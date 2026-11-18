#!/usr/bin/env bash
# Requiere una base PostgreSQL 16 vacía y desechable, seleccionada mediante PG*.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${PGDATABASE:?Indica una base de pruebas desechable con PGDATABASE}"

psql -X -v ON_ERROR_STOP=1 \
  -f practica12/sql/00_esquema_local.sql \
  -f supabase/migrations/20261024_cotizaciones_moviles.sql \
  -f supabase/migrations/20261024_acompanantes_sin_ocupacion.sql \
  -f practica13-14/persistencia.sql
