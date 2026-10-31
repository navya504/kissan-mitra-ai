import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LocalizedText as Text } from './i18n';

export const C = {
  ink: '#1f3328', muted: '#738074', green: '#247447', greenDark: '#155936',
  greenSoft: '#e7f2e9', lime: '#dcebc8', cream: '#f7f7f0', white: '#ffffff',
  border: '#e5e9df', gold: '#dfaa3d', red: '#c44e42', redSoft: '#fff0ec',
  blue: '#5085a3', blueSoft: '#eaf3f7', orange: '#d07b34',
};

export const S = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.cream },
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 22, paddingBottom: 36 },
  title: { color: C.ink, fontSize: 27, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: C.muted, fontSize: 14, marginTop: 5 },
  card: { backgroundColor: C.white, borderColor: C.border, borderWidth: 1, borderRadius: 20, padding: 18 },
  sectionTitle: { color: C.ink, fontSize: 17, fontWeight: '800' },
  body: { color: C.ink, fontSize: 14, lineHeight: 21 },
  muted: { color: C.muted, fontSize: 12, lineHeight: 18 },
});

export function Icon({ name, size = 20, color = C.green }: { name: any; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

export function Button({ title, onPress, secondary = false, icon, style }: {
  title: string; onPress: () => void; secondary?: boolean; icon?: any; style?: ViewStyle;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary, style]}>
      {icon ? <Icon name={icon} size={17} color={secondary ? C.green : C.white} /> : null}
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[S.card, style]}>{children}</View>;
}

export function Tag({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'red' | 'gold' | 'blue' }) {
  const tones = {
    green: { bg: C.greenSoft, fg: C.greenDark }, red: { bg: C.redSoft, fg: C.red },
    gold: { bg: '#fff5dc', fg: '#946515' }, blue: { bg: C.blueSoft, fg: C.blue },
  };
  return <View style={[styles.tag, { backgroundColor: tones[tone].bg }]}><Text style={{ color: tones[tone].fg, fontWeight: '700', fontSize: 11 }}>{children}</Text></View>;
}

export function Stat({ label, value, detail, icon, color = C.green }: { label: string; value: string; detail?: string; icon: any; color?: string }) {
  return <View style={{ flex: 1, minWidth: 115, padding: 14, borderRadius: 16, backgroundColor: '#f8faf6' }}>
    <Icon name={icon} size={19} color={color} />
    <Text style={{ color: C.muted, fontSize: 12, marginTop: 11 }}>{label}</Text>
    <Text style={{ color: C.ink, fontSize: 23, fontWeight: '800', marginTop: 3 }}>{value}</Text>
    {detail ? <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{detail}</Text> : null}
  </View>;
}

export function Divider() { return <View style={{ height: 1, backgroundColor: C.border, marginVertical: 14 }} />; }

const styles = StyleSheet.create({
  button: { minHeight: 48, backgroundColor: C.green, borderRadius: 14, paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonSecondary: { backgroundColor: C.greenSoft, borderWidth: 1, borderColor: '#cfe2d1' },
  buttonText: { color: C.white, fontSize: 14, fontWeight: '800' },
  buttonTextSecondary: { color: C.greenDark },
  tag: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5, alignSelf: 'flex-start' },
});
