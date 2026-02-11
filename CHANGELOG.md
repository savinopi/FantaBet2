# Changelog FantaBet

Tutti i cambiamenti notevoli di questo progetto saranno documentati in questo file.

## [3.14.1] - 2026-02-11

### Migliorie
- **Miglioramenti UI/UX**: Refinement interfaccia utente
- **Correzioni CSS**: Aggiustamenti styling e responsive design
- **Ottimizzazioni App**: Performance improvements in app.js
- **Miglioramenti Upload CSV**: Refinement nella gestione upload file

## [3.14.0] - 2026-02-09

### Aggiunte
- **Sistema Upload Voti Fantacalcio**: Modulo completo per caricare voti da Excel
  - Caricamento file XLSX con parsing automatico foglio "Statistico"
  - Supporto giornate multiple in coda con progress bar visuale
  - Mapping dinamico colonne: Cod, Ruolo, Nome, Voto, Gf, Gs, Rp, Rs, Rf, Au, Amm, Esp, Ass
  - Rilevamento automatico giornata da titolo, nome file, o prima riga
  - Cancellazione voti precedenti per giornata prima dell'inserimento

- **Sezione Statistiche Calciatori Singoli**: Analisi player-focused completa
  - Indice dinamico dei giocatori con ricerca autocomplete normalizzi diacritici
  - 6 Statistics Cards: Partite, Gol, Assist, Ammonizioni, Espulsioni, Media Voto
  - Grafico interattivo Chart.js: linea doppia Voto vs FantaVoto per giornata
  - Tabella per-giornata con: giornata, voto, gf, gs, assist, amm, legenda bonus, FantaVoto
  - Formula FantaVoto visibile con componenti: Voto + (Gf×3) + (Rf×3) - (Gs×1) + (Ass×1) - (Amm×0.5) - (Esp×1) + (Rp×3) - (Au×1)
  - Debug functions: `debugSearchPlayer(term)` e `debugPlayersByTeam(squadra)` per troubleshooting

- **Logging Migliorato per Parsing Voti**:
  - Mostra distribuzione ruoli (P/D/C/A) durante parsing
  - Elenca primi portieri trovati per verifica rapida
  - Traccia numero squadre rilevate e mapping intestazioni

### Correzioni 🎯
- **BUG CRITICO - Parser Saltava Portieri**: Flag `inHeaderRow` continuava senza processare prima riga
  - Impatto: Prima parse = 314 voti (P=0), dopo = 334 voti (P=20)
  - Causa: Codice resettava flag E saltava riga con `continue;` 
  - Soluzione: Resettare senza saltare il giocatore

- **Test Numerico Codice Corretto**: Ora controlla colonna mappata `colMap.cod` anziché sempre A
  - Preveniva malidentificazione di giocatori come squadre

- **Legenda Campi Voti**: Corretta definizione Rf = "Rigori segnati"

- **Search Diacritici**: Added `normalizeName()` function usando NFD decomposition
  - Risolve ricerca di giocatori con accenti (Carnesecchi, etc)

### Miglioramenti UX
- **Error Handling Player Search**: Messaggio dettagliato quando giocatore non trovato
- **Admin Dashboard**: Nuove funzioni `clearVotesForGiornata()` e `clearAllVotes()`

---

## [3.13.0] - 2026-02-08

### Aggiunte
- **Sistema di Autenticazione completo**: Nuova pagina di login/signup professionale
  - Design con gradiente purple/indigo, form arrotondati, animazioni slide-in/slide-out
  - Toggle visibilità password con icona occhio
  - Supporto Firebase Auth: `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`
  - Pagina di recupero password con `sendPasswordResetEmail`
  
- **Validazione Password stringente (Signup)**: Criteri di sicurezza avanzati
  - Minimo 8 caratteri, almeno 1 maiuscola, 1 minuscola, 1 numero, 1 carattere speciale
  - Checklist visiva in tempo reale (✓/✗ colorati verde/rosso)
  - Pulsante "Crea Account" disabilitato finché tutti i criteri non sono soddisfatti
  - Verifica conferma password con feedback immediato

