#!/bin/sh
# Изпълнява се веднъж, при първото стартиране на празна база (docker-entrypoint-initdb.d).
# Създава таблиците и потребителя на приложението с права само за INSERT и SELECT.
# Без `set -eu`: на Windows файлът губи правото за изпълнение и входната точка на
# образа го зарежда (source) в своята обвивка; ON_ERROR_STOP спира при всяка грешка.

psql -v ON_ERROR_STOP=1 -v app_parola="$APP_DB_PASSWORD" \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'EOSQL'

-- Дневник на показанията: в него само се добавя.
CREATE TABLE pokazaniya (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  elektromer_id text        NOT NULL,
  vreme         timestamptz NOT NULL,
  energiya_wh   bigint      NOT NULL CHECK (energiya_wh >= 0),
  priet_v       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (elektromer_id, vreme)
);

-- Показанията пристигат подредени по време: BRIN индексът е малък и достатъчен.
CREATE INDEX pokazaniya_vreme_brin ON pokazaniya USING brin (vreme);

-- Сигнали за необичайни показания. Също само се добавят.
CREATE TABLE signali (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  elektromer_id text        NOT NULL,
  vreme         timestamptz NOT NULL,
  vid           text        NOT NULL CHECK (vid IN ('namalyavashto', 'skok')),
  opisanie      text        NOT NULL,
  sazdaden_v    timestamptz NOT NULL DEFAULT now()
);

-- Потребител на приложението: само чете и добавя. Без UPDATE, DELETE, TRUNCATE.
CREATE ROLE energo_app LOGIN PASSWORD :'app_parola';
GRANT CONNECT ON DATABASE energo TO energo_app;
GRANT USAGE ON SCHEMA public TO energo_app;
GRANT SELECT, INSERT ON pokazaniya, signali TO energo_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO energo_app;
EOSQL
