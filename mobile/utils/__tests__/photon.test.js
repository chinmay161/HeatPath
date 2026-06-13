import { searchPlaces } from '../../api/photon';

describe('searchPlaces', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return empty array when query is empty or only whitespace', async () => {
    const res1 = await searchPlaces('');
    const res2 = await searchPlaces('   ');
    expect(res1).toEqual([]);
    expect(res2).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should call Photon API with query and location bias and return formatted results', async () => {
    const mockGeoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [72.8347, 18.9220], // lon, lat
          },
          properties: {
            name: 'Mumbai Central',
            city: 'Mumbai',
            state: 'Maharashtra',
            country: 'India',
            osm_value: 'station',
          },
        },
      ],
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockGeoJson,
    });

    const results = await searchPlaces('Mumbai Central', 18.9220, 72.8347);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('q=Mumbai%20Central'),
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('lat=18.922'),
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('lon=72.8347'),
      expect.any(Object)
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      label: 'Mumbai Central, Mumbai, Maharashtra',
      lat: 18.9220,
      lon: 72.8347, // flipped properly
      osm_value: 'station',
    });
  });

  it('should correctly omit null/undefined address parts from the label', async () => {
    const mockGeoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [72.8347, 18.9220],
          },
          properties: {
            name: 'Gateway of India',
            state: 'Maharashtra',
          },
        },
      ],
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockGeoJson,
    });

    const results = await searchPlaces('Gateway');
    expect(results[0].label).toBe('Gateway of India, Maharashtra');
  });

  it('should return empty array and not throw on API error', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const results = await searchPlaces('Mumbai');
    expect(results).toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  it('should return empty array and not throw on network rejection', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network failure'));

    const results = await searchPlaces('Mumbai');
    expect(results).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});
