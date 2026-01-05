/**
 * FANTABet - Gestione Stato Globale
 * 
 * Questo modulo centralizza lo stato dell'applicazione
 * per evitare variabili globali sparse nel codice.
 */

// ===================================
// STATO DATI PRINCIPALI
// ===================================

/** Tutte le squadre caricate */
export let allTeams = [];

/** Tutti i risultati storici */
export let allResults = [];

/** Tutte le partite (aperte e chiuse) */
export let allMatches = [];

/** Partite aperte per scommesse */
export let openMatches = [];

/** Numero della prossima giornata */
export let nextGiornataNumber = 0;

/** Scommesse piazzate dall'utente */
export let userPlacedBets = [];

/** Previsioni correnti (per scommesse di gruppo) */
export let currentPredictions = {};

// ===================================
// STATO ORDINAMENTO CLASSIFICA
// ===================================

export let standingsSortColumn = null;
export let standingsSortDirection = 'asc';

// ===================================
// STATO TIMERS
// ===================================

/** Timer per countdown deadline scommesse */
export let countdownInterval = null;

/** Timer per countdown deadline bonus */
export let bonusCountdownInterval = null;

/** Flag se deadline è passata (per notifica bonus una sola volta) */
export let deadlineHasPassed = false;

// ===================================
// STATO ADMIN
// ===================================

/** Unsubscribe per listener scommesse admin */
export let adminBetsUnsubscribe = null;

/** Lista utenti per admin */
export let allUsersForAdmin = [];

/** Contenuto CSV locale */
export let localCsvContent = null;

/** Dati CSV parsati */
export let parsedCsvData = [];

/** Giornata attiva per i bonus */
export let currentActiveBonusGiornata = null;

/** Filtro corrente scommesse admin */
export let currentBetsFilter = 'all';

// ===================================
// STATO NAVIGAZIONE
// ===================================

/** Vista corrente */
export let currentView = 'home';

/** Vista precedente */
export let previousView = 'home';

// ===================================
// DATI ROSE E CALCIATORI
// ===================================

/** Dati delle rose delle squadre */
export let squadsData = null;

/** Statistiche calciatori */
export let playerStatsData = [];

// ===================================
// FUNZIONI SETTER (per aggiornare lo stato)
// ===================================

export const setAllTeams = (teams) => { allTeams = teams; };
export const setAllResults = (results) => { allResults = results; };
export const setAllMatches = (matches) => { allMatches = matches; };
export const setOpenMatches = (matches) => { openMatches = matches; };
export const setNextGiornataNumber = (num) => { nextGiornataNumber = num; };
export const setUserPlacedBets = (bets) => { userPlacedBets = bets; };
export const setCurrentPredictions = (preds) => { currentPredictions = preds; };
export const updatePrediction = (matchId, prediction) => { 
    currentPredictions[matchId] = prediction; 
};
export const clearPredictions = () => { currentPredictions = {}; };
export const clearCurrentPredictions = () => { currentPredictions = {}; };

export const setStandingsSortColumn = (col) => { standingsSortColumn = col; };
export const setStandingsSortDirection = (dir) => { standingsSortDirection = dir; };

export const setCountdownInterval = (interval) => { countdownInterval = interval; };
export const setBonusCountdownInterval = (interval) => { bonusCountdownInterval = interval; };
export const setDeadlineHasPassed = (passed) => { deadlineHasPassed = passed; };
export const clearCountdownInterval = () => { 
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
};
export const clearBonusCountdownInterval = () => { 
    if (bonusCountdownInterval) {
        clearInterval(bonusCountdownInterval);
        bonusCountdownInterval = null;
    }
};

export const setAdminBetsUnsubscribe = (unsub) => { adminBetsUnsubscribe = unsub; };
export const setAllUsersForAdmin = (users) => { allUsersForAdmin = users; };
export const setLocalCsvContent = (content) => { localCsvContent = content; };
export const setParsedCsvData = (data) => { parsedCsvData = data; };
export const setCurrentActiveBonusGiornata = (giornata) => { currentActiveBonusGiornata = giornata; };
export const setCurrentBetsFilter = (filter) => { currentBetsFilter = filter; };

export const setCurrentView = (view) => { currentView = view; };
export const setPreviousView = (view) => { previousView = view; };

export const setSquadsData = (data) => { squadsData = data; };
export const setPlayerStatsData = (data) => { playerStatsData = data; };

// ===================================
// FUNZIONI GETTER
// ===================================

export const getAllTeams = () => allTeams;
export const getAllResults = () => allResults;
export const getAllMatches = () => allMatches;
export const getOpenMatches = () => openMatches;
export const getNextGiornataNumber = () => nextGiornataNumber;
export const getUserPlacedBets = () => userPlacedBets;
export const getCurrentPredictions = () => currentPredictions;

export const getStandingsSortColumn = () => standingsSortColumn;
export const getStandingsSortDirection = () => standingsSortDirection;

export const getCountdownInterval = () => countdownInterval;
export const getBonusCountdownInterval = () => bonusCountdownInterval;
export const getDeadlineHasPassed = () => deadlineHasPassed;

export const getAdminBetsUnsubscribe = () => adminBetsUnsubscribe;
export const getAllUsersForAdmin = () => allUsersForAdmin;
export const getLocalCsvContent = () => localCsvContent;
export const getParsedCsvData = () => parsedCsvData;
export const getCurrentActiveBonusGiornata = () => currentActiveBonusGiornata;
export const getCurrentBetsFilter = () => currentBetsFilter;

export const getCurrentView = () => currentView;
export const getPreviousView = () => previousView;

export const getSquadsData = () => squadsData;
export const getPlayerStatsData = () => playerStatsData;

// ===================================
// FUNZIONI UTILITY
// ===================================

/**
 * Reset dello stato delle scommesse correnti
 */
export const resetBettingState = () => {
    currentPredictions = {};
};

/**
 * Aggiorna una partita specifica in openMatches
 * @param {string} matchId - ID della partita
 * @param {Object} updates - Dati da aggiornare
 */
export const updateOpenMatch = (matchId, updates) => {
    const index = openMatches.findIndex(m => m.id === matchId);
    if (index !== -1) {
        openMatches[index] = { ...openMatches[index], ...updates };
    }
};

/**
 * Pulisce i timer attivi
 */
export const clearAllTimers = () => {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    if (bonusCountdownInterval) {
        clearInterval(bonusCountdownInterval);
        bonusCountdownInterval = null;
    }
};

/**
 * Ottiene lo stato corrente (per debug)
 * @returns {Object} Snapshot dello stato
 */
export const getStateSnapshot = () => ({
    allTeams: allTeams.length,
    allResults: allResults.length,
    allMatches: allMatches.length,
    openMatches: openMatches.length,
    nextGiornataNumber,
    userPlacedBets: userPlacedBets.length,
    currentPredictions: Object.keys(currentPredictions).length,
    currentView,
    standingsSortColumn,
    standingsSortDirection
});

// ===================================
// ESPORTAZIONI WINDOW (per script inline)
// ===================================
window.getAllResults = getAllResults;
window.getPlayerStatsData = getPlayerStatsData;
window.getSquadsData = getSquadsData;
