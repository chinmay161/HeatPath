/**
 * Interpolates between R, G, B channels of two colors.
 * @param {number[]} colorStart - [R, G, B]
 * @param {number[]} colorEnd - [R, G, B]
 * @param {number} t - Fraction between 0 and 1
 * @returns {string} Hex string in format #RRGGBB
 */
function interpolateColor(colorStart, colorEnd, t) {
  const r = Math.round(colorStart[0] + t * (colorEnd[0] - colorStart[0]));
  const g = Math.round(colorStart[1] + t * (colorEnd[1] - colorStart[1]));
  const b = Math.round(colorStart[2] + t * (colorEnd[2] - colorStart[2]));
  
  const toHex = (c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Maps a safety/comfort score (0.0 to 1.0) to a hex color string using linear interpolation.
 * @param {number} score - Comfort/safety score between 0.0 and 1.0
 * @returns {string} Hex color string
 */
export function scoreToColor(score) {
  // Clamp score between 0.0 and 1.0
  const clamped = Math.max(0, Math.min(1.0, score));

  const red = [255, 68, 68];      // #FF4444
  const orange = [255, 140, 0];    // #FF8C00
  const yellow = [255, 215, 0];    // #FFD700
  const green = [34, 197, 94];     // #22C55E

  if (clamped <= 0.33) {
    const t = clamped / 0.33;
    return interpolateColor(red, orange, t);
  } else if (clamped <= 0.66) {
    const t = (clamped - 0.33) / 0.33;
    return interpolateColor(orange, yellow, t);
  } else {
    const t = (clamped - 0.66) / 0.34;
    return interpolateColor(yellow, green, t);
  }
}

/**
 * Maps a safety/comfort score (0.0 to 1.0) to a descriptive label.
 * @param {number} score - Comfort/safety score between 0.0 and 1.0
 * @returns {string} "Hot" | "Warm" | "Cool"
 */
export function scoreToLabel(score) {
  const clamped = Math.max(0, Math.min(1.0, score));
  if (clamped <= 0.33) {
    return "Hot";
  } else if (clamped <= 0.66) {
    return "Warm";
  } else {
    return "Cool";
  }
}

/**
 * Maps a safety/comfort score (0.0 to 1.0) to a static Tailwind bg- class name.
 * @param {number} score - Comfort/safety score between 0.0 and 1.0
 * @returns {string} Tailwind class name string
 */
export function scoreToBgClass(score) {
  const clamped = Math.max(0, Math.min(1.0, score));
  if (clamped <= 0.33) {
    return "bg-red-500";
  } else if (clamped <= 0.66) {
    return "bg-amber-400";
  } else {
    return "bg-green-500";
  }
}
