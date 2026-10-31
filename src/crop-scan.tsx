import { useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { C, S, Bullet, Button, Card, Divider, Icon, Tag } from './ui';
import { farmer } from './data';
import { Diagnosis, diagnoseCrop, preparePhoto } from './diagnosis';
import riceLeafPhoto from '../assets/rice-leaf-blight.png';

type ScanState =
  | { step: 'idle' }
  | { step: 'analyzing'; uri: string }
  | { step: 'done'; uri: string; result: Diagnosis }
  | { step: 'failed'; uri?: string; message: string };

export function CropScan({ go }: { go: (s: string) => void }) {
  const [scan, setScan] = useState<ScanState>({ step: 'idle' });
  const busy = scan.step === 'analyzing';

  const pick = async (source: 'camera' | 'library') => {
    try {
      if (source === 'camera' && Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return setScan({ step: 'failed', message: 'Camera access is needed to take a photo. You can allow it in your phone settings, or upload an image instead.' });
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
      const picked = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (picked.canceled || !picked.assets?.length) return;

      const asset = picked.assets[0];
      setScan({ step: 'analyzing', uri: asset.uri });
      const photo = await preparePhoto(asset);
      const result = await diagnoseCrop(photo.base64, { location: `${farmer.village}, ${farmer.district}, ${farmer.state}` });
      setScan({ step: 'done', uri: asset.uri, result });
    } catch (e) {
      setScan(old => ({ step: 'failed', uri: 'uri' in old ? old.uri : undefined, message: e instanceof Error ? e.message : 'Something went wrong. Please try again.' }));
    }
  };

  const uri = 'uri' in scan ? scan.uri : undefined;

  return <View style={styles.stack}>
    <Card style={{ alignItems: 'center' }}>
      <View style={styles.photoWrap}>
        <Image source={uri ? { uri } : riceLeafPhoto} resizeMode="cover" style={styles.photo} />
        {busy ? <View style={styles.photoOverlay}><ActivityIndicator color={C.white} size="large" /><Text style={styles.overlayText}>Checking your crop…</Text></View> : null}
      </View>
      <Text style={[S.sectionTitle, { marginTop: 14 }]}>{uri ? 'Your crop photo' : 'Take or upload a clear leaf photo'}</Text>
      <Text style={[S.muted, { textAlign: 'center', maxWidth: 440, marginTop: 4 }]}>Keep the affected area in focus and use natural light for a more useful result.</Text>
      {!busy ? <View style={styles.rowWrap}>
        <Button title={uri ? 'Take another photo' : 'Take photo'} icon="camera-outline" onPress={() => pick('camera')} style={{ flex: 1 }} />
        <Button title="Upload image" secondary icon="image-outline" onPress={() => pick('library')} style={{ flex: 1 }} />
      </View> : null}
      {!uri ? <Text style={[S.muted, { marginTop: 12 }]}>Example field photo</Text> : null}
    </Card>

    {scan.step === 'failed' ? <Card style={{ backgroundColor: C.redSoft, borderColor: '#f3d3cc' }}>
      <View style={{ flexDirection: 'row', gap: 10 }}><Icon name="alert-circle-outline" color={C.red} /><View style={{ flex: 1 }}><Text style={styles.itemTitle}>Could not check this photo</Text><Text style={[S.body, { marginTop: 3 }]}>{scan.message}</Text></View></View>
    </Card> : null}

    {scan.step === 'done' ? <Result result={scan.result} go={go} /> : null}

    {scan.step === 'idle' || scan.step === 'analyzing' ? <Card style={{ backgroundColor: '#f0f6ed' }}>
      <Text style={styles.itemTitle}>Good to know</Text>
      <Text style={[S.muted, { marginTop: 4 }]}>The photo diagnosis is a guide. Confirm symptoms before applying any treatment.</Text>
    </Card> : null}
  </View>;
}

function Result({ result, go }: { result: Diagnosis; go: (s: string) => void }) {
  if (!result.isPlant || result.photoQuality === 'unclear') {
    return <Card>
      <View style={{ flexDirection: 'row', gap: 10 }}><Icon name="camera-retake-outline" color={C.orange} size={24} /><View style={{ flex: 1 }}>
        <Text style={S.sectionTitle}>{result.isPlant ? 'The photo is not clear enough' : 'No crop found in this photo'}</Text>
        <Text style={[S.body, { marginTop: 6 }]}>{result.summary}</Text>
        {result.photoTip ? <Bullet icon="lightbulb-on-outline" color={C.gold} text={result.photoTip} /> : null}
      </View></View>
    </Card>;
  }

  const confidenceTone = result.confidence >= 75 ? 'green' : result.confidence >= 50 ? 'gold' : 'red';
  const details = [result.healthy ? 'No disease found' : `${capitalize(result.severity)} severity`, result.crop, result.healthy ? '' : pathogenLabel[result.pathogenType]].filter(Boolean).join(' · ');

  return <Card>
    <View style={styles.rowBetween}>
      <View><Text style={S.sectionTitle}>Analysis result</Text><Text style={S.muted}>AI estimate</Text></View>
      <Tag tone={confidenceTone}>{`${result.confidence}% CONFIDENCE`}</Tag>
    </View>
    <Divider />
    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
      <Text style={{ fontSize: 35 }}>{result.healthy ? '🌱' : '🌿'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: result.healthy ? C.green : C.red, fontSize: 17, fontWeight: '800' }}>{result.disease}</Text>
        {result.scientificName ? <Text style={[S.muted, { fontStyle: 'italic' }]}>{result.scientificName}</Text> : null}
        <Text style={S.muted}>{details}</Text>
      </View>
    </View>
    {result.summary ? <Text style={[S.body, { marginTop: 11 }]}>{result.summary}</Text> : null}

    {result.consultExpert ? <View style={styles.expertBox}>
      <Icon name="account-tie-outline" color="#946515" />
      <Text style={[S.body, { flex: 1 }]}>Please confirm this with your local Krishi Vigyan Kendra or agriculture officer before spraying.</Text>
    </View> : null}

    <Section title="What we see in the photo" items={result.symptoms} icon="eye-outline" color={C.blue} />
    <Section title="Do this now" items={result.immediateActions} icon="flag-outline" color={C.red} />
    <Section title="Natural and low-cost treatment" items={result.organicTreatment} icon="leaf" />
    <Section title="Chemical treatment (if needed)" items={result.chemicalTreatment} icon="flask-outline" color={C.orange}
      note="Use only as a last resort. Follow the label dose, wear gloves and a mask, and keep the waiting period before harvest." />
    <Section title="Prevent it next time" items={result.prevention} icon="shield-check-outline" />
    {result.otherPossibilities.length ? <Text style={[S.muted, { marginTop: 12 }]}>Could also be: {result.otherPossibilities.join(', ')}</Text> : null}

    <Button title="Ask AI about this result" icon="robot-outline" onPress={() => go('assistant')} style={{ marginTop: 14 }} />
  </Card>;
}

function Section({ title, items, icon, color = C.green, note }: { title: string; items: string[]; icon: string; color?: string; note?: string }) {
  if (!items.length) return null;
  return <View style={styles.adviceBox}>
    <Text style={styles.itemTitle}>{title}</Text>
    {note ? <Text style={[S.muted, { marginTop: 3 }]}>{note}</Text> : null}
    {items.map(item => <Bullet key={item} text={item} icon={icon} color={color} />)}
  </View>;
}

const pathogenLabel: Record<Diagnosis['pathogenType'], string> = {
  fungal: 'Fungal disease', bacterial: 'Bacterial disease', viral: 'Viral disease', pest: 'Pest damage',
  nutrient: 'Nutrient deficiency', abiotic: 'Weather or soil stress', none: '', unknown: '',
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const styles = StyleSheet.create({
  stack: { gap: 15 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignSelf: 'stretch', marginTop: 14 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  itemTitle: { color: C.ink, fontSize: 13, fontWeight: '800' },
  photoWrap: { width: '100%', height: 220, borderRadius: 16, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  photoOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(19, 57, 38, 0.6)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  overlayText: { color: C.white, fontWeight: '800', fontSize: 14 },
  adviceBox: { backgroundColor: '#f5f8f2', padding: 13, borderRadius: 13, marginTop: 12 },
  expertBox: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#fff5dc', padding: 12, borderRadius: 13, marginTop: 12 },
});
