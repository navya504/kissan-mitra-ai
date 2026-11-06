import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from './i18n';
import { appSpeechLanguages } from './speech-text';
import { DictationSession, useSpeechAccess } from './speech-access';
import { useVoiceCommands, useVoiceCommandScope } from './voice-command-context';

const noSubscribe = () => () => {};
const zero = () => 0;

export function VoiceCommandBar({ compact = false }: { compact?: boolean }) {
  const registry = useVoiceCommands();
  const scope = useVoiceCommandScope();
  const speech = useSpeechAccess();
  const { language } = useLanguage();
  useSyncExternalStore(registry?.subscribe ?? noSubscribe, registry?.snapshot ?? zero, zero);
  const [expanded, setExpanded] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordEpoch, setRecordEpoch] = useState(0);
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState('');
  const recordingCurrent = recording && recordEpoch === registry?.scopeEpoch();
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = async (text: string, epoch = registry?.scopeEpoch()) => {
    if (!registry || !text.trim()) return;
    const result = await registry.execute(text, epoch);
    if (!alive.current) return;
    setFeedback(`Heard: “${text.trim()}”. ${result.message}`);
    setDraft('');
    if (result.navigate) { speech?.stop(); router.push(result.navigate as never); }
    if (result.back) {
      if (router.canGoBack()) router.back();
      else setFeedback('You are already at the first screen. Say open home to go to the dashboard.');
    }
  };
  if (!registry || !speech || registry.currentScope().id !== scope) return null;
  const pending = registry.pending;
  return <View style={[styles.container, compact && styles.compact]}>
    <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: compact ? 290 : 440 }} contentContainerStyle={{ gap: 10 }}>
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="Speak an app command" disabled={speech.dictating || recordingCurrent}
        style={[styles.mic, speech.dictating && { opacity: 0.5 }]} onPress={() => { setExpanded(true); setRecordEpoch(registry.scopeEpoch()); setRecording(true); }}>
        <MaterialCommunityIcons name="microphone" size={18} color="#fffefa" /><Text style={styles.micText}>Speak a command</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Show command help" accessibilityState={{ expanded }} style={styles.help} onPress={() => setExpanded(current => !current)}>
        <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'help-circle-outline'} size={22} color="#246b47" />
      </Pressable>
    </View>
    {recordingCurrent ? <DictationSession key={`${scope}-${recordEpoch}`} language={appSpeechLanguages[language]} onText={text => { void run(text, recordEpoch); }} onClose={() => setRecording(false)} /> : null}
    {pending ? <View style={styles.pending}>
      <Text style={styles.title}>Confirm: {pending.action.label}</Text>
      {pending.action.preview ? <Text style={styles.text}>{pending.action.preview}</Text> : null}
      <Text style={styles.text}>Review the form. Say “confirm” to proceed or “cancel”. Editing the form invalidates this confirmation.</Text>
      <View style={styles.row}><Pressable accessibilityRole="button" style={styles.help} onPress={() => { void run('confirm'); }}><Text style={styles.title}>Confirm action</Text></Pressable><Pressable accessibilityRole="button" style={styles.help} onPress={() => { void run('cancel'); }}><Text style={styles.title}>Cancel</Text></Pressable></View>
    </View> : null}
    {feedback ? <Text accessibilityLiveRegion="polite" style={styles.text}>{feedback}</Text> : null}
    {expanded ? <View style={{ gap: 8 }}>
      <Text style={styles.text}>Say “open weather”, “open profit planner”, “go back”, “close dialog”, “select first”, or a visible option/button name. “Submit” always needs a separate “confirm”. Commands support English and common Hindi, Telugu and Tamil phrases.</Text>
      <Text style={styles.text}>Current choices: {registry.available().filter(action => action.kind === 'select').slice(0, 8).map((action, index) => `${index + 1}. ${action.label}`).join(' · ') || 'Use a visible button name or open another screen.'}</Text>
      <View style={styles.row}><TextInput accessibilityLabel="Type an app command" value={draft} onChangeText={setDraft} placeholder="Or type a command to test" onSubmitEditing={() => { if (!recordingCurrent) void run(draft); }} style={styles.input} />
        <Pressable accessibilityRole="button" accessibilityLabel="Run typed command" disabled={!draft.trim() || recordingCurrent} style={styles.help} onPress={() => { void run(draft); }}><Text style={styles.title}>Run</Text></Pressable></View>
    </View> : null}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  container: { paddingVertical: 3, gap: 8 },
  compact: { maxWidth: 340, maxHeight: 320 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  mic: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#247447' },
  micText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  help: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  text: { color: '#465d4c', fontSize: 12, lineHeight: 18, flexShrink: 1 },
  title: { color: '#123d2a', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  pending: { padding: 10, borderRadius: 12, backgroundColor: '#f6edce', gap: 7 },
  input: { flex: 1, minWidth: 140, minHeight: 44, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#fffefa', borderWidth: 1, borderColor: '#dce5d5', color: '#19382b' },
});
