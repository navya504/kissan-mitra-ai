import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { C, S, Card, Divider, Icon, Tag } from './ui';
import { detectLanguage, LanguageCode, languages } from './languages';
import { askAssistant, ChatMessage, speak, transcribe } from './voice';
import { useFarmProfile } from './farm-profile';

const MAX_RECORDING_SECONDS = 30; // Sarvam's quick speech-to-text limit

const greeting: ChatMessage = {
  from: 'ai', language: 'en-IN',
  text: 'Namaste! Ask me anything about your farm. Type your question, or tap the mic and speak in your own language.',
};

const suggestions: [string, string][] = [
  ['🌱', 'Suggest fertilizers for paddy'],
  ['💧', 'వరికి నీరు ఎప్పుడు పెట్టాలి?'],
  ['🐛', 'धान में तना छेदक से कैसे बचाएं?'],
];

type Status = 'idle' | 'recording' | 'transcribing' | 'thinking';

// expo-audio needs the browser's Audio object, which doesn't exist during server rendering on web.
const noSubscribe = () => () => {};

export function Assistant() {
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false); // false only while server rendering
  if (!inBrowser) return <Card style={{ minHeight: 500, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.green} /></Card>;
  return <AssistantChat />;
}

function AssistantChat() {
  const { profile } = useFarmProfile();
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [loadingAudio, setLoadingAudio] = useState<number | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCache = useRef(new Map<number, string>()); // message index -> audio, so replays aren't billed again

  useEffect(() => () => { if (stopTimer.current) clearTimeout(stopTimer.current); }, []);

  const busy = status !== 'idle';

  const play = async (index: number, message: ChatMessage) => {
    if (playing === index && playerStatus.playing) { player.pause(); return; }
    try {
      setLoadingAudio(index);
      let uri = audioCache.current.get(index);
      if (!uri) { uri = await speak(message.text, message.language); audioCache.current.set(index, uri); }
      player.replace({ uri });
      player.play();
      setPlaying(index);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not play the answer.');
    } finally {
      setLoadingAudio(null);
    }
  };

  const send = async (text: string, language: LanguageCode, spoken = false) => {
    const clean = text.trim();
    if (!clean) return; // buttons are disabled while busy; voice calls this mid-flow, so no status check here
    const next = [...messages, { from: 'farmer' as const, text: clean, language, spoken }];
    setMessages(next);
    setDraft('');
    setError(null);
    setStatus('thinking');
    try {
      const reply: ChatMessage = { from: 'ai', text: await askAssistant(next, language, profile.name), language };
      setMessages([...next, reply]);
      if (spoken) play(next.length, reply); // answer aloud when the farmer spoke the question
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setStatus('idle');
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
      if (Platform.OS !== 'web') {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) { setError('Microphone access is needed to ask by voice. You can allow it in your phone settings, or type your question.'); return; }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      }
      player.pause();
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStatus('recording');
      stopTimer.current = setTimeout(stopRecording, MAX_RECORDING_SECONDS * 1000);
    } catch {
      setStatus('idle');
      setError('Could not start the microphone. Please check that the app is allowed to use it.');
    }
  };

  async function stopRecording() {
    if (stopTimer.current) { clearTimeout(stopTimer.current); stopTimer.current = null; }
    setStatus('transcribing');
    try {
      await recorder.stop();
      if (Platform.OS !== 'web') await setAudioModeAsync({ allowsRecording: false }); // play replies through the speaker
      if (!recorder.uri) throw new Error('The recording could not be saved. Please try again.');
      const { transcript, language } = await transcribe(recorder.uri);
      await send(transcript, language ?? detectLanguage(transcript), true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not understand the recording. Please try again.');
      setStatus('idle');
    }
  }

  const seconds = Math.floor((recorderState.durationMillis || 0) / 1000);

  return <View style={styles.stack}>
    <Card style={{ minHeight: 500 }}>
      <View style={styles.header}>
        <View style={styles.avatar}><Icon name="sprout" color={C.white} size={23} /></View>
        <View><Text style={styles.itemTitle}>Kisaan Mitra</Text><Text style={S.muted}>Your farming assistant · Speaks your language</Text></View>
        <View style={{ flex: 1 }} /><Tag>ONLINE</Tag>
      </View>
      <Divider />

      <View style={{ gap: 13 }}>
        {messages.map((m, i) => m.from === 'farmer'
          ? <View key={i} style={[styles.bubble, styles.farmer]}>
              <Text style={[S.body, { color: C.white }]}>{m.text}</Text>
              {m.spoken ? <Text style={styles.farmerMeta}>🎤 {languages[m.language].native}</Text> : null}
            </View>
          : <View key={i} style={[styles.bubble, styles.ai]}>
              <Text style={S.body}>{m.text}</Text>
              <Pressable onPress={() => play(i, m)} style={styles.listen} disabled={loadingAudio !== null}>
                {loadingAudio === i ? <ActivityIndicator size="small" color={C.green} /> : <Icon name={playing === i && playerStatus.playing ? 'pause-circle' : 'volume-high'} size={17} />}
                <Text style={styles.listenText}>{playing === i && playerStatus.playing ? 'Pause' : 'Listen'} · {languages[m.language].native}</Text>
              </Pressable>
            </View>)}
        {status === 'transcribing' ? <View style={[styles.bubble, styles.farmer, styles.pending]}><ActivityIndicator size="small" color={C.white} /><Text style={[S.body, { color: C.white }]}>Understanding your voice…</Text></View> : null}
        {status === 'thinking' ? <View style={[styles.bubble, styles.ai, styles.pending]}><ActivityIndicator size="small" color={C.green} /><Text style={S.body}>Thinking…</Text></View> : null}
      </View>

      {error ? <View style={styles.error}><Icon name="alert-circle-outline" color={C.red} size={18} /><Text style={[S.body, { flex: 1 }]}>{error}</Text></View> : null}

      <Text style={[styles.label, { marginTop: 17 }]}>Suggested questions</Text>
      <View style={styles.chips}>{suggestions.map(([icon, q]) => <Pressable key={q} onPress={() => send(q, detectLanguage(q))} disabled={busy} style={styles.chip}><Text style={{ fontSize: 12, color: C.greenDark }}>{icon}  {q}</Text></Pressable>)}</View>

      <View style={styles.composer}>
        <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={() => !busy && send(draft, detectLanguage(draft))} editable={!busy} placeholder="Type your question in any language..." style={styles.input} />
        <Pressable onPress={() => send(draft, detectLanguage(draft))} disabled={busy} style={[styles.send, busy && { opacity: 0.5 }]}><Icon name="arrow-up" size={20} color={C.white} /></Pressable>
      </View>

      <Pressable
        onPress={status === 'recording' ? stopRecording : startRecording}
        disabled={status === 'transcribing' || status === 'thinking'}
        style={[styles.mic, status === 'recording' && styles.micRecording, (status === 'transcribing' || status === 'thinking') && { opacity: 0.5 }]}>
        <Icon name={status === 'recording' ? 'stop' : 'microphone'} size={24} color={C.white} />
        <View>
          <Text style={styles.micTitle}>{status === 'recording' ? `Listening… ${seconds}s · tap to stop` : 'Tap to speak'}</Text>
          <Text style={styles.micSub}>{status === 'recording' ? `Up to ${MAX_RECORDING_SECONDS} seconds` : 'हिन्दी · తెలుగు · தமிழ் · ಕನ್ನಡ · मराठी · বাংলা · English…'}</Text>
        </View>
      </Pressable>
    </Card>
    <Text style={S.muted}>AI answers can be wrong. Check important crop decisions with a qualified local expert.</Text>
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: 15 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 41, height: 41, borderRadius: 14, backgroundColor: C.green, justifyContent: 'center', alignItems: 'center' },
  itemTitle: { color: C.ink, fontSize: 13, fontWeight: '800' },
  bubble: { padding: 12, borderRadius: 15, maxWidth: '88%' },
  farmer: { backgroundColor: C.green, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  farmerMeta: { color: '#d6ead9', fontSize: 11, marginTop: 5, alignSelf: 'flex-end' },
  ai: { backgroundColor: '#f1f4ee', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9, alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 9, borderRadius: 12, backgroundColor: C.white },
  listenText: { color: C.greenDark, fontSize: 12, fontWeight: '700' },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: C.redSoft, padding: 11, borderRadius: 12, marginTop: 14 },
  label: { color: C.muted, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 7 },
  chip: { borderRadius: 18, borderWidth: 1, borderColor: '#dce8d8', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#f7faf5' },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15 },
  input: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: C.border, borderRadius: 13, paddingHorizontal: 12, backgroundColor: '#fbfcf9', outlineStyle: 'none' as any },
  send: { width: 43, height: 43, backgroundColor: C.green, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  mic: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, alignSelf: 'stretch', minHeight: 62, borderRadius: 31, backgroundColor: C.green, paddingHorizontal: 20, marginTop: 16 },
  micRecording: { backgroundColor: C.red },
  micTitle: { color: C.white, fontWeight: '800', fontSize: 15 },
  micSub: { color: '#d6ead9', fontSize: 11, marginTop: 2 },
});
