# FANTABet - Struttura Progetto

**Versione: 3.11**

## 🆕 Changelog v3.11

### Supporto File Excel XLSX
- **Caricamento Dati via XLSX**: Alternativa moderna ai CSV per caricare tutti i dati
  - **Statistiche**: Lettura da foglio "Tutti" con skip automatico della riga titolo e colonna Rm
  - **Calendario**: Layout dual-column (giornate dispari colonne A-E, giornate pari G-K)
  - **Rose Squadre**: Lettura da foglio "TutteLeRose" con layout dual-column
  - **Formazioni Giornate**: Parsing avanzato con titolari, panchina, voti e bonus
- **Formato Italiano Supportato**: Numeri decimali con virgola (es. 6,5 → 6.5) convertiti automaticamente
- **Libreria SheetJS**: Utilizzo di xlsx v0.20.1 per parsing affidabile e performante

### Gestione Bonus Completa
- **Bonus Negativi**: Visualizzazione corretta di bonus negativi (es. -0,5)
  - Stile rosso con icona ✗ per bonus negativi nelle statistiche
  - Stile verde con icona ✓ per bonus positivi
- **Tipi di Bonus Supportati**:
  - Modificatore difesa
  - Modificatore fairplay (+1 o -0,5)
  - Altri bonus (positivi e negativi)

### Reset Dati Admin
- **Cancellazione Formazioni Giornata**: Nuovo pulsante arancione nella sezione "Reset Dati"
  - Input interattivo per selezionare la giornata (1-38)
  - Rimozione completa dati formazioni per quella giornata
  - Funziona sia per dati da CSV che da XLSX

### Miglioramenti Interfaccia
- **Organizzazione Upload**: CSV ora in sezione collapsibile `<details>`
- **Pulsanti Upload XLSX**: Nuovi pulsanti verdi per file Excel (uno per tipo di dato)
- **Progress Bar**: Barre di progresso separate per ogni tipo di caricamento

### Bugfix
- **Parsing Formazioni da Excel**: Correzione offset colonne
  - Colonna D/J = Voto base (non più C/I)
  - Colonna E/K = Fantavoto (non più D/J)
- **Visualizzazione Bonus**: Bonus negativi non apparivano nella UI
  - Filtro cambiato da `valore > 0` a `valore !== 0`
  - Segno corretto nel display

---

## 🆕 Changelog v3.10

### Team of the Season Feature
- **Formazione Ideale (1-4-3-3)**: Visualizzazione della migliore formazione della stagione nella sezione "Dati Lega"
- **Selezione per Fantamedia**: Giocatori scelti in base al valore fantamedia (fm) anziché media voto
- **Filtro Presenze**: Solo giocatori con 5+ apparizioni nella stagione vengono considerati
- **Visualizzazione Completa**:
  - Nome giocatore
  - FantaSquad (squadra di appartenenza)
  - Fantamedia (rating medio della stagione)
  - Immagini da fantacalcio.it (200+ giocatori caricati)
- **Layout Responsive Mobile-First**:
  - Dimensioni card: 12x16px su mobile, 20x28px su desktop
  - Distribuzione difesa su tutta la larghezza
  - Centrocampo e attacco su righe singole
  - Gap responsivo tra elementi
- **Posizionamento in Dati Lega**: Nuova voce nel menu "Team of the Season" accanto a Risultati, Rose, Statistiche

### Sincronizzazione Date Risultati Storici
- **Fix Giornate 1-7**: Risolto problema dove le prime 7 giornate non mostravano date nella sezione "Risultati Storici"
- **Fallback a Date Predefinite**: Se una data non è presente in Firestore, usa automaticamente la data predefinita della Serie A da config.js
- **Coerenza Admin-Utente**:
  - Admin section "Orari Giornate" e user section "Risultati Storici" usano lo stesso sistema di date
  - Se l'admin salva una data custom, viene usata quella sia in admin che nell'area utente
  - Altrimenti fallback alla data predefinita Serie A
- **Rimozione Duplicazione**: Corretto bug che mostrava due volte la stessa data per giornata

### Footer Update
- **Versione aggiornata**: Cambiato da v3.9 a v3.10

---

## 🆕 Changelog v3.9

### Allegati Giornate (File Attachment System)
- **Modal Allegati**: Nuova finestra modale per gestire file allegati a ogni giornata della sezione "Risultati Storici"
- **Admin Upload**: Solo gli admin possono caricare file allegati (pulsante "Scegli File" e "Carica" visibili solo per admin)
- **View-Only Per Utenti**: Utenti non-admin possono visualizzare e scaricare file allegati, ma non caricarli
- **Limite 15 MB**: Validazione lato client che impedisce il caricamento di file > 15 MB con messaggio di errore chiaro
- **Firestore Integration**: File metadata salvati in collection `giornate_attachments` con tracciamento:
  - Numero giornata
  - Nome file, dimensione, tipo MIME
  - Data/ora caricamento
  - UID utente che ha caricato
