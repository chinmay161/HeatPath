import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import { fonts } from '../theme/colors';
import type { ScoredRoute } from '../hooks/useFindRoutes';

// Inject Leaflet CSS from CDN once per page load
function useLeafletCSS() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = 'leaflet-css';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }, []);
}

// Re-fit map bounds whenever the selected route changes
function FitBounds({ routes, selectedIdx }: { routes: ScoredRoute[]; selectedIdx: number }) {
  const map = useMap();
  useEffect(() => {
    const r = routes[selectedIdx];
    if (!r || r.path.length === 0) return;
    const bounds: [number, number][] = r.path.map(p => [p.lat, p.lon]);
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
  }, [routes, selectedIdx]);
  return null;
}

function shadePctToColor(pct: number): string {
  if (pct >= 60) return '#1C7C4A'; // forest green
  if (pct >= 40) return '#E5B23C'; // caution amber
  if (pct >= 20) return '#E8843A'; // high orange
  return '#C8322A';                // extreme red
}

// Split the full ORS path into N equal-point chunks and assign shade colors.
// shade_segments (≤7 values) come from a simplified 8-point path, not the full
// path, so we approximate by dividing path evenly — visually correct, not
// meter-accurate to the actual shade boundaries.
function buildSegments(
  path: { lat: number; lon: number }[],
  shadeSegs: number[],
): { positions: [number, number][]; color: string }[] {
  if (path.length === 0) return [];
  const n = shadeSegs.length;
  if (n === 0) {
    return [{ positions: path.map(p => [p.lat, p.lon] as [number, number]), color: '#1C7C4A' }];
  }
  const chunkSize = Math.ceil(path.length / n);
  return shadeSegs
    .map((pct, i) => {
      const start = i * chunkSize;
      // Overlap by one point so adjacent segments connect without a gap
      const end = Math.min(start + chunkSize + 1, path.length);
      return {
        positions: path.slice(start, end).map(p => [p.lat, p.lon] as [number, number]),
        color: shadePctToColor(pct),
      };
    })
    .filter(s => s.positions.length >= 2);
}

type Props = {
  routes: ScoredRoute[];
  selectedIdx: number;
  startLat: number | null;
  startLon: number | null;
  endLat: number | null;
  endLon: number | null;
  routeTitle: string;
};

export function RouteMap({
  routes,
  selectedIdx,
  startLat,
  startLon,
  endLat,
  endLon,
  routeTitle,
}: Props) {
  useLeafletCSS();

  const selected = routes[selectedIdx];
  const segments = selected ? buildSegments(selected.path, selected.shade_segments) : [];

  const center: [number, number] = [
    startLat ?? selected?.path[0]?.lat ?? 12.97,
    startLon ?? selected?.path[0]?.lon ?? 77.59,
  ];

  return (
    <View style={styles.outer}>
      {/* Absolute-fill so the map stretches to fill the flex parent */}
      <MapContainer
        center={center}
        zoom={14}
        // @ts-ignore — react-leaflet style prop is CSSProperties; we pass a compatible object
        style={styles.mapFill}
        zoomControl
        scrollWheelZoom
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <FitBounds routes={routes} selectedIdx={selectedIdx} />

        {/* Faint dashed ghost lines for non-selected routes */}
        {routes.map((r, i) =>
          i !== selectedIdx ? (
            <Polyline
              key={`ghost-${i}`}
              positions={r.path.map(p => [p.lat, p.lon] as [number, number])}
              pathOptions={{ color: '#8A988E', weight: 4, opacity: 0.28, dashArray: '5 9' }}
            />
          ) : null,
        )}

        {/* Active route — color-coded by shade segment */}
        {segments.map((seg, i) => (
          <Polyline
            key={`seg-${selectedIdx}-${i}`}
            positions={seg.positions}
            pathOptions={{ color: seg.color, weight: 7, lineCap: 'round', lineJoin: 'round', opacity: 0.92 }}
          />
        ))}

        {/* Start marker (blue circle) */}
        {startLat != null && startLon != null && (
          <CircleMarker
            center={[startLat, startLon]}
            radius={9}
            pathOptions={{ fillColor: '#2563C9', color: '#fff', weight: 3, fillOpacity: 1 }}
          />
        )}

        {/* End marker (green circle) */}
        {endLat != null && endLon != null && (
          <CircleMarker
            center={[endLat, endLon]}
            radius={9}
            pathOptions={{ fillColor: '#1C7C4A', color: '#fff', weight: 3, fillOpacity: 1 }}
          />
        )}
      </MapContainer>

      {/* Route label chip — sits above the map */}
      <View style={styles.chip} pointerEvents="none">
        <Text style={styles.chipText}>{routeTitle} route · live</Text>
      </View>

      {/* Shade / sun legend */}
      <View style={styles.legend} pointerEvents="none">
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: '#1C7C4A' }]} />
          <Text style={styles.legendLabel}>Shade</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: '#E8843A' }]} />
          <Text style={[styles.legendLabel, { color: '#b5560f' }]}>Sun</Text>
        </View>
      </View>
    </View>
  );
}

const SHADOW_WEB = {
  boxShadow: '0 6px 16px -8px rgba(0,0,0,0.30)',
} as any;

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#DDE8D2',
  },
  mapFill: {
    position: 'absolute' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%' as any,
    height: '100%' as any,
  },
  chip: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: '#fff',
    zIndex: 1000,
    ...SHADOW_WEB,
  },
  chipText: {
    fontFamily: fonts.dataBold,
    fontSize: 12,
    color: '#102b1e',
  },
  legend: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 13,
    zIndex: 1000,
    ...SHADOW_WEB,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 14,
    height: 5,
    borderRadius: 3,
  },
  legendLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    color: '#16633B',
  },
});
