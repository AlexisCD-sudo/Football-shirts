# Fase 1 — Inspecció, requisits i model de dades

Data: 27/10/2026 · Estat: **proposta pendent de validació** (no s'ha creat codi de l'aplicació ni s'ha tocat cap servei extern).

## 1. Estat del repositori de GitHub

No hi ha cap compte de GitHub enllaçat a aquesta sessió ni m'has indicat cap `owner/repo`, així que **no he pogut inspeccionar cap repositori i no he fet cap canvi a GitHub**. Tot el que hi ha és en una carpeta local de la sessió (`football-shirt-collection/`), sense historial git.

Per continuar necessito una d'aquestes dues coses: (a) el nom `owner/repo` d'un repositori (idealment **privat** i buit) per afegir-lo a la sessió, o (b) que el creïs tu i hi pugi els fitxers que et prepararé.

## 2. Estructura de l'Excel (en realitat és un fitxer Numbers)

El fitxer és `Samarretes_futbol.numbers` (Apple Numbers, no Excel). LibreOffice el converteix buit, així que n'he descodificat el format intern directament. Resultat: **1 full («Camisetes futbol»), 6 columnes, 64 samarretes** (no 65) més la capçalera.

| Columna original | Omplerta | Contingut | Camp proposat |
|---|---|---|---|
| Equip | 64/64 | Club o selecció | `teams.name` (+ `kind`, `country`) |
| Any | 64/64 | Temporada `AAAA-AA` | `shirts.season` |
| Nom | 13/64 | Jugador serigrafiat | `shirts.player_name` |
| Home/away | 64/64 | 54 Home, 10 Away | `shirts.kit_type` |
| Rèpliques | 3/64 | «Rèplica» | `shirts.version = 'replica'` / `authenticity` |
| Curiositats | 12/64 | Text lliure | `shirts.curiosities` |

**No hi ha** cap dada de marca, talla, preu, data de compra, estat, ubicació, competició ni model. Aquests camps començaran buits (no s'inventaran).

Problemes de qualitat detectats (cap es corregirà automàticament; la fila original es conserva sencera a `original_data`):

- **Duplicats exactes (equip + temporada + equipació): 0.** Hi ha equips amb diverses peces (Barça 7, Bayern 3, Man. City 3, Man. United 3…), però són temporades diferents.
- `2005-2006` (Argentina, Messi) no segueix el format `2005-06`: proposo normalitzar-lo i guardar l'original.
- `Dinamarca ` té un espai al final.
- Possibles errates de nom, **a confirmar per tu**: «Ganha» (Ghana?), «Bayern Leverkusen» (Bayer Leverkusen?), «Sant Pauli» (St. Pauli?), «Fenerbaçe» (Fenerbahçe?), «Wisla Crakovia» (Wisła Kraków), «Real Societat», «Lewandowsky», «Palestine» (en anglès, la resta en català), «Reedeció oficial Adidas».
- A «Curiositats» de Chile/Alexis hi ha el **número 7** (no text): sembla un dorsal. A confirmar; si és així, aniria a `squad_number`.
- «Rèpliques» només té 3 valors; no sé si les 61 restants són originals o simplement no marcades. Per defecte quedaran com `unverified`, no com `official`.
- «Curiositats» barreja informació diferent (edició especial, notes personals com «Marc B. - Ghana», rerefons). Es conserva com a text lliure.

Equips: **48 diferents (40 clubs, 8 seleccions) de 17 països**. He preparat una proposta de tipus i país per a cada equip (`data/private/equips_proposta.csv`) basada en coneixement general: **cal que la validis**, no és dada del teu fitxer.

## 3. Model de dades proposat

Implementat com a migració SQL a `supabase/migrations/20261027000001_initial_schema.sql`.

- `teams` — clubs i seleccions normalitzats (`kind`, `country`). Permet corregir un nom en un sol lloc.
- `shirts` — tots els camps que demanes, tots opcionals menys l'equip. Inclou `import_batch_id`, `source_row` i `original_data` (jsonb) per conservar la fila original i fer la importació idempotent.
- `shirt_images` — una fila per candidata o imatge confirmada: `origin` (`external` / `stored`), `status` (`candidate` / `confirmed` / `rejected`), URL de la imatge i de la pàgina d'origen, font, autor, llicència, puntuació de coincidència, dates de consulta i selecció, `storage_path`. Màxim una imatge principal per samarreta; una confirmada no es pot duplicar.
- `image_search_jobs` + `image_search_job_items` — cerca per lots amb progrés, pausa/represa, intents i errors, persistent.
- `wishlist_items` — llista de desitjos amb enllaç a la samarreta adquirida (`acquired_shirt_id`) per no duplicar dades.
- `budgets` — pressupost opcional per any.
- `import_batches` — historial d'importacions (mapeig de columnes i resum).

Historial de compres separat: **no l'he creat**; amb una sola compra per peça, les columnes de `shirts` (data, preu, enviament, venedor) són suficients. Es pot afegir més endavant sense reconstruir res.

**Seguretat:** cada taula té `owner_id` (per defecte `auth.uid()`), RLS activada i forçada, una única política per a `authenticated` i cap privilegi per a `anon`. Les claus foranes són compostes `(id, owner_id)`, de manera que una fila no pot referenciar dades d'un altre usuari.

**Proves fetes avui** en un PostgreSQL 16 local (amb un *stub* mínim de l'esquema `auth` de Supabase, no amb Supabase real):
- La migració s'aplica sense errors.
- L'usuari B veu 0 files de l'usuari A, no pot modificar-les ni esborrar-les, i no pot inserir files amb l'`owner_id` d'A.
- L'usuari B no pot crear una samarreta que apunti a un equip d'A (error de clau forana composta).
- `anon` rep «permission denied».
- El format de temporada invàlid (`2005-2006`) és rebutjat pel `CHECK`.

Això **no** substitueix la prova contra el Supabase real a la Fase 3 (inclòs Storage).

## 4. Fonts d'imatges: viabilitat i limitacions

**Important:** des d'aquest entorn no he pogut cridar cap API d'imatges (la xarxa només permet registres de paquets i poc més), així que el que segueix prové de documentació, **no de proves reals**. La viabilitat s'ha de comprovar amb un petit experiment al començament de la Fase 5.

| Font | Clau | Notes i riscos |
|---|---|---|
| **Wikimedia Commons** (API MediaWiki, `imageinfo` + `extmetadata`) | No | Dóna llicència i autor per fitxer. Llicències tipus CC BY-SA exigeixen atribució; cal desar-la. Cal enviar un `User-Agent` identificatiu. **Risc gran:** hi ha pocs fotos reals de samarretes concretes; sovint són plantilles d'equipació (SVG), fotos de partits o logotips. Cobertura esperada baixa per a peces antigues o poc conegudes. |
| **Openverse** (API oficial) | Opcional | Agrega Flickr, Wikimedia, etc. amb llicència. Sense clau: màx. 20 resultats per pàgina; prohibit fer scraping del catàleg o esquivar límits amb diverses màquines. Per a ús amb lots convé registrar una clau (secreta → funció de servidor). |
| Cercadors generals (Google/Bing) | Sí | Les imatges no són lliures de drets per defecte. Segons recordo, l'API de Bing Image Search es va retirar el 2025 i l'accés nou a la Programmable Search de Google és restringit; **no ho he pogut verificar** i no ho incorporaria. |
| Botigues i catàlegs de samarretes | — | Només si en permeten explícitament l'ús; normalment no. Sense scraping. |

Conseqüència realista: per a una part de les 64 peces **no hi haurà cap candidata fiable**. Per això el flux ha de ser sempre «proposa → revisa → confirma», amb alternatives gratuïtes: enllaç manual a una pàgina d'origen (guardat com a referència externa amb llicència «desconeguda») o pujar una foto pròpia al bucket privat. Les imatges externes es guarden com a referència; només es copien a Supabase Storage quan la llicència ho permet.

## 5. Serveis necessaris i costos potencials

Preus consultats avui a pàgines de tercers i a la documentació de Vercel; **verifica'ls al lloc oficial abans de contractar**.

| Servei | Pla | Cost | Límits rellevants |
|---|---|---|---|
| GitHub | Free (repositori privat) | 0 € | — |
| Supabase | Free | 0 € | 500 MB BD, 1 GB fitxers, 5 GB de sortida/mes, **pausa automàtica després d'1 setmana sense activitat** (cal reactivar-lo manualment), 2 projectes. No he pogut confirmar si inclou còpies automàtiques; **no hi comptaré**. |
| Supabase | Pro | ≈25 USD/mes | Només si cal estabilitat o còpies gestionades. |
| Vercel | Hobby | 0 € | Només ús personal i no comercial (el teu cas). 100 GB de transferència/mes. |
| Domini propi | Opcional | ≈10–15 €/any | No necessari: Vercel dóna un `*.vercel.app`. |
| APIs d'imatges | Commons / Openverse | 0 € | Possible clau gratuïta d'Openverse. |

Cost esperat: **0 €/mes**. L'únic punt feble del pla gratuït és la pausa de Supabase per inactivitat; la solució gratuïta és una petita tasca programada (GitHub Actions) que faci una consulta setmanal, o pagar Pro. 65 samarretes caben de sobres als límits.

**Versions de dependències:** no he pogut consultar el registre npm des d'aquí. Les fixaré a la Fase 2 amb versions estables verificades i un `package-lock.json`.

## 6. Estructura inicial de fitxers

```
football-shirt-collection/
├─ src/{components,pages,lib,services,types,hooks}/
├─ supabase/{migrations,functions,tests}/
├─ public/                 icones i manifest PWA
├─ tests/
├─ docs/                   FASE-1.md, seguretat, còpies, desplegament
├─ data/private/           (ignorada per git) extracció de l'Excel
├─ .github/workflows/      TypeScript, lint, proves, build
├─ .env.example · .gitignore · README.md · vercel.json
```

Decisions tècniques: React + TypeScript + Vite; Tailwind; TanStack Query per a l'estat de servidor; React Router; Zod per a validació; Vitest + Testing Library; `vite-plugin-pwa`; les cerques d'imatges amb clau secreta, a Supabase Edge Functions.

## 7. Pla d'implementació verificable

| Fase | Entrega | Verificació |
|---|---|---|
| 2 | Projecte Vite + catàleg (graella/llista, cerca, filtres, CRUD) | typecheck, lint, proves, build; revisió en mòbil |
| 3 | Supabase: migració, Auth, RLS, Storage privat | Proves RLS contra el projecte real |
| 4 | Importació (vista prèvia, mapeig, duplicats, informe) i exportació CSV/Excel/JSON | Prova amb mostra de 5 files, després les 64 |
| 5 | Cerca d'imatges, revisió, lots amb pausa/represa | Experiment previ amb Commons/Openverse; gestió d'errors |
| 6 | Llista de desitjos, finances, estadístiques | Proves amb camps buits |
| 7 | PWA, proves, còpies | Instal·lació al mòbil |
| 8 | Publicació a Vercel i documentació | Comprovació de l'URL real |

**Limitació important per a la Fase 2:** aquest entorn no pot instal·lar paquets npm (el registre està bloquejat), així que no puc executar `build`, lint ni proves aquí. Opcions: (a) tu executes els comandaments en local i em passes els errors; (b) afegir el repositori i que GitHub Actions ho executi i jo en llegeixi el resultat. No afirmaré que una fase està verificada si no l'he pogut executar.

## 8. Decisions pendents

1. Repositori de GitHub (`owner/repo`) o connexió del compte.
2. Validar `equips_proposta.csv` (tipus i país) i les possibles errates de noms.
3. El 7 de Chile/Alexis és un dorsal?
4. Només un usuari (tu): desactivar el registre públic a Supabase un cop creat el teu compte.
5. Com es resol el tema de les còpies i la pausa de Supabase (tasca setmanal gratuïta o Pro).
