import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

// Same SVG path strings as the reference icons.jsx — line, 2px, rounded
const PATHS: Record<string, string> = {
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  gps: '<path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
  shade: '<path d="M12 2a7 7 0 1 0 10 10 9 9 0 1 1-10-10Z"/>',
  park: '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"/><path d="M12 22v-3"/>',
  water: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7Z"/>',
  ac: '<path d="M2 6h20M2 12h20M2 18h12M17 16a2 2 0 1 1 1 3.7"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9Z"/>',
  crowd: '<path d="M3 12a9 9 0 0 1 9-9M21 12a9 9 0 0 1-9 9"/><path d="M9 12a3 3 0 0 1 6 0"/>',
  heat: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.5-4.3 1-6-.2 2 1.3 3.3 2.5 4.5C16 9.3 17 11 17 13a5 5 0 0 1-10 .5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  temp: '<path d="M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/><path d="M14 9h-4"/>',
  map: '<path d="M9.2 4.2 4 6v14l5.2-1.8 5.6 2 5.2-1.8V6.4L14.8 8Z"/><path d="M9.2 4.2V18M14.8 8v12"/>',
  heatmap: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2Z"/><path d="M9 4v16M15 6v16"/>',
  home: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-3v-7H8v7H5a2 2 0 0 1-2-2Z"/>',
  routes: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-3.5 3.6-6 8-6s8 2.5 8 6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  trophy: '<circle cx="12" cy="8" r="6"/><path d="m8.5 13-1.5 8 5-3 5 3-1.5-8"/>',
  lock: '<rect x="4" y="9" width="16" height="12" rx="2"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>',
};

function extractAttr(s: string, attr: string): string {
  const m = s.match(new RegExp(`${attr}="([^"]+)"`));
  return m ? m[1] : '';
}

function parseElements(svgStr: string, stroke: string, sw: number): React.ReactElement[] {
  const elems: React.ReactElement[] = [];
  let k = 0;

  // <path .../>
  const pr = /<path\s+([^>]*?)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = pr.exec(svgStr))) {
    const a = m[1];
    const d = extractAttr(a, 'd');
    const fill = a.includes('fill=') ? extractAttr(a, 'fill') : 'none';
    elems.push(
      <Path
        key={k++}
        d={d}
        stroke={stroke}
        strokeWidth={sw}
        fill={fill}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  // <circle .../>
  const cr = /<circle\s+([^>]*?)\/>/g;
  while ((m = cr.exec(svgStr))) {
    const a = m[1];
    const fill = a.includes('fill=') ? extractAttr(a, 'fill') : 'none';
    const stroke2 = a.includes('stroke="none"') ? 'none' : stroke;
    const sw2 = a.includes('stroke="none"') ? 0 : sw;
    const realFill = a.includes('stroke="none"') ? stroke : fill;
    elems.push(
      <Circle
        key={k++}
        cx={parseFloat(extractAttr(a, 'cx'))}
        cy={parseFloat(extractAttr(a, 'cy'))}
        r={parseFloat(extractAttr(a, 'r'))}
        stroke={stroke2}
        strokeWidth={sw2}
        fill={realFill}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  // <rect .../>
  const rr = /<rect\s+([^>]*?)\/>/g;
  while ((m = rr.exec(svgStr))) {
    const a = m[1];
    const fill = a.includes('fill=') ? extractAttr(a, 'fill') : 'none';
    const rxv = a.includes('rx=') ? parseFloat(extractAttr(a, 'rx')) : undefined;
    const op = a.includes('opacity=') ? parseFloat(extractAttr(a, 'opacity')) : 1;
    elems.push(
      <Rect
        key={k++}
        x={parseFloat(extractAttr(a, 'x') || '0')}
        y={parseFloat(extractAttr(a, 'y') || '0')}
        width={parseFloat(extractAttr(a, 'width'))}
        height={parseFloat(extractAttr(a, 'height'))}
        rx={rxv}
        stroke={stroke}
        strokeWidth={sw}
        fill={fill}
        opacity={op}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  return elems;
}

interface IconProps {
  name: string;
  size?: number;
  stroke?: string;
  width?: number;
}

export default function Icon({ name, size = 20, stroke = '#15241C', width = 2 }: IconProps) {
  const svgStr = PATHS[name] || '';
  const elements = parseElements(svgStr, stroke, width);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {elements}
    </Svg>
  );
}
