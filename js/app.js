/**
 * FANTABet - Entry Point Principale
 * 
 * Questo file inizializza l'applicazione e coordina tutti i moduli.
 * È il punto di ingresso che viene caricato dall'HTML.
 */

// ===================================
// IMPORTS
// ===================================

import { 
    db, 
    auth,
    initializeApp as firebaseInitializeApp,
    getFirestore,
    getAuth,
    onSnapshot,
    query,
    where,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    collection,
    getTeamsCollectionRef,
    getResultsCollectionRef,
    getMatchesCollectionRef,
    getGiornataBetsCollectionRef,
    getUsersCollectionRef,
    getScheduleCollectionRef,
    getBonusCollectionRef,
    getSquadsCollectionRef,
    getPlayersCollectionRef,
    getPlayerStatsCollectionRef
} from './firebase-config.js';

import { 
    ADMIN_USER_IDS, 
    TEAM_LOGOS, 
    getTeamLogo,
    SERIE_A_DATES,
    BONUS_TYPES
} from './config.js';

import { 
    messageBox, 
    hideMessageBox,
    showProgressBar,
    updateProgressBar,
    hideProgressBar,
    formatNumber,
    formatDate,
    formatDateTime,
    debounce,
    sleep
} from './utils.js';

import * as state from './state.js';

import { 
    setAppView, 
    showAdminTab,
    setViewCallbacks,
    showElement,
    hideElement
} from './views.js';

import {
    userId,
    userCredits,
    isUserAdmin,
    currentUserProfile,
    handleLoginRegister,
    handleLogout,
    checkAdminStatus,
    updateUserInfoDisplay,
    adjustCredits,
    setUserCredits,
    setCurrentUserProfile,
    setUserId,
    setIsUserAdmin,
    addUnsubscribe,
    removeAllListeners,
    setupAuthStateListener
} from './auth.js';

import {
    renderOpenMatches,
    renderPlacedBets,
    setupAdminBetsListener,
    setBetsDependencies,
    recordPrediction,
    updateGiornataBetButton,
    placeBetForGiornata,
    setupGlobalBetsFunctions,
    setOddsDependencies,
    calculateOdds,
    calculateStandings,
    calculateTeamStats
} from './bets.js';

import {
    renderHistoricResults,
    renderStandings,
    renderStatistics,
    renderStandingsTrend
} from './rendering.js';

// Import nuovi moduli
import {
    loadBonusData,
    saveBonusData,
    updateBonusTotal,
    updateBonusUsage,
    loadUserBonuses,
    saveUserBonusData,
    toggleBonusRequest,
    dismissBonusNotification,
    toggleAdditionalStats,
    setBonusDependencies
} from './bonus.js';

import {
    startDraw,
    drawNextTeam,
    resetDraw,
    copyLastDraw,
    getTeamStats,
    setDrawDependencies
} from './draw.js';

import {
    triggerFileInput,
    handleFileSelect,
    confirmUpload,
    processNewFile,
    processUploadedData,
    triggerSquadsFileInput,
    handleSquadsFileSelect,
    confirmSquadsUpload,
    processSquadsFile,
    triggerStatsFileInput,
    handleStatsFileSelect,
    confirmStatsUpload,
    processStatsFile
} from './csv-upload.js';

import {
    loadPlayerStats,
    sortPlayerStats,
    filterPlayerStats,
    loadPlayerLeaderboards,
    loadSquadsData,
    filterSquadView,
    loadLeagueStatsData,
    loadStandingsTrendChart
} from './player-stats.js';

// ===================================
// VARIABILI MODULO
// ===================================

let firebaseInitialized = false;

// ===================================
// SETUP FIREBASE
// ===================================

