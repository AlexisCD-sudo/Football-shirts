-- Prova d'aïllament RLS (s'executa contra un Postgres amb l'esquema aplicat).
-- Requereix l'stub d'auth de supabase/tests/auth_stub.sql quan NO es fa servir Supabase real.
\set ON_ERROR_STOP off
insert into auth.users(id) values ('00000000-0000-0000-0000-00000000000a'),('00000000-0000-0000-0000-00000000000b');

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
insert into teams(name,kind,country) values ('Barça','club','Espanya');
insert into shirts(team_id,season) select id,'2010-11' from teams where name='Barça';
select 'A veu', count(*) from shirts;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select 'B veu (esperat 0)', count(*) from shirts;
update shirts set notes='hack';            -- 0 files
select 'B update afectades (esperat 0 visibles)', count(*) from shirts where notes='hack';
delete from shirts;                         -- 0 files
-- B no pot inserir files a nom d'A:
insert into teams(owner_id,name,kind) values ('00000000-0000-0000-0000-00000000000a','Intrús','club');
-- B no pot penjar una samarreta pròpia a un equip d'A (FK composta):
insert into teams(name,kind) values ('Propi B','club');
insert into shirts(team_id) select id from teams where name='Barça';

reset role;
select 'total real shirts (esperat 1)', count(*) from shirts;
-- anon no té accés:
set role anon;
select count(*) from shirts;
reset role;
