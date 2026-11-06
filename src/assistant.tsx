import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { C, S, Card, Divider, Icon, Tag } from './ui';
import { detectLanguage, LanguageCode, languages } from './languages';
import { askAssistant, ChatMessage, speak, transcribe } from './voice';
import { useFarmProfile } from './farm-profile';
import { useSpeechAccess } from './speech-access';
import { emptyProfitInputs, ProfitPlanner, ProfitPlanView } from './components/ProfitPlanner';
import { useLanguage } from './i18n';
import { appSpeechLanguages } from './speech-text';
import { VoiceAction } from './voice-command-context';

const MAX_RECORDING_SECONDS = 30; // Sarvam's quick speech-to-text limit

const greeting: ChatMessage = {
  from: 'ai', language: 'en-IN',
  text: 'Namaste! Ask me anything about your farm. Type your question, or tap the mic and speak in your own language.',
};

const suggestions: [string, string][] = [
  ['₹', 'How much profit can I make? Show my top 2 profit routes and checklists.'],
  ['🌱', 'Suggest fertilizers for paddy'],
  ['💧', 'వరికి నీరు ఎప్పుడు పెట్టాలి?'],
  ['🐛', 'धान में तना छेदक से कैसे बचाएं?'],
];

type Status = 'idle' | 'preparing' | 'recording' | 'transcribing' | 'thinking';

// expo-audio needs the browser's Audio object, which doesn't exist during server rendering on web.
const noSubscribe = () => () => {};

export function Assistant({ initialProfitPlanning = false }: { initialProfitPlanning?: boolean }) {
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false); // false only while server rendering
  if (!inBrowser) return <Card style={{ minHeight: 500, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.green} /></Card>;
  return <AssistantChat initialProfitPlanning={initialProfitPlanning} />;
}