const setupFirebase = async () => {
    if (firebaseInitialized) return;
    
    try {
        // Firebase è già inizializzato in firebase-config.js
        firebaseInitialized = true;
        
        // Setup funzioni globali per bets (onclick nell'HTML)
        setupGlobalBetsFunctions();
        
        // Setup dipendenze per bets.js
        setBetsDependencies({
            getGiornataDeadline: getGiornataDeadline,
            isDeadlinePassed: isDeadlinePassed,
            checkPendingBonusRequests: () => {}, // placeholder
            renderAdminBetsList: () => {} // placeholder
        });
        
        // Setup dipendenze per odds calculation
        setOddsDependencies({
            getAllResults: () => state.getAllResults()
        });
        
        // Setup dipendenze per bonus.js
        setBonusDependencies({
            loadActiveGiornata: loadActiveGiornata,
            getGiornataDeadline: getGiornataDeadline,
            isActiveGiornata: isActiveGiornata,
            calculateStandings: calculateStandings
        });
        
        // Setup dipendenze per draw.js
        setDrawDependencies({
            calculateStandings: calculateStandings
        });
        
        document.getElementById('auth-status').textContent = 'In attesa di autenticazione...';
        
        // Setup listener per stato autenticazione
        setupAuthStateListener({
            onLogin: async (user) => {
                setUserId(user.uid);
                
                await checkAdminStatus();
                updateUserInfoDisplay();
                setupUserProfileListener(user.uid);
                setupListeners();
                
                if (isUserAdmin) {
                    await loadInitialData();
                    // Mostra pulsanti admin
                    showElement('admin-button-home');
                    showElement('user-bonus-button-home');
                }
                
                // Va alla home
                setAppView('home');
                
                // Setup data picker
                const today = new Date().toISOString().split('T')[0];
                const historicDate = document.getElementById('historic-date');
                const newMatchDate = document.getElementById('new-match-date');
                if (historicDate) historicDate.value = today;
                if (newMatchDate) newMatchDate.value = today;
            },
            onLogout: () => {
                setUserId(null);
                const userDisplayNameElement = document.getElementById('user-display-name');
                if (userDisplayNameElement) userDisplayNameElement.textContent = '';
            }
        });
        
    } catch (error) {
        console.error('Errore inizializzazione Firebase:', error);
        messageBox('Errore di configurazione Firebase. Impossibile avviare l\'app.');
    }
};

// ===================================
// LISTENER PROFILO UTENTE
// ===================================

const setupUserProfileListener = (uid) => {
    const userDocRef = doc(getUsersCollectionRef(), uid);
    
    addUnsubscribe(
        onSnapshot(userDocRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setCurrentUserProfile(data);
                setUserCredits(data.credits || 100);
                updateUserInfoDisplay();
                
                // Aggiorna elementi UI specifici
                const squadName = data.squadName;
                if (squadName) {
                    const bonusSquadEl = document.getElementById('user-bonus-squad-name');
                    if (bonusSquadEl) bonusSquadEl.textContent = squadName;
                    
                    // Mostra pulsante bonus se l'utente ha una squadra
                    showElement('user-bonus-button-home');
                }
            }
        }, (error) => console.error('Errore listener profilo:', error))
    );
};

// ===================================
// SETUP LISTENERS FIRESTORE
// ===================================

const setupListeners = () => {
    console.log('Inizializzazione listeners...');
    
    // Prima rimuovi eventuali listener esistenti
    removeAllListeners();
    
    // Listener per le Squadre
    addUnsubscribe(
        onSnapshot(getTeamsCollectionRef(), (snapshot) => {
            const teams = snapshot.docs.map(doc => doc.data().name).filter(name => name);
            state.setAllTeams(teams);
            updateTeamSelects(teams);
        }, (error) => console.error("Errore onSnapshot Teams:", error))
    );
    
    // Listener per i Risultati Storici
    addUnsubscribe(
        onSnapshot(getResultsCollectionRef(), (snapshot) => {
            const results = snapshot.docs.map(doc => doc.data());
            state.setAllResults(results);
            renderHistoricResults(results);
            renderStandings();
            renderStatistics();
            renderStandingsTrend();
            
            // Se la vista scommesse è aperta, ricalcola
            if (state.currentView === 'betting' && state.allMatches.length > 0) {
                (async () => {
                    const activeGiornata = await loadActiveGiornata();
                    if (activeGiornata) {
                        renderOpenMatches(state.allMatches, activeGiornata);
                    }
                })();
            }
        }, (error) => console.error("Errore onSnapshot Results:", error))
    );
    
    // Listener per le Partite
    addUnsubscribe(
        onSnapshot(getMatchesCollectionRef(), async (snapshot) => {
            try {
                const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                state.setAllMatches(matches);
                
                updateMatchToCloseSelect(matches);
                
                // Determina la giornata attiva
                const activeGiornata = await loadActiveGiornata();
                const lastCompletedGiornata = determineLastCompletedGiornata();
                let newNextGiornata = activeGiornata || (lastCompletedGiornata + 1);
                
                console.log('[DEBUG SCOMMESSE] activeGiornata:', activeGiornata, 
                    '| lastCompletedGiornata:', lastCompletedGiornata, 
                    '| newNextGiornata:', newNextGiornata);
                
                // Filtra partite aperte
                let openMatchesData = matches.filter(m => {
                    const isOpen = m.status === 'open' || !m.status;
                    const giornataNum = parseInt(m.giornata || '0', 10);
                    return isOpen && giornataNum === newNextGiornata;
                });
                
                // Aggiorna numero giornata se cambiato
                if (newNextGiornata !== state.nextGiornataNumber) {
                    state.setNextGiornataNumber(newNextGiornata);
                    if (isUserAdmin) {
                        setupAdminBetsListener(newNextGiornata, state.allUsersForAdmin);
                    }
                }
                
                // Recupera scommessa utente
                let userGiornataBet = null;
                if (userId && newNextGiornata) {
                    const betDocRef = doc(getGiornataBetsCollectionRef(), `${userId}_giornata_${newNextGiornata}`);
                    const betSnapshot = await getDoc(betDocRef);
                    if (betSnapshot.exists()) {
                        userGiornataBet = betSnapshot.data();
                    }
                }
                
                // Assegna scommesse alle partite
                const openMatches = openMatchesData.map(match => {
                    if (userGiornataBet) {
                        const prediction = userGiornataBet.predictions?.find(p => p.matchId === match.id);
                        match.userBet = {
                            prediction: prediction?.prediction || null,
                            stake: userGiornataBet.stake || 0,
                            odds: prediction?.odds || 0
                        };
                    } else {
                        match.userBet = { prediction: null, stake: 0 };
                    }
                    return match;
                });
                
                state.setOpenMatches(openMatches);
                renderOpenMatches(openMatches, state.nextGiornataNumber);
                
            } catch (error) {
                console.error("Errore elaborazione match snapshot:", error);
            }
        }, (error) => console.error("Errore onSnapshot Matches:", error))
    );
    
    // Listener scommesse utente
    const qUserBets = query(getGiornataBetsCollectionRef(), where('userId', '==', userId));
    addUnsubscribe(
        onSnapshot(qUserBets, (snapshot) => {
            const bets = snapshot.docs.map(doc => doc.data());
            state.setUserPlacedBets(bets);
            renderPlacedBets(bets);
        }, (error) => console.error("Errore onSnapshot User Placed Bets:", error))
    );
    
    // Listener admin
    if (isUserAdmin) {
        addUnsubscribe(
            onSnapshot(getUsersCollectionRef(), (snapshot) => {
                const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                state.setAllUsersForAdmin(users);
                renderAdminUsersList(users);
                setupAdminBetsListener(state.nextGiornataNumber, users);
            }, (error) => console.error("Errore onSnapshot Users:", error))
        );
    }
};

