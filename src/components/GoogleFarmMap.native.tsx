import Constants from 'expo-constants';
import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { FarmMapPicker } from './FarmMapPicker';
import { C, Icon } from '../ui';
import { LocalizedText as Text } from '../i18n';

type Point = { latitude: number; longitude: number };

export function FarmLocationPicker({ state, initialLatitude, initialLongitude, area, onSelect }: {
  state?: string; initialLatitude?: number; initialLongitude?: number; area?: string; onSelect: (point: Point) => void;
}) {
  const center = { latitude: initialLatitude ?? stateCenter(state).latitude, longitude: initialLongitude ?? stateCenter(state).longitude };
  const [selected, setSelected] = useState(center);
  const nativeGoogleMapsConfigured = Platform.OS === 'android'
    ? Boolean(Constants.expoConfig?.extra?.androidGoogleMapsConfigured)
    : Boolean(Constants.expoConfig?.extra?.iosGoogleMapsConfigured);
  if (nativeGoogleMapsConfigured) return <View style={{ gap: 9 }}>
    <Text style={styles.note}>Drag the pin or tap the map. The outlined square is estimated from the pin and farm area; verify it follows your field edges.</Text>
    <MapView style={styles.map} provider={PROVIDER_GOOGLE} mapType="satellite" initialRegion={{ ...center, latitudeDelta: 0.008, longitudeDelta: 0.008 }} onPress={event => setSelected(event.nativeEvent.coordinate)}>
      {areaAcres(area) > 0 ? <Polygon coordinates={boundaryPoints(selected, area)} strokeColor="#155936" strokeWidth={3} fillColor="#5bb36c38" /> : null}
      <Marker coordinate={selected} draggable title="Your farm pin" onDragEnd={event => setSelected(event.nativeEvent.coordinate)} />
    </MapView>
    <View style={styles.coordinates}><Icon name="crosshairs-gps" size={16} color={C.green} /><Text style={styles.coordinateText}>{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</Text><View style={{ flex: 1 }} /><Pressable onPress={() => onSelect(selected)} style={styles.useButton}><Text style={styles.useButtonText}>Use this pin</Text></Pressable></View>
  </View>;
  const location = `${center.latitude},${center.longitude}`;
  return <View style={{ gap: 8 }}>
    <FarmMapPicker state={state} initialLatitude={initialLatitude} initialLongitude={initialLongitude} onSelect={onSelect} />
    <Pressable onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`)} style={styles.googleLink}>
      <Icon name="google-maps" color={C.green} size={17} /><Text style={styles.googleLinkText}>View this location in Google Maps</Text>
    </Pressable>
    <Text style={styles.note}>Google Maps pin editing requires the Google Maps SDK configuration; the in-app pin picker above remains ready to use on this device.</Text>
  </View>;
}

function boundaryPoints(center: Point, areaText?: string) {
  const acres = areaAcres(areaText);
  const halfSide = Math.sqrt(Math.max(0.1, acres) * 4046.8564224) / 2;
  const halfLat = halfSide / 111320;
  const halfLng = halfSide / (111320 * Math.max(0.1, Math.cos(center.latitude * Math.PI / 180)));
  return [
    { latitude: center.latitude - halfLat, longitude: center.longitude - halfLng }, { latitude: center.latitude - halfLat, longitude: center.longitude + halfLng },
    { latitude: center.latitude + halfLat, longitude: center.longitude + halfLng }, { latitude: center.latitude + halfLat, longitude: center.longitude - halfLng },
  ];
}

function areaAcres(areaText?: string) {
  const number = Number(String(areaText ?? '').replaceAll(',', '').match(/[\d.]+/)?.[0] ?? 0);
  return /hectare|\bha\b/i.test(areaText ?? '') ? number * 2.47105 : number;
}

function stateCenter(state?: string): Point {
  const values: Record<string, Point> = { 'Andhra Pradesh': { latitude: 15.9129, longitude: 79.74 }, Telangana: { latitude: 18.1124, longitude: 79.0193 }, Karnataka: { latitude: 15.3173, longitude: 75.7139 }, 'Tamil Nadu': { latitude: 11.1271, longitude: 78.6569 } };
  return values[state ?? ''] ?? { latitude: 20.5937, longitude: 78.9629 };
}

const styles = StyleSheet.create({
  map: { width: '100%', height: 330, borderRadius: 15 },
  coordinates: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7 },
  coordinateText: { color: C.ink, fontSize: 12, fontWeight: '700' },
  useButton: { minHeight: 38, justifyContent: 'center', backgroundColor: C.green, paddingHorizontal: 14, borderRadius: 11 },
  useButtonText: { color: C.white, fontSize: 12, fontWeight: '800' },
  googleLink: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5 },
  googleLinkText: { color: C.green, fontSize: 12, fontWeight: '700' },
  note: { color: C.muted, fontSize: 11, lineHeight: 16 },
});
