import os
import logging
import asyncio
import asyncpg
from dotenv import load_dotenv
from typing import List, Dict, Any

load_dotenv()

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool = None

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = os.environ.get(
            "POSTGIS_DSN", 
            "postgresql://heatpath_app:heatpath_secure_pass_2026@127.0.0.1:5433/heatpath_osm"
        )
        logger.info(f"Initializing PostGIS connection pool with DSN: {dsn}")
        _pool = await asyncpg.create_pool(
            dsn=dsn,
            min_size=2,
            max_size=10,
            ssl='disable'
        )
    return _pool

async def fetch_shade_features_postgis(lat: float, lon: float, radius_m: int = 60) -> tuple[List[Dict[str, Any]], str]:
    """
    Query PostGIS for shade-contributing features within radius_m of (lat, lon).
    Returns (features, source) matching the same shape Overpass returns.
    """
    try:
        pool = await get_pool()
    except Exception as e:
        logger.warning(f"Failed to connect to PostGIS pool: {e}")
        return [], "postgis_error"

    # PostGIS queries use WGS84 geography ST_DWithin.
    # $1 = lon, $2 = lat, $3 = radius_m.
    # Note that ST_MakePoint(lon, lat) is standard.
    
    # Query 1: Trees (points)
    query_trees = """
        SELECT 'tree' as feature_type, ST_X(way) as lon, ST_Y(way) as lat,
               "natural", tags->'crown_diameter' as crown_diameter, 
               tags->'diameter_crown' as diameter_crown, tags->'radius' as radius,
               tags->'width' as width, tags->'height' as height
        FROM planet_osm_point
        WHERE "natural" = 'tree'
          AND ST_DWithin(way::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3);
    """

    # Query 2: Buildings (polygons)
    query_buildings = """
        SELECT 'building' as feature_type, ST_X(ST_Centroid(way)) as lon, ST_Y(ST_Centroid(way)) as lat,
               building, tags->'height' as height, tags->'building:levels' as building_levels,
               tags->'levels' as levels
        FROM planet_osm_polygon
        WHERE building IS NOT NULL AND building != 'no'
          AND ST_DWithin(way::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3);
    """

    # Query 3: Forests / Woods (polygons)
    query_forests = """
        SELECT 'forest' as feature_type, ST_X(ST_Centroid(way)) as lon, ST_Y(ST_Centroid(way)) as lat,
               landuse, "natural"
        FROM planet_osm_polygon
        WHERE (landuse = 'forest' OR "natural" = 'wood')
          AND ST_DWithin(way::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3);
    """

    # Query 4: Bridges and covered ways (lines)
    query_lines = """
        SELECT 'line' as feature_type, ST_X(ST_Centroid(way)) as lon, ST_Y(ST_Centroid(way)) as lat,
               bridge, highway, railway, covered, tags->'covered' as tags_covered, tags->'bridge' as tags_bridge
        FROM planet_osm_line
        WHERE (bridge = 'yes' OR tags->'bridge' = 'yes' OR covered = 'yes' OR tags->'covered' = 'yes')
          AND ST_DWithin(way::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3);
    """

    # Query 5: Bridges, covered ways, and roof buildings (polygons)
    query_polygons_lines = """
        SELECT 'polygon_line' as feature_type, ST_X(ST_Centroid(way)) as lon, ST_Y(ST_Centroid(way)) as lat,
               bridge, highway, railway, covered, tags->'covered' as tags_covered, tags->'bridge' as tags_bridge,
               building
        FROM planet_osm_polygon
        WHERE (bridge = 'yes' OR tags->'bridge' = 'yes' OR covered = 'yes' OR tags->'covered' = 'yes' OR building = 'roof' OR tags->'building' = 'roof')
          AND ST_DWithin(way::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3);
    """

    # Query 6: Shelters (points and polygons)
    query_shelters_point = """
        SELECT 'shelter_point' as feature_type, ST_X(way) as lon, ST_Y(way) as lat,
               amenity, tags->'shelter_type' as shelter_type
        FROM planet_osm_point
        WHERE (amenity = 'shelter' OR tags->'shelter_type' = 'public_transport' OR tags->'amenity' = 'shelter')
          AND ST_DWithin(way::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3);
    """

    query_shelters_polygon = """
        SELECT 'shelter_polygon' as feature_type, ST_X(ST_Centroid(way)) as lon, ST_Y(ST_Centroid(way)) as lat,
               amenity, tags->'shelter_type' as shelter_type
        FROM planet_osm_polygon
        WHERE (amenity = 'shelter' OR tags->'shelter_type' = 'public_transport' OR tags->'amenity' = 'shelter')
          AND ST_DWithin(way::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3);
    """

    try:
        async with pool.acquire() as conn:
            # Run all queries concurrently
            results = await asyncio.gather(
                conn.fetch(query_trees, lon, lat, radius_m),
                conn.fetch(query_buildings, lon, lat, radius_m),
                conn.fetch(query_forests, lon, lat, radius_m),
                conn.fetch(query_lines, lon, lat, radius_m),
                conn.fetch(query_polygons_lines, lon, lat, radius_m),
                conn.fetch(query_shelters_point, lon, lat, radius_m),
                conn.fetch(query_shelters_polygon, lon, lat, radius_m),
            )
        
        features = []
        
        # Flatten and process results
        for rows in results:
            for row in rows:
                f_type = row['feature_type']
                lat_val = float(row['lat'])
                lon_val = float(row['lon'])
                
                tags = {}
                
                if f_type == 'tree':
                    tags['natural'] = 'tree'
                    for key in ['crown_diameter', 'diameter_crown', 'radius', 'width', 'height']:
                        if row[key] is not None:
                            tags[key] = str(row[key])
                            
                elif f_type == 'building':
                    tags['building'] = row['building']
                    for key in ['height', 'building_levels', 'levels']:
                        val = row[key]
                        if val is not None:
                            # Map building_levels back to building:levels in output tags
                            out_key = 'building:levels' if key == 'building_levels' else key
                            tags[out_key] = str(val)
                            
                elif f_type == 'forest':
                    if row['landuse'] is not None:
                        tags['landuse'] = row['landuse']
                    if row['natural'] is not None:
                        tags['natural'] = row['natural']
                        
                elif f_type in ('line', 'polygon_line'):
                    # Bridge
                    is_bridge = (row['bridge'] == 'yes' or row['tags_bridge'] == 'yes')
                    if is_bridge:
                        tags['bridge'] = 'yes'
                        if row['highway'] is not None:
                            tags['highway'] = row['highway']
                        if row['railway'] is not None:
                            tags['railway'] = row['railway']
                    
                    # Covered
                    is_covered = (row['covered'] == 'yes' or row['tags_covered'] == 'yes')
                    if is_covered:
                        tags['covered'] = 'yes'
                        
                    # Roof building
                    if f_type == 'polygon_line':
                        if row['building'] == 'roof':
                            tags['building'] = 'roof'
                            
                elif f_type in ('shelter_point', 'shelter_polygon'):
                    tags['amenity'] = 'shelter'
                    if row['shelter_type'] is not None:
                        tags['shelter_type'] = row['shelter_type']
                
                if tags:
                    features.append({
                        "lat": lat_val,
                        "lon": lon_val,
                        "tags": tags,
                        "feature_type": f_type
                    })
        
        if not features:
            return [], "postgis_empty"
            
        return features, "postgis"

    except Exception as e:
        logger.error(f"Error querying PostGIS: {type(e).__name__}: {e}")
        return [], "postgis_error"
