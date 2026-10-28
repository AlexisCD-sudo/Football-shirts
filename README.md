# Football Shirt Collection

Aplicació web per gestionar una col·lecció personal de samarretes de futbol. Interfície en català.

> **Estat: fase 4 de 8.** Catàleg, Supabase amb autenticació, importació i exportació.
> La cerca d'imatges, la llista de desitjos, les estadístiques i la PWA arriben a les fases següents.
> El pla complet és a [`docs/FASE-1.md`](docs/FASE-1.md).

## Què funciona ara

- Catàleg en quadrícula i en llista, amb targetes de mida uniforme.
- Cerca (sense distingir accents ni majúscules) i filtres combinables: equip, país, temporada, marca, equipació, versió i foto.
- Ordenació per equip, temporada o darrer afegit.
- Crear, editar i eliminar samarretes (amb validació i confirmació).
- Mode clar i fosc, adaptat a mòbil, tauleta i ordinador.
- Importació des de CSV o Excel (amb vista prèvia, duplicats i informe) i exportació a Excel, CSV i JSON: [`docs/IMPORT_EXPORT.md`](docs/IMPORT_EXPORT.md).
- Desat al núvol amb Supabase i inici de sessió: [`docs/SUPABASE.md`](docs/SUPABASE.md).

## Què encara NO funciona

Cerca i selecció de fotografies, llista de desitjos, estadístiques, PWA i còpies de seguretat.

## Requisits i execució

Node.js 20 o superior.

```bash
npm install
npm run dev        # servidor local
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm test           # proves (Vitest)
npm run build      # compilació de producció
```

## Estructura

```
src/components/   components reutilitzables
src/pages/        pàgines
src/lib/          utilitats pures (filtres, validació, format)
src/services/     accés a dades (interfície + implementació en memòria)
src/hooks/        hooks
src/types/        tipus
supabase/         migració SQL proposada i prova d'aïllament RLS (encara no aplicada)
tests/            proves
docs/             documentació
```

## Seguretat i dades personals

- No hi ha secrets al repositori. `.env.example` només és una plantilla.
- `.gitignore` exclou `.env*`, `data/private/`, fitxers `.numbers`/`.xlsx` i exportacions.
- Al frontend només anirà la clau pública `anon` de Supabase; mai la `service_role`.
