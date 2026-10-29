-- COMPROVACIÓ DE SEGURETAT (només lectura). Enganxa-ho al SQL Editor de Supabase i executa-ho.
-- Cada fila ha de dir «OK». Si alguna diu «ALERTA», no publiquis l'aplicació fins a arreglar-la.

-- 1) Totes les taules de public tenen RLS activada i forçada
select 'RLS activada i forçada: ' || c.relname as comprovacio,
       case when c.relrowsecurity and c.relforcerowsecurity then 'OK' else 'ALERTA' end as resultat
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'

union all
-- 2) Cap taula de public té privilegis per al rol anon
select 'anon sense accés a ' || table_name,
       case when exists (
         select 1 from information_schema.role_table_grants g
         where g.table_schema = 'public' and g.table_name = t.table_name and g.grantee = 'anon'
       ) then 'ALERTA' else 'OK' end
from information_schema.tables t
where t.table_schema = 'public' and t.table_type = 'BASE TABLE'

union all
-- 3) Cada taula de public té almenys una política
select 'Té política: ' || c.relname,
       case when exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
            then 'OK' else 'ALERTA' end
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'

union all
-- 4) Cap política de public és per a anon ni per a «public» (tothom)
select 'Cap política oberta a anon/public a ' || coalesce(p.tablename, '-'),
       case when 'anon' = any(p.roles) or 'public' = any(p.roles) then 'ALERTA' else 'OK' end
from pg_policies p
where p.schemaname = 'public'

union all
-- 5) El bucket de fotos existeix i és privat
select 'Bucket shirt-photos privat',
       case when exists (select 1 from storage.buckets where id = 'shirt-photos' and public = false) then 'OK' else 'ALERTA' end

union all
-- 6) Cap altre bucket públic
select 'Cap bucket públic: ' || id, case when public then 'ALERTA' else 'OK' end
from storage.buckets

order by 2 desc, 1;
