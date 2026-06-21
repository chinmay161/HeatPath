const STOPS = [
  { at: 0.0, color: '#FF4444' },
  { at: 0.33, color: '#FF8C00' },
  { at: 0.66, color: '#FFD700' },
  { at: 1.0, color: '#22C55E' },
] as const;

export type ScoreLabel = 'SAFE' | 'CAUTION' | 'HIGH' | 'EXTREME';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Convert a comfort score into the shared HeatPath heat-map gradient colour.
 */
export function scoreToColor(score: number): string {
  const s = clamp(score, 0, 1);
  for (let i = 0; i < STOPS.length - 1; i += 1) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (s >= a.at && s <= b.at) {
      const t = (s - a.at) / (b.at - a.at);
      const ca = hexToRgb(a.color);
      const cb = hexToRgb(b.color);
      return rgbToHex([
        ca[0] + (cb[0] - ca[0]) * t,
        ca[1] + (cb[1] - ca[1]) * t,
        ca[2] + (cb[2] - ca[2]) * t,
      ]);
    }
  }
  return STOPS[STOPS.length - 1].color;
}

/**
 * Convert a comfort score into the shared route severity label.
 */
export function scoreToLabel(score: number): ScoreLabel {
  const s = clamp(score, 0, 1);
  if (s >= 0.70) return 'SAFE';
  if (s >= 0.50) return 'CAUTION';
  if (s >= 0.30) return 'HIGH';
  return 'EXTREME';
}

export type RouteSegment = {
  path: { lat: number; lon: number }[];
  color: string;
};

/**
 * Split a full ORS route path into colour-coded chunks aligned to shade_segments.
 * shade_segments are percentages (0–100); normalised to 0–1 for scoreToColor
 * so web and native share the same gradient without separate colour functions.
 */
export function buildShadedSegments(
  path: { lat: number; lon: number }[],
  shadeSegments: number[],
): RouteSegment[] {
  if (path.length === 0) return [];
  const n = shadeSegments.length;
  if (n === 0) {
    return [{ path, color: scoreToColor(0.5) }];
  }
  const chunkSize = Math.ceil(path.length / n);
  return shadeSegments
    .map((pct, i) => {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize + 1, path.length); // +1 for line continuity
      return {
        path: path.slice(start, end),
        color: scoreToColor(pct / 100),
      };
    })
    .filter(s => s.path.length >= 2);
}
