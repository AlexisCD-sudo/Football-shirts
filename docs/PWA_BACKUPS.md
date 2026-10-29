# PWA, còpies de seguretat i proves (fase 7)

## Instal·lar l'aplicació (PWA)
- **Android (Chrome):** menú ⋮ → «Instal·la l'aplicació» (o «Afegeix a la pantalla d'inici»).
- **iPhone (Safari):** botó Compartir → «Afegeix a la pantalla d'inici».
- **Ordinador (Chrome/Edge):** icona d'instal·lar a la barra d'adreces.
- Només funciona a la versió publicada (https), no en local amb `npm run dev`.

### Què funciona sense connexió i què no
- Sí: s'obre l'aplicació (pantalles, estils i codi).
- **No:** les dades. Llegir i desar la col·lecció requereix Internet (es mostra un avís). No es desa cap còpia de les dades al dispositiu: així, si algú té el teu mòbil o ordinador, no queden samarretes ni fotos al navegador després de tancar la sessió.
- El service worker (`public/sw.js`) només gestiona fitxers del mateix domini. **Mai** toca Supabase (dades, sessió, fotos signades), imatges externes ni tipografies.
- Actualitzacions: la pàgina principal es demana sempre a la xarxa; els fitxers amb hash es guarden. Si veus una versió antiga, recarrega (Ctrl+Shift+R) o tanca i reobre l'app.

## Còpies de seguretat
Tres capes, de més senzilla a més completa:

1. **Còpia completa en JSON (dins l'app):** Exporta → «Descarrega la còpia (.json)». Inclou samarretes (amb la fila original d'importació), equips, metadades de fotos, desitjos i pressupostos. **No inclou les fotos pròpies** (només la ruta). «Verifica una còpia» comprova que un fitxer és vàlid i que els recomptes quadren, sense modificar res.
2. **Excel/CSV:** es poden tornar a importar (fase 4). Només cobreixen les samarretes.
3. **Volcat de la base de dades (opcional, automàtic):** `.github/workflows/db-backup.yml` fa cada dilluns un `pg_dump` de les dades i el desa com a artefacte privat 30 dies. Només s'activa si crees el secret `SUPABASE_DB_URL`:
   - Supabase → Connect → **Session pooler** → copia la cadena (substitueix `[YOUR-PASSWORD]`). Cal el pooler perquè la connexió directa és IPv6 i GitHub no en té.
   - GitHub → Settings → Secrets and variables → Actions → New repository secret → `SUPABASE_DB_URL`.
   - Prova-ho: Actions → «Còpia de seguretat de la base de dades» → Run workflow. **No s'ha pogut provar des de l'entorn de desenvolupament.**
   - Els artefactes contenen les teves dades: el repositori ha de continuar privat.

Fotos pròpies: viuen al bucket privat `shirt-photos` de Supabase i no entren a cap còpia automàtica. Descarrega-les des de Supabase → Storage si en vols còpia.

### Restaurar
- **Samarretes:** importa l'Excel/CSV (Importa). L'import no esborra ni fusiona res i avisa dels duplicats.
- **Resta de dades (desitjos, pressupostos…):** no hi ha restauració automàtica des del JSON. El fitxer és llegible i serveix per tornar-les a introduir o per carregar-les a mà.
- **Base de dades completa:** el volcat SQL es restaura amb `psql` sobre un projecte amb l'esquema de `supabase/migrations`.
- Supabase gratuït **no garanteix còpies automàtiques**: per això convé descarregar el JSON de tant en tant.

## Proves automàtiques
`npm test` (també a CI): catàleg, validació, importació/exportació, imatges, lots, finances, estadístiques, desitjos, PWA (manifest, icones, regles del service worker) i còpia de seguretat. Totes usen dades simulades: **cap prova toca el Supabase real**.