- **Banner FANTABET fisso**: Header globale sempre visibile
  - Gradiente purple → indigo con titolo FANTABET cliccabile (reload pagina)
  - Pulsante profilo circolare con iniziale email dell'utente
  - Design responsive: più sottile su desktop (`lg:py-2, lg:text-2xl`)

- **Menu Profilo**: Dropdown con email utente e logout
  - Elemento posizionato fuori dall'header (z-index: 9999) per evitare problemi di stacking context
  - Email troncata con `truncate`, label "Account", icona logout SVG
  - Chiusura automatica al click outside

### Correzioni
- **Messaggi di errore user-friendly**: Errori Firebase tradotti in italiano
  - Messaggi specifici per login (credenziali errate, troppi tentativi)
  - Messaggi specifici per signup (email già registrata, password debole)
  - Evidenziazione campi con bordo rosso in caso di errore

- **SyntaxError player-stats.js**: Risolto `Unexpected token 'export'` alla riga 265
  - Causato da `return;` mancante nel blocco `if (!tableBody)` rimosso durante debug cleanup

- **Menu profilo invisibile**: Il menu era dentro l'header con z-40 (stacking context limitato)
  - Spostato come elemento indipendente `fixed` fuori dall'header

- **Layout desktop**: Header troppo grande e sidebar sovrapposta
  - Header più sottile su desktop con classi `lg:py-2 lg:text-2xl lg:max-w-full`
  - Sidebar `top` cambiato da `1rem` a `3.5rem` per posizionarsi sotto l'header

### Pulizia Codice
- **Rimozione debug logs**: Eliminati 50+ `console.log` da tutti i moduli JS
  - `app.js`: Rimossi log [DEBUG LISTENER], Inizializzazione, scheduling, scommesse
  - `player-stats.js`: Rimossi 20+ log [LoadPlayerStats], [RenderPlayerStatsView], [SortPlayerStats], [DEBUG Rose]
  - `auth.js`: Rimossi log autenticazione, salvataggio documento, verifica admin
  - `views.js`: Rimosso log autoplay audio
  - `bonus.js`: Rimosso log [DEBUG BONUS] profilo utente
  - `admin.js`: Rimosso log [DEBUG saveAllSchedules]
  - `coach-stats.js`: Rimossi 2 log formazioni e ottimale
  - `rendering.js`: Rimossi log [DEBUG formatDateItalian], renderHistoricResults, Team of the Season
  - `debug-formations.js`: Rimosso log "Debug script caricato"

### Sicurezza
- **API Key Firebase aggiornata**: Nuova chiave in `firebase-config.js` e `debug-formations.html`
- **Caricamento dati differito**: `loadAppData()` ora viene chiamato solo dopo autenticazione riuscita

---

## [3.12.2] - 2026-02-07

### Correzioni
- **Statistiche Allenatore - Logica formazione ottimale**: Riscritta completamente
  - Quando schierata ha < 11 giocatori: usa lo STESSO modulo della schierata, non prova all ALLOWED_FORMATIONS
  - Sostituisce solo "pari ruolo" (P con P, D con D, C con C, A con A) con i migliori disponibili
  - **Risolve bug FC SANTA CLAUS G4**: Ora calcola correttamente l'ottimale anche con 2 soli difensori con voto
  - Efficacia del coach ora conta in tutte le situazioni, non solo con 11 giocatori schierati

### Miglioramenti UI/UX Mobile
- **Pulsante "Vedi dettaglio"**: Ora più grande e tocabile su mobile
  - Larghezza intera (`w-full`), padding generoso (`py-3`), testo più grande
  - Colori solido blu con hover/active state per feedback tattile
  - Arrotondato e ombreggiato (design moderno)
  
