import { useMemo, useState } from 'react';
import { Image, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { C, Icon } from '../ui';
import { LocalizedText as Text } from '../i18n';

const TILE_SIZE = 256;
const TILE_URL = 'https://tile.openstreetmap.org';
const INDIA_CENTER = { latitude: 20.5937, longitude: 78.9629 };
const STATE_CENTERS: Record<string, Point> = {
  'Andhra Pradesh': { latitude: 15.9129, longitude: 79.74 }, Telangana: { latitude: 18.1124, longitude: 79.0193 },
  Karnataka: { latitude: 15.3173, longitude: 75.7139 }, 'Tamil Nadu': { latitude: 11.1271, longitude: 78.6569 },
  Kerala: { latitude: 10.8505, longitude: 76.2711 }, Maharashtra: { latitude: 19.7515, longitude: 75.7139 },
  Gujarat: { latitude: 22.2587, longitude: 71.1924 }, Rajasthan: { latitude: 27.0238, longitude: 74.2179 },
  'Uttar Pradesh': { latitude: 26.8467, longitude: 80.9462 }, Bihar: { latitude: 25.0961, longitude: 85.3131 },
  Odisha: { latitude: 20.9517, longitude: 85.0985 }, Punjab: { latitude: 31.1471, longitude: 75.3412 },
  'West Bengal': { latitude: 22.9868, longitude: 87.855 }, Assam: { latitude: 26.2006, longitude: 92.9376 },
  Haryana: { latitude: 29.0588, longitude: 76.0856 }, 'Madhya Pradesh': { latitude: 22.9734, longitude: 78.6569 },
  Chhattisgarh: { latitude: 21.2787, longitude: 81.8661 }, Jharkhand: { latitude: 23.6102, longitude: 85.2799 },
};

type Point = { latitude: number; longitude: number };

export function FarmMapPicker({ initialLatitude, initialLongitude, state, onSelect }: {
  initialLatitude?: number;
  initialLongitude?: number;
  state?: string;
  onSelect: (point: Point) => void;
}) {
  const [zoom, setZoom] = useState(5);
  const start = initialLatitude !== undefined && initialLongitude !== undefined
    ? { latitude: initialLatitude, longitude: initialLongitude }
    : STATE_CENTERS[state ?? ''] ?? INDIA_CENTER;
  const [center, setCenter] = useState<Point>(start);
  const [selected, setSelected] = useState<Point>(center);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: event => {
      const scale = TILE_SIZE * 2 ** zoom;
      const mapCenter = toWorldPixels(center, zoom);
      const offsetX = clamp(event.nativeEvent.locationX - mapSize.width / 2, -mapSize.width / 2 + 18, mapSize.width / 2 - 18);
      const offsetY = clamp(event.nativeEvent.locationY - mapSize.height / 2, -mapSize.height / 2 + 37, mapSize.height / 2 - 12);
      const world = {
        x: wrap(mapCenter.x + offsetX, scale),
        y: Math.max(0, Math.min(scale, mapCenter.y + offsetY)),
      };
      setSelected(fromWorldPixels(world, zoom));
    },
  }), [center, mapSize, zoom]);

  const tiles = useMemo(() => {
    if (!mapSize.width || !mapSize.height) return [];
    const world = toWorldPixels(center, zoom);
    const gridX = Math.floor(world.x / TILE_SIZE);
    const gridY = Math.floor(world.y / TILE_SIZE);
    const tileCount = 2 ** zoom;
    const left = mapSize.width / 2 - (world.x - gridX * TILE_SIZE);
    const top = mapSize.height / 2 - (world.y - gridY * TILE_SIZE);
    const visible = [];
    for (let yOffset = -1; yOffset <= 1; yOffset++) {
      for (let xOffset = -1; xOffset <= 1; xOffset++) {
        const tileX = wrap(gridX + xOffset, tileCount);
        const tileY = gridY + yOffset;
        if (tileY < 0 || tileY >= tileCount) continue;
        visible.push({
          key: `${zoom}/${tileX}/${tileY}`,
          uri: `${TILE_URL}/${zoom}/${tileX}/${tileY}.png`,
          left: left + xOffset * TILE_SIZE,
          top: top + yOffset * TILE_SIZE,
        });
      }
    }
    return visible;
  }, [center, mapSize, zoom]);

  const selectedWorld = toWorldPixels(selected, zoom);
  const centerWorld = toWorldPixels(center, zoom);
  const markerLeft = mapSize.width / 2 + shortestWorldDelta(selectedWorld.x - centerWorld.x, TILE_SIZE * 2 ** zoom) - 14;
  const markerTop = mapSize.height / 2 + selectedWorld.y - centerWorld.y - 31;

  const changeZoom = (delta: number) => {
    setCenter(selected);
    setZoom(value => Math.max(4, Math.min(18, value + delta)));
  };

  return <View style={styles.container}>
    <Text style={styles.instruction}>Drag the pin to your farm. Zoom in for a more precise location.</Text>
    <View style={styles.map} onLayout={event => setMapSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}>
      {tiles.map(tile => <Image key={tile.key} source={{ uri: tile.uri, headers: { 'User-Agent': 'KisaanMitraAI/1.0' } }} style={[styles.tile, { left: tile.left, top: tile.top }]} />)}
      <View {...panResponder.panHandlers} style={styles.touchSurface} />
      <View pointerEvents="none" style={[styles.markerTouch, { left: markerLeft, top: markerTop }]}>
        <Icon name="map-marker" size={38} color="#bd342b" />
      </View>
      <View style={styles.zoomControls}>
        <Pressable onPress={() => changeZoom(1)} accessibilityRole="button" accessibilityLabel="Zoom in on map" style={styles.zoomButton}><Icon name="plus" size={20} color={C.ink} /></Pressable>
        <Pressable onPress={() => changeZoom(-1)} accessibilityRole="button" accessibilityLabel="Zoom out on map" style={styles.zoomButton}><Icon name="minus" size={20} color={C.ink} /></Pressable>
      </View>
      <Text style={styles.attribution}>© OpenStreetMap contributors</Text>
    </View>
    <View style={styles.coordinates}><Icon name="crosshairs-gps" size={16} color={C.green} /><Text style={styles.coordinateText}>{selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}</Text><View style={{ flex: 1 }} /><Pressable onPress={() => onSelect(selected)} accessibilityRole="button" style={styles.useButton}><Text style={styles.useButtonText}>Use this pin</Text></Pressable></View>
  </View>;
}

