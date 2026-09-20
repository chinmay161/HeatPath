#!/usr/bin/env bash
set -e

# ==============================================================================
# HeatPath - Western Zone Shade Data Importer for Neon PostGIS
#
# This script:
# 1. Parses the Neon connection string and configures standard PostgreSQL credentials
# 2. Uses the filtered Western Zone shade PBF (western-zone-shade.osm.pbf, 39 MB)
# 3. Imports only shade-casting features (buildings, trees, forests, shelters) into Neon PostGIS
# 4. Uses `osm2pgsql --drop` to eliminate intermediate cache tables, keeping storage under ~300 MB
# 5. Generates the necessary GiST spatial indexes for high-speed (2-5ms) shade queries
# ==============================================================================

cd "$(dirname "$0")/../.."
REPO_ROOT=$(pwd)

echo "=================================================================="
echo " HeatPath - Neon PostGIS Western Zone Importer"
echo "=================================================================="
echo "[setup] Repo root: ${REPO_ROOT}"

# Check for required tools
command -v osmium >/dev/null 2>&1 || { echo "ERROR: osmium is required. Install with 'sudo apt-get install osmium-tool'."; exit 1; }
command -v osm2pgsql >/dev/null 2>&1 || { echo "ERROR: osm2pgsql is required. Install with 'sudo apt-get install osm2pgsql'."; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "ERROR: psql is required. Install with 'sudo apt-get install postgresql-client'."; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 is required."; exit 1; }

# Step 1: Check Neon Database Connection String
TARGET_DSN="${1:-$NEON_DATABASE_URL}"

if [ -z "$TARGET_DSN" ]; then
    echo "Usage: ./backend/scripts/setup_neon_postgis.sh <NEON_POSTGRES_URL>"
    echo "Or set NEON_DATABASE_URL in your environment."
    echo ""
    echo "Example:"
    echo "  ./backend/scripts/setup_neon_postgis.sh \"postgresql://neondb_owner:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require\""
    exit 1
fi

# Parse connection URL into standard PG environment variables
# Note: For bulk loaders like osm2pgsql, we target the direct endpoint (removing -pooler)
eval $(python3 -c "
import urllib.parse, sys
url = urllib.parse.urlparse(sys.argv[1])
host = url.hostname.replace('-pooler.', '.') if url.hostname else ''
print(f'export PGHOST=\"{host}\"')
print(f'export PGUSER=\"{url.username}\"')
print(f'export PGPASSWORD=\"{url.password}\"')
print(f'export PGDATABASE=\"{url.path.lstrip(\"/\")}\"')
print(f'export PGPORT=\"{url.port or 5432}\"')
print('export PGSSLMODE=\"require\"')
" "$TARGET_DSN")

echo "[setup] Connecting to Neon host: ${PGHOST}:${PGPORT} (database: ${PGDATABASE}, user: ${PGUSER})"

# Test connection
echo "[setup] Testing Neon connection..."
psql -c "SELECT version();" >/dev/null
echo "[setup] Connection verified successfully!"

# Step 2: Ensure shade PBF is ready
OUTPUT_PBF="./western-zone-shade.osm.pbf"
if [ -f "$OUTPUT_PBF" ]; then
    FILTERED_SIZE=$(stat -c%s "$OUTPUT_PBF")
    echo "[setup] Using existing filtered PBF: ${OUTPUT_PBF} ($((FILTERED_SIZE / 1024 / 1024)) MB)"
else
    INPUT_PBF="./western-zone-clipped.osm.pbf"
    if [ ! -f "$INPUT_PBF" ]; then
        INPUT_PBF="./western-zone-latest.osm.pbf"
    fi

    if [ ! -f "$INPUT_PBF" ]; then
        echo "ERROR: Could not find western-zone-clipped.osm.pbf or western-zone-latest.osm.pbf in repo root."
        exit 1
    fi

    ORIG_SIZE=$(stat -c%s "$INPUT_PBF")
    echo "[setup] Found input PBF: ${INPUT_PBF} ($((ORIG_SIZE / 1024 / 1024)) MB)"
    echo "[setup] Filtering non-shade data for the entire Western Zone..."
    echo "[setup] Keeping: buildings, trees, wood/forests, covered structures, bridges, and shelters..."

    osmium tags-filter "$INPUT_PBF" \
      w/building \
      n/natural=tree \
      w/natural=wood,tree_row \
      w/landuse=forest \
      w/covered=yes w/bridge=yes \
      nw/amenity=shelter \
      -o "$OUTPUT_PBF" --overwrite

    FILTERED_SIZE=$(stat -c%s "$OUTPUT_PBF")
    echo "[setup] Filtered PBF created: ${OUTPUT_PBF} ($((FILTERED_SIZE / 1024 / 1024)) MB)"
fi

# Step 3: Enable PostGIS extensions on Neon
echo "[setup] Ensuring PostGIS and hstore extensions are enabled..."
psql -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -c "CREATE EXTENSION IF NOT EXISTS hstore;"

# Step 4: Import with osm2pgsql (--drop frees up slim cache tables)
echo "[setup] Importing shade geometries into Neon with osm2pgsql (--drop)..."
osm2pgsql \
  --create --slim --drop \
  -E 4326 \
  --hstore \
  -C 1000 \
  "$OUTPUT_PBF"

# Step 5: Create spatial GiST indexes for millisecond query times
echo "[setup] Creating spatial GiST indexes..."
psql -c "CREATE INDEX IF NOT EXISTS idx_osm_point_way ON planet_osm_point USING GIST(way);"
psql -c "CREATE INDEX IF NOT EXISTS idx_osm_polygon_way ON planet_osm_polygon USING GIST(way);"
psql -c "CREATE INDEX IF NOT EXISTS idx_osm_line_way ON planet_osm_line USING GIST(way);"
psql -c "CREATE INDEX IF NOT EXISTS idx_osm_point_way_geog ON planet_osm_point USING GIST((way::geography));"
psql -c "CREATE INDEX IF NOT EXISTS idx_osm_polygon_way_geog ON planet_osm_polygon USING GIST((way::geography));"
psql -c "CREATE INDEX IF NOT EXISTS idx_osm_line_way_geog ON planet_osm_line USING GIST((way::geography));"

# Step 6: Verification
echo "=================================================================="
echo " Verification & Row Counts"
echo "=================================================================="
psql -c "
SELECT 'planet_osm_point' as table_name, count(*) as count FROM planet_osm_point
UNION ALL
SELECT 'planet_osm_polygon' as table_name, count(*) as count FROM planet_osm_polygon
UNION ALL
SELECT 'planet_osm_line' as table_name, count(*) as count FROM planet_osm_line;
"

echo "[setup] Calculating total database size on Neon..."
psql -c "
SELECT pg_size_pretty(pg_database_size(current_database())) as total_db_size;
"

echo "=================================================================="
echo " Setup complete! Your Neon PostGIS database is ready for HeatPath."
echo " Set POSTGIS_DSN in your Render environment variables:"
echo " POSTGIS_DSN=${TARGET_DSN}"
echo "=================================================================="
