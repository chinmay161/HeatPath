#!/usr/bin/env bash
set -e

# Change directory to the repository root
cd "$(dirname "$0")/../.."
REPO_ROOT=$(pwd)

echo "[setup] Repo root resolved to: ${REPO_ROOT}"

# Step 1: Verify western-zone-latest.osm.pbf exists
PBF_FILE="./western-zone-latest.osm.pbf"
if [ ! -f "$PBF_FILE" ]; then
    echo "ERROR: ${PBF_FILE} is missing."
    exit 1
fi

ORIG_SIZE=$(stat -c%s "$PBF_FILE")
echo "[setup] Original: $((ORIG_SIZE / 1024 / 1024))MB (Exact bytes: ${ORIG_SIZE})"

# Step 2: Clip out Arabian Sea using osmium
CLIPPED_FILE="./western-zone-clipped.osm.pbf"
echo "[setup] Clipping ocean-side coastline..."
osmium extract --bbox 72.6,15.0,76.5,24.0 "$PBF_FILE" -o "$CLIPPED_FILE" --overwrite

CLIPPED_SIZE=$(stat -c%s "$CLIPPED_FILE")
echo "[setup] Original: $((ORIG_SIZE / 1024 / 1024))MB → ocean-clipped: $((CLIPPED_SIZE / 1024 / 1024))MB (Exact bytes: ${CLIPPED_SIZE})"

# Step 3: Set up PostGIS database
echo "[setup] Starting PostgreSQL service..."
sudo service postgresql start

echo "[setup] Creating database and enabling PostGIS..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS heatpath_osm;"
sudo -u postgres psql -c "CREATE DATABASE heatpath_osm;"
sudo -u postgres psql -d heatpath_osm -c "CREATE EXTENSION IF NOT EXISTS postgis;"
sudo -u postgres psql -d heatpath_osm -c "CREATE EXTENSION IF NOT EXISTS hstore;"

echo "[setup] Creating app user and setting up permissions..."
sudo -u postgres psql -c "DROP USER IF EXISTS heatpath_app;"
sudo -u postgres psql -c "CREATE USER heatpath_app WITH PASSWORD 'heatpath_secure_pass_2026';"
sudo -u postgres psql -d heatpath_osm -c "GRANT ALL PRIVILEGES ON DATABASE heatpath_osm TO heatpath_app;"
sudo -u postgres psql -d heatpath_osm -c "GRANT ALL ON SCHEMA public TO heatpath_app;"

# Step 4: Import with osm2pgsql
# We limit cache (-C) to 2000 MB.
# --slim keeps intermediate tables.
# -E 4326 imports in WGS84 coordinates.
# --hstore captures all additional tags.
echo "[setup] Importing OSM data into PostGIS using osm2pgsql..."
PGPASSWORD='heatpath_secure_pass_2026' osm2pgsql -d heatpath_osm -U heatpath_app -H 127.0.0.1 -P 5433 \
  --create --slim \
  -E 4326 \
  --hstore \
  -C 2000 \
  "$CLIPPED_FILE"

# Grant permissions on newly created osm2pgsql tables to the app user
sudo -u postgres psql -d heatpath_osm -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO heatpath_app;"
sudo -u postgres psql -d heatpath_osm -c "GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO heatpath_app;"

# Step 5: Add spatial index (critical for query speed)
echo "[setup] Creating spatial indexes..."
sudo -u postgres psql -d heatpath_osm -c "CREATE INDEX IF NOT EXISTS idx_osm_point_way ON planet_osm_point USING GIST(way);"
sudo -u postgres psql -d heatpath_osm -c "CREATE INDEX IF NOT EXISTS idx_osm_polygon_way ON planet_osm_polygon USING GIST(way);"
sudo -u postgres psql -d heatpath_osm -c "CREATE INDEX IF NOT EXISTS idx_osm_line_way ON planet_osm_line USING GIST(way);"
sudo -u postgres psql -d heatpath_osm -c "CREATE INDEX IF NOT EXISTS idx_osm_point_way_geog ON planet_osm_point USING GIST((way::geography));"
sudo -u postgres psql -d heatpath_osm -c "CREATE INDEX IF NOT EXISTS idx_osm_polygon_way_geog ON planet_osm_polygon USING GIST((way::geography));"
sudo -u postgres psql -d heatpath_osm -c "CREATE INDEX IF NOT EXISTS idx_osm_line_way_geog ON planet_osm_line USING GIST((way::geography));"

# Verify indices and log row counts
echo "[setup] Post-import Verification:"
echo "--- Row counts ---"
sudo -u postgres psql -d heatpath_osm -c "SELECT COUNT(*) FROM planet_osm_point;"
sudo -u postgres psql -d heatpath_osm -c "SELECT COUNT(*) FROM planet_osm_line;"
sudo -u postgres psql -d heatpath_osm -c "SELECT COUNT(*) FROM planet_osm_polygon;"
sudo -u postgres psql -d heatpath_osm -c "SELECT COUNT(*) FROM planet_osm_roads;"

echo "--- Forest / Wood polygon count ---"
sudo -u postgres psql -d heatpath_osm -c "SELECT COUNT(*) FROM planet_osm_polygon WHERE landuse='forest' OR \"natural\"='wood';"