function toWorldPixels(point: Point, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, point.latitude));
  const sin = Math.sin(latitude * Math.PI / 180);
  return {
    x: ((point.longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function fromWorldPixels(world: { x: number; y: number }, zoom: number): Point {
  const scale = TILE_SIZE * 2 ** zoom;
  const longitude = world.x / scale * 360 - 180;
  const n = Math.PI - (2 * Math.PI * world.y) / scale;
  const latitude = 180 / Math.PI * Math.atan(Math.sinh(n));
  return { latitude, longitude };
}

function wrap(value: number, range: number) { return ((value % range) + range) % range; }
function shortestWorldDelta(value: number, range: number) { return ((value + range / 2) % range + range) % range - range / 2; }
function clamp(value: number, minimum: number, maximum: number) { return Math.max(minimum, Math.min(maximum, value)); }

const styles = StyleSheet.create({
  container: { gap: 10 },
  instruction: { color: C.muted, fontSize: 12, lineHeight: 18 },
  map: { height: 330, width: '100%', backgroundColor: '#e9e5d5', borderRadius: 15, overflow: 'hidden', position: 'relative' },
  tile: { position: 'absolute', width: TILE_SIZE, height: TILE_SIZE },
  touchSurface: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1 },
  markerTouch: { position: 'absolute', width: 42, height: 48, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  zoomControls: { position: 'absolute', right: 10, top: 10, gap: 6, zIndex: 4 },
  zoomButton: { width: 37, height: 37, borderRadius: 10, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  attribution: { position: 'absolute', right: 4, bottom: 3, color: '#29342a', backgroundColor: '#ffffffcc', fontSize: 9, paddingHorizontal: 4, zIndex: 2 },
  coordinates: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7 },
  coordinateText: { color: C.ink, fontSize: 12, fontWeight: '700' },
  useButton: { minHeight: 38, justifyContent: 'center', backgroundColor: C.green, paddingHorizontal: 14, borderRadius: 11 },
  useButtonText: { color: C.white, fontSize: 12, fontWeight: '800' },
});
