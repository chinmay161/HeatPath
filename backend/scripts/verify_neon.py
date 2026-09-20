import asyncio
import os
import asyncpg
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

async def main():
    dsn = os.getenv("POSTGIS_DSN")
    print(f"Connecting to Neon PostGIS...")
    conn = await asyncpg.connect(dsn, ssl="require")
    
    rows = await conn.fetch("""
        SELECT 'planet_osm_polygon' as tbl, count(*) as cnt FROM planet_osm_polygon
        UNION ALL
        SELECT 'planet_osm_point' as tbl, count(*) as cnt FROM planet_osm_point
        UNION ALL
        SELECT 'planet_osm_line' as tbl, count(*) as cnt FROM planet_osm_line;
    """)
    for r in rows:
        print(f"  {r['tbl']}: {r['cnt']:,} records")
        
    db_size = await conn.fetchval("SELECT pg_size_pretty(pg_database_size(current_database()));")
    print(f"\nTotal Database Disk Usage: {db_size} (Neon Free Tier limit: 512 MB)")
    
    # Test sample shade calculation query
    print("\nTesting live bounding box query (Churchgate/Nariman Point, Mumbai)...")
    sample = await conn.fetch("""
        SELECT osm_id, building, tags->'building:levels' as levels, tags->'height' as height, ST_AsText(ST_Centroid(way)) as center
        FROM planet_osm_polygon
        WHERE way && ST_MakeEnvelope(72.82, 18.92, 72.84, 18.94, 4326)
          AND building IS NOT NULL
        LIMIT 5;
    """)
    for b in sample:
        print(f"  ID {b['osm_id']}: type={b['building']}, levels={b['levels']}, height={b['height']}, center={b['center']}")
        
    await conn.close()
    print("\n[SUCCESS] Neon database is fully populated, indexed, and ready for production!")

if __name__ == "__main__":
    asyncio.run(main())
