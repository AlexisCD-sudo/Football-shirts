-- Vista pública de NOMÉS LECTURA (opt-in). Per defecte no fa públic res: cal afegir la teva fila a `public_collections`.
-- Cap taula s'obre a `anon`: només dues funcions SECURITY DEFINER que retornen columnes segures.
-- Mai es publiquen: preus, enviament, venedor, valor estimat, ubicació, procedència, dades d'importació, desitjos ni finances.

create table public_collections (
  owner_id   uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public_collections enable row level security;
create policy "public_collections_owner" on public_collections
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Ruta de carpeta del bucket (primer segment = id d'usuari) pertany a una col·lecció pública?
create function is_public_folder(folder text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when folder ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then exists (select 1 from public.public_collections c where c.owner_id = folder::uuid)
    else false
  end
$$;
revoke all on function is_public_folder(text) from public;
grant execute on function is_public_folder(text) to anon, authenticated;

-- Les fotos pròpies de col·leccions públiques es poden veure (signar URL) sense sessió. Només lectura.
create policy "shirt_photos_public_read" on storage.objects
  for select to anon
  using (bucket_id = 'shirt-photos' and public.is_public_folder((storage.foldername(name))[1]));

create function public_shirts() returns table (
  id uuid, team_name text, team_kind team_kind, country text,
  season text, competition text, brand text, model text, kit_type kit_type, version shirt_version,
  player_name text, squad_number smallint, size text, manufacture_year smallint,
  condition shirt_condition, authenticity authenticity, notes text, curiosities text,
  created_at timestamptz, updated_at timestamptz,
  image_id uuid, image_origin image_origin, image_url text, thumbnail_url text, source_page_url text,
  image_source text, author text, license text, license_url text, storage_path text
)
language sql stable security definer set search_path = '' as $$
  select s.id, t.name, t.kind, t.country,
         s.season, s.competition, s.brand, s.model, s.kit_type, s.version,
         s.player_name, s.squad_number, s.size, s.manufacture_year,
         s.condition, s.authenticity, s.notes, s.curiosities,
         s.created_at, s.updated_at,
         i.id, i.origin, i.image_url, i.thumbnail_url, i.source_page_url,
         i.source, i.author, i.license, i.license_url, i.storage_path
  from public.shirts s
  join public.teams t on t.id = s.team_id and t.owner_id = s.owner_id
  left join public.shirt_images i on i.shirt_id = s.id and i.owner_id = s.owner_id and i.is_primary and i.status = 'confirmed'
  where exists (select 1 from public.public_collections c where c.owner_id = s.owner_id)
  order by s.created_at desc
$$;
revoke all on function public_shirts() from public;
grant execute on function public_shirts() to anon, authenticated;

-- Per activar la teva col·lecció pública (a Supabase → SQL Editor, canviant el correu):
--   insert into public_collections (owner_id) select id from auth.users where email = 'el-teu-correu@exemple.com';
-- Per desactivar-la:
--   delete from public_collections;
