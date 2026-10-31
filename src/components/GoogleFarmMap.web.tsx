import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { FarmMapPicker } from './FarmMapPicker';
import { C, Icon } from '../ui';
import { LocalizedText as Text } from '../i18n';

declare global { interface Window { google?: any } }
type Point = { latitude: number; longitude: number };
let mapsLoad: Promise<void> | null = null;

export function FarmLocationPicker({ state, initialLatitude, initialLongitude, area, onSelect }: {
  state?: string;
  initialLatitude?: number;
  initialLongitude?: number;
  area?: string;
  onSelect: (point: Point) => void;
}) {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapCenter = { latitude: initialLatitude ?? stateCenter(state).latitude, longitude: initialLongitude ?? stateCenter(state).longitude };
  const [selected, setSelected] = useState<Point>(mapCenter);
  const [mapError, setMapError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    let cleanup = () => {};
    if (!key) return () => { active = false; };
    loadGoogleMaps(key).then(() => {
      if (!active || !mapElement.current || !window.google?.maps) return;
      const center = { lat: mapCenter.latitude, lng: mapCenter.longitude };
      const map = new window.google.maps.Map(mapElement.current, {
        center, zoom: initialLatitude === undefined ? 14 : 17, mapTypeId: 'satellite',
        mapTypeControl: true, streetViewControl: false, fullscreenControl: false, clickableIcons: false,
      });
      const marker = new window.google.maps.Marker({ position: center, map, draggable: true, title: 'Drag this pin to your farm' });
      const polygon = areaAcres(area) > 0 ? new window.google.maps.Polygon({ paths: boundaryPoints(center, area), strokeColor: '#155936', strokeOpacity: 0.95, strokeWeight: 3, fillColor: '#5bb36c', fillOpacity: 0.22, map }) : null;
      const update = (position: { lat: () => number; lng: () => number }) => {
        const point = { latitude: position.lat(), longitude: position.lng() };
        setSelected(point);
        polygon?.setPath(boundaryPoints({ lat: point.latitude, lng: point.longitude }, area));
      };
      const dragListener = marker.addListener('dragend', (event: any) => update(event.latLng));
      const clickListener = map.addListener('click', (event: any) => {
        if (!event.latLng) return;
        marker.setPosition(event.latLng);
        update(event.latLng);
      });
      setLoaded(true);
      cleanup = () => { dragListener.remove(); clickListener.remove(); polygon?.setMap(null); marker.setMap(null); };
    }).catch(() => { if (active) setMapError('Google Maps could not be loaded. Check the API key and Maps JavaScript API setting.'); });
    return () => { active = false; cleanup(); };
  }, [area, initialLatitude, initialLongitude, key, mapCenter.latitude, mapCenter.longitude, state]);

  if (!key || mapError) return <View style={{ gap: 9 }}>
    <View style={styles.keyNotice}><Icon name="google-maps" size={19} color={C.green} /><Text style={styles.noticeText}>{!key ? 'Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to the project .env and enable Maps JavaScript API to use Google Maps here. The current pin picker is available below.' : mapError}</Text></View>
    <FarmMapPicker state={state} initialLatitude={initialLatitude} initialLongitude={initialLongitude} onSelect={onSelect} />
    {!key ? <Pressable onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`)} style={styles.googleLink}><Icon name="open-in-new" color={C.green} size={16} /><Text style={styles.googleLinkText}>Open this location in Google Maps</Text></Pressable> : null}
  </View>;

  return <View style={{ gap: 9 }}>
    <Text style={styles.instruction}>Drag the pin or tap the map to move it. The outlined square is estimated from this pin and your farm area ({area || 'area not set'}); adjust the farm size in your profile if it is wrong.</Text>
    <div ref={mapElement} style={{ height: 330, width: '100%', borderRadius: 15, overflow: 'hidden', background: '#e7ece3' }} />
    <View style={styles.coordinates}><Icon name="crosshairs-gps" size={16} color={C.green} /><Text style={styles.coordinateText}>{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</Text><View style={{ flex: 1 }} /><Pressable disabled={!loaded} onPress={() => onSelect(selected)} accessibilityRole="button" style={[styles.useButton, !loaded && { opacity: 0.55 }]}><Text style={styles.useButtonText}>Use this pin</Text></Pressable></View>
  </View>;
}

function loadGoogleMaps(key: string) {
  if (window.google?.maps) return Promise.resolve();
  if (mapsLoad) return mapsLoad;
  mapsLoad = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('#kisaan-google-maps');
    if (existing) { existing.addEventListener('load', () => resolve(), { once: true }); existing.addEventListener('error', () => reject(new Error('Google map failed to load')), { once: true }); return; }
    const script = document.createElement('script');
    script.id = 'kisaan-google-maps'; script.async = true; script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly`;
    script.onload = () => resolve(); script.onerror = () => reject(new Error('Google map failed to load'));
    document.head.appendChild(script);
  });
  return mapsLoad;
}

function boundaryPoints(center: { lat: number; lng: number }, areaText?: string) {
  const acres = areaAcres(areaText);
  const halfSide = Math.sqrt(Math.max(0.1, acres) * 4046.8564224) / 2;
  const halfLat = halfSide / 111320;
  const halfLng = halfSide / (111320 * Math.max(0.1, Math.cos(center.lat * Math.PI / 180)));
  return [
    { lat: center.lat - halfLat, lng: center.lng - halfLng }, { lat: center.lat - halfLat, lng: center.lng + halfLng },
    { lat: center.lat + halfLat, lng: center.lng + halfLng }, { lat: center.lat + halfLat, lng: center.lng - halfLng },
  ];
}

function areaAcres(areaText?: string) {
  const number = Number(String(areaText ?? '').replaceAll(',', '').match(/[\d.]+/)?.[0] ?? 0);
  return /hectare|\bha\b/i.test(areaText ?? '') ? number * 2.47105 : number;
}

function stateCenter(state?: string): Point {
  const values: Record<string, Point> = {
    'Andhra Pradesh': { latitude: 15.9129, longitude: 79.74 }, Telangana: { latitude: 18.1124, longitude: 79.0193 },
    Karnataka: { latitude: 15.3173, longitude: 75.7139 }, 'Tamil Nadu': { latitude: 11.1271, longitude: 78.6569 },
  };
  return values[state ?? ''] ?? { latitude: 20.5937, longitude: 78.9629 };
}

const styles = StyleSheet.create({
  keyNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 11, backgroundColor: '#f1f6ee', padding: 11 },
  noticeText: { color: C.ink, fontSize: 12, lineHeight: 18, flex: 1 },
  googleLink: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5 },
  googleLinkText: { color: C.green, fontSize: 12, fontWeight: '700' },
  instruction: { color: C.muted, fontSize: 12, lineHeight: 18 },
  coordinates: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7 },
  coordinateText: { color: C.ink, fontSize: 12, fontWeight: '700' },
  useButton: { minHeight: 38, justifyContent: 'center', backgroundColor: C.green, paddingHorizontal: 14, borderRadius: 11 },
  useButtonText: { color: C.white, fontSize: 12, fontWeight: '800' },
});
