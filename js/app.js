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
    getSerieAMatchDate,
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
    renderStandingsTrend,
    createSectionHeader
} from './rendering.js';

import {
    setupGlobalAdminFunctions,
    setAdminDependencies,
    renderAdminBetsList
} from './admin.js';

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
    loadLeagueStatsData
} from './league-stats.js';

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
    loadStandingsTrendChart
} from './player-stats.js';

// ===================================
// VARIABILI MODULO
// ===================================

let firebaseInitialized = false;

// ===================================
// SETUP FIREBASE
// ===================================

/**
 * Renderizza gli header di tutte le sezioni
 */
const setupSectionHeaders = () => {
    // Definizione degli header per ogni sezione - colore azzurro uniforme
    const headers = [
        {
            title: 'Home',
            color: 'text-blue-400',
            container: 'home-container'
        },
        {
            title: 'Scommesse',
            color: 'text-blue-400',
            container: 'betting-container'
        },
        {
            title: 'Dati Lega',
            color: 'text-blue-400',
            container: 'league-data-container'
        },
        {
            title: 'Profilo',
            color: 'text-blue-400',
            container: 'profile-container'
        },
        {
            title: 'Profilo',
            color: 'text-blue-400',
            container: 'user-bonus-container'
        },
        {
            title: 'Settings',
            color: 'text-blue-400',
            container: 'admin-container'
        }
    ];
    
    // Renderizza ogni header
    headers.forEach(header => {
        const container = document.getElementById(header.container);
        if (container) {
            const firstChild = container.querySelector('div:first-child');
            if (firstChild && !firstChild.querySelector('h1')) {
                // Solo se non esiste già un h1 (header non ancora creato)
                const headerHTML = createSectionHeader(header.title, header.color);
                firstChild.insertAdjacentHTML('afterbegin', headerHTML);
            }
        }
    });
};

/**
 * Aggiorna il welcome personalizzato nella Home
 * @param {Object} userProfile - Profilo utente con fantaSquad e displayName
 */
const updateHomeWelcome = (userProfile) => {
    const teamLogoEl = document.getElementById('user-team-logo');
    const teamNameEl = document.getElementById('user-team-name');
    
    if (!teamLogoEl || !teamNameEl) return;
    
    const squadName = userProfile?.fantaSquad || userProfile?.squadName;
    const displayName = userProfile?.displayName || 'Utente';
    
    if (squadName) {
        // Imposta logo della squadra
        const logoUrl = getTeamLogo(squadName);
        teamLogoEl.src = logoUrl;
        teamLogoEl.alt = `Logo ${squadName}`;
        
        // Imposta nome squadra
        teamNameEl.textContent = squadName;
    } else {
        // Nessuna squadra assegnata
        teamLogoEl.src = 'https://raw.githubusercontent.com/savinopi/FantaBet2/main/assets/esempio%20stemma%20lega.png';
        teamLogoEl.alt = 'Logo Lega';
        teamNameEl.textContent = displayName;
    }
};

