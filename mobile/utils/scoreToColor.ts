const STOPS = [
  { at: 0.0, color: '#FF4444' },
  { at: 0.33, color: '#FF8C00' },
  { at: 0.66, color: '#FFD700' },
  { at: 1.0, color: '#22C55E' },
] as const;

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
