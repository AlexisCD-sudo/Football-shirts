# Guia d'ús

## Entrar
Obre la URL de l'aplicació i inicia la sessió amb el teu correu i contrasenya (els de Supabase → Authentication → Users). No hi ha registre públic: només tu hi pots entrar. «Tanca la sessió» és a dalt a la dreta.

## Col·lecció
- **Cerca** (dalt): escriu equip, jugador, temporada, marca… No cal posar accents.
- **Filtres i ordre:** sota la cerca. «Neteja filtres» els treu tots.
- **Quadrícula / Llista:** el canvi es recorda al dispositiu.
- **Afegeix samarreta:** només l'equip és obligatori. Els camps que no coneguis, deixa'ls buits (no s'inventen).
- **Clic a una samarreta:** veus tots els detalls. Des d'allà: Edita, Elimina i Cerca fotos.

## Importar la col·lecció des d'Excel o CSV
1. **Importa** → tria el fitxer (.xlsx o .csv).
2. Revisa la correspondència de columnes i la vista prèvia. Els avisos (temporada `2005-2006` → `2005-06`, decimals amb coma…) no bloquegen.
3. Les **possibles duplicades** (mateix equip, temporada i equipació) es marquen, però no s'esborra ni es fusiona res.
4. Primer prova amb una mostra de 5 files; després importa-ho tot. L'informe final diu què s'ha importat i què ha fallat.
Detalls: `docs/IMPORT_EXPORT.md`.

## Fotos
**Una samarreta:** clic → «Cerca fotos».
- **Cerca a Internet:** la consulta es pot editar. Veuràs candidates amb font, autor i llicència. «Confirma» per triar-ne una, «Rebutja» per descartar-la (no es tornarà a proposar). Marca «Compara» a fins a 3 per veure-les ampliades.
- **Puja una foto pròpia:** JPG, PNG o WebP. Es redueix a 1600 px i es guarda al teu espai privat. És la via més fiable.
- **Afegeix per enllaç:** enganxa l'adreça directa d'una imatge (assegura't que en pots fer ús).
- **Treu / Elimina la foto:** a la mateixa pantalla.

**Per lots:** botó «Cerca fotos» de la col·lecció → «Cerca per a N samarretes sense foto». Pots **pausar** i **reprendre** (també si tanques la pàgina). Les samarretes amb foto confirmada no es toquen. Quan acabi, les que tenen candidates surten amb l'etiqueta **«Per revisar»**: obre-les i confirma o rebutja. **Cap foto s'assigna sola.**

## Desitjos
Pestanya «Desitjos» → «Afegeix un desig» (equip, temporada, equipació, prioritat 1 = màxima, preu màxim, enllaç, notes). «Ja la tinc» obre el formulari de samarreta ja omplert; en desar-lo, el desig es marca com a adquirit i queda enllaçat.

## Finances
- Despesa total = preu + enviament de les samarretes que tenen preu. Les que no en tenen **no es compten** (l'app t'ho diu).
- Balanç estimat: només amb les samarretes que tenen preu **i** valor estimat.
- **Pressupost anual:** posa un any i un import. Si la despesa del any el supera, es marca en vermell.

## Estadístiques
Recomptes per equip, país, marca, equipació, dècada, estat i versió, i una llista de dades que et falten (foto, marca, talla, preu…) per anar completant la col·lecció.

## Còpies de seguretat
Col·lecció → «Exporta» → «Descarrega la còpia (.json)». Fes-ho de tant en tant i guarda-la fora de l'aplicació. «Verifica una còpia» comprova que un fitxer és vàlid. Més detalls a `docs/PWA_BACKUPS.md`.

## Instal·lar al mòbil
Android (Chrome): menú ⋮ → Instal·la l'aplicació. iPhone (Safari): Compartir → Afegeix a la pantalla d'inici.

## Problemes habituals
| Passa | Què fer |
|---|---|
| No veig una funció nova | Recarrega amb Ctrl+Shift+R o tanca i reobre l'app. |
| «No hi ha connexió amb el servidor» | Comprova Internet; si és correcte, pot ser que Supabase estigui pausat (panell de Supabase → Restore). |
| La cerca de fotos no troba res | És normal per a peces poc conegudes. Prova una altra consulta o puja la teva foto. |
| Una foto externa ha deixat de veure's | L'enllaç ja no existeix. Cerca-ho de nou o puja la teva. |
| «La sessió ha caducat» | Torna a iniciar la sessió. |