function AssistantChat({ initialProfitPlanning }: { initialProfitPlanning: boolean }) {
  const { profile } = useFarmProfile();
  const speech = useSpeechAccess();
  const { language: appLanguage } = useLanguage();
  const [profitInputs, setProfitInputs] = useState(emptyProfitInputs);
  const [showProfitPlanner, setShowProfitPlanner] = useState(initialProfitPlanning);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [loadingAudio, setLoadingAudio] = useState<number | null>(null);
  const [voiceLanguage, setVoiceLanguage] = useState<LanguageCode | 'auto'>('auto');
  const [readAloud, setReadAloud] = useState(true);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCache = useRef(new Map<number, string>()); // message index -> audio, so replays aren't billed again
  const recordingPhase = useRef<'idle' | 'preparing' | 'recording' | 'stopping'>('idle');
  const playbackRequest = useRef(0);
  const mounted = useRef(true);
  const readAloudRef = useRef(readAloud);
  const ownsRecordingLock = useRef(false);
  const endDictation = speech?.endDictation;
  const registerAudioStop = speech?.registerAudioStop;

  useEffect(() => registerAudioStop?.(() => {
    playbackRequest.current += 1;
    player.pause();
    setLoadingAudio(null);
  }), [registerAudioStop, player]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      playbackRequest.current += 1;
      if (stopTimer.current) clearTimeout(stopTimer.current);
      if (ownsRecordingLock.current) { ownsRecordingLock.current = false; endDictation?.(); }
      // The Expo hooks release recorder/player resources when this screen unmounts.
      if (Platform.OS !== 'web') void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
  }, [endDictation]);

  const busy = status !== 'idle';

  const play = async (index: number, message: ChatMessage) => {
    if (speech?.isDictating()) return;
    if (playing === index && playerStatus.playing) { player.pause(); return; }
    speech?.stop();
    const request = ++playbackRequest.current;
    try {
      setError(null);
      player.pause();
      setLoadingAudio(index);
      let uri = audioCache.current.get(index);
      if (!uri) { uri = await speak(message.text, message.language); audioCache.current.set(index, uri); }
      if (!mounted.current || request !== playbackRequest.current) return;
      if (Platform.OS !== 'web') await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!mounted.current || request !== playbackRequest.current) return;
      player.replace({ uri });
      player.play();
      setPlaying(index);
    } catch (e) {
      if (mounted.current && request === playbackRequest.current) setError(e instanceof Error ? e.message : 'Could not play the answer.');
    } finally {
      if (mounted.current && request === playbackRequest.current) setLoadingAudio(null);
    }
  };

  const send = async (text: string, language: LanguageCode, spoken = false, requestProfit = false) => {
    const clean = text.trim();
    if (!clean) return; // buttons are disabled while busy; voice calls this mid-flow, so no status check here
    playbackRequest.current += 1;
    player.pause();
    setLoadingAudio(null);
    const next = [...messages, { from: 'farmer' as const, text: clean, language, spoken }];
    setMessages(next);
    setDraft('');
    setError(null);
    setStatus('thinking');
    try {
      const answer = await askAssistant(next, language, profile.name, { profile, profitInputs, requestProfit });
      const reply: ChatMessage = { from: 'ai', text: answer.reply, language, profitPlan: answer.profitPlan };
      if (!mounted.current) return;
      if (answer.profitRequested) setShowProfitPlanner(true);
      setMessages([...next, reply]);
      if (readAloudRef.current) void play(next.length, reply);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      if (mounted.current) setStatus('idle');
    }
  };

  const startRecording = async () => {
    if (recordingPhase.current !== 'idle') return;
    if (speech && !speech.beginDictation()) { setError('Finish or cancel the other recording first.'); return; }
    ownsRecordingLock.current = Boolean(speech);
    recordingPhase.current = 'preparing';
    setStatus('preparing');
    setError(null);
    speech?.stop();
    try {
      if (Platform.OS === 'web' && (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)) {
        throw new Error('Voice needs a secure browser connection. Open the app over HTTPS, or use localhost on this computer.');
      }
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error('Microphone access is needed to ask by voice. Allow it in your device or browser settings, or type your question.');
      if (!mounted.current) return;
      playbackRequest.current += 1;
      setLoadingAudio(null);
      player.pause();
      if (Platform.OS !== 'web') await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (!mounted.current) return;
      recorder.record();
      recordingPhase.current = 'recording';
      setStatus('recording');
      stopTimer.current = setTimeout(() => { void stopRecording(); }, MAX_RECORDING_SECONDS * 1000);
    } catch (e) {
      recordingPhase.current = 'idle';
      if (ownsRecordingLock.current) { ownsRecordingLock.current = false; endDictation?.(); }
      if (Platform.OS !== 'web') await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (!mounted.current) return;
      setStatus('idle');
      setError(e instanceof Error ? e.message : 'Could not start the microphone. Please check that the app is allowed to use it.');
    }
  };

  async function stopRecording(cancel = false) {
    if (recordingPhase.current !== 'recording') return;
    recordingPhase.current = 'stopping';
    if (stopTimer.current) { clearTimeout(stopTimer.current); stopTimer.current = null; }
    setStatus('transcribing');
    try {
      await recorder.stop();
      if (ownsRecordingLock.current) { ownsRecordingLock.current = false; endDictation?.(); }
      if (Platform.OS !== 'web') await setAudioModeAsync({ allowsRecording: false }); // play replies through the speaker
      if (!mounted.current) return;
      if (cancel) { setStatus('idle'); return; }
      if (!recorder.uri) throw new Error('The recording could not be saved. Please try again.');
      const { transcript, language } = await transcribe(recorder.uri, voiceLanguage === 'auto' ? undefined : voiceLanguage);
      if (!mounted.current) return;
      if (!transcript.trim()) throw new Error('We could not hear any words. Please try again.');
      await send(transcript, language ?? detectLanguage(transcript), true);
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : 'Could not understand the recording. Please try again.');
      setStatus('idle');
    } finally {
      recordingPhase.current = 'idle';
      if (ownsRecordingLock.current) { ownsRecordingLock.current = false; endDictation?.(); }
      if (Platform.OS !== 'web') await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  }

  const seconds = Math.floor((recorderState.durationMillis || 0) / 1000);

  return <View style={styles.stack}>
    <Card style={{ minHeight: 500 }}>
      <View style={styles.header}>
        <View style={styles.avatar}><Icon name="sprout" color={C.white} size={23} /></View>
        <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.itemTitle}>Your farm copilot</Text><Text style={S.muted}>A little guidance, in your language.</Text></View>
        <Tag>AI</Tag>
      </View>
      <Divider />

      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showVoiceSettings }} onPress={() => setShowVoiceSettings(current => !current)} style={styles.preferencesButton}>
        <Icon name="tune-variant" size={19} /><Text style={styles.listenText}>Voice preferences · {voiceLanguage === 'auto' ? 'Auto detect' : languages[voiceLanguage].native}</Text><Icon name={showVoiceSettings ? 'chevron-up' : 'chevron-down'} size={18} />
      </Pressable>
      {showVoiceSettings ? <View style={styles.voiceSettings}>
        <View style={styles.voiceToggle}>
          <View style={{ flex: 1 }}><Text style={styles.itemTitle}>Read answers aloud</Text><Text style={S.muted}>Hear replies to spoken and typed questions</Text></View>
          <Switch value={readAloud} accessibilityLabel="Read answers aloud" onValueChange={value => {
            setReadAloud(value);
            readAloudRef.current = value;
            if (!value) { playbackRequest.current += 1; player.pause(); setLoadingAudio(null); }
          }} trackColor={{ true: C.green }} />
        </View>
        <Text style={styles.label}>Voice language</Text>
        <View style={styles.chips}>
          {(['auto', ...Object.keys(languages)] as (LanguageCode | 'auto')[]).map(code => <Pressable
            key={code} accessibilityRole="radio" accessibilityState={{ checked: voiceLanguage === code, disabled: busy }}
            accessibilityLabel={code === 'auto' ? 'Detect language automatically' : languages[code].name}
            disabled={busy} onPress={() => setVoiceLanguage(code)}
            style={[styles.chip, voiceLanguage === code && styles.selectedLanguage]}>
            <Text style={{ color: voiceLanguage === code ? C.white : C.greenDark, fontSize: 12 }}>{code === 'auto' ? 'Auto detect' : languages[code].native}</Text>
          </Pressable>)}
        </View>
        <Text style={S.muted}>Choose your language if automatic detection gets it wrong.</Text>
      </View> : null}

      <View style={{ gap: 13 }}>
        {messages.map((m, i) => m.from === 'farmer'
          ? <View key={i} style={[styles.bubble, styles.farmer]}>
              <Text style={[S.body, { color: C.white }]}>{m.text}</Text>
              {m.spoken ? <Text style={styles.farmerMeta}>🎤 {languages[m.language].native}</Text> : null}
            </View>
          : <View key={i} style={[styles.bubble, styles.ai, m.profitPlan && { maxWidth: '100%', width: '100%' }]}>
              <Text style={S.body}>{m.text}</Text>
              {m.profitPlan ? <ProfitPlanView plan={m.profitPlan} replyLanguage={m.language} /> : null}
              <Pressable accessibilityRole="button" accessibilityLabel={`${playing === i && playerStatus.playing ? 'Pause' : 'Listen to'} answer in ${languages[m.language].name}`} onPress={() => play(i, m)} style={styles.listen} disabled={loadingAudio !== null || busy}>
                {loadingAudio === i ? <ActivityIndicator size="small" color={C.green} /> : <Icon name={playing === i && playerStatus.playing ? 'pause-circle' : 'volume-high'} size={17} />}
                <Text style={styles.listenText}>{playing === i && playerStatus.playing ? 'Pause' : 'Listen'} · {languages[m.language].native}</Text>
              </Pressable>
            </View>)}
        {status === 'transcribing' ? <View style={[styles.bubble, styles.farmer, styles.pending]}><ActivityIndicator size="small" color={C.white} /><Text style={[S.body, { color: C.white }]}>Understanding your voice…</Text></View> : null}
        {status === 'thinking' ? <View style={[styles.bubble, styles.ai, styles.pending]}><ActivityIndicator size="small" color={C.green} /><Text style={S.body}>Thinking…</Text></View> : null}
      </View>

      {error ? <View style={styles.error}><Icon name="alert-circle-outline" color={C.red} size={18} /><Text style={[S.body, { flex: 1 }]}>{error}</Text></View> : null}

      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showProfitPlanner }} onPress={() => setShowProfitPlanner(current => !current)} style={styles.profitEntry}>
        <View style={styles.profitEntryIcon}><Icon name="chart-line" size={24} color={C.greenDark} /></View>
        <View style={{ flex: 1 }}><Text style={styles.itemTitle}>Make the most of your harvest</Text><Text style={S.muted}>{showProfitPlanner ? 'Your profit planning details' : 'Compare profit routes with AI'}</Text></View>
        <Icon name={showProfitPlanner ? 'chevron-up' : 'arrow-right'} size={20} />
      </Pressable>
      {showProfitPlanner ? <ProfitPlanner value={profitInputs} onChange={setProfitInputs} busy={busy} crop={profile.crop} location={`${profile.district}, ${profile.state}`}
        onCompare={() => void send('Compare my current farm options. Show the top one or two estimated profit routes with their checklists.', voiceLanguage === 'auto' ? appSpeechLanguages[appLanguage] : voiceLanguage, false, true)} /> : null}

      <Text style={[styles.label, { marginTop: 17 }]}>Suggested questions</Text>
      <View style={styles.chips}>{suggestions.map(([icon, q]) => <Pressable key={q} onPress={() => send(q, detectLanguage(q))} disabled={busy} style={styles.chip}><Text style={{ fontSize: 12, color: C.greenDark }}>{icon}  {q}</Text></Pressable>)}</View>

      <View style={styles.composer}>
        <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={() => !busy && send(draft, detectLanguage(draft))} editable={!busy} placeholder="Type your question in any language..." style={styles.input} />
        <VoiceAction label="Send question" kind="submit" preview={draft} accessibilityRole="button" accessibilityLabel="Send question" onPress={() => { void send(draft, detectLanguage(draft)); }} disabled={busy || !draft.trim()} style={[styles.send, (busy || !draft.trim()) && { opacity: 0.5 }]}><Icon name="arrow-up" size={20} color={C.white} /></VoiceAction>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status === 'recording' ? 'Stop recording and send question' : 'Ask a question by voice'}
        onPress={() => status === 'recording' ? stopRecording() : startRecording()}
        disabled={(busy || speech?.dictating) && status !== 'recording'}
        style={[styles.mic, status === 'recording' && styles.micRecording, busy && status !== 'recording' && { opacity: 0.5 }]}>
        <Icon name={status === 'recording' ? 'stop' : 'microphone'} size={24} color={C.white} />
        <View style={{ flex: 1 }}>
          <Text style={styles.micTitle}>{status === 'preparing' ? 'Opening microphone…' : status === 'recording' ? `Listening… ${seconds}s · tap to stop` : 'Tap to speak'}</Text>
          <Text style={styles.micSub}>{status === 'recording' ? `Up to ${MAX_RECORDING_SECONDS} seconds` : 'हिन्दी · తెలుగు · தமிழ் · ಕನ್ನಡ · मराठी · বাংলা · English…'}</Text>
        </View>
      </Pressable>
      {status === 'recording' ? <Pressable accessibilityRole="button" accessibilityLabel="Cancel recording without sending" onPress={() => stopRecording(true)} style={styles.cancelRecording}><Text style={styles.listenText}>Cancel recording</Text></Pressable> : null}
    </Card>
    <Text style={S.muted}>AI answers can be wrong. Check important crop decisions with a qualified local expert.</Text>
  </View>;
}

