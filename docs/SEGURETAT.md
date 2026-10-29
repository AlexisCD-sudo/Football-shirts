# Seguretat: model, controls i què s'ha verificat

Aplicació d'**un sol usuari** amb dades personals poc sensibles (samarretes, preus, fotos). L'objectiu és que **ningú més** pugui llegir ni modificar res, i que no hi hagi secrets al navegador ni al repositori.

## Controls
| Àrea | Control |
|---|---|
| Accés | Inici de sessió amb Supabase Auth. Registre públic desactivat (cal fer-ho a mà, vegeu `SUPABASE.md` §3). |
| Dades | Totes les taules de `public` amb RLS **activada i forçada**; una política per taula (`owner_id = auth.uid()`); el rol `anon` sense cap privilegi. |
| Integritat entre usuaris | Claus foranes compostes `(id, owner_id)`: una fila no pot apuntar a dades d'un altre usuari. |
| Fotos pròpies | Bucket `shirt-photos` **privat**, carpeta per usuari, enllaços signats d'1 hora. |
| Secrets | Al navegador només la clau pública `anon`. Cap `service_role`, cap clau privada d'APIs d'imatges. `.gitignore` exclou `.env*` i les dades privades. |
| Cerca d'imatges | Només APIs públiques (Wikimedia Commons, Openverse), sense scraping ni evasió de límits. Les fotos externes es carreguen amb `referrerPolicy="no-referrer"`. Només s'accepten enllaços `http(s)`. |
| Service worker | Només toca fitxers del mateix domini; mai Supabase, fotos ni tipografies. No es desen dades al dispositiu. |
| Capçaleres (Vercel) | `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` i una **CSP en mode «només informe»** (vegeu més avall). |
| Dependències | Dependabot setmanal i `npm audit` informatiu a la CI. |

## Què s'ha verificat de veritat (i com)
- **Aïllament RLS i Storage** amb PostgreSQL 16 local i una simulació mínima de Supabase (`supabase/tests/`): l'usuari B no veu, no modifica, no esborra ni insereix com A; `anon` rep «permission denied»; no es pot enllaçar una fila amb dades d'un altre usuari.
- **Script de comprovació** `supabase/tests/real_project_checks.sql`: provat en local (34 comprovacions «OK» amb la migració aplicada i «ALERTA» quan s'hi desactiva la RLS d'una taula a propòsit).
- **Proves automàtiques** (`npm test`, a la CI): validacions, importació/exportació, cerca d'imatges, lots, desitjos, finances, PWA i còpia. Totes amb dades simulades.
- Tu has comprovat que l'inici de sessió, la sincronització, l'import/export, les fotos i les pàgines noves funcionen al desplegament real.

## Què NO s'ha verificat
- **Les polítiques contra el projecte real de Supabase** no les he pogut executar jo des de l'entorn de desenvolupament. Per això hi ha el pas 1 de la llista següent.
- La **pujada a Storage** i els enllaços signats només s'han provat amb un client simulat (i, a la teva prova manual, funcionant).
- La **CSP** no s'ha pogut provar en un navegador real (per això és «només informe»).
- El **volcat automàtic de la BD** (`db-backup.yml`) no s'ha executat mai.
- No he fet cap prova de penetració ni auditoria externa.

## Llista de comprovació abans de donar-ho per bo (≈10 minuts)
1. **SQL Editor de Supabase:** executa `supabase/tests/real_project_checks.sql`. Totes les files han de dir `OK`.
2. **Sense sessió, les dades surten buides** (substitueix les variables):
   ```bash
   curl -s "$VITE_SUPABASE_URL/rest/v1/shirts?select=id" -H "apikey: $VITE_SUPABASE_ANON_KEY"
   # esperat: []   (o un error de permisos; mai dades)
   ```
3. **Registre tancat:** Supabase → Authentication → Sign In / Providers → Email → «Allow new users to sign up» desactivat. Authentication → Users: només hi has de ser tu.
4. **Contrasenya forta** i única per al teu usuari (gestor de contrasenyes).
5. **Repositori privat** (GitHub → Settings → General → Danger Zone). Les còpies de la BD i els registres de la CI contenen o poden contenir dades.
6. **Variables a Vercel:** només `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY`. Comprova que cap és la `service_role` (la clau `anon` comença per `eyJ…` amb rol `anon`, o `sb_publishable_…`; la secreta és `sb_secret_…` o rol `service_role`).
7. **Prova de la CSP:** obre l'aplicació a Chrome, F12 → Console. Si no hi ha línies «[Report Only] Refused to…» mentre navegues, cerques fotos i exportes, es pot passar a mode d'aplicació: a `vercel.json` canvia `Content-Security-Policy-Report-Only` per `Content-Security-Policy`. Si n'hi ha, envia-me-les i ajusto la política abans.
8. **Previews de Vercel:** les URL de branca/desplegament usen el mateix Supabase. Vercel les protegeix amb inici de sessió per defecte; no ho desactivis.

## Riscos oberts i decisions
- **Sense 2FA** a l'aplicació: Supabase ho permet, però no hi ha interfície. El risc es mitiga amb contrasenya forta i registre tancat.
- **Clau `anon` pública**: és així per disseny; la protecció són les polítiques RLS (punt 1 i 2).
- **Cerques d'imatges**: el text de la consulta (equip, temporada, jugador) s'envia a Wikimedia i Openverse. No s'hi envia res més (ni usuari ni claus).
- **Fotos externes**: es carreguen des del servidor d'origen; aquest pot saber que algú les veu (sense referent). Si desapareixen, la fitxa mostra el marcador de posició.
- **Pla gratuït**: Supabase pausa per inactivitat i no garanteix còpies; vegeu `PWA_BACKUPS.md`.
- **Compromís del compte**: si sospites que algú té la teva contrasenya, canvia-la a Supabase → Authentication → Users i tanca totes les sessions. Si sospites que s'ha filtrat una clau, Project Settings → API → regenera-la i actualitza les variables de Vercel (redesplegament sense memòria cau).

## Com informar d'un problema
És un projecte personal: obre una *issue* al repositori (sense dades personals ni claus) o escriu al propietari.