- **Download/Delete**: Pulsanti per scaricare o eliminare file (delete solo per admin)

### Bonus Management Tab
- **Sezione Admin Bonus**: Nuova tab nel pannello Admin dedicata alla gestione bonus squadre
- **Tre Tipi di Bonus**: 
  - RG (Raddoppio Goal) - Rappresentato in rosso
  - 2G (Assegna 2 Goal) - Rappresentato in blu
  - SC (Scudo) - Rappresentato in verde
- **Card Squadre**: Visualizzazione bonus per ogni squadra con contatori
- **Salva Bonus**: Pulsante per salvare modifiche su Firestore
- **Carica Bonus**: Pulsante per ricaricare i dati dal database
- **Firestore Sync**: Sincronizzazione completa con collection `bonus_squadre`

### Footer Update
- **Versione aggiornata**: Cambiato da v3.8 a v3.9

## 🆕 Changelog v3.8

### Sezione "I miei Bonus"
- **Visualizzazione Classifica 2 Squadre**: Mini classifica nella sezione bonus che mostra i dati punti (PT) e punti fantacalcio (PTI) delle 2 squadre coinvolte nel bonus
- **PTI Calculation Fix**: Corretto il calcolo dei Punti Fantacalcio che non venivano accumulati correttamente
- **Bonus Standings Import**: Importazione diretta di `calculateStandings` da rendering.js per garantire coerenza dati tra home e bonus
- **Back Navigation**: Aggiunto pulsante back con freccia blu < che torna alla vista precedente (home)

### Sezione "Risultati Storici"
- **Back Navigation Unified**: Implementato back button con freccia blu < coerente con sezione bonus
- **Improved UI**: Titolo "Risultati Storici" in blu con layout header semplificato
- **Navigation Logic**: Uso di `goBack()` per tornare alla vista precedente anziché hardcoded redirect a home

### Bug Fixes
- **Fantasy Points Accumulation**: Risolto bug dove valori 0 o stringhe vuote non venivano accumulate nella classifica
- **Conditional Check Fix**: Migliorato il check `if (res.homePoints !== undefined && res.homePoints !== null && res.homePoints !== '')` per evitare esclusione di valori nulli

---

## 📜 Changelog v3.7

### Admin User Management
- **Delete User Button**: Aggiunto pulsante "Elimina" per rimuovere utenti dal database (admin only)
- **Rendi Admin Label**: Rinominato da "Ruolo" a "Rendi Admin" con visualizzazione Sì/No
- **Responsive Grid Layout**: Grid a 2 colonne su mobile, 3 su tablet, 5 su desktop per visibility ottimale
- **Auto-load Users**: Caricamento automatico della lista utenti all'apertura della sezione Settings

### Mobile Admin UI
- **Desktop-only Tabs Hidden**: Tab "Orari", "Scommesse", "Dati CSV" nascosti su mobile (<1024px)
- **Gestione Utenti sempre visibile**: Tab utenti visibile su tutte le piattaforme
- **Improved Responsive Design**: Layout ottimizzato per mobile, tablet e desktop

### Footer Enhancement
- **GitHub Commit Info**: Footer mostra data e ora dell'ultimo commit su GitHub
- **Real-time Version**: Versione aggiornata automaticamente dal repository

---

## 📜 Changelog v3.6

### Sezione Profilo
- **Pulsante Logout**: Aggiunto pulsante rosso per disconnettersi dall'account

### Home Welcome
- **Badge posizione classifica**: Mostrato come pillola gialla "#X in classifica" sotto il nome squadra
- **Layout migliorato**: Nome squadra in bianco, badge posizione in evidenza

### Sezione Scommesse
- **Crediti disponibili**: Visualizzazione crediti utente prima dell'input puntata
- **Layout compatto**: Crediti e Puntata sulla stessa riga (responsive)

---

## 📜 Changelog v3.5

### Miglioramenti Mobile
- **Statistiche Calciatori Fullscreen**: Tabella completa con scroll orizzontale, ordinamento dinamico funzionante, mantenimento posizione scroll durante ordinamento
- **Filtri Andamento Classifica**: Selettori "Da" e "A" per visualizzare intervallo giornate specifico
- **Colonne ottimizzate**: Gestione nomi lunghi con ellipsis (Calciatore, Squadra, Rosa)

