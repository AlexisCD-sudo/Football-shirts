-- Prova de la vista pública (psql -d <bd> -f aquest fitxer des de l arrel del repositori; usa els stubs locals).
\set ON_ERROR_STOP on
\i supabase/tests/auth_stub.sql
\i supabase/tests/storage_stub.sql
\i supabase/migrations/20261027000001_initial_schema.sql
\i supabase/migrations/20261028000002_storage_private_bucket.sql
\i supabase/migrations/20261031000003_public_readonly.sql
\set ON_ERROR_STOP off
insert into auth.users(id) values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
insert into teams(name,kind) values ('Barça','club');
insert into shirts(team_id,season,price,seller,location,provenance,notes) select id,'2010-11',99,'Vendedor','Armari','Prov','nota' from teams;
reset role;
set role anon;
select 'anon sense publicar (esperat 0)', count(*) from public_shirts();
select 'anon shirts directe (esperat ERROR)' ; select count(*) from shirts;
reset role;
insert into public_collections(owner_id) values ('00000000-0000-0000-0000-00000000000a');
insert into storage.objects(bucket_id,name) values ('shirt-photos','00000000-0000-0000-0000-00000000000a/x/1.jpg'),('shirt-photos','00000000-0000-0000-0000-00000000000b/x/2.jpg'),('shirt-photos','brossa/3.jpg');
grant select on storage.objects to anon;
set role anon;
select 'anon públic (esperat 1)', count(*) from public_shirts();
select 'columnes', string_agg(a.attname, ',') from pg_proc p join pg_attribute a on false where false;
select * from public_shirts();
select 'anon escriu (esperat ERROR)'; insert into shirts(team_id) select id from teams;
select 'anon public_collections (esperat ERROR)'; select * from public_collections;
select 'fotos anon (esperat 1 de A)', count(*), min(name) from storage.objects;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select 'B no pot publicar per A (esperat ERROR)'; insert into public_collections(owner_id) values ('00000000-0000-0000-0000-00000000000a');
