import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import type { LanguageCode } from './languages';
import { speak, transcribe } from './voice';
import { speechChunks } from './speech-text';

type SpeechAccess = {
  read: (text: string, language: LanguageCode) => void;
  stop: () => void;
  active: boolean;
  loading: boolean;
  error: string | null;
  dictating: boolean;
  beginDictation: () => boolean;
  endDictation: () => void;
  isDictating: () => boolean;
  registerAudioStop: (stop: () => void) => () => void;
};
const SpeechContext = createContext<SpeechAccess | null>(null);
export const useSpeechAccess = () => useContext(SpeechContext);
const noSubscribe = () => () => {};

export function SpeechProvider({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(noSubscribe, () => true, () => false);
  return ready ? <SpeechRuntime>{children}</SpeechRuntime> : children;
}

function SpeechRuntime({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(null);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dictating, setDictating] = useState(false);
  const dictationLock = useRef(false);
  const audioStops = useRef(new Set<() => void>());
  const isDictating = useCallback(() => dictationLock.current, []);
  const registerAudioStop = useCallback((handler: () => void) => { audioStops.current.add(handler); return () => { audioStops.current.delete(handler); }; }, []);
  const generation = useRef(0);
  const running = useRef(false);
  const loadingChunk = useRef(false);
  const queue = useRef<string[]>([]);
  const languageRef = useRef<LanguageCode>('en-IN');

  const playNext = useCallback(async (request: number) => {
    const text = queue.current.shift();
    if (!text) { running.current = false; setActive(false); return; }
    loadingChunk.current = true;
    setLoading(true);
    try {
      const uri = await speak(text, languageRef.current);
      if (request !== generation.current) return;
      if (Platform.OS !== 'web') await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (request !== generation.current) return;
      player.replace({ uri });
      player.play();
    } catch (reason) {
      if (request !== generation.current) return;
      queue.current = [];
      running.current = false;
      setActive(false);
      setError(reason instanceof Error ? reason.message : 'Could not read this aloud.');
    } finally {
      if (request === generation.current) { loadingChunk.current = false; setLoading(false); }
    }
  }, [player]);

  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', status => {
      if (!running.current) return;
      if (status.error) {
        generation.current += 1;
        running.current = false;
        loadingChunk.current = false;
        queue.current = [];
        setActive(false);
        setLoading(false);
        setError('Audio could not play. Tap Listen to try again and check your device sound.');
      } else if (status.didJustFinish && !loadingChunk.current) void playNext(generation.current);
    });
    return () => { generation.current += 1; subscription.remove(); };
  }, [player, playNext]);

  const stop = useCallback(() => {
    audioStops.current.forEach(handler => { try { handler(); } catch {} });
    generation.current += 1;
    running.current = false;
    loadingChunk.current = false;
    queue.current = [];
    player.pause();
    setActive(false);
    setLoading(false);
    setError(null);
  }, [player]);

  const read = useCallback((text: string, language: LanguageCode) => {
    if (dictationLock.current) return;
    stop();
    queue.current = speechChunks(text);
    running.current = queue.current.length > 0;
    languageRef.current = language;
    setActive(queue.current.length > 0);
    void playNext(generation.current);
  }, [stop, playNext]);

  const beginDictation = useCallback(() => {
    if (dictationLock.current) return false;
    dictationLock.current = true;
    setDictating(true);
    stop();
    return true;
  }, [stop]);
  const endDictation = useCallback(() => { dictationLock.current = false; setDictating(false); }, []);

  return <SpeechContext.Provider value={{ read, stop, active, loading, error, dictating, beginDictation, endDictation, isDictating, registerAudioStop }}>{children}</SpeechContext.Provider>;
}

export function ListenControl({ text, language }: { text: string; language: LanguageCode }) {
  const speech = useSpeechAccess();
  if (!speech || !text.trim()) return null;
  return <View>
    <Pressable disabled={speech.dictating} accessibilityRole="button" accessibilityLabel={speech.active ? 'Stop reading aloud' : 'Listen to this dialog'}
      onPress={() => speech.active ? speech.stop() : speech.read(text, language)} style={styles.listen}>
      {speech.loading ? <ActivityIndicator color="#247447" /> : <MaterialCommunityIcons name={speech.active ? 'stop-circle-outline' : 'volume-high'} size={20} color="#247447" />}
      <Text style={styles.label}>{speech.active ? 'Stop reading' : 'Listen'}</Text>
    </Pressable>
    {speech.error ? <Text accessibilityRole="alert" style={styles.error}>{speech.error}</Text> : null}
  </View>;
}