- **Layout sezioni Statistiche Allenatore**: Riepilogo su 3 colonne (Schierata - Efficacia - Ottimale)
  - Usa inline CSS Grid per garantire display su UNA riga anche su mobile (iPhone XR 414px)
  - Gap e padding responsivo: ridotto su mobile, normale su desktop
  - Testo numero: `text-base` su mobile → `text-xl` su desktop

---

## [3.12.1] - 2026-02-06

### Correzioni
- **Lettura colore celle Excel**: Il sistema ora legge il colore delle celle fantavoto dall'Excel
  - Le celle **verdi** indicano i calciatori che hanno contribuito al punteggio
  - Titolari che hanno giocato E panchinari subentrati vengono identificati correttamente
  - Non serve più l'asterisco nel nome, il colore è l'unico indicatore
  
- **Statistiche Allenatore - Calcolo formazione schierata**: Migliorato algoritmo
  - Usa `fantavoto_in_verde` quando disponibile (dati da Excel con colori)
  - Fallback a simulazione sostituzioni se i dati non sono affidabili
  - Limite garantito di 11 giocatori (1 portiere + 10 movimento)

- **Upload Formazioni Excel**: Caricamento ottimizzato
  - Opzione `cellStyles: true` per leggere stili e colori
  - Verifica automatica del colore verde nella cella fantavoto
  - I nuovi caricamenti avranno dati coerenti con la visualizzazione Excel

---

## [3.12] - 2026-02-06

### Aggiunte
- **Statistiche Allenatore**: Nuova sottosezione in Dati Lega
  - Calcolo del coefficiente di efficacia delle formazioni schierate
  - Confronto formazione schierata vs formazione ottimale calcolabile
  - Supporto per tutti i moduli consentiti: 3-4-3, 3-5-2, 4-3-3, 4-4-2, 4-5-1, 5-3-2, 5-4-1
  - Classifica allenatori basata sulla media del coefficiente
  - Filtri per giornata singola o intervallo di giornate
  - Filtro per squadra specifica
  - Dettaglio formazione schierata vs ottimale con evidenziazione differenze
  - Modal per visualizzare i calciatori che potevano essere sostituiti

- **Upload multiplo file Formazioni Excel**: Possibilità di caricare più file in coda
  - Selezione multipla di file Excel contemporaneamente
  - Lista visuale della coda con stato di ogni file
  - Elaborazione sequenziale con indicatore di progresso
  - Riepilogo finale con conteggio successi/errori

- **Aggiornamento automatico risultati**: Il caricamento formazioni aggiorna anche i risultati campionato
  - Estrazione automatica di squadre, punteggi e risultati dal file formazioni
  - Salvataggio/aggiornamento nella collection results
  - Le funzioni Calendario e Formazioni coesistono senza conflitti

---

## [3.11] - 2026-02-04

### Aggiunte
- **Caricamento Excel XLSX**: Supporto completo per file Excel (.xlsx) in alternativa ai CSV
  - Caricamento Statistiche da foglio "Tutti"
  - Caricamento Calendario con layout dual-column (giornate pari/dispari)
  - Caricamento Rose Squadre da foglio "TutteLeRose"
  - Caricamento Formazioni Giornate con parsing avanzato (titolari, panchina, bonus)
  - Supporto per numeri decimali in formato italiano (virgola → punto)
  - Utilizzo libreria SheetJS (xlsx) per parsing affidabile

- **Gestione Bonus Negativi**: Supporto completo per bonus negativi
  - Visualizzazione corretta di bonus con valori negativi (es. -0,5)
  - Stile visivo differenziato (rosso) per bonus negativi
  - Parsing corretto di "Altri bonus" sia positivi che negativi

- **Reset Formazioni per Giornata**: Nuova funzionalità admin
  - Cancellazione selettiva di formazioni per una giornata specifica
  - Input con validazione numero giornata (1-38)
  - Rimozione dati caricati sia da CSV che da XLSX

### Bugfix
- **Parsing Formazioni da Excel**: Correzione offset colonne
  - Colonna D = Voto base, Colonna E = Fantavoto (non più C e D)
  - Corretto parsing da layout dual-column
  - Bonus "Modificatore fairplay" e "Altri bonus" ora parsati correttamente

