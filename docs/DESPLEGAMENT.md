# Desplegament i operació

Cost previst: **0 €/mes** (GitHub gratuït amb repositori privat, Supabase Free, Vercel Hobby per a ús personal i no comercial). Verifica els límits actuals als llocs oficials abans de dependre'n.

## Primer desplegament, en ordre
1. **GitHub:** repositori **privat** amb aquest codi.
2. **Supabase:** projecte a una regió europea → aplicar les dues migracions → tancar el registre → crear el teu usuari. Pas a pas a [`SUPABASE.md`](SUPABASE.md).
3. **Vercel:** *Add New → Project* → importa el repositori. Framework: Vite (es detecta sol; `vercel.json` ja ho fixa). Variables d'entorn (Production **i** Preview): `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY`.
4. **Supabase → Authentication → URL Configuration:** *Site URL* = la URL de producció de Vercel.
5. **Comprovació de seguretat:** [`SEGURETAT.md`](SEGURETAT.md) → llista de comprovació.
6. **Secrets de GitHub** (*Settings → Secrets and variables → Actions*):
   - `SUPABASE_URL` i `SUPABASE_ANON_KEY` → activa el keep-alive diari (evita la pausa per inactivitat).
   - `SUPABASE_DB_URL` (opcional) → activa el volcat setmanal de la BD ([`PWA_BACKUPS.md`](PWA_BACKUPS.md)).
7. **Importa la col·lecció** i fes una primera còpia JSON.

## Flux de treball
- Una branca per canvi → PR cap a `main` → la CI ha d'estar en verd (TypeScript, lint, proves, build) → fusiona.
- Vercel desplega `main` a producció i cada branca/PR a una URL de previsualització.
- Les variables `VITE_*` s'incorporen **en compilar**: si les canvies, fes *Redeploy* sense memòria cau.

## Tornar enrere
- **Aplicació:** Vercel → Deployments → desplegament anterior en verd → «Promote to Production». O a GitHub, *Revert* de la PR.
- **Dades:** no hi ha esborrats massius ni migracions destructives previstes. Per recuperar dades, vegeu la secció de restauració de `PWA_BACKUPS.md`.

## Migracions futures
Fitxers nous a `supabase/migrations/` (nom amb data), aplicats a mà al SQL Editor. Prova-les abans en un projecte de Supabase a part o en un PostgreSQL local. Mai amb dades reals com a primera prova.

## Manteniment
- **Dependabot** obre PR setmanals de dependències: revisa que la CI estigui en verd abans de fusionar.
- **Keep-alive:** GitHub desactiva les tasques programades després de 60 dies sense activitat al repositori; si passa, reactiva el workflow a *Actions*. Si Supabase pausa el projecte, reactiva'l des del panell.
- **Còpia JSON:** descarrega'n una de tant en tant i després de grans canvis (importacions, neteges).
- **Domini propi** (opcional): Vercel → Settings → Domains. Recorda actualitzar la *Site URL* de Supabase.

## Si alguna cosa falla
| Símptoma | Causa probable |
|---|---|
| La pàgina diu «This page doesn't exist» a Vercel | El desplegament és d'una branca sense l'aplicació o ha fallat; obre el de `main` en estat Ready. |
| Surt el mode de prova (avís taronja) en producció | Falten les variables `VITE_*` o no s'ha fet el redesplegament sense memòria cau. |
| No pots iniciar sessió | Usuari no creat o no confirmat; contrasenya incorrecta; *Site URL* errònia. |
| «No tens permís per fer aquesta operació» | La sessió ha caducat o les migracions no s'han aplicat completes; executa `real_project_checks.sql`. |
| Vercel: «Command npm install exited with 1» | Vercel ha canviat la versió de Node per defecte. El projecte fixa Node 22.x a `engines` de `package.json`; no ho tornis a posar a `>=20`. |
| La CI falla a la instal·lació | `package-lock.json` desactualitzat respecte de `package.json`: regenera'l i puja'l. |
