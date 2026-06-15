export function getThermalStress(feelsLikeC) {
  if (feelsLikeC < 27) return { label: 'Low',      color: '#16a34a', bg: '#f0fdf4' };
  if (feelsLikeC < 32) return { label: 'Moderate', color: '#ca8a04', bg: '#fefce8' };
  if (feelsLikeC < 39) return { label: 'High',     color: '#ea580c', bg: '#fff7ed' };
  return                     { label: 'Extreme',  color: '#dc2626', bg: '#fef2f2' };
}