const styles = StyleSheet.create({
  preferencesButton: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', backgroundColor: '#f3f5ef', borderRadius: 14, minHeight: 46, padding: 11, marginBottom: 18 },
  profitEntry: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f6f9f3', borderWidth: 1, borderColor: C.border, padding: 13, borderRadius: 14, marginTop: 16 },
  profitEntryIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center' },
  stack: { gap: 15 },
  voiceSettings: { gap: 10, marginBottom: 22, padding: 14, borderWidth: 1, borderColor: C.border, borderRadius: 18 },
  voiceToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  selectedLanguage: { backgroundColor: C.green, borderColor: C.green },
  cancelRecording: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 41, height: 41, borderRadius: 14, backgroundColor: C.green, justifyContent: 'center', alignItems: 'center' },
  itemTitle: { color: C.ink, fontSize: 15, lineHeight: 22, fontWeight: '800' },
  bubble: { padding: 13, borderRadius: 16, maxWidth: '94%' },
  farmer: { backgroundColor: C.green, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  farmerMeta: { color: '#d6ead9', fontSize: 11, marginTop: 5, alignSelf: 'flex-end' },
  ai: { backgroundColor: '#f0f3eb', alignSelf: 'flex-start', borderBottomLeftRadius: 6, borderWidth: 1, borderColor: '#e3e9dd' },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9, alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 9, borderRadius: 12, backgroundColor: C.white },
  listenText: { color: C.greenDark, fontSize: 12, fontWeight: '700' },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: C.redSoft, padding: 11, borderRadius: 12, marginTop: 14 },
  label: { color: C.muted, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 },
  chip: { borderRadius: 14, borderWidth: 1, borderColor: '#dce8d8', paddingHorizontal: 12, paddingVertical: 11, minHeight: 44, backgroundColor: '#f7faf5' },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15 },
  input: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: C.border, borderRadius: 13, paddingHorizontal: 12, backgroundColor: '#fbfcf9', outlineStyle: 'none' as any },
  send: { width: 43, height: 43, backgroundColor: C.green, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  mic: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, alignSelf: 'stretch', minHeight: 62, borderRadius: 20, backgroundColor: C.green, paddingHorizontal: 20, paddingVertical: 12, marginTop: 16 },
  micRecording: { backgroundColor: C.red },
  micTitle: { color: C.white, fontWeight: '800', fontSize: 15 },
  micSub: { color: '#d6ead9', fontSize: 11, marginTop: 2 },
});