const setupFirebase = async () => {
    if (firebaseInitialized) return;
    
    try {
        // Firebase è già inizializzato in firebase-config.js
        firebaseInitialized = true;
        
        // Renderizza gli header di tutte le sezioni
        setupSectionHeaders();
        
        // Setup funzioni globali per bets (onclick nell'HTML)
        setupGlobalBetsFunctions();
        
        // Setup funzioni globali per admin (onclick nell'HTML)
        setupGlobalAdminFunctions();
        
        // Setup dipendenze per bets.js
        setBetsDependencies({
            getGiornataDeadline: getGiornataDeadline,
            isDeadlinePassed: isDeadlinePassed,
            checkPendingBonusRequests: () => {}, // placeholder
            renderAdminBetsList: renderAdminBetsList
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
        
        // Setup dipendenze per admin.js - sarà completato dopo che le funzioni sono definite
        // Le funzioni loadAllSchedules, loadActiveGiornata, getGiornataSchedule 
        // saranno disponibili dopo l'inizializzazione
        
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

const setupUserProfileListener = async (uid) => {
    if (!uid) return;
    
    try {
        const userDocRef = doc(getUsersCollectionRef(), uid);
        console.log('[DEBUG LISTENER] Impostazione listener profilo per uid:', uid);
        
        // STEP 1: VERIFICA PRIMA SE IL DOCUMENTO ESISTE
        const docSnap = await getDoc(userDocRef);
        console.log('[DEBUG LISTENER] getDoc risultato - exists:', docSnap.exists(), '| data:', docSnap.data());
        
        if (!docSnap.exists()) {
            // STEP 2: SE NON ESISTE, CREALO PRIMA DI IMPOSTARE IL LISTENER
            console.log('[DEBUG LISTENER] Documento non esiste, creazione documento di default...');
            
            const isDefaultAdmin = ADMIN_USER_IDS.includes(uid);
            const defaultUserData = {
                email: auth.currentUser?.email || '',
                displayName: auth.currentUser?.email?.split('@')[0] || 'Utente',
                credits: 100,
                isAdmin: isDefaultAdmin,
                createdAt: new Date().toISOString()
            };
            
            console.log('[DEBUG LISTENER] Creazione documento con:', defaultUserData);
            await setDoc(userDocRef, defaultUserData);
            console.log('[DEBUG LISTENER] Documento creato con successo');
        }
        
        // STEP 3: ORA IMPOSTA IL LISTENER (il documento esiste con certezza)
        const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
            console.log('[DEBUG LISTENER] Snapshot ricevuto! Exists:', snapshot.exists());
            console.log('[DEBUG LISTENER] Snapshot data:', snapshot.data());
            
            if (snapshot.exists()) {
                const data = snapshot.data();
                console.log('[DEBUG LISTENER] Dati profilo ricevuti:', data);
                setCurrentUserProfile({ id: snapshot.id, ...data });
                setUserCredits(data.credits || 100);
                updateUserInfoDisplay();
                checkAdminStatus();
                
                // Aggiorna welcome section nella Home
                updateHomeWelcome(data);
                
                // Aggiorna elementi UI specifici
                const squadName = data.fantaSquad || data.squadName;
                if (squadName) {
                    const bonusSquadEl = document.getElementById('user-bonus-squad-name');
                    if (bonusSquadEl) bonusSquadEl.textContent = squadName;
                    
                    // Mostra pulsante bonus se l'utente ha una squadra
                    showElement('user-bonus-button-home');
                }
                
                // Controlla richieste bonus pendenti per admin
                if (isUserAdmin) {
                    loadActiveGiornata().then(activeGiornata => {
                        const lastCompletedGiornata = determineLastCompletedGiornata();
                        const currentGiornata = activeGiornata || (lastCompletedGiornata + 1);
                        const notificationShown = localStorage.getItem('bonusNotificationShown');
                        
                        if (notificationShown !== currentGiornata.toString()) {
                            checkPendingBonusRequests();
                        }
                    });
                }
                
                // Usa state.getCurrentView() per ottenere la vista corrente
                const getCurrentView = () => state.currentView;
                if (getCurrentView() === 'profile') {
                    renderProfileArea();
                }
            } else {
                console.warn('[DEBUG LISTENER] Documento utente non trovato per UID:', uid);
                setCurrentUserProfile(null);
            }
        }, (error) => {
            console.error('[DEBUG LISTENER] Errore onSnapshot:', error);
        });
        
        addUnsubscribe(unsubscribe);
        console.log('[DEBUG LISTENER] Listener registrato e aggiunto alla lista unsubscribe');
        
    } catch (error) {
        console.error('[DEBUG LISTENER] Errore setup profilo utente:', error);
        messageBox("Errore nella configurazione del profilo utente. Contatta l'amministratore.");
    }
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
            renderPlacedBets(bets, state.getAllResults());
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

const checkPendingBonusRequests = async () => {
    // Solo per admin
    if (!isUserAdmin) return;
    
    try {
        // Usa la giornata attiva impostata dall'admin, altrimenti fallback al calcolo automatico
        const activeGiornata = await loadActiveGiornata();
        const lastCompletedGiornata = determineLastCompletedGiornata();
        const currentGiornata = activeGiornata || (lastCompletedGiornata + 1);
        
        // Verifica se la deadline è passata (quindi la giornata è iniziata)
        const { deadline } = await getGiornataDeadline(currentGiornata);
        const now = new Date();
        
        // Mostra notifica solo se la deadline è passata (giornata iniziata)
        if (now < deadline) return;
        
        // Carica tutti i bonus
        const bonusSnapshot = await getDocs(getBonusCollectionRef());
        const teamsWithBonusRequests = [];
        
        bonusSnapshot.docs.forEach(doc => {
            const bonusData = doc.data();
            const teamName = bonusData.teamName;
            
            // Controlla se c'è un bonus richiesto per questa giornata
            const bonusTypes = ['RG', 'twoG', 'SC', 'POTM'];
            let requestedBonus = null;
            
            bonusTypes.forEach(type => {
                const usedArray = bonusData[type]?.usedInGiornata || [];
                if (usedArray.includes(currentGiornata.toString()) || usedArray.includes(currentGiornata)) {
                    requestedBonus = type;
                }
            });
            
            if (requestedBonus) {
                const bonusName = requestedBonus === 'RG' ? 'Raddoppio Goal' : 
                                 requestedBonus === 'twoG' ? 'Assegna 2 Goal' : 'Scudo';
                teamsWithBonusRequests.push({ team: teamName, bonus: bonusName });
            }
        });
        
        // Se ci sono richieste, mostra notifica
        if (teamsWithBonusRequests.length > 0) {
            const teamsList = teamsWithBonusRequests
                .map(t => `• ${t.team}: <strong>${t.bonus}</strong>`)
                .join('<br>');
            
            const notification = document.createElement('div');
            notification.id = 'bonus-notification';
            notification.className = 'fixed top-20 right-4 z-50 max-w-md';
            notification.innerHTML = `
                <div class="bg-gradient-to-br from-yellow-900/95 to-orange-900/95 border-2 border-yellow-500 rounded-lg shadow-2xl p-4 animate-pulse">
                    <div class="flex items-start">
                        <div class="flex-shrink-0">
                            <svg class="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"></path>
                            </svg>
                        </div>
                        <div class="ml-3 flex-1">
                            <h3 class="text-lg font-bold text-yellow-300 mb-2">
                                ⚡ Richieste Bonus Giornata ${currentGiornata}
                            </h3>
                            <p class="text-sm text-yellow-100 mb-2">
                                ${teamsWithBonusRequests.length} squadra/e ha/hanno richiesto bonus:
                            </p>
                            <div class="text-sm text-white bg-black/30 rounded p-2 mb-3">
                                ${teamsList}
                            </div>
                            <div class="flex gap-2">
                                <button onclick="setAppView('admin'); showAdminTab('bonus'); dismissBonusNotification();" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors">
                                    Vai ai Bonus
                                </button>
                                <button onclick="dismissBonusNotification()" class="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded transition-colors">
                                    OK, chiudi
                                </button>
                            </div>
                        </div>
                        <button onclick="dismissBonusNotification()" class="ml-2 text-yellow-300 hover:text-yellow-100">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
            
            // Rimuovi notifica precedente se esiste
            const existingNotification = document.getElementById('bonus-notification');
            if (existingNotification) {
                existingNotification.remove();
            }
            
            // Aggiungi la nuova notifica
            document.body.appendChild(notification);
            
            // Salva in localStorage che abbiamo già mostrato la notifica per questa giornata
            localStorage.setItem('bonusNotificationShown', currentGiornata.toString());
        }
        
    } catch (error) {
        console.error('Errore controllo bonus pendenti:', error);
    }
};

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
    // Usa la data dal calendario Serie A
    const date = getSerieAMatchDate(parseInt(giornata));
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
    const select = document.getElementById('match-to-close-select');
    if (!select) return; 
    
    // Trova l'ultima giornata con risultati (usa anche i risultati storici)
    const lastCompletedGiornata = determineLastCompletedGiornata();
    console.log('updateMatchToCloseSelect -> ultima completata:', lastCompletedGiornata, 'prossima:', lastCompletedGiornata + 1);

        // Mostra solo le partite della prossima giornata da completare
        const openMatches = matches
            .filter(m => {
                const giornata = parseInt(m.giornata || '0', 10);
                const isNextGiornata = giornata === (lastCompletedGiornata + 1);
                const isOpen = m.status === 'open' || !m.status;
                
                console.log('Valutazione partita per visualizzazione:', {
                    partita: `${m.homeTeam} vs ${m.awayTeam}`,
                    giornata,
                    status: m.status,
                    isNextGiornata,
                    isOpen,
                    include: isOpen && isNextGiornata
                });
                
                return isOpen && isNextGiornata;
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));

    select.innerHTML = '<option value="">Seleziona partita da chiudere</option>';
    
    if (openMatches.length === 0) {
         select.innerHTML = '<option value="">Nessuna partita aperta nella prossima giornata</option>';
         return;
    }

    openMatches.forEach(match => {
        const option = document.createElement('option');
        option.value = match.id;
        option.textContent = `G${match.giornata}: ${match.homeTeam} vs ${match.awayTeam} (${match.date})`;
        select.appendChild(option);
    });
};

// Le funzioni renderOpenMatches, renderPlacedBets, setupAdminBetsListener
// sono importate da bets.js
// Le funzioni renderHistoricResults, renderStandings, renderStatistics, renderStandingsTrend
// sono importate da rendering.js

const renderAdminUsersList = async (users) => {
    const listContainer = document.getElementById('admin-users-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (!users || users.length === 0) {
        listContainer.innerHTML = '<div class="text-center text-gray-500 py-4">Nessun utente registrato.</div>';
        return;
    }

    // Carica le rose disponibili
    const squadsSnapshot = await getDocs(getSquadsCollectionRef());
    const availableSquads = squadsSnapshot.docs.map(doc => doc.data().name).sort();

    users.forEach(user => {
        const row = document.createElement('div');
        row.className = 'bg-gray-900 rounded-lg p-4 mb-3 border border-gray-700';
        
        // Crea le opzioni per il select delle rose
        let squadOptions = '<option value="">Nessuna rosa</option>';
        availableSquads.forEach(squadName => {
            const selected = user.fantaSquad === squadName ? 'selected' : '';
            squadOptions += `<option value="${squadName}" ${selected}>${squadName}</option>`;
        });
        
        row.innerHTML = `
            <div class="flex flex-col space-y-3">
                <!-- Header con email -->
                <div class="flex items-center justify-between border-b border-gray-700 pb-2">
                    <div class="font-medium text-white">${user.displayName || user.email || user.id}</div>
                    <div class="text-xs text-gray-500">${user.email || ''}</div>
                </div>
                
                <!-- Grid informazioni utente -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <!-- Rosa Fantacalcio -->
                    <div class="flex flex-col">
                        <label class="text-xs text-gray-400 mb-1">Rosa Fantacalcio</label>
                        <select 
                            id="squad-${user.id}" 
                            class="bg-gray-800 text-sm p-2 rounded border border-gray-600 text-white">
                            ${squadOptions}
                        </select>
                    </div>
                    
                    <!-- Crediti -->
                    <div class="flex flex-col">
                        <label class="text-xs text-gray-400 mb-1">Crediti</label>
                        <input 
                            type="number" 
                            id="credits-${user.id}" 
                            value="${user.credits || 0}" 
                            class="bg-gray-800 text-sm p-2 rounded border border-gray-600 text-white" />
                    </div>
                    
                    <!-- Admin -->
                    <div class="flex flex-col justify-center">
                        <label class="text-xs text-gray-400 mb-1">Ruolo</label>
                        <label class="flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                id="isAdmin-${user.id}" 
                                ${user.isAdmin ? 'checked' : ''}
                                class="mr-2 w-4 h-4">
                            <span class="text-sm ${user.isAdmin ? 'text-yellow-400 font-bold' : 'text-gray-300'}">
                                ${user.isAdmin ? 'Admin' : 'Utente'}
                            </span>
                        </label>
                    </div>
                    
                    <!-- Pulsante Salva -->
                    <div class="flex items-end">
                        <button 
                            onclick="updateUserPermissionsAndCredits('${user.id}')" 
                            class="btn-primary w-full text-sm py-2">
                            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Salva
                        </button>
                    </div>
                </div>
            </div>
        `;
        listContainer.appendChild(row);
    });
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
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = '';
        document.body.style.overflow = '';
    }
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
    
    // Setup dipendenze per admin.js (le funzioni sono definite in questo modulo)
    setAdminDependencies({
        loadAllSchedules: loadAllSchedules,
        loadActiveGiornata: loadActiveGiornata,
        getGiornataSchedule: getGiornataSchedule
    });
    
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
