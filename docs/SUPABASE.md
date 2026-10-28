# Configuració de Supabase (fase 3)

Tot el que cal fer **manualment**, en ordre. El codi no pot crear el projecte ni aplicar migracions per tu.

## 1. Crear el projecte

1. [supabase.com](https://supabase.com) → *New project*.
2. Regió: **Europa** (p. ex. *West EU (Ireland)* o *Central EU (Frankfurt)*).
3. Guarda la contrasenya de la base de dades en un gestor de contrasenyes. **No la posis mai al repositori.**

## 2. Aplicar les migracions

*SQL Editor* → *New query* → enganxa i executa, **en aquest ordre**:

1. `supabase/migrations/20261027000001_initial_schema.sql`
2. `supabase/migrations/20261028000002_storage_private_bucket.sql`

Comprova a *Table Editor* que cada taula mostra «RLS enabled». A *Storage* ha d'existir el bucket `shirt-photos` com a **privat**.

## 3. Tancar el registre públic i crear el teu usuari

Aquesta és una aplicació d'un sol usuari.

1. *Authentication → Sign In / Providers → Email*: desactiva **Allow new users to sign up**.
2. *Authentication → Users → Add user → Create new user*: el teu correu i una contrasenya forta, amb *Auto Confirm User* activat.

## 4. Variables d'entorn

A *Project Settings → API* copia la **Project URL** i la clau **anon / publishable**. Mai la `service_role`.

- **Local:** copia `.env.example` a `.env.local` i omple `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY`.
- **Vercel:** *Project → Settings → Environment Variables*, afegeix les mateixes dues variables (Production i Preview) i fes un *Redeploy*.

La clau `anon` és pública per disseny: va dins el JavaScript del navegador. El que protegeix les dades són les polítiques RLS, no el secret de la clau.

## 5. URL de redirecció

*Authentication → URL Configuration*: posa la URL de Vercel com a *Site URL*.

## 6. Evitar la pausa per inactivitat (pla gratuït)

Supabase pausa els projectes gratuïts amb poca activitat durant 7 dies. El workflow `.github/workflows/keepalive.yml` fa una petició diària. Cal crear dos *secrets* a GitHub (*Settings → Secrets and variables → Actions*): `SUPABASE_URL` i `SUPABASE_ANON_KEY`.

Limitacions: GitHub desactiva les tasques programades després de 60 dies sense activitat al repositori, i no he pogut confirmar que Supabase compti aquesta petició com a activitat suficient. Segueix atent als correus d'avís de Supabase. Si es pausa, es pot reactivar des del panell durant un any.

## 7. Comprovació de seguretat

Amb RLS activada i cap política per a `anon`, una petició sense sessió retorna una llista buida. Prova-ho:

```bash
curl -s "$VITE_SUPABASE_URL/rest/v1/shirts?select=id" -H "apikey: $VITE_SUPABASE_ANON_KEY"
# esperat: []
```

La prova d'aïllament entre usuaris (`supabase/tests/`) s'ha executat contra un PostgreSQL local amb una simulació mínima de Supabase, **no** contra el projecte real.
