/**
 * TileProvider.ts
 *
 * Centralized Tile & Style Management for MapLibre GL.
 * Never hardcodes tile URLs across components.
 */

export interface TileProviderConfig {
  readonly id: string;
  readonly name: string;
  readonly type: 'raster' | 'vector' | 'styleUrl';
  readonly url?: string;
  readonly tiles?: readonly string[];
  readonly tileSize?: number;
  readonly attribution: string;
  readonly minZoom: number;
  readonly maxZoom: number;
}

export const TILE_PROVIDERS: Record<string, TileProviderConfig> = {
  OSM_RASTER: {
    id: 'osm_raster',
    name: 'OpenStreetMap Standard',
    type: 'raster',
    tiles: [
      'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
    ],
    tileSize: 256,
    attribution: '© OpenStreetMap contributors',
    minZoom: 0,
    maxZoom: 19,
  },
  MAPLIBRE_DEMO: {
    id: 'maplibre_demo',
    name: 'MapLibre Bright',
    type: 'styleUrl',
    url: 'https://demotiles.maplibre.org/style.json',
    attribution: '© MapLibre contributors',
    minZoom: 0,
    maxZoom: 20,
  },
  CARTO_LIGHT: {
    id: 'carto_light',
    name: 'CartoDB Positron',
    type: 'raster',
    tiles: [
      'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    ],
    tileSize: 256,
    attribution: '© CARTO, © OpenStreetMap contributors',
    minZoom: 0,
    maxZoom: 19,
  },
} as const;

export type TileProviderId = keyof typeof TILE_PROVIDERS;

export const DEFAULT_TILE_PROVIDER: TileProviderId = 'OSM_RASTER';

/**
 * Builds a MapLibre Style Specification JSON for raster providers,
 * or returns the remote style URL for vector/demo styles.
 */
export function getMapLibreStyle(providerId: TileProviderId = DEFAULT_TILE_PROVIDER): string | object {
  const provider = TILE_PROVIDERS[providerId] ?? TILE_PROVIDERS[DEFAULT_TILE_PROVIDER];

  if (provider.type === 'styleUrl' && provider.url) {
    return provider.url;
  }

  // Generate MapLibre GL Style Spec v8 JSON for raster tile providers
  return {
    version: 8,
    name: provider.name,
    sources: {
      'raster-tiles': {
        type: 'raster',
        tiles: provider.tiles ?? [],
        tileSize: provider.tileSize ?? 256,
        attribution: provider.attribution,
        minzoom: provider.minZoom,
        maxzoom: provider.maxZoom,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#F3F6F1',
        },
      },
      {
        id: 'base-raster-layer',
        type: 'raster',
        source: 'raster-tiles',
        minzoom: provider.minZoom,
        maxzoom: provider.maxZoom,
        paint: {
          'raster-opacity': 1.0,
          'raster-fade-duration': 200,
        },
      },
    ],
  };
}

export function getAttributionString(providerId: TileProviderId = DEFAULT_TILE_PROVIDER): string {
  const provider = TILE_PROVIDERS[providerId] ?? TILE_PROVIDERS[DEFAULT_TILE_PROVIDER];
  return provider.attribution;
}
