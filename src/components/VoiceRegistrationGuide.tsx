import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { FarmProfileData } from '../farm-profile';
import { languageOptions, LocalizedText as Text, useLanguage } from '../i18n';
import { C, S, Button, Icon } from '../ui';
import { DictationSession, useSpeechAccess } from '../speech-access';
import { appSpeechLanguages } from '../speech-text';
import { effectiveRegistrationStep, nextRegistrationStep, registrationFields, registrationTransition, type RegistrationSession } from '../registration-guide';
import { registrationLabels, registrationPrompt } from '../registration-prompts';
import { useVoiceCommands, VoiceAction } from '../voice-command-context';

const noSubscribe = () => () => {};
const zero = () => 0;

export function VoiceRegistrationGuide({ draft, states, onChange, onSave, onChooseMap, mapOpen }: {
  draft: FarmProfileData; states: readonly string[]; onChange: (profile: FarmProfileData) => void; onSave: () => boolean; onChooseMap: () => void; mapOpen: boolean;
}) {
  const { language, setLanguage } = useLanguage();
  const speech = useSpeechAccess();
  const commands = useVoiceCommands();
  const commandEpoch = useSyncExternalStore(commands?.subscribe ?? noSubscribe, commands?.scopeEpoch ?? zero, zero);
  const [started, setStarted] = useState(false);
  const [session, setSession] = useState<RegistrationSession>({ step: 'name' });
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [recording, setRecording] = useState<{ fingerprint: string; step: string; epoch: number } | null>(null);
  const step = effectiveRegistrationStep(session, draft, states);
  const prompt = registrationPrompt(step, language, draft);
  const fingerprint = JSON.stringify(draft);
  const recordingCurrent = Boolean(recording && !mapOpen && recording.epoch === commandEpoch && recording.fingerprint === fingerprint && recording.step === step);
  const read = speech?.read;
  const stop = speech?.stop;
  const latest = useRef({ draft, session, onSave, onChange, onChooseMap, language });
  useEffect(() => { latest.current = { draft, session, onSave, onChange, onChooseMap, language }; }, [draft, session, onSave, onChange, onChooseMap, language]);
  const lastPrompt = useRef('');
  useEffect(() => {
    if (!started || mapOpen || commands?.currentScope().modal || speech?.dictating || !read) return;
    const key = `${language}:${prompt}`;
    if (lastPrompt.current !== key) { lastPrompt.current = key; read(prompt, appSpeechLanguages[language]); }
  }, [started, mapOpen, speech?.dictating, read, prompt, language, commands, commandEpoch]);
  useEffect(() => () => stop?.(), [stop]);

  const accept = (text: string, captured?: { fingerprint: string; step: string; epoch: number }) => {
    const current = latest.current;
    if (captured && (captured.epoch !== commands?.scopeEpoch() || captured.fingerprint !== JSON.stringify(current.draft) || captured.step !== effectiveRegistrationStep(current.session, current.draft, states))) {
      setError('The form changed during recording. Review the current question and answer again.'); return;
    }
    const result = registrationTransition(current.session, current.draft, text, states);
    commands?.invalidateConfirmation();
    setError(result.error ?? '');
    if (result.error) return;
    setAnswer('');
    setSession(result.session);
    if (result.command === 'pause') { stop?.(); setStarted(false); setRecording(null); return; }
    if (result.command === 'repeat') {
      const repeated = registrationPrompt(result.session.step, current.language, current.draft);
      if (speech?.isDictating()) lastPrompt.current = '';
      else { lastPrompt.current = `${current.language}:${repeated}`; read?.(repeated, appSpeechLanguages[current.language]); }
      return;
    }
    if (result.command === 'map') { stop?.(); current.onChooseMap(); return; }
    if (result.command === 'save') { stop?.(); if (current.onSave()) setStarted(false); return; }
    current.onChange(result.profile);
  };
  const pause = () => { stop?.(); setStarted(false); setRecording(null); setError(''); };

  return <View style={styles.root}>
    <View style={styles.heading}><View style={styles.icon}><Icon name="account-voice" size={24} /></View><View style={{ flex: 1 }}><Text style={S.sectionTitle}>Register with voice</Text><Text style={S.muted}>One question at a time. Your details stay editable.</Text></View></View>
    <View style={styles.choices}>{languageOptions.map(option => <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: language === option.id }} disabled={recordingCurrent} onPress={() => { stop?.(); setLanguage(option.id); }} style={[styles.language, language === option.id && styles.selectedLanguage]}><Text style={{ color: language === option.id ? C.white : C.greenDark, fontSize: 12 }}>{option.nativeName}</Text></Pressable>)}</View>
    {!started ? <><Text style={S.body}>I will ask for your name, state, district, village, crop and farm area, then read everything back. Choose your exact field pin on the map before confirming.</Text><Button title="Start voice registration" icon="microphone-outline" disabled={!speech} onPress={() => { setSession({ step: nextRegistrationStep(draft, states) }); setStarted(true); setError(''); lastPrompt.current = ''; }} /></> : <>
      <Text style={styles.progress}>{step === 'map' ? '7 / 8 · FARM PIN' : step === 'review' ? '8 / 8 · REVIEW & CONFIRM' : `${registrationFields.indexOf(step) + 1} / 8 · YOUR FARM DETAILS`}</Text>
      <Text accessibilityLiveRegion="polite" style={[S.body, { fontWeight: '700' }]}>{prompt}</Text>
      {step === 'review' ? <View style={styles.review}>{registrationFields.map((field, index) => <View key={field} style={styles.reviewRow}><View style={{ flex: 1 }}><Text style={S.muted}>{registrationLabels[language][index]}</Text><Text style={S.body}>{draft[field]}</Text></View><VoiceAction label={`Change ${field}`} onPress={() => { stop?.(); setError(''); setAnswer(''); setSession({ step: field }); }} style={styles.edit}><Icon name="pencil-outline" size={19} /></VoiceAction></View>)}<Text style={S.muted}>Farm pin: {draft.latitude}, {draft.longitude}</Text></View> : null}
      {step === 'map' ? <Button title="Choose my farm pin" icon="map-marker-outline" onPress={() => { stop?.(); onChooseMap(); }} /> : null}
      {step !== 'map' && step !== 'review' && draft[step].trim() ? <Button title={`Use entered value: ${draft[step]}`} secondary disabled={recordingCurrent || mapOpen} onPress={() => accept(draft[step])} /> : null}
      {recordingCurrent && recording ? <DictationSession key={`${recording.step}:${recording.fingerprint}`} language={appSpeechLanguages[language]} onText={text => accept(text, recording)} onClose={() => setRecording(null)} /> : <Button title={step === 'review' ? 'Speak: confirm or change a detail' : 'Speak my answer'} icon="microphone-outline" disabled={speech?.dictating || mapOpen} onPress={() => { stop?.(); setRecording({ fingerprint, step, epoch: commandEpoch }); }} />}
      <Text style={S.muted}>Tap Speak for each answer, then Stop and use text. You can also say “repeat”, “go back”, “change my village”, or “cancel”. Use “confirm” after the final review. Common commands in the chosen language are supported.</Text>
      <View style={styles.answerRow}><TextInput accessibilityLabel="Type an answer to the registration guide" value={answer} editable={!recordingCurrent && !mapOpen} onChangeText={setAnswer} onSubmitEditing={() => { if (!recordingCurrent && !mapOpen && answer.trim()) accept(answer); }} placeholder="Or type an answer to try the guide" style={styles.input} /><Button title="Use answer" disabled={recordingCurrent || mapOpen || !answer.trim()} onPress={() => accept(answer)} secondary /></View>
      <View style={styles.choices}><Button title="Repeat question" secondary onPress={() => { if (!speech?.dictating) read?.(prompt, appSpeechLanguages[language]); }} disabled={speech?.dictating} /><Button title="Pause guide" secondary onPress={pause} /></View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </>}
    {speech?.error ? <Text accessibilityRole="alert" style={styles.error}>{speech.error} You can keep using the typed guide or the form below.</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { padding: 16, gap: 14, backgroundColor: '#eef3e8', borderWidth: 1, borderColor: '#d4e1cd', borderRadius: 20, marginBottom: 22 },
  heading: { flexDirection: 'row', gap: 11, alignItems: 'center' },
  icon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#dce9d3' },
  progress: { color: C.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  choices: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  language: { minHeight: 44, paddingHorizontal: 11, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  selectedLanguage: { backgroundColor: C.green, borderColor: C.green },
  review: { padding: 12, borderRadius: 14, backgroundColor: C.white, gap: 7 },
  reviewRow: { flexDirection: 'row', gap: 7, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 7 },
  edit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  answerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  input: { flex: 1, minWidth: 145, minHeight: 48, paddingHorizontal: 11, backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.border, color: C.ink, fontSize: 14 },
  error: { color: C.red, fontSize: 13, lineHeight: 20 },
});
