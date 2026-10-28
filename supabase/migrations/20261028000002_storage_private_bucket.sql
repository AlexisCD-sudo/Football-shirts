-- Bucket privat per a fotografies que es puguin emmagatzemar legalment (fase 5).
-- Estructura de rutes: <user_id>/<shirt_id>/<fitxer>. Cada usuari només toca la seva carpeta.

insert into storage.buckets (id, name, public)
values ('shirt-photos', 'shirt-photos', false)
on conflict (id) do nothing;

create policy "shirt_photos_owner_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'shirt-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'shirt-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
