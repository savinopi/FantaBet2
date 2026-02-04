# Changelog FantaBet

Tutti i cambiamenti notevoli di questo progetto saranno documentati in questo file.

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