### Sezione Settings/Admin
- **Tabs di navigazione desktop**: Utenti, Orari, Scommesse, Dati CSV
- **Sottosezioni nascoste su mobile**: Orari, Scommesse e Dati CSV visibili solo su desktop (≥1024px)
- **Gestione Utenti sempre visibile** su tutte le piattaforme

### Bugfix
- Corretto fullscreen grafico "Andamento Classifica" che mostrava "Nessun dato disponibile"
- Corretto fullscreen statistiche che faceva sparire la tabella alla chiusura
- Rimosso codice duplicato residuo

---

## 📜 Changelog v3.4

### Redesign Sezione Scommesse
- **Layout responsivo orizzontale** per le opzioni di scommessa (1, X, 2) su una sola riga
- **Titolo sezione migliorato**: "Scommetti su: Giornata X (Y Partite)" in giallo con data grigia
- **Squadre in layout compatto**:
  - Logo + nome della squadra in verticale su mobile (<480px)
  - Layout flex orizzontale con separatore "vs"
  - Font size responsive: text-sm su mobile, text-lg su desktop
- **Opzioni scommessa**:
  - Flex layout su una riga con gap minimalista
  - Padding ridotto su mobile (p-1) per compattezza
  - Mostra "Quota: X.XX" sotto ogni opzione
- **Nav bar**: Icona Home cambiata con una casa pulita e minimale
- **Scommesse nella nav**: Testo centrato rispetto all'icona, no capo a riga
- **CSS ottimizzato**: Ridotto padding/gap per mobile <480px, mantenuto look desktop

---

## 📜 Changelog v3.3

### Redesign Sezione Home
- **Welcome personalizzato** con logo e nome della rosa dell'utente
- **Layout ristrutturato**:
  1. Benvenuto utente con logo squadra (da `fantaSquad` nel profilo)
  2. Classifica (spostata subito dopo il welcome)
  3. Pulsante "I Miei Bonus" - ora rettangolare e a larghezza piena
  4. Sorteggio Coppa Italia (solo desktop)
- **Rimosso** il generico "Benvenuto in FantaBet" con logo lega
- **Nuova funzione** `updateHomeWelcome()` in app.js

---

## 📜 Changelog v3.2

### Ristrutturazione Sezione "Dati Lega"
- **Nuova navigazione a sottosezioni** con header dinamico e freccia indietro
- **5 sottosezioni dedicate**:
  - 📅 **Risultati Storici** - Consulta risultati passati con filtro per giornata
  - 👥 **Rose** - Visualizza le rose delle squadre con filtro
  - 📊 **Statistiche Calciatori** - Analizza prestazioni con filtri e ordinamento
  - 📈 **Statistiche Lega** - Statistiche generali della lega
  - 📉 **Andamento Classifica** - Grafico evoluzione posizioni
- **Caricamento asincrono** dei dati da Firebase
- **Download Regolamento PDF** sempre accessibile dal menu principale

### Miglioramenti Tecnici
- Esportate funzioni getter su `window` per accesso dai moduli inline
- Aggiunto `window.standingsTrendChartInstance` per il grafico andamento
- Nuove funzioni: `switchLeagueDataView()`, `goBackToLeagueMenu()`
- Supporto sia per dati locali che caricati da Firebase

---

## 📁 Struttura delle Cartelle

```
FANTABet/
├── index.html               # File HTML principale (entry point)
├── README.md                # Questa documentazione
├── css/
│   └── styles.css           # Tutti gli stili CSS estratti
├── js/
│   ├── app.js               # Entry point principale, coordina i moduli
│   ├── firebase-config.js   # Configurazione e inizializzazione Firebase
│   ├── config.js            # Costanti, mappature loghi, configurazioni globali
│   ├── utils.js             # Funzioni di utilità (messageBox, progress bar, etc)
│   ├── state.js             # Gestione stato globale dell'applicazione
│   ├── views.js             # Navigazione tra le viste e gestione UI
│   ├── auth.js              # Autenticazione (login, logout, gestione utente)
│   ├── rendering.js         # Funzioni di rendering UI (classifica, statistiche)
│   ├── bets.js              # Gestione scommesse e pronostici
│   └── admin.js             # Funzionalità amministratore
└── assets/
    └── (immagini locali)    # Per immagini/risorse locali
```

## 🔧 Moduli JavaScript

### firebase-config.js
Contiene la configurazione Firebase e l'inizializzazione di Firestore e Authentication.
Esporta:
- `db`, `auth` - Istanze Firebase
- Tutte le funzioni Firestore necessarie
- Funzioni getter per le collection reference

### config.js
Contiene tutte le costanti e configurazioni:
- `ADMIN_USER_IDS` - Lista admin
- `TEAM_LOGOS` - Mappatura loghi squadre
- `SERIE_A_DATES` - Date del calendario Serie A
- `BONUS_TYPES` - Tipi di bonus disponibili
- `getTeamLogo()` - Helper per ottenere URL logo

