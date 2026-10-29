# Football Shirt Collection

Aplicació web (en català) per gestionar una col·lecció personal de samarretes de futbol: catàleg, importació des d'Excel, fotos, llista de desitjos, finances i estadístiques. Instal·lable al mòbil (PWA) i amb les dades al núvol protegides per usuari.

> **Estat: fases 1–8 completades.** Cada fase s'ha validat amb una PR. Els límits coneguts són a l'apartat [Limitacions](#limitacions-conegudes).

## Què fa
- **Col·lecció:** quadrícula i llista, cerca sense accents, filtres combinables (equip, país, temporada, marca, equipació, versió, foto), ordenació, alta/edició/baixa amb validació.
- **Importació i exportació:** CSV i Excel amb vista prèvia, duplicats detectats (mai fusionats ni esborrats) i informe; exportació a Excel, CSV i JSON. [`docs/IMPORT_EXPORT.md`](docs/IMPORT_EXPORT.md)
- **Football Kit Archive (assistit):** afegir samarretes i fotos des de les fitxes de FKA (sense API oficial: flux manual guiat). [`docs/FOOTBALL_KIT_ARCHIVE.md`](docs/FOOTBALL_KIT_ARCHIVE.md)
- **Fotos:** cerca a Wikimedia Commons i Openverse (imatges amb llicència), revisió manual (mai s'assigna res sola), cerca per lots amb pausa i represa, enllaç manual i pujada de fotos pròpies al bucket privat. [`docs/IMAGES.md`](docs/IMAGES.md)
- **Desitjos:** prioritat, preu màxim, enllaç de compra; «Ja la tinc» la converteix en samarreta.
- **Finances:** despesa, preu mitjà, valor estimat, balanç i pressupost anual. Mai s'inventen preus que falten.
- **Estadístiques:** per equip, país, marca, equipació, dècada, estat i versió, i dades per completar.
- **PWA i còpies:** instal·lable, còpia completa en JSON verificable i volcat opcional de la BD. [`docs/PWA_BACKUPS.md`](docs/PWA_BACKUPS.md)

## Documentació
| Per a | Document |
|---|---|
| Usar l'aplicació | [`docs/GUIA_US.md`](docs/GUIA_US.md) |
| Posar-la en marxa des de zero | [`docs/DESPLEGAMENT.md`](docs/DESPLEGAMENT.md) |
| Configurar Supabase pas a pas | [`docs/SUPABASE.md`](docs/SUPABASE.md) |
| Seguretat i què s'ha verificat | [`docs/SEGURETAT.md`](docs/SEGURETAT.md) |
| Còpies i PWA | [`docs/PWA_BACKUPS.md`](docs/PWA_BACKUPS.md) |
| Disseny inicial i model de dades | [`docs/FASE-1.md`](docs/FASE-1.md) |

## Stack
React 19 · TypeScript · Vite · Tailwind 4 · Supabase (Postgres, Auth, Storage, RLS) · Vercel · GitHub Actions · Vitest.

## Execució en local
Node.js 20 o superior.

```bash
npm install
cp .env.example .env.local   # omple VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY (opcional)
npm run dev        # servidor local
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm test           # proves (Vitest)
npm run build      # compilació de producció
```
Sense les variables de Supabase l'aplicació arrenca en **mode de prova** (dades només en memòria, es perden en recarregar).

## Estructura
```
src/components/   components reutilitzables
src/pages/        pàgines (col·lecció, desitjos, finances, estadístiques, accés)
src/lib/          lògica pura (filtres, validació, importació, cerca d'imatges, finances…)
src/services/     accés a dades: interfície + memòria + Supabase
src/hooks/        hooks
supabase/         migracions SQL, proves d'aïllament RLS i comprovació del projecte real
public/           manifest PWA, icones, service worker
tests/            proves automàtiques
docs/             documentació
.github/          CI, keep-alive, volcat de BD (opcional), Dependabot
```

## Seguretat (resum)
- Un sol usuari; registre públic desactivat. Totes les taules amb RLS activada i forçada; el rol `anon` no té cap privilegi. Bucket de fotos privat, amb carpeta per usuari.
- Al navegador només hi va la clau pública `anon`; mai la `service_role`. No hi ha secrets al repositori.
- Cap clau privada a la cerca d'imatges: s'usen només APIs públiques i sense scraping.
- Detalls, comprovacions manuals i riscos oberts: [`docs/SEGURETAT.md`](docs/SEGURETAT.md).

## Limitacions conegudes
- **Fotos:** a Commons i Openverse hi ha poques fotos de samarretes concretes; per a moltes peces caldrà pujar la foto pròpia. Les fotos externes es desen com a enllaç, no com a còpia.
- **Sense connexió** només s'obre l'aplicació, no les dades (decisió de privacitat).
- **Restauració:** no hi ha restauració automàtica des de la còpia JSON; les samarretes es poden reimportar amb Excel/CSV.
- **Supabase gratuït:** pausa per inactivitat (mitigat amb el workflow keep-alive) i sense còpies garantides.
- **Importes** sempre en euros.
- Les proves automàtiques usen dades simulades; el comportament contra Supabase real s'ha de comprovar al desplegament (vegeu `docs/SEGURETAT.md`).