export function VoiceHint() {
  const speech = useSpeechAccess();
  const [expanded, setExpanded] = useState(false);
  if (!speech) return null;
  return <View style={styles.hint}>
    <Pressable accessibilityRole="button" accessibilityLabel="Show voice help" accessibilityState={{ expanded }} onPress={() => setExpanded(current => !current)} style={styles.helpButton}>
      <MaterialCommunityIcons name="microphone-outline" size={17} color="#246b47" />
      <Text style={styles.label}>Voice controls</Text>
      <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#627266" />
    </Pressable>
    {speech.active ? <Pressable accessibilityRole="button" accessibilityLabel="Stop reading aloud" onPress={speech.stop} style={styles.listen}><Text style={styles.label}>Stop reading</Text></Pressable> : null}
    {expanded ? <Text style={{ color: '#627266', width: '100%', fontSize: 13, lineHeight: 20, paddingHorizontal: 10 }}>Tap a field’s mic to speak. Hold text (right-click on web) to hear it in your app language.</Text> : null}
    {speech.error ? <Text accessibilityRole="alert" style={styles.error}>{speech.error}</Text> : null}
  </View>;
}

// Mount a recorder only for the field currently being dictated, including inside a Modal.
export function DictationSession({ language, onText, onClose }: { language: LanguageCode; onText: (text: string) => void; onClose: () => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const speech = useSpeechAccess();
  const [phase, setPhase] = useState<'preparing' | 'recording' | 'transcribing' | 'error'>('preparing');
  const [error, setError] = useState('');
  const finish = useRef<() => void>(() => {});
  // Freeze the target field for this session; a transcript never moves to another field.
  const [target] = useState(() => ({ language, onText, onClose, begin: speech?.beginDictation, end: speech?.endDictation }));

  useEffect(() => {
    let cancelled = false;
    let recording = false;
    let finishing = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const resetAudio = async () => {
      if (Platform.OS !== 'web') await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
    const fail = (reason: unknown) => {
      if (!cancelled) { setPhase('error'); setError(reason instanceof Error ? reason.message : 'Voice input failed. Please try again.'); }
    };
    const acquired = target.begin?.() ?? true;
    if (!acquired) {
      fail(new Error('Finish or cancel the other recording first.'));
      return;
    }
    finish.current = () => {
      if (finishing || !recording || cancelled) return;
      finishing = true;
      clearTimeout(timer);
      setPhase('transcribing');
      void (async () => {
        try {
          await recorder.stop();
          recording = false;
          await resetAudio();
          if (cancelled) return;
          if (!recorder.uri) throw new Error('The recording could not be saved. Please try again.');
          const { transcript } = await transcribe(recorder.uri, target.language);
          if (cancelled) return;
          if (!transcript.trim()) throw new Error('No words were heard. Please try again.');
          target.onText(transcript);
          target.onClose();
        } catch (reason) { fail(reason); }
      })();
    };
    void (async () => {
      try {
        if (Platform.OS === 'web' && (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)) throw new Error('Microphone input needs HTTPS or localhost.');
        const permission = await requestRecordingPermissionsAsync();
        if (cancelled) return;
        if (!permission.granted) throw new Error('Allow microphone access in your device or browser settings, or type instead.');
        if (Platform.OS !== 'web') await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        if (cancelled) { await resetAudio(); return; }
        await recorder.prepareToRecordAsync();
        if (cancelled) { await resetAudio(); return; }
        recorder.record();
        recording = true;
        setPhase('recording');
        timer = setTimeout(() => finish.current(), 30_000);
      } catch (reason) { await resetAudio(); fail(reason); }
    })();
    return () => {
      cancelled = true;
      target.end?.();
      clearTimeout(timer);
      if (recording && !finishing) void recorder.stop().catch(() => {}).finally(resetAudio);
      else void resetAudio();
    };
  }, [recorder, target]);

  return <View style={styles.session}>
    <Text accessibilityLiveRegion="polite" style={styles.label}>{phase === 'recording' ? `Listening… ${Math.floor(state.durationMillis / 1000)}s / 30s` : phase === 'preparing' ? 'Opening microphone…' : phase === 'transcribing' ? 'Understanding your voice…' : error}</Text>
    <View style={styles.actions}>
      {phase === 'recording' ? <Pressable accessibilityRole="button" onPress={() => finish.current()} style={styles.listen}><Text style={styles.label}>Stop and use text</Text></Pressable> : null}
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.listen}><Text style={styles.label}>{phase === 'error' ? 'Close' : 'Cancel'}</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  hint: { gap: 6, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingBottom: 2 },
  helpButton: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#eaf2e8', borderWidth: 1, borderColor: '#dbe6d6' },
  listen: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, paddingHorizontal: 10, alignSelf: 'flex-start' },
  label: { color: '#155936', fontSize: 13, fontWeight: '600' },
  error: { color: '#c44e42', fontSize: 12, padding: 8 },
  session: { backgroundColor: '#e7f2e9', borderRadius: 10, padding: 10, gap: 5, width: '100%' },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
});
