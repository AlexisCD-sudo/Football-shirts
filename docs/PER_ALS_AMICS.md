# Fes-te la teva pròpia còpia (en blanc)

Cada persona té **la seva web, la seva base de dades i les seves fotos**, tot gratuït i sense compartir res amb ningú
(ni amb qui t'ha passat l'app). Tarda uns 15–20 minuts. Cal un correu i tres comptes gratuïts: GitHub, Supabase i Vercel.

## 1. Agafa el codi
1. Crea un compte a [github.com](https://github.com).
2. Obre el repositori de l'app i clica **Use this template → Create a new repository** (o **Fork** si no surt).
   Posa-li el nom que vulguis i, si vols, **Private**.

## 2. Crea la teva base de dades (Supabase)
1. Crea un compte a [supabase.com](https://supabase.com) → **New project**. Regió *West EU (Ireland)* o *Central EU (Frankfurt)*.
   Guarda la contrasenya de la base de dades (no la posis enlloc del repositori).
2. **SQL Editor → New query**: obre al teu repositori el fitxer `supabase/setup_complet.sql`, copia-ho **tot**, enganxa-ho i clica **Run**.
   Ha de dir *Success*. A *Storage* haurà aparegut el bucket privat `shirt-photos`.
3. **Authentication → Sign In / Providers → Email**: desactiva **Allow new users to sign up** (així ningú més s'hi pot registrar).
4. **Authentication → Users → Add user → Create new user**: el teu correu i una contrasenya forta, amb **Auto Confirm User** activat.
5. **Project Settings → API**: copia la **Project URL** i la clau **anon / publishable**. **Mai** la `service_role`.

## 3. Publica la web (Vercel)
1. Crea un compte a [vercel.com](https://vercel.com) amb GitHub → **Add New → Project** → tria el teu repositori → **Import**.
2. A **Environment Variables** afegeix:
   - `VITE_SUPABASE_URL` = la Project URL
   - `VITE_SUPABASE_ANON_KEY` = la clau anon
3. **Deploy**. En acabar tens una adreça `https://…vercel.app`.
4. A Supabase → **Authentication → URL Configuration**, posa aquesta adreça com a **Site URL**.

## 4. Fes-la servir
Obre l'adreça, inicia la sessió amb el correu i la contrasenya del pas 2.4 i afegeix samarretes. Al mòbil, «Afegeix a la pantalla d'inici»
(iPhone: Safari → Compartir) per tenir-la com una app. Pots pujar les teves fotos a cada samarreta i importar un Excel/CSV
(vegeu `docs/IMPORT_EXPORT.md`).

## Opcional
- **Evitar la pausa per inactivitat** (pla gratuït de Supabase): a GitHub → Settings → Secrets and variables → Actions, crea
  `SUPABASE_URL` i `SUPABASE_ANON_KEY`; el workflow «keep-alive» ja hi és.
- **Còpia de seguretat setmanal**: secret `SUPABASE_DB_URL` (vegeu `docs/PWA_BACKUPS.md`). També tens «Exporta» dins l'app.

## Seguretat, en una frase
Cada compte només veu les seves dades (RLS a la base de dades) i les fotos són privades. No comparteixis mai la clau `service_role`
ni la contrasenya de la base de dades.
