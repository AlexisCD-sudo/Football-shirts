# Importació i exportació (fase 4)

## Importar

1. **Catàleg → Importa.** Accepta **CSV** i **Excel (.xlsx)**. Els fitxers de **Numbers** (`.numbers`) no es poden llegir al navegador: a Numbers, *Arxiu → Exporta a → CSV*.
2. **Columnes.** L'aplicació reconeix per nom les capçaleres habituals (també les del teu fitxer original: *Equip, Any, Nom, Home/away, Rèpliques, Curiositats*). Pots canviar l'assignació de cada columna. Les columnes que ignoris **no es perden**: la fila original sencera es desa amb cada samarreta (`original_data`).
3. **Vista prèvia i validació.** Cada fila mostra errors (no s'importa), avisos (s'importa amb una normalització) i possibles duplicats.
4. **Duplicats.** Es consideren duplicats les files amb el mateix equip, temporada i equipació, tant respecte a la col·lecció com dins del mateix fitxer. **No es fusionen ni s'esborren**: queden desmarcades i decideixes tu.
5. **Mostra.** Per defecte només s'importen les 5 primeres files marcades. Després, torna a importar el mateix fitxer amb «Totes les files marcades»: les 5 ja importades surten com a duplicades i queden desmarcades.
6. **Informe.** Al final es veu quantes s'han importat, quines han fallat (amb el motiu) i quantes no s'han importat. Es pot descarregar en JSON. Cada importació queda registrada a `import_batches`.

### Normalitzacions automàtiques (sempre amb avís)

- Temporada `2005-2006` o `2005/06` → `2005-06`.
- Espais sobrants al nom de l'equip.
- Imports amb coma decimal o símbol d'euro (`59,90 €` → `59.90`).
- Dates `dd/mm/aaaa` → `aaaa-mm-dd`.
- Equipació: `Home/Local/Casa` → Local; `Away/Visitant/Fora` → Visitant, etc.
- Versió «Rèplica» → versió rèplica i autenticitat rèplica.

Mai s'inventa cap dada: els camps que no hi són queden buits.

### Equips

Només es creen els equips que falten. **Els equips que ja existeixen no es modifiquen** (ni el tipus ni el país). Si el fitxer no té columna «Tipus d'equip», els equips nous es creen com a *Club*.

## Exportar

**Catàleg → Exporta:** Excel (.xlsx), CSV (UTF-8 amb BOM, per als accents a Excel) o JSON complet. S'exporten **totes** les samarretes, sense aplicar els filtres. Els fitxers CSV i Excel usen les mateixes capçaleres que l'importador, de manera que es poden tornar a importar. El JSON també inclou les dades originals d'importació.

> Una exportació amb enllaços a fotos **no és una còpia de les imatges**: només guarda l'URL.
