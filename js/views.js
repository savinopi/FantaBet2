/**
 * FANTABet - Gestione Viste e Navigazione
 * 
 * Questo modulo gestisce la navigazione tra le diverse
 * sezioni dell'applicazione.
 */

import * as state from './state.js';

// ===================================
// MAPPATURA CONTENITORI
// ===================================

const VIEW_CONTAINERS = {
    home: 'home-container',
    betting: 'betting-container',
    placed_bets: 'placed-bets-area',
    admin: 'admin-container',
    profile: 'profile-container',
    user_bonus: 'user-bonus-container',
    historic_results: 'historic-results-container',
    squads: 'squads-container',
    player_stats: 'player-stats-container',
    league_stats: 'league-stats-container',
    standings_trend: 'standings-trend-container-full',
    draw: 'draw-container'
};

// ===================================
// CALLBACK PER CARICAMENTO DATI
// ===================================

// Queste callback verranno impostate da app.js
let viewCallbacks = {
    onBettingView: null,
    onProfileView: null,
    onHomeView: null,
    onSquadsView: null,
    onPlayerStatsView: null,
    onUserBonusView: null,
    onLeagueStatsView: null,
    onStandingsTrendView: null,
    onHistoricResultsView: null,
    onDrawView: null,
    onAdminView: null
};

/**
 * Imposta le callback per le viste
 * @param {Object} callbacks - Oggetto con le callback
 */
export const setViewCallbacks = (callbacks) => {
    viewCallbacks = { ...viewCallbacks, ...callbacks };
};

// ===================================
// NAVIGAZIONE PRINCIPALE
// ===================================

/**
 * Cambia la vista corrente dell'applicazione
 * @param {string} view - Nome della vista da mostrare
 */
export const setAppView = async (view) => {
    const previousView = state.currentView;
    
    // Gestione cleanup della vista precedente
    handleViewExit(previousView);
    
    // Aggiorna lo stato - salva la vista precedente PRIMA di impostare quella nuova
    state.setPreviousView(previousView);
    state.setCurrentView(view);
    
    // Nascondi tutte le sezioni
    Object.values(VIEW_CONTAINERS).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    
    // Mostra la sezione richiesta
    const viewId = VIEW_CONTAINERS[view];
    if (viewId) {
        const el = document.getElementById(viewId);
        if (el) {
            el.classList.remove('hidden');
            
            // Gestione entrata nella nuova vista
            await handleViewEnter(view);
        }
    }
    
    // Aggiorna lo stato attivo nella navbar (opzionale)
    updateNavbarActiveState(view);
};

/**
 * Torna alla vista precedente
 */
export const goBack = async () => {
    const previousView = state.getPreviousView();
    await setAppView(previousView);
};

/**
 * Gestisce la pulizia quando si esce da una vista
 * @param {string} view - Vista da cui si sta uscendo
 */
const handleViewExit = (view) => {
    // Ferma il timer del countdown se si esce da betting
    if (view === 'betting' && state.countdownInterval) {
        clearInterval(state.countdownInterval);
        state.setCountdownInterval(null);
    }
    
    // Ferma il timer bonus se si esce da user_bonus
    if (view === 'user_bonus' && state.bonusCountdownInterval) {
        clearInterval(state.bonusCountdownInterval);
        state.setBonusCountdownInterval(null);
    }
    
    // Gestione audio sorteggi
    if (view === 'draw') {
        const drawAudio = document.getElementById('draw-theme-audio');
        if (drawAudio) {
            drawAudio.pause();
            drawAudio.currentTime = 0;
        }
    }
};

/**
 * Gestisce l'inizializzazione quando si entra in una vista
 * @param {string} view - Vista in cui si sta entrando
 */
const handleViewEnter = async (view) => {
    switch (view) {
        case 'betting':
            if (viewCallbacks.onBettingView) {
                await viewCallbacks.onBettingView();
            }
            break;
            
        case 'profile':
            if (viewCallbacks.onProfileView) {
                viewCallbacks.onProfileView();
            }
            break;
            
        case 'home':
            if (viewCallbacks.onHomeView) {
                viewCallbacks.onHomeView();
            }
            break;
            
        case 'squads':
            if (viewCallbacks.onSquadsView) {
                viewCallbacks.onSquadsView();
            }
            break;
            
        case 'player_stats':
            if (viewCallbacks.onPlayerStatsView) {
                viewCallbacks.onPlayerStatsView();
            }
            break;
            
        case 'user_bonus':
            if (viewCallbacks.onUserBonusView) {
                viewCallbacks.onUserBonusView();
            }
            break;
            
        case 'league_stats':
            if (viewCallbacks.onLeagueStatsView) {
                viewCallbacks.onLeagueStatsView();
            }
            break;
            
        case 'standings_trend':
            if (viewCallbacks.onStandingsTrendView) {
                viewCallbacks.onStandingsTrendView();
            }
            break;
            
        case 'historic_results':
            if (viewCallbacks.onHistoricResultsView) {
                viewCallbacks.onHistoricResultsView();
            }
            break;
            
        case 'draw':
            if (viewCallbacks.onDrawView) {
                viewCallbacks.onDrawView();
            }
            // Avvia musica tema UEFA
            const drawAudio = document.getElementById('draw-theme-audio');
            if (drawAudio) {
                drawAudio.currentTime = 0;
                drawAudio.play().catch(err => {});
            }
            break;
            
        case 'admin':
            if (viewCallbacks.onAdminView) {
                viewCallbacks.onAdminView();
            }
            // Mostra tab utenti di default
            showAdminTab('users');
            break;
    }
};

