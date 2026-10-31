import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { C, Icon } from '../ui';
import { LocalizedText as Text } from '../i18n';

const TILE = 256;
type Point = { latitude: number; longitude: number };

/** A lightweight, cross-platform tiled map centered on the farmer's saved location. */
export function FarmMapPreview({ latitude, longitude, mode, locationLabel, area }: {
  latitude: number;
  longitude: number;
  mode: 'Map' | 'Satellite';
  locationLabel: string;
  area: string;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(16);
  const tiles = useMemo(() => {
    if (!size.width || !size.height) return [];
    const world = toWorld({ latitude, longitude }, zoom);
    const tileX = Math.floor(world.x / TILE);
    const tileY = Math.floor(world.y / TILE);
    const count = 2 ** zoom;
    const left = size.width / 2 - (world.x - tileX * TILE);
    const top = size.height / 2 - (world.y - tileY * TILE);
    const output = [];
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
      const tx = wrap(tileX + x, count);
      const ty = tileY + y;
      if (ty < 0 || ty >= count) continue;
      output.push({ key: `${zoom}/${tx}/${ty}`, uri: tileUrl(mode, zoom, tx, ty), left: left + x * TILE, top: top + y * TILE });
    }
    return output;
  }, [latitude, longitude, mode, size, zoom]);
  const areaNumber = Number(area.replaceAll(',', '').match(/[\d.]+/)?.[0] ?? 0);
  const acres = /hectare|\bha\b/i.test(area) ? areaNumber * 2.47105 : areaNumber;
  const metresPerPixel = 156543.03392 * Math.cos(latitude * Math.PI / 180) / 2 ** zoom;
  const boundarySize = Math.max(28, Math.min(180, Math.sqrt(Math.max(0, acres) * 4046.8564224) / metresPerPixel));

  return <View style={styles.map} onLayout={event => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}>
    {tiles.map(tile => <Image key={tile.key} source={{ uri: tile.uri }} style={[styles.tile, { left: tile.left, top: tile.top }]} />)}
    {acres > 0 ? <View pointerEvents="none" style={[styles.fieldBoundary, { width: boundarySize, height: boundarySize, marginLeft: -boundarySize / 2, marginTop: -boundarySize / 2 }]} /> : null}
    <View pointerEvents="none" style={styles.centerPin}><View style={styles.pinDot}><Icon name="sprout" size={17} color={C.white} /></View><View style={styles.pinStem} /></View>
    <View pointerEvents="none" style={styles.locationLabel}><Icon name="map-marker" size={14} color={C.greenDark} /><Text numberOfLines={1} style={styles.locationText}>{locationLabel || 'Saved farm location'}</Text></View>
    <View style={styles.zoomControls}>
      <Pressable onPress={() => setZoom(value => Math.min(19, value + 1))} accessibilityRole="button" accessibilityLabel="Zoom in on satellite map" style={styles.zoomButton}><Icon name="plus" size={19} color={C.ink} /></Pressable>
      <Pressable onPress={() => setZoom(value => Math.max(4, value - 1))} accessibilityRole="button" accessibilityLabel="Zoom out on satellite map" style={styles.zoomButton}><Icon name="minus" size={19} color={C.ink} /></Pressable>
    </View>
    <View pointerEvents="none" style={styles.attribution}><Text style={styles.attributionText}>{mode === 'Satellite' ? 'Imagery © Esri and its imagery providers' : '© OpenStreetMap contributors'}</Text></View>
  </View>;
}

function tileUrl(mode: 'Map' | 'Satellite', z: number, x: number, y: number) {
  if (mode === 'Satellite') return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

function toWorld(point: Point, zoom: number) {
  const scale = TILE * 2 ** zoom;
  const lat = Math.max(-85.05112878, Math.min(85.05112878, point.latitude));
  const sin = Math.sin(lat * Math.PI / 180);
  return { x: ((point.longitude + 180) / 360) * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
}

function wrap(value: number, range: number) { return ((value % range) + range) % range; }

const styles = StyleSheet.create({
  map: { height: 310, width: '100%', marginTop: 14, borderRadius: 16, overflow: 'hidden', backgroundColor: '#dfe7d7', position: 'relative' },
  tile: { position: 'absolute', width: TILE, height: TILE },
  centerPin: { position: 'absolute', left: '50%', top: '50%', marginLeft: -17, marginTop: -28, alignItems: 'center' },
  fieldBoundary: { position: 'absolute', left: '50%', top: '50%', borderWidth: 2, borderColor: '#f8ffe9', borderRadius: 6, backgroundColor: '#71b74d35' },
  pinDot: { height: 34, width: 34, borderRadius: 18, backgroundColor: C.green, borderColor: C.white, borderWidth: 2, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  pinStem: { height: 10, width: 2, backgroundColor: C.greenDark },
  locationLabel: { position: 'absolute', top: 11, left: 11, maxWidth: '75%', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 9, backgroundColor: '#ffffffed' },
  locationText: { color: C.greenDark, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  zoomControls: { position: 'absolute', right: 10, top: 10, gap: 6 },
  zoomButton: { height: 36, width: 36, borderRadius: 10, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  attribution: { position: 'absolute', right: 3, bottom: 2, backgroundColor: '#ffffffdc', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 2 },
  attributionText: { color: '#263228', fontSize: 8 },
});
