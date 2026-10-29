# Fotos de les samarretes (fase 5)

## Què fa
- **Cerca per samarreta**: *Detall → Cerca fotos*. La consulta es construeix amb equip, temporada, equipació i jugador, i es pot editar. Es mostren candidates amb la font, l'autor, la llicència i l'enllaç a la pàgina d'origen. Es poden comparar fins a 3, confirmar, rebutjar i tornar a cercar.
- **Cerca per lots**: botó *Cerca fotos* del catàleg. Barra de progrés, pausa i represa, resultats desats a mesura que arriben (si tanques la pàgina, es pot reprendre), ~1 samarreta per segon, fins a 3 intents amb espera creixent per samarreta i cua de revisió.
- **Enllaç manual**: pots enganxar l'adreça d'una imatge; es desa com a referència externa amb llicència «desconeguda».

## Regles
- **Mai s'assigna cap foto automàticament.** Tot passa per *candidata → revisió → confirmació*. La puntuació (equip, temporada, equipació, jugador) només serveix per ordenar.
- Les samarretes amb foto confirmada queden protegides: el lot no les cerca.
- Una URL rebutjada no es torna a proposar.
- Només es proposen JPEG, PNG i WebP (les plantilles SVG d'equipacions s'exclouen).

## Fonts
| Font | Clau | Notes |
|---|---|---|
| Wikimedia Commons (API MediaWiki) | No | Llicència i autor per fitxer. |
| Openverse (API oficial) | No | Màx. 20 resultats per consulta; es respecten els límits (429 → error i reintent). |

No hi ha scraping ni claus privades al frontend. Si les peticions des del navegador fossin bloquejades per CORS, caldria una funció de servidor (pendent de comprovar a l'entorn real).

## Referència externa vs còpia
Només es desa la **referència externa** (URL + atribució). No es copien imatges al bucket privat; la còpia i la pujada de fotos pròpies queden **fora d'aquesta fase**. Si l'enllaç extern deixa de funcionar, la fitxa mostra el marcador de posició.

## Limitacions conegudes
- La cobertura real serà baixa: a Commons i Openverse hi ha poques fotos de samarretes concretes.
- La puntuació és heurística sobre el títol i la descripció; no verifica la imatge.
- Les proves automàtiques usen respostes simulades. **La cerca real no s'ha pogut provar des de l'entorn de desenvolupament** (xarxa restringida): cal provar-la al desplegament.
