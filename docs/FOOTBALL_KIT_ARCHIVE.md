# Football Kit Archive (FKA)

## Estat: integració automàtica NO viable → flux assistit
Investigat el 29/10/2026:
- **No hi ha cap API oficial ni programa d'accés per a tercers** que hagi pogut trobar.
- L'únic «API de FKA» que existia (projecte FKAPI, no oficial) feia *scraping*; està arxivat, el servei allotjat s'ha tancat i el seu autor indica que la protecció Cloudflare de FKA va aturar la recollida automàtica.
- No he pogut obrir els Termes d'ús de footballkitarchive.com. Els del lloc germà de la mateixa xarxa (thekitarchive.com) prohibeixen fer *scraping* o saltar-se restriccions d'accés sense permís. Per precaució s'aplica el mateix a FKA.

Per tant **no s'ha implementat cap integració que consulti FKA des de l'aplicació ni des d'una funció de Vercel** (seria scraping i hauria d'eludir Cloudflare). Tampoc es simula una cerca. No s'ha afegit cap funció de servidor, clau ni variable d'entorn.

> Si vols una integració automàtica, el camí correcte és escriure a FKA i demanar permís o un accés oficial. Si te'l donen, el punt d'extensió és `src/lib/imageSearch/` (una font nova amb el mateix contracte que Commons/Openverse).

## Què s'ha implementat
### 1. «Des de Football Kit Archive» (botó al catàleg)
1. **Obre Football Kit Archive** (nova pestanya) i troba la samarreta.
2. **Enganxa l'enllaç de la fitxa.** L'app llegeix només el *text* de l'URL (p. ex. `…/ajax-2021-22-third-kit/`) i **suggereix** equip, temporada i equipació. És una heurística: es mostra com a suggeriment, mai com a coincidència exacta; si no pot deduir res, deixa els camps buits.
3. **Imatge (opcional):** puja el fitxer (recomanat: queda a la teva còpia privada) o enganxa l'adreça directa. La previsualització avisa si el web d'origen no deixa mostrar-la.
4. **Revisa les dades** al formulari habitual de samarreta (tot editable, amb la validació de sempre) i desa. Patrocinador → «Observacions» (no hi ha camp propi; evita una migració).

### 2. Des d'una samarreta que ja tens
Detall → «Cerca fotos»: ara la primera secció és Football Kit Archive (enllaç al web + text suggerit per cercar). Després pots **pujar** la imatge o **afegir-la per enllaç**; si l'enllaç o la fitxa són de FKA, es marca la font «Football Kit Archive».

### 3. Cerca automàtica (Commons/Openverse) → alternativa
Es manté intacta (cerca per samarreta i per lots) però queda com a «alternativa».

## Dades que es conserven
- **Font:** `footballkitarchive` (o `manual` si l'enllaç no és de FKA).
- **URL de la fitxa:** a la imatge (`source_page_url`) i a «Procedència» de la samarreta (així també es conserva si has pujat un fitxer).
- **Permís:** «Ús personal (permís assumit pel propietari)». Segons les teves instruccions s'assumeix que pots usar-les en privat; l'aplicació **no afirma que siguin lliures de drets** i la col·lecció és privada.
- Avís (no bloquejant) si ja tens una samarreta amb el mateix equip, temporada i equipació.

## Limitacions
- No hi ha llista de resultats dins l'app ni cerca per marca/patrocinador: depèn del web de FKA.
- Les imatges per **adreça** poden deixar de veure's si FKA bloqueja l'enllaçament extern; per això es recomana pujar el fitxer. No ho he pogut provar contra FKA real (el meu entorn no hi té accés).
- El suggeriment a partir de l'URL depèn del format dels enllaços de FKA, que he deduït d'exemples i **no he pogut verificar**. Les temporades d'un sol any (p. ex. «2022») no es dedueixen: s'han d'escriure.
- No s'ha fet cap descàrrega automàtica d'imatges.

## Desplegar a Vercel
Res de nou: no hi ha variables d'entorn, funcions ni migracions. Fusiona la PR, espera el desplegament de `main` (Ready) i recarrega.

## Nota
El commit `78a13d9` (afegeix `text?` a `FetchLike`) és teu i no s'usa en aquesta implementació; es deixa tal qual.