- **Visualizzazione Bonus**: I bonus negativi erano nascosti nella UI
  - Cambio filtro da `valore > 0` a `valore !== 0`
  - Segno corretto nel display (+1 per positivi, -0.5 per negativi)

### Modifiche
- Aggiornamento versioning a v3.11
- Spostamento CSV upload in sezione collapsibile `<details>`
- Aggiunta pulsante "Cancella Formazioni" nella sezione Reset dati admin (colore arancione)
- Miglioramento della struttura parser formazioni con debug logging

---

## [3.10] - 2026-02-01

### Aggiunte
- **Team of the Season Feature**: Visualizzazione della formazione ideale (1-4-3-3) con i migliori giocatori della stagione
  - Selezione giocatori basata su fantamedia (fm)
  - Filtro per presenze minime (5+ apparizioni)
  - Visualizzazione fantaSquad e fantamedia per ogni giocatore
  - Layout responsive mobile-first (12x16 su mobile, 20x28 su desktop)
  - Caricamento immagini da fantacalcio.it

### Bugfix
- **Sincronizzazione Date Risultati Storici**: Risolto problema dove giornate 1-7 non mostravano date in "Risultati Storici"
  - Ora utilizza fallback alle date predefinite della Serie A (da config.js) se non presenti in Firestore
  - Sincronizzazione perfetta tra admin "Orari Giornate" e sezione "Risultati Storici"
  - Rimozione duplicazione date nella visualizzazione

### Modifiche
- Aggiornamento versioning a v3.10
- Miglioramento loading dati giornate per consistenza tra sezioni admin e utente

---

## [3.9] - 2026-01-16

### Aggiunte
- **Sezione Allegati Giornate**: Nuova funzionalità per allegare file ai risultati storici
  - Possibilità di caricare/scaricare/eliminare file per ogni giornata
  - Limite di 15 MB per singolo file
  - Validazione lato client della dimensione del file
  - Caricamento file solo per admin
  - Archiviazione metadati in Firestore
  - Modal intuitiva per la gestione degli allegati

- **Bonus Management Tab**: Nuova tab admin dedicata alla gestione dei bonus squadre
  - Visualizzazione e gestione bonus per ogni squadra
  - Supporto per tre tipi di bonus: RG (Raddoppio Goal), 2G (Assegna 2 Goal), SC (Scudo)
  - Tracciamento dei bonus utilizzati per giornata
  - Salvataggio modifiche su Firestore

### Modifiche
- Aggiornamento versioning a v3.9
- Miglioramento UX della sezione Admin con nuove tab

### Bugfix
- Correzione validazione file allegati

---

## [3.8] - 2025-12-20

### Aggiunte
- Supporto completo per gestione utenti admin
- Interfaccia admin per gestione dati CSV
- Tab per gestione orari giornate
- Tab per visualizzazione e liquidazione scommesse

### Modifiche
- Ottimizzazione rendering tabella risultati
- Miglioramento performance caricamento dati

---

## [3.7] - 2025-11-15

### Aggiunte
- Statistiche calciatori con filtri avanzati
- Andamento classifica con grafici
- Visualizzazione rose squadre
- Leaderboard top scorer e top assistman

---

## [3.6] - 2025-10-10

### Aggiunte
- Sorteggio Coppa Italia (feature decorativa)
- Miglioramenti UI/UX per mobile
- Nuove animazioni e transizioni

---

## [3.5] - 2025-09-20

### Aggiunte
- Sistema scommesse per giornata
- Gestione crediti utenti
- Calcolo vincite automatico
- Cronologia scommesse

---

## [3.0] - 2025-08-01

### Aggiunte
- Lancio iniziale piattaforma FantaBet
- Sistema di autenticazione Firebase
- Dashboard home con classifica
- Caricamento dati CSV
- Gestione profili utenti
- Visualizzazione risultati storici
- Statistiche della lega