/**
 * Aggiorna lo stato attivo nella navbar
 * @param {string} activeView - Vista attualmente attiva
 */
const updateNavbarActiveState = (activeView) => {
    // Rimuovi classe active da tutti i link nav
    document.querySelectorAll('[data-view]').forEach(el => {
        el.classList.remove('nav-active', 'text-green-400', 'border-green-400');
    });
    
    // Aggiungi classe active al link corrente
    const activeLink = document.querySelector(`[data-view="${activeView}"]`);
    if (activeLink) {
        activeLink.classList.add('nav-active', 'text-green-400', 'border-green-400');
    }
};

// ===================================
// GESTIONE TAB ADMIN
// ===================================

/**
 * Mostra una tab specifica nel pannello admin
 * @param {string} tabName - Nome della tab
 */
export const showAdminTab = async (tabName) => {
    // Nascondi tutti i contenuti delle tab
    document.querySelectorAll('.admin-tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Disattiva tutti i pulsanti delle tab
    document.querySelectorAll('[id^="admin-tab-"]').forEach(button => {
        if (!button.id.endsWith('-content')) {
            button.classList.remove('btn-primary', 'text-red-500', 'border-red-500');
            button.classList.add('btn-secondary');
        }
    });

    // Mostra il contenuto della tab selezionata
    const tabContent = document.getElementById(`admin-tab-${tabName}-content`);
    if (tabContent) {
        tabContent.classList.remove('hidden');
    }
    
    // Attiva il pulsante della tab selezionata
    const activeButton = document.getElementById(`admin-tab-${tabName}`);
    if (activeButton) {
        activeButton.classList.remove('btn-secondary');
        if (tabName === 'danger') {
            activeButton.classList.add('text-red-500', 'border-red-500');
        } else {
            activeButton.classList.add('btn-primary');
        }
    }
    
    // Carica i dati specifici della tab
    await loadAdminTabData(tabName);
};

/**
 * Carica i dati per una tab admin specifica
 * @param {string} tabName - Nome della tab
 */
const loadAdminTabData = async (tabName) => {
    // Queste funzioni verranno chiamate tramite callback
    // configurate da admin.js quando viene importato
    const adminCallbacks = window.adminTabCallbacks || {};
    
    switch (tabName) {
        case 'bets':
            if (adminCallbacks.onBetsTab) {
                await adminCallbacks.onBetsTab();
            }
            break;
            
        case 'schedules':
            if (adminCallbacks.onSchedulesTab) {
                await adminCallbacks.onSchedulesTab();
            }
            break;
            
        case 'users':
            if (adminCallbacks.onUsersTab) {
                await adminCallbacks.onUsersTab();
            }
            break;
    }
};

// ===================================
// HELPER VISIBILITÀ
// ===================================

/**
 * Mostra un elemento
 * @param {string} elementId - ID dell'elemento
 */
export const showElement = (elementId) => {
    const el = document.getElementById(elementId);
    if (el) el.classList.remove('hidden');
};

/**
 * Nasconde un elemento
 * @param {string} elementId - ID dell'elemento
 */
export const hideElement = (elementId) => {
    const el = document.getElementById(elementId);
    if (el) el.classList.add('hidden');
};

/**
 * Toggle visibilità di un elemento
 * @param {string} elementId - ID dell'elemento
 */
export const toggleElement = (elementId) => {
    const el = document.getElementById(elementId);
    if (el) el.classList.toggle('hidden');
};

/**
 * Verifica se un elemento è visibile
 * @param {string} elementId - ID dell'elemento
 * @returns {boolean}
 */
export const isVisible = (elementId) => {
    const el = document.getElementById(elementId);
    return el && !el.classList.contains('hidden');
};

// ===================================
// SCROLL HELPERS
// ===================================

/**
 * Scrolla a un elemento
 * @param {string} elementId - ID dell'elemento
 * @param {string} behavior - 'smooth' o 'auto'
 */
export const scrollToElement = (elementId, behavior = 'smooth') => {
    const el = document.getElementById(elementId);
    if (el) {
        el.scrollIntoView({ behavior, block: 'start' });
    }
};

/**
 * Scrolla in cima alla pagina
 */
export const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ===================================
// EXPORT PER COMPATIBILITÀ WINDOW
// ===================================

window.setAppView = setAppView;
window.goBack = goBack;
window.showAdminTab = showAdminTab;