### utils.js
Funzioni di utilità generiche:
- `messageBox()`, `hideMessageBox()` - Gestione messaggi
- `showProgressBar()`, `updateProgressBar()`, `hideProgressBar()` - Progress bar
- `formatNumber()`, `formatDate()`, `formatDateTime()` - Formattazione
- `debounce()`, `throttle()` - Rate limiting
- `setLocalStorage()`, `getLocalStorage()` - Storage helpers

### state.js
Gestione centralizzata dello stato dell'applicazione:
- Dati squadre, risultati, partite
- Stato scommesse e previsioni
- Stato navigazione
- Funzioni setter per aggiornare lo stato

### views.js
Gestione della navigazione tra le sezioni:
- `setAppView()` - Cambia vista corrente
- `showAdminTab()` - Gestione tab admin
- Helper per visibilità elementi
- Callback per caricamento dati per vista

### auth.js
Gestione autenticazione utente:
- `handleLoginRegister()` - Login/Registrazione
- `handleLogout()` - Logout
- `checkAdminStatus()` - Verifica admin
- `adjustCredits()` - Gestione crediti
- Listener stato autenticazione

### rendering.js
Funzioni di rendering UI:
- `renderHistoricResults()` - Tabella risultati storici
- `renderStandings()` - Classifica con ordinamento
- `calculateStandings()` - Calcolo classifica
- `renderStatistics()` - Statistiche lega
- `renderStandingsTrend()` - Grafico andamento (Chart.js)
- `renderDataAnalysis()` - Modal analisi dati
- Listener real-time Firestore per aggiornamenti

### bets.js
Gestione scommesse e pronostici:
- `recordPrediction()` - Registra pronostico singolo
- `updateGiornataBetButton()` - Aggiorna stato pulsante conferma
- `placeBetForGiornata()` - Conferma scommesse giornata
- `renderOpenMatches()` - Mostra partite aperte per scommesse
- `renderBetDeadlineCountdown()` - Countdown deadline scommessa
- `renderPlacedBets()` - Visualizza scommesse piazzate
- `setupAdminBetsListener()` - Listener admin per liquidazione

### admin.js
Funzionalità amministratore:
- `renderAdminUsersList()` - Lista utenti con modifica
- `loadUsersForAdmin()` - Carica utenti
- `updateUserPermissionsAndCredits()` - Modifica utente
- `loadSchedulesForAdmin()` - Carica orari giornate
- `saveAllSchedules()` - Salva orari
- `renderAdminBetsList()` - Lista scommesse per liquidazione
- `renderAdminBetsFilter()` - Filtro scommesse admin

## 🚀 Come Usare

1. Il file `index.html` è l'entry point dell'applicazione
2. Tutti i moduli JS usano ES6 modules (import/export)
3. I CSS sono caricati da `css/styles.css`
4. Le dipendenze esterne (Tailwind, Chart.js, Firebase) sono caricate via CDN

## 📝 Note per gli Sviluppatori

- Usa sempre `import`/`export` per le dipendenze tra moduli
- Le funzioni esposte a `window` sono solo quelle necessarie per gli onclick inline
- Lo stato è centralizzato in `state.js` - evita variabili globali
- Per aggiungere nuove viste, aggiungi la mappatura in `views.js`

## 🔄 Migrazione dal File Originale

Il file originale `FANTABet.html` (~10,800 righe) è stato suddiviso in:
1. HTML puro (index.html)
2. CSS estratto (styles.css)
3. Moduli JS separati per funzionalità

Vantaggi della nuova struttura:
- ✅ Codice più manutenibile
- ✅ Separazione delle responsabilità
- ✅ Più facile il debugging
- ✅ Possibilità di caching del browser per CSS/JS
- ✅ Team di sviluppo può lavorare su file diversi

## �️ Collezioni Firestore

| Collection | Descrizione |
|------------|-------------|
| `fantabet_teams` | Squadre del fantacalcio |
| `fantabet_results` | Risultati storici delle partite |
| `fantabet_matches` | Partite (aperte e chiuse) |
| `fantabet_giornata_bets` | Scommesse degli utenti |
| `fantabet_users` | Profili utenti |
| `fantabet_schedules` | Orari delle giornate |
| `fantabet_bonus` | Bonus/malus utenti |
| `fantabet_squads` | Rose delle squadre |
| `fantabet_players` | Giocatori |
| `fantabet_player_stats` | Statistiche giocatori |

## �📦 Dipendenze CDN

- Tailwind CSS 3.4.16
- Chart.js 4.4.0
- Firebase 9.6.11 (App, Firestore, Auth)
