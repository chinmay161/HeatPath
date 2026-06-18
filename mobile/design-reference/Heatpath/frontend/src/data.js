// HeatPath shared data — conditions, routes, heat grid.
// Swap these for live API responses in production.

export const conditions = {
  location: 'Indiranagar, Bengaluru',
  date: 'Mon 17 Jun',
  feelsLike: 41,
  real: 36,
  humidity: 58,
  uv: 9,
  wind: 11,
  peak: 47,
  peakTime: '3 PM',
  severity: 'HIGH',
}

// Best-time-to-walk hourly bars (height %, severity color key)
export const bestTime = [
  { h: '6a', v: 34, sev: 'safe' },
  { h: '7a', v: 28, sev: 'safe', best: true },
  { h: '9a', v: 50, sev: 'caution' },
  { h: '12p', v: 74, sev: 'high' },
  { h: '3p', v: 100, sev: 'extreme' },
  { h: '5p', v: 62, sev: 'high' },
  { h: '7p', v: 36, sev: 'safe' },
]

export const routes = {
  coolest: {
    id: 'coolest', title: 'Coolest', sub: 'most shade · gentlest', icon: 'shade',
    iconBg: '#E6F4E2', iconColor: '#1C7C4A', severity: 'SAFE',
    min: '24 min', feels: '38°', feelsColor: '#E8843A', shade: '71%',
    bar: [[3, 'shade'], [1.2, 'high'], [2.6, 'shade'], [0.8, 'caution'], [2, 'shade']],
    seg: ['#1C7C4A', '#1C7C4A', '#1C7C4A'],
  },
  fastest: {
    id: 'fastest', title: 'Fastest', sub: 'least time', icon: 'bolt',
    iconBg: '#E1ECFB', iconColor: '#2563C9', severity: 'HIGH',
    min: '16 min', feels: '47°', feelsColor: '#C8322A', shade: '22%',
    bar: [[1, 'shade'], [3, 'high'], [1, 'shade'], [2.5, 'extreme'], [1, 'caution']],
    seg: ['#E8843A', '#C8322A', '#E8843A'],
  },
  quietest: {
    id: 'quietest', title: 'Quietest', sub: 'low crowd', icon: 'crowd',
    iconBg: '#EAF0E6', iconColor: '#445349', severity: 'CAUTION',
    min: '27 min', feels: '42°', feelsColor: '#E5B23C', shade: '54%',
    bar: [[2.4, 'shade'], [1.4, 'caution'], [2, 'shade'], [1.4, 'high'], [1.6, 'shade']],
    seg: ['#1C7C4A', '#E5B23C', '#E8843A'],
  },
}
export const routeOrder = ['coolest', 'fastest', 'quietest']

export const coolSpots = [
  { name: 'Cubbon Park', meta: '4 min · −6° cooler', icon: 'shade', tone: 'green' },
  { name: 'BWSSB Fountain', meta: '6 min · mist zone', icon: 'water', tone: 'blue' },
  { name: 'Garuda Mall', meta: '8 min · AC refuge', icon: 'ac', tone: 'blue' },
]

export const SEVERITY = {
  safe: '#29A35A', caution: '#E5B23C', high: '#E8843A', extreme: '#C8322A',
}

// 10×7 heat grid — deterministic sample pattern
export const heatGrid = Array.from({ length: 70 }, (_, i) => {
  const palette = ['safe', 'safe', 'caution', 'high', 'extreme', 'high', 'caution', 'safe', 'caution', 'safe']
  return palette[(i * 7 + (i % 5)) % palette.length]
})
