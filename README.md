# Football Shirt Collection

Aplicació web per gestionar una col·lecció personal de samarretes de futbol. Interfície en català.

> **Estat: fase 2 de 8.** Catàleg funcional amb dades **provisionals en memòria** (es perden en recarregar).
> El desat al núvol (Supabase), la importació, la cerca d'imatges i la resta de funcions arriben a les fases següents.
> El pla complet és a [`docs/FASE-1.md`](docs/FASE-1.md).

## Què funciona ara

- Catàleg en quadrícula i en llista, amb targetes de mida uniforme.
- Cerca (sense distingir accents ni majúscules) i filtres combinables: equip, país, temporada, marca, equipació, versió i foto.
- Ordenació per equip, temporada o darrer afegit.
- Crear, editar i eliminar samarretes (amb validació i confirmació).
- Mode clar i fosc, adaptat a mòbil, tauleta i ordinador.

## Què encara NO funciona

Desar al núvol i sincronitzar entre dispositius, autenticació, importació de l'Excel/Numbers, fotografies, llista de desitjos, estadístiques, PWA i còpies de seguretat.

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