// ===================================
// FUNZIONI PLACEHOLDER
// (Da implementare o importare dai moduli specifici)
// ===================================

const loadInitialData = async () => {
    console.log('Caricamento dati iniziali admin...');
    // Implementazione esistente
};

// Cache per gli orari delle giornate
let scheduleCache = null;

const loadActiveGiornata = async () => {
    try {
        const scheduleSnapshot = await getDocs(getScheduleCollectionRef());
        for (const docSnap of scheduleSnapshot.docs) {
            const data = docSnap.data();
            if (data.isActive) {
                console.log('[DEBUG loadActiveGiornata] Giornata attiva trovata:', data.giornata);
                return parseInt(data.giornata, 10);
            }
        }
    } catch (error) {
        console.error('Errore caricamento giornata attiva:', error);
    }
    return null;
};

// Carica tutti gli orari delle giornate (con cache)
const loadAllSchedules = async () => {
    if (scheduleCache) return scheduleCache;
    
    try {
        const snapshot = await getDocs(getScheduleCollectionRef());
        scheduleCache = {};
        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            scheduleCache[data.giornata] = data;
        });
        console.log('Schedule cache caricata:', scheduleCache);
        return scheduleCache;
    } catch (error) {
        console.error('Errore caricamento schedules:', error);
        return {};
    }
};

// Orario di default per una giornata (se non configurato dall'admin)
const getDefaultSchedule = (giornata) => {
    const date = new Date().toISOString().split('T')[0];
    return {
        giornata: giornata.toString(),
        date: date,
        time: '20:45',
        confirmed: false,
        notes: 'Orario di default (non ancora confermato)'
    };
};

// Ottieni l'orario di una specifica giornata
const getGiornataSchedule = async (giornata) => {
    const allSchedules = await loadAllSchedules();
    
    if (allSchedules[giornata]) {
        return allSchedules[giornata];
    }
    
    // Se non esiste, restituisci default
    return getDefaultSchedule(giornata);
};

// Calcola la deadline (data + ora) per una giornata
const getGiornataDeadline = async (giornata) => {
    const schedule = await getGiornataSchedule(giornata);
    const deadlineString = `${schedule.date}T${schedule.time}:00`;
    return {
        deadline: new Date(deadlineString),
        confirmed: schedule.confirmed,
        notes: schedule.notes
    };
};

// Verifica se la deadline è passata
const isDeadlinePassed = async (giornata) => {
    const { deadline } = await getGiornataDeadline(giornata);
    return new Date() >= deadline;
};

// Verifica se una giornata è quella attiva
const isActiveGiornata = async (giornata) => {
    const activeGiornata = await loadActiveGiornata();
    return activeGiornata === parseInt(giornata, 10);
};

