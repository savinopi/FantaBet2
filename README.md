# FANTABet - Struttura Progetto

**Versione: 3.5**

## 🆕 Changelog v3.5

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
