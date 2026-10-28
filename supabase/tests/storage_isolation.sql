-- Prova d'aïllament del bucket privat (necessita auth_stub, storage_stub i les migracions).
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000b1') on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false) \gset
insert into storage.objects(bucket_id,name) values ('shirt-photos','00000000-0000-0000-0000-0000000000a1/s1/foto.jpg');
\echo -- A no pot escriure a la carpeta de B (error esperat):
insert into storage.objects(bucket_id,name) values ('shirt-photos','00000000-0000-0000-0000-0000000000b1/s1/intrus.jpg');
\echo -- A no pot escriure en un altre bucket sense política (error esperat):
insert into storage.objects(bucket_id,name) values ('altre','00000000-0000-0000-0000-0000000000a1/x.jpg');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1',false) \gset
select 'B veu (esperat 0)' as prova, count(*) from storage.objects;
delete from storage.objects;
reset role;
select 'total real (esperat 1)' as prova, count(*) from storage.objects;