const determineLastCompletedGiornata = () => {
    const results = state.allResults;
    if (!results || results.length === 0) return 0;
    
    const giornate = results
        .map(r => parseInt(r.giornata || '0', 10))
        .filter(g => g > 0);
    
    return giornate.length > 0 ? Math.max(...giornate) : 0;
};

const updateTeamSelects = (teams) => {
    const selects = [
        'historic-home-team', 'historic-away-team',
        'new-match-home-team', 'new-match-away-team'
    ];
    
    selects.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.innerHTML = '';
            teams.forEach(team => {
                const option = document.createElement('option');
                option.value = team;
                option.textContent = team;
                select.appendChild(option);
            });
        }
    });
};

const updateMatchToCloseSelect = (matches) => {
    // Implementazione placeholder
};

// Le funzioni renderOpenMatches, renderPlacedBets, setupAdminBetsListener
// sono importate da bets.js
// Le funzioni renderHistoricResults, renderStandings, renderStatistics, renderStandingsTrend
// sono importate da rendering.js

const renderAdminUsersList = (users) => {
    // Implementazione placeholder
};

// ===================================
// SETUP CALLBACK VISTE
// ===================================

setViewCallbacks({
    onBettingView: async () => {
        console.log('Passaggio a sezione scommesse...');
        if (state.allMatches.length > 0) {
            const activeGiornata = await loadActiveGiornata();
            if (activeGiornata) {
                renderOpenMatches(state.allMatches, activeGiornata);
            }
        }
    },
    onProfileView: () => {
        renderProfileArea();
    },
    onHomeView: () => {
        loadPlayerLeaderboards();
    },
    onSquadsView: () => {
        loadSquadsData();
    },
    onPlayerStatsView: () => {
        loadPlayerStats();
    },
    onUserBonusView: () => {
        loadUserBonuses();
    },
    onLeagueStatsView: () => {
        loadLeagueStatsData();
    },
    onStandingsTrendView: () => {
        loadStandingsTrendChart();
    },
    onDrawView: () => {
        if (!window.currentSquadsData) {
            loadSquadsData();
        }
    },
    onAdminView: () => {
        showAdminTab('csv');
    }
});

// Funzioni placeholder per le viste
const renderProfileArea = () => {
    const emailInput = document.getElementById('profile-email');
    const nameInput = document.getElementById('profile-display-name');
    
    if (currentUserProfile) {
        if (emailInput) emailInput.value = currentUserProfile.email || '';
        if (nameInput) nameInput.value = currentUserProfile.displayName || '';
    }
};

// ===================================
// FUNZIONI MENU
// ===================================

window.showDataAnalysisMenu = () => {
    const modal = document.getElementById('data-analysis-modal');
    if (modal) modal.classList.remove('hidden');
};

window.hideDataAnalysisMenu = () => {
    const modal = document.getElementById('data-analysis-modal');
    if (modal) modal.classList.add('hidden');
};

window.expandStandings = () => {
    const modal = document.getElementById('standings-fullscreen-modal');
    if (modal) modal.classList.remove('hidden');
};

window.closeStandings = () => {
    const modal = document.getElementById('standings-fullscreen-modal');
    if (modal) modal.classList.add('hidden');
};

window.closeTeamStatsModal = () => {
    const modal = document.getElementById('team-stats-modal');
    if (modal) modal.classList.add('hidden');
};

// ===================================
// MENU UTENTE
// ===================================

window.toggleUserMenu = () => {
    const dropdown = document.getElementById('user-menu-dropdown');
    const button = document.getElementById('user-menu-toggle');
    
    if (dropdown && button) {
        if (dropdown.classList.contains('open')) {
            dropdown.classList.remove('open');
            button.style.transform = 'rotate(0deg)';
        } else {
            dropdown.classList.add('open');
            button.style.transform = 'rotate(90deg)';
        }
    }
};

// Chiudi menu quando si clicca fuori
document.addEventListener('click', (event) => {
    const dropdown = document.getElementById('user-menu-dropdown');
    const button = document.getElementById('user-menu-toggle');
    
    if (dropdown && button && !dropdown.contains(event.target) && !button.contains(event.target)) {
        dropdown.classList.remove('open');
        button.style.transform = 'rotate(0deg)';
    }
});

// ===================================
// INIZIALIZZAZIONE (Export per HTML)
// ===================================

/**
 * Funzione principale di inizializzazione dell'app
 * Esportata per essere chiamata dall'HTML
 */
export const initializeApp = () => {
    console.log('FANTABet - Inizializzazione...');
    setupFirebase();
};

// Fallback per caricamento diretto
window.onload = () => {
    // Se l'app non è già stata inizializzata dal modulo
    if (!window.FANTABetInitialized) {
        initializeApp();
        window.FANTABetInitialized = true;
    }
};

// Export per debug
window.FANTABetState = state;
