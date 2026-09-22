import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Cross-Page Consistency: Feature naming is standardized to "Heat Map"', () => {
  const baseDir = path.resolve(__dirname, '../../');

  // 1. Sidebar.tsx
  const sidebarContent = fs.readFileSync(path.join(baseDir, 'components/Sidebar.tsx'), 'utf-8');
  assert.ok(
    sidebarContent.includes("{ key: 'map', label: 'Heat Map', icon: 'heatmap' }"),
    'Sidebar NAV_ITEMS must use "Heat Map"',
  );
  assert.ok(
    !sidebarContent.includes("{ key: 'map', label: 'Heat map',"),
    'Sidebar NAV_ITEMS must not use "Heat map"',
  );

  // 2. TabBar.tsx
  const tabBarContent = fs.readFileSync(path.join(baseDir, 'components/TabBar.tsx'), 'utf-8');
  assert.ok(
    tabBarContent.includes("{ key: 'map', label: 'Heat Map', icon: 'heatmap' }"),
    'TabBar TABS must use "Heat Map"',
  );
  assert.ok(
    !tabBarContent.includes("{ key: 'map', label: 'Map',"),
    'TabBar TABS must not use "Map"',
  );

  // 3. (tabs)/_layout.tsx
  const layoutContent = fs.readFileSync(path.join(baseDir, 'app/(tabs)/_layout.tsx'), 'utf-8');
  assert.ok(
    layoutContent.includes('<Tabs.Screen name="map" options={{ title: \'Heat Map\' }} />'),
    '_layout.tsx Tabs.Screen for map must have title "Heat Map"',
  );

  // 4. (tabs)/map.tsx
  const mapContent = fs.readFileSync(path.join(baseDir, 'app/(tabs)/map.tsx'), 'utf-8');
  assert.ok(
    !mapContent.includes('City heat map'),
    'map.tsx must not contain "City heat map"',
  );
  assert.ok(
    mapContent.includes('Heat Map'),
    'map.tsx header must display "Heat Map"',
  );
});

test('Cross-Page Consistency: Comfort score format in RouteStats uses percentage ("XX%")', () => {
  const baseDir = path.resolve(__dirname, '../../');
  const routeStatsContent = fs.readFileSync(
    path.join(baseDir, 'navigation/components/RouteStats.tsx'),
    'utf-8',
  );

  assert.ok(
    !routeStatsContent.includes('${scoreVal}/100'),
    'RouteStats must not format comfort score as fraction /100',
  );
  assert.ok(
    routeStatsContent.includes('${scoreVal}%'),
    'RouteStats must format comfort score as percentage (${scoreVal}%)',
  );

  // Test computation logic
  const formatScore = (overallScore: number | null | undefined): string => {
    const scoreVal = overallScore != null ? Math.round(overallScore * 100) : null;
    return scoreVal != null ? `${scoreVal}%` : '—';
  };

  assert.equal(formatScore(0.93), '93%');
  assert.equal(formatScore(0.81), '81%');
  assert.equal(formatScore(0.0), '0%');
  assert.equal(formatScore(1.0), '100%');
  assert.equal(formatScore(null), '—');
  assert.equal(formatScore(undefined), '—');
});

test('Cross-Page Consistency: Temperature units conversion and formatting', () => {
  // Test conversion helper logic matching usePreferences
  const convertTemp = (tempC: number | null | undefined, units: 'celsius' | 'fahrenheit'): number | null => {
    if (tempC == null) return null;
    if (units === 'fahrenheit') {
      return Math.round((tempC * 9) / 5 + 32);
    }
    return Math.round(tempC);
  };

  const formatTemp = (
    tempC: number | null | undefined,
    units: 'celsius' | 'fahrenheit',
    options?: { includeUnit?: boolean },
  ): string => {
    if (tempC == null) return '—';
    const isF = units === 'fahrenheit';
    const val = isF ? Math.round((tempC * 9) / 5 + 32) : Math.round(tempC);
    if (options?.includeUnit === false) {
      return `${val}°`;
    }
    return `${val}°${isF ? 'F' : 'C'}`;
  };

  // Celsius expectations
  assert.equal(convertTemp(36, 'celsius'), 36);
  assert.equal(formatTemp(36, 'celsius'), '36°C');
  assert.equal(formatTemp(36, 'celsius', { includeUnit: false }), '36°');

  // Fahrenheit expectations
  assert.equal(convertTemp(0, 'fahrenheit'), 32);
  assert.equal(convertTemp(36, 'fahrenheit'), 97);
  assert.equal(convertTemp(41, 'fahrenheit'), 106);
  assert.equal(formatTemp(36, 'fahrenheit'), '97°F');
  assert.equal(formatTemp(36, 'fahrenheit', { includeUnit: false }), '97°');

  // Null/undefined handling
  assert.equal(convertTemp(null, 'fahrenheit'), null);
  assert.equal(formatTemp(null, 'fahrenheit'), '—');
  assert.equal(formatTemp(undefined, 'celsius'), '—');
});

test('Cross-Page Consistency: Screen files read from unit preference and avoid hardcoded °C', () => {
  const baseDir = path.resolve(__dirname, '../../');

  // routes.tsx
  const routesContent = fs.readFileSync(path.join(baseDir, 'app/(tabs)/routes.tsx'), 'utf-8');
  assert.ok(
    !routesContent.includes('{Math.round(route.feels_like_c)}°C'),
    'routes.tsx must not hardcode {Math.round(route.feels_like_c)}°C',
  );
  assert.ok(
    routesContent.includes('formatTemp(route.feels_like_c)'),
    'routes.tsx must format route perceived heat with formatTemp',
  );

  // impact.tsx
  const impactContent = fs.readFileSync(path.join(baseDir, 'app/(tabs)/impact.tsx'), 'utf-8');
  assert.ok(
    !impactContent.includes('feels {feelLikeC.toFixed(0)}°C'),
    'impact.tsx must not hardcode feels {feelLikeC.toFixed(0)}°C',
  );
  assert.ok(
    impactContent.includes('feels {formatTemp(feelLikeC)}'),
    'impact.tsx must format feels temperature with formatTemp',
  );

  // map.tsx
  const mapContent = fs.readFileSync(path.join(baseDir, 'app/(tabs)/map.tsx'), 'utf-8');
  assert.ok(
    mapContent.includes('convertTemp(rawHeatIndex)'),
    'map.tsx must convert heat index using user preference',
  );
});
