-- Football Shirt Collection — esquema inicial (PROPOSTA FASE 1, encara no aplicada a cap projecte)
-- Tot és privat per defecte: RLS activada a cada taula i cap política per a `anon`.

create extension if not exists pgcrypto;

-- ───────── Tipus enumerats ─────────
create type team_kind        as enum ('club', 'national');
create type kit_type         as enum ('home', 'away', 'third', 'goalkeeper', 'special', 'training', 'other');
create type shirt_version    as enum ('fan', 'player', 'replica', 'unknown');
create type shirt_condition  as enum ('new_with_tags', 'new_without_tags', 'excellent', 'good', 'fair', 'poor');
create type authenticity     as enum ('official', 'reissue', 'replica', 'unverified');
create type image_origin     as enum ('external', 'stored');
create type image_status     as enum ('candidate', 'confirmed', 'rejected');
create type job_status       as enum ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled');
create type wishlist_status  as enum ('wanted', 'watching', 'acquired', 'dropped');

-- ───────── Funcions comunes ─────────
create function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ───────── Lots d'importació ─────────
create table import_batches (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  filename    text not null,
  column_mapping jsonb not null default '{}',
  summary     jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  unique (id, owner_id)
);

-- ───────── Equips (clubs i seleccions) ─────────
create table teams (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (length(btrim(name)) > 0),
  kind       team_kind not null,
  country    text,                       -- nom del país (en català); pot quedar buit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (owner_id, name)
);

-- ───────── Samarretes ─────────
create table shirts (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  team_id          uuid not null,
  season           text check (season ~ '^\d{4}-\d{2}$'),      -- p. ex. 2016-17
  competition      text,
  brand            text,
  model            text,
  kit_type         kit_type,
  version          shirt_version not null default 'unknown',
  player_name      text,
  squad_number     smallint check (squad_number between 0 and 99),
  size             text,
  manufacture_year smallint check (manufacture_year between 1880 and 2100),
  condition        shirt_condition,
  authenticity     authenticity not null default 'unverified',
  provenance       text,
  purchase_date    date,
  price            numeric(10,2) check (price >= 0),
  shipping_cost    numeric(10,2) check (shipping_cost >= 0),
  seller           text,
  estimated_value  numeric(10,2) check (estimated_value >= 0),
  location         text,
  notes            text,
  curiosities      text,                     -- columna «Curiositats» de l'Excel
  -- traçabilitat de la importació: la fila original es conserva sencera
  import_batch_id  uuid,
  source_row       integer,
  original_data    jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (team_id, owner_id) references teams (id, owner_id) on delete restrict,
  foreign key (import_batch_id, owner_id) references import_batches (id, owner_id) on delete set null (import_batch_id)
);
create index shirts_owner_team_idx   on shirts (owner_id, team_id);
create index shirts_owner_season_idx on shirts (owner_id, season);
-- evita importar dues vegades la mateixa fila del mateix lot (idempotència)
create unique index shirts_import_row_uidx on shirts (owner_id, import_batch_id, source_row)
  where import_batch_id is not null;

-- ───────── Fotografies ─────────
create table shirt_images (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  shirt_id        uuid not null,
  origin          image_origin not null default 'external',
  status          image_status not null default 'candidate',
  is_primary      boolean not null default false,
  image_url       text,                      -- imatge externa
  thumbnail_url   text,
  source_page_url text,                      -- pàgina d'origen (obligatòria per a externes)
  source          text,                      -- 'wikimedia_commons', 'openverse', 'manual'…
  author          text,
  license         text,
  license_url     text,
  match_score     numeric(4,3) check (match_score between 0 and 1),
  retrieved_at    timestamptz,
  selected_at     timestamptz,
  storage_path    text,                      -- ruta al bucket privat si origin = 'stored'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (shirt_id, owner_id) references shirts (id, owner_id) on delete cascade,
  check (origin <> 'external' or (image_url is not null and source_page_url is not null)),
  check (origin <> 'stored'   or storage_path is not null),
  check (not is_primary or status = 'confirmed')
);
create index shirt_images_shirt_idx on shirt_images (owner_id, shirt_id);
create unique index shirt_images_one_primary_uidx on shirt_images (shirt_id) where is_primary;
-- una mateixa URL no es pot proposar dues vegades per a la mateixa samarreta
create unique index shirt_images_no_dup_uidx on shirt_images (shirt_id, image_url) where image_url is not null;

-- ───────── Cerca d'imatges per lots (pausa/represa) ─────────
create table image_search_jobs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status      job_status not null default 'pending',
  total       integer not null default 0,
  done        integer not null default 0,
  failed      integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, owner_id)
);
create table image_search_job_items (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id      uuid not null,
  shirt_id    uuid not null,
  status      job_status not null default 'pending',
  attempts    smallint not null default 0,
  last_error  text,
  candidates_found integer not null default 0,
  updated_at  timestamptz not null default now(),
  foreign key (job_id, owner_id)   references image_search_jobs (id, owner_id) on delete cascade,
  foreign key (shirt_id, owner_id) references shirts (id, owner_id) on delete cascade,
  unique (job_id, shirt_id)
);

-- ───────── Llista de desitjos ─────────
create table wishlist_items (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  team_id          uuid not null,
  season           text check (season ~ '^\d{4}-\d{2}$'),
  kit_type         kit_type,
  player_name      text,
  priority         smallint not null default 3 check (priority between 1 and 5),
  max_price        numeric(10,2) check (max_price >= 0),
  purchase_url     text,
  reference_image_url text,
  notes            text,
  status           wishlist_status not null default 'wanted',
  acquired_shirt_id uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (team_id, owner_id) references teams (id, owner_id) on delete restrict,
  foreign key (acquired_shirt_id, owner_id) references shirts (id, owner_id) on delete set null (acquired_shirt_id)
);

-- ───────── Pressupost opcional ─────────
create table budgets (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year       smallint not null check (year between 1990 and 2100),
  amount     numeric(10,2) not null check (amount >= 0),
  primary key (owner_id, year)
);

-- ───────── Triggers updated_at ─────────
create trigger teams_updated    before update on teams             for each row execute function set_updated_at();
create trigger shirts_updated   before update on shirts            for each row execute function set_updated_at();
create trigger images_updated   before update on shirt_images      for each row execute function set_updated_at();
create trigger jobs_updated     before update on image_search_jobs for each row execute function set_updated_at();
create trigger jitems_updated   before update on image_search_job_items for each row execute function set_updated_at();
create trigger wish_updated     before update on wishlist_items    for each row execute function set_updated_at();

-- ───────── Row Level Security: cada fila és només del seu propietari ─────────
do $$
declare t text;
begin
  foreach t in array array['import_batches','teams','shirts','shirt_images','image_search_jobs',
                           'image_search_job_items','wishlist_items','budgets'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format($p$create policy %I on %I for all to authenticated
                      using (owner_id = (select auth.uid()))
                      with check (owner_id = (select auth.uid()))$p$, t || '_owner_all', t);
  end loop;
end $$;

-- Cap privilegi per a `anon`; `authenticated` només opera sota RLS.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
