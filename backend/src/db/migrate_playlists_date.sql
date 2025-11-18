-- Migración: Eliminar description y agregar scheduled_date a playlists
-- Ejecutar: psql -U postgres -d cinechronic -f migrate_playlists_date.sql

-- Eliminar el campo description
ALTER TABLE playlists DROP COLUMN IF EXISTS description;

-- Agregar el campo scheduled_date
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS scheduled_date DATE;

