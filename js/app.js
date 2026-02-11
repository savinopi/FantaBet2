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
    orderBy,
    limit,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    addDoc,
    deleteDoc,
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

import './csv-upload.js';

import {
    showMatchDetails,
    closeMatchDetails
} from './match-details.js';

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
    const teamPositionEl = document.getElementById('user-team-position');
    
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
        
        // Calcola e mostra posizione in classifica
        if (teamPositionEl) {
            const standings = calculateStandings();
            if (standings && standings.length > 0) {
                const position = standings.findIndex(s => s.team === squadName) + 1;
                if (position > 0) {
                    teamPositionEl.textContent = `#${position} in classifica`;
                    teamPositionEl.classList.remove('hidden');
                } else {
                    teamPositionEl.classList.add('hidden');
                }
            } else {
                teamPositionEl.classList.add('hidden');
            }
        }
    } else {
        // Nessuna squadra assegnata
        teamLogoEl.src = 'https://raw.githubusercontent.com/savinopi/FantaBet2/main/assets/esempio%20stemma%20lega.png';
        teamLogoEl.alt = 'Logo Lega';
        teamNameEl.textContent = displayName;
        if (teamPositionEl) teamPositionEl.textContent = '';
    }
};

/**
 * Processa il contenuto di un file CSV Calendario
 */
const processCsvContent = async (csvContent) => {
    try {
        const lines = csvContent.trim().split('\n');
        
        if (lines.length < 2) {
            messageBox('File CSV vuoto o non valido');
            return;
        }

        const headers = lines[0].split(';').map(h => h.trim());
        if (!headers.includes('Giornata')) {
            messageBox('Formato CSV non riconosciuto. Assicurati che la prima colonna sia "Giornata"');
            return;
        }

        showProgressBar();
        
        const teamNames = new Set();
        const resultsBatch = []; // Partite giocate (chiuse)
        const matchesBatch = [];  // Partite da aprire (score = '-')
        let processed = 0;
        let skipped = 0;
        
        // Processa ogni riga (saltando l'header)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            try {
                const values = line.split(';').map(v => v.trim());
                
                if (values.length < 6) continue;
                
                const giornata = values[0];
                const homeTeam = values[1];
                const homePoints = parseFloat(values[2]) || 0;
                const awayPoints = parseFloat(values[3]) || 0;
                const awayTeam = values[4];
                const score = values[5];
                
                if (!giornata || !homeTeam || !awayTeam) continue;
                
                teamNames.add(homeTeam);
                teamNames.add(awayTeam);
                
                if (score === '-') {
                    // PARTITA DA APRIRE (prossimi match)
                    matchesBatch.push({
                        homeTeam,
                        awayTeam,
                        giornata,
                        status: 'open',
                        score: null,
                        createdAt: new Date().toISOString()
                    });
                    skipped++;
                } else if (score && score.includes('-')) {
                    // PARTITA GIOCATA (risultato storico)
                    const [homeGoals, awayGoals] = score.split('-').map(g => parseInt(g.trim(), 10));
                    let result = null;
                    
                    if (homeGoals > awayGoals) result = '1';
                    else if (homeGoals < awayGoals) result = '2';
                    else result = 'X';
                    
                    resultsBatch.push({
                        homeTeam,
                        awayTeam,
                        homePoints,
                        awayPoints,
                        result,
                        score: score,
                        giornata,
                        status: 'closed',
                        timestamp: new Date().toISOString()
                    });
                    processed++;
                }
                
                updateProgressBar(Math.round((i / lines.length) * 100));
                
            } catch (error) {
                console.error(`Errore riga ${i}:`, error);
            }
        }
        
        hideProgressBar();
        
        // 1. Salva le squadre
        showProgressBar();
        updateProgressBar(20, 'Salvataggio squadre...');
        
        for (const team of teamNames) {
            if (team) {
                const q = query(getTeamsCollectionRef(), where('name', '==', team), limit(1));
                const existing = await getDocs(q);
                if (existing.empty) {
                    await addDoc(getTeamsCollectionRef(), {
                        name: team,
                        createdAt: new Date().toISOString()
                    });
                }
            }
        }
        
        // 2. Salva i risultati (partite giocate)
        updateProgressBar(40, 'Salvataggio risultati storici...');
        
        for (const res of resultsBatch) {
            const q = query(
                getResultsCollectionRef(),
                where('homeTeam', '==', res.homeTeam),
                where('awayTeam', '==', res.awayTeam),
                where('giornata', '==', res.giornata),
                limit(1)
            );
            const existing = await getDocs(q);
            if (existing.empty) {
                await addDoc(getResultsCollectionRef(), res);
            }
        }
        
        // 3. Salva le partite future (rimuovi quelle vecchie, carica le nuove)
        updateProgressBar(60, 'Aggiornamento partite aperte...');
        
        // Rimuovi partite aperte vecchie
        const matchesRef = getMatchesCollectionRef();
        const oldMatches = await getDocs(query(matchesRef, where('status', '==', 'open')));
        
        for (const doc of oldMatches.docs) {
            await deleteDoc(doc.ref);
        }
        
        // Aggiungi nuove partite aperte
        for (const match of matchesBatch) {
            await addDoc(matchesRef, match);
        }
        
        hideProgressBar();
        
        // Ricarica i dati
        scheduleCache = null;
        await loadAllSchedules();
        
        // Riepilogo
        const allResults = state.getAllResults();
        const completedGiornate = new Set();
        allResults.forEach(result => {
            if (result.giornata) {
                const giornataNum = parseInt(result.giornata, 10);
                if (giornataNum > 0) completedGiornate.add(giornataNum);
            }
        });
        
        const activeGiornata = await loadActiveGiornata();
        const suspendedGiornate = [];
        if (activeGiornata) {
            for (let i = 1; i < activeGiornata; i++) {
                if (!completedGiornate.has(i)) suspendedGiornate.push(i);
            }
        }
        
        const sortedCompleted = Array.from(completedGiornate).sort((a, b) => a - b);
        let summaryText = `✅ Caricamento completato!\n\n`;
        summaryText += `📊 RIEPILOGO GIORNATE\n`;
        summaryText += `────────────────────────\n`;
        summaryText += `✅ Giornate Salvate: ${sortedCompleted.length}\n`;
        if (sortedCompleted.length > 0) {
            summaryText += `   ${sortedCompleted.join(', ')}\n`;
        }
        summaryText += `\n⏱️ Giornata Attiva: ${activeGiornata || 'N/A'}\n`;
        if (activeGiornata) {
            summaryText += `   💡 Puoi modificarla dai Settings\n`;
        }
        
        if (suspendedGiornate.length > 0) {
            summaryText += `\n⏸️ Giornate Sospese: ${suspendedGiornate.length}\n`;
            summaryText += `   ${suspendedGiornate.join(', ')}\n`;
        }
        
        summaryText += `\n📥 STATS UPLOAD\n`;
        summaryText += `────────────────────────\n`;
        summaryText += `✓ Risultati caricati: ${processed}\n`;
        summaryText += `⊘ Partite aperte: ${skipped}\n`;
        summaryText += `📋 Squadre salvate: ${teamNames.size}\n`;
        
        messageBox(summaryText);
        
    } catch (error) {
        hideProgressBar();
        console.error('Errore durante l\'elaborazione del CSV:', error);
        messageBox('Errore durante l\'elaborazione del file: ' + error.message);
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
        
        // STEP 1: VERIFICA PRIMA SE IL DOCUMENTO ESISTE
        const docSnap = await getDoc(userDocRef);
        
        if (!docSnap.exists()) {
            // STEP 2: SE NON ESISTE, CREALO PRIMA DI IMPOSTARE IL LISTENER
            
            const isDefaultAdmin = ADMIN_USER_IDS.includes(uid);
            const defaultUserData = {
                email: auth.currentUser?.email || '',
                displayName: auth.currentUser?.email?.split('@')[0] || 'Utente',
                credits: 100,
                isAdmin: isDefaultAdmin,
                createdAt: new Date().toISOString()
            };
            
            await setDoc(userDocRef, defaultUserData);
        }
        
        // STEP 3: ORA IMPOSTA IL LISTENER (il documento esiste con certezza)
        const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
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
                setCurrentUserProfile(null);
            }
        }, (error) => {
            console.error('Errore onSnapshot profilo utente:', error);
        });
        
        addUnsubscribe(unsubscribe);
        
    } catch (error) {
        console.error('Errore setup profilo utente:', error);
        messageBox("Errore nella configurazione del profilo utente. Contatta l'amministratore.");
    }
};

// ===================================
// SETUP LISTENERS FIRESTORE
// ===================================

const setupListeners = () => {
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
        onSnapshot(getResultsCollectionRef(), async (snapshot) => {
            const results = snapshot.docs.map(doc => doc.data());
            state.setAllResults(results);
            
            // Carica le date degli orari delle giornate per tutte le giornate (1-36)
            const giornateData = {};
            try {
                // Carica tutte le giornate usando la funzione che ha il fallback alle date predefinite
                for (let g = 1; g <= 36; g++) {
                    const schedule = await getGiornataSchedule(g);
                    if (schedule && schedule.date) {
                        const giornataKey = String(schedule.giornata);
                        giornateData[giornataKey] = schedule.date;
                    }
                }
                // Salva giornateData globalmente per accesso da altri componenti
                window.giornateData = giornateData;
            } catch (error) {
                console.error('Errore caricamento orari giornate:', error);
            }
            
            // Passa sia i risultati che le date delle giornate
            renderHistoricResults(results, giornateData);
            renderStandings();
            renderStatistics();
            renderStandingsTrend();
            renderGiornateProgress(); // Aggiorna barra progressione
            
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
    // Implementazione esistente
};

/**
 * Renderizza la barra di progressione delle giornate
 */
const renderGiornateProgress = async () => {
    const container = document.getElementById('giornate-grid');
    const infoContainer = document.getElementById('current-giornata-info');
    
    if (!container) return;
    
    try {
        // Ottieni giornata attiva
        const activeGiornata = await loadActiveGiornata();
        
        // Ottieni tutti i risultati per sapere quali giornate sono chiuse
        const allResults = state.getAllResults();
        const completedGiornate = new Set();
        
        // Una giornata è completata solo se è MINORE della giornata attiva
        // oppure se è la giornata attiva ma ha risultati finali
        allResults.forEach(result => {
            if (result.giornata) {
                const giornataNum = parseInt(result.giornata, 10);
                // Una giornata è completata solo se è passata (< activeGiornata)
                if (activeGiornata && giornataNum < activeGiornata) {
                    completedGiornate.add(giornataNum);
                }
            }
        });
        
        // Determina il numero totale di giornate (36 per il fantacalcio)
        const totalGiornate = 36;
        
        // Renderizza le giornate
        let html = '';
        for (let i = 1; i <= totalGiornate; i++) {
            let bgColor = 'bg-gray-700'; // Giornate non iniziate (grigio) - DEFAULT
            let tooltip = `Giornata ${i}`;
            let icon = '';
            
            // Logica di controllo ordinata per priorità
            if (i === activeGiornata) {
                // Giornata attiva (giallo con animazione) - PRIORITÀ 1
                bgColor = 'bg-yellow-500 ring-2 ring-yellow-300 animate-pulse';
                tooltip = `Giornata ${i} - In corso`;
                icon = '<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path></svg>';
            } else if (completedGiornate.has(i)) {
                // Giornate completate (verde) - PRIORITÀ 2
                bgColor = 'bg-green-500';
                tooltip = `Giornata ${i} - Completata`;
                icon = '<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>';
            } else if (activeGiornata && i < activeGiornata) {
                // Giornate passate ma non completate = sospese/saltate (rosso) - PRIORITÀ 3
                bgColor = 'bg-red-500';
                tooltip = `Giornata ${i} - Sospesa`;
                icon = '<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>';
            }
            // else: grigio (giornate non ancora iniziate) - rimane il DEFAULT
            
            html += `<div class="${bgColor} flex-1 min-w-0 h-full cursor-pointer hover:opacity-70 transition-all relative group" title="${tooltip}"></div>`;
        }
        
        container.innerHTML = html;
        
        // Aggiorna il titolo con la giornata in corso
        const titleElement = document.getElementById('giornata-title');
        if (titleElement && activeGiornata) {
            titleElement.innerHTML = `
                <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"></path>
                </svg>
                Giornata ${activeGiornata}/${totalGiornate}
            `;
        }
        
    } catch (error) {
        console.error('Errore nel rendering della progressione giornate:', error);
        if (container) {
            container.innerHTML = '<p class="text-gray-500 text-center">Errore nel caricamento</p>';
        }
    }
};

// Cache per gli orari delle giornate
let scheduleCache = null;

const loadActiveGiornata = async () => {
    try {
        const scheduleSnapshot = await getDocs(getScheduleCollectionRef());
        for (const docSnap of scheduleSnapshot.docs) {
            const data = docSnap.data();
            if (data.isActive) {
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

        // Mostra solo le partite della prossima giornata da completare
        const openMatches = matches
            .filter(m => {
                const giornata = parseInt(m.giornata || '0', 10);
                const isNextGiornata = giornata === (lastCompletedGiornata + 1);
                const isOpen = m.status === 'open' || !m.status;
                
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
        renderGiornateProgress();
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
// RENDI GLOBALI LE VARIABILI AUTH
// ===================================

// Esponi userId e isUserAdmin come proprietà globali accessibili da script inline
Object.defineProperty(window, 'userId', {
    get: () => {
        const { getUserId } = window._authGetters || {};
        return getUserId ? getUserId() : null;
    },
    configurable: true
});

Object.defineProperty(window, 'isUserAdmin', {
    get: () => {
        const { getIsUserAdmin } = window._authGetters || {};
        return getIsUserAdmin ? getIsUserAdmin() : false;
    },
    configurable: true
});

// Store i getter per accesso dalla proprietà window
window._authGetters = {
    getUserId: () => userId,
    getIsUserAdmin: () => isUserAdmin
};

// ===================================
// INIZIALIZZAZIONE (Export per HTML)
// ===================================

/**
 * Funzione principale di inizializzazione dell'app
 * Esportata per essere chiamata dall'HTML
 */
export const initializeApp = async () => {
    // Esponi Firebase Firestore a livello globale per script inline
    window.db = db;
    
    // Esponi funzioni di autenticazione per l'HTML inline SUBITO
    window.handleLoginRegister = handleLoginRegister;
    window.handleLogout = handleLogout;
    
    // Setup dipendenze per admin.js (le funzioni sono definite in questo modulo)
    setAdminDependencies({
        loadAllSchedules: loadAllSchedules,
        loadActiveGiornata: loadActiveGiornata,
        getGiornataSchedule: getGiornataSchedule
    });
    
    setupFirebase();
    
    // NON carico i dati qui - verrà fatto solo dopo l'autenticazione
    // I dati saranno caricati in loadAppData() che verrà chiamato dopo il login
    
    // Esponi loadAppData a livello globale per poterla chiamare da auth.js
    window.loadAppData = loadAppData;
    
    // Listener per resize finestra - aggiorna classifica per layout responsivo
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Re-render classifica solo se ci sono dati
            if (state.allResults && state.allResults.length > 0) {
                renderStandings();
            }
        }, 250); // Debounce 250ms
    });
};

/**
 * Carica i dati dell'app dopo l'autenticazione
 * Viene chiamato automaticamente quando l'utente si autentica
 */
export const loadAppData = async () => {
    try {
        // Carica gli orari delle giornate e imposta la progressione
        await loadAllSchedules();
        renderGiornateProgress();
        
        // Aggiorna il pulsante profilo con l'email dell'utente
        if (window.updateProfileButton && currentUserProfile?.email) {
            window.updateProfileButton(currentUserProfile.email);
        }
    } catch (error) {
        messageBox('Errore nel caricamento dei dati. Ricarica la pagina.');
    }
};

// ===================================
// FUNZIONI RESET DATI (ADMIN ONLY)
// ===================================

window.clearHistoricResults = async () => {
    if (!isUserAdmin) return;
    
    if (!confirm('Sei sicuro di voler cancellare TUTTI i risultati storici? Questa azione è irreversibile.')) {
        return;
    }
    
    showProgressBar();
    
    try {
        const snapshot = await getDocs(getResultsCollectionRef());
        const totalDocs = snapshot.docs.length;
        let deletedCount = 0;
        
        for (const docSnapshot of snapshot.docs) {
            await deleteDoc(doc(getResultsCollectionRef(), docSnapshot.id));
            deletedCount++;
            
            const progress = (deletedCount / totalDocs) * 100;
            updateProgressBar(progress, `Cancellazione in corso...`);
        }
        
        hideProgressBar();
        messageBox(`Cancellati ${deletedCount} risultati storici.`);
        
        // Ricarica i dati
        scheduleCache = null;
        await loadAllSchedules();
        
    } catch (error) {
        console.error("Errore cancellazione risultati storici:", error);
        hideProgressBar();
        messageBox(`Errore durante la cancellazione: ${error.message}`);
    }
};

window.clearOpenMatches = async () => {
    if (!isUserAdmin) return;
    
    if (!confirm('Sei sicuro di voler cancellare TUTTE le partite aperte? Questa azione è irreversibile.')) {
        return;
    }
    
    showProgressBar();
    
    try {
        const q = query(getMatchesCollectionRef(), where('status', '==', 'open'));
        const snapshot = await getDocs(q);
        const totalDocs = snapshot.docs.length;
        let deletedCount = 0;
        
        for (const docSnapshot of snapshot.docs) {
            await deleteDoc(doc(getMatchesCollectionRef(), docSnapshot.id));
            deletedCount++;
            
            const progress = (deletedCount / totalDocs) * 100;
            updateProgressBar(progress, `Cancellazione in corso...`);
        }
        
        hideProgressBar();
        messageBox(`Cancellate ${deletedCount} partite aperte.`);
        
        // Ricarica i dati
        scheduleCache = null;
        await loadAllSchedules();
        
    } catch (error) {
        console.error("Errore cancellazione partite aperte:", error);
        hideProgressBar();
        messageBox(`Errore durante la cancellazione: ${error.message}`);
    }
};

window.resetUserCredits = async () => {
    if (!isUserAdmin) return;
    
    if (!confirm('Sei sicuro di voler reimpostare i crediti di TUTTI gli utenti a 100? Questa azione è irreversibile.')) {
        return;
    }
    
    showProgressBar();
    
    try {
        const snapshot = await getDocs(getUsersCollectionRef());
        const totalDocs = snapshot.docs.length;
        let updatedCount = 0;
        
        for (const docSnapshot of snapshot.docs) {
            await updateDoc(doc(getUsersCollectionRef(), docSnapshot.id), { credits: 100 });
            updatedCount++;
            
            const progress = (updatedCount / totalDocs) * 100;
            updateProgressBar(progress, `Reset in corso...`);
        }
        
        hideProgressBar();
        messageBox(`Crediti reimpostati per ${updatedCount} utenti.`);
        
    } catch (error) {
        console.error("Errore reset crediti:", error);
        hideProgressBar();
        messageBox(`Errore durante il reset: ${error.message}`);
    }
};

window.clearHistoricResultsAndTeams = async (confirmed) => {
    if (!isUserAdmin) return;
    
    if (!confirmed) {
        messageBox('⚠️ RESET TOTALE DATABASE\n\nCancella TUTTO: squadre, partite, risultati storici.\nQuesta azione è IRREVERSIBILE!\n\nSei davvero sicuro?', true);
        return;
    }
    
    showProgressBar();

    const collectionsToClear = [
        getTeamsCollectionRef(), 
        getResultsCollectionRef(), 
        getMatchesCollectionRef()
    ];
    
    let totalDeleted = 0;
    let totalDocs = 0;

    try {
        // Prima conta tutti i documenti
        const snapshots = await Promise.all(collectionsToClear.map(ref => getDocs(ref)));
        totalDocs = snapshots.reduce((sum, snapshot) => sum + snapshot.docs.length, 0);
        
        updateProgressBar(10, 'Inizio cancellazione...');
        
        let currentIndex = 0;
        for (let i = 0; i < collectionsToClear.length; i++) {
            const collectionRef = collectionsToClear[i];
            const snapshot = snapshots[i];
            let collectionDeleted = 0;
            
            // Cancella ogni documento uno per uno
            for (const docSnapshot of snapshot.docs) {
                await deleteDoc(doc(collectionRef, docSnapshot.id));
                collectionDeleted++;
                totalDeleted++;
                currentIndex++;
                
                const progress = 10 + (currentIndex / totalDocs) * 85;
                updateProgressBar(progress, `Cancellazione ${collectionRef.id}...`);
            }
        }
        
        updateProgressBar(100, 'Completato!');
        
        setTimeout(() => {
            hideProgressBar();
            messageBox(`Cancellazione completa! Eliminati ${totalDeleted} documenti totali. L'app è stata resettata.`);
            
            // Ricarica i dati
            scheduleCache = null;
            loadAllSchedules();
        }, 500);
        
    } catch (error) {
        console.error("Errore durante la cancellazione dei dati:", error);
        hideProgressBar();
        messageBox(`Errore grave durante la cancellazione. Controlla i permessi di scrittura/cancellazione su Firebase. Errore: ${error.message}`);
    }
};

// Fallback per caricamento diretto
window.onload = () => {
    // Se l'app non è già stata inizializzata dal modulo
    if (!window.FANTABetInitialized) {
        initializeApp();
        window.FANTABetInitialized = true;
    }
};

// ===================================
// GESTIONE ALLEGATI GIORNATE (Global Functions)
// ===================================

window.loadGiornataAttachments = async (giornata) => {
    try {
        const attachmentsList = document.getElementById('giornata-attachments-list');
        if (!attachmentsList) return;
        
        attachmentsList.innerHTML = '<p class="text-gray-400 text-center py-4">Caricamento allegati...</p>';

        // Query senza orderBy (ordineremo in memoria per evitare indici compositi)
        const q = query(
            collection(db, 'giornate_attachments'),
            where('giornata', '==', giornata)
        );
        
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            attachmentsList.innerHTML = '<p class="text-gray-400 text-center py-4">Nessun file allegato a questa giornata</p>';
            return;
        }

        // Raccogli i dati e ordina in memoria
        const attachments = [];
        snapshot.forEach(docSnapshot => {
            attachments.push({
                id: docSnapshot.id,
                ...docSnapshot.data()
            });
        });
        
        // Ordina per uploadedAt decrescente (più recenti prima)
        attachments.sort((a, b) => {
            const dateA = a.uploadedAt ? new Date(a.uploadedAt.toDate()).getTime() : 0;
            const dateB = b.uploadedAt ? new Date(b.uploadedAt.toDate()).getTime() : 0;
            return dateB - dateA;
        });

        let html = '<div class="space-y-2">';
        attachments.forEach(data => {
            const fileSize = (data.fileSize / 1024 / 1024).toFixed(2);
            const uploadDate = data.uploadedAt ? new Date(data.uploadedAt.toDate()).toLocaleString('it-IT') : 'Data non disponibile';
            
            html += `
                <div class="bg-gray-800/70 rounded-lg p-3 flex items-center justify-between border-l-4 border-blue-500 hover:bg-gray-800/90 transition-colors">
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold text-white truncate">📄 ${data.fileName}</p>
                        <p class="text-xs text-gray-400 mt-1">
                            <span>${fileSize} MB</span> • 
                            <span>${uploadDate}</span>
                        </p>
                    </div>
                    <div class="flex gap-2 ml-4 flex-shrink-0">
                        <button onclick="downloadAttachment('${data.id}', '${data.fileName}')" 
                            class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-semibold transition-colors flex items-center gap-1 whitespace-nowrap">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
                            </svg>
                            Scarica
                        </button>
                        <button onclick="deleteAttachment('${data.id}', '${data.fileName}')" 
                            class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm font-semibold transition-colors flex items-center gap-1 whitespace-nowrap">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                            </svg>
                            Elimina
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        attachmentsList.innerHTML = html;
    } catch (error) {
        console.error('Errore caricamento allegati:', error);
        const attachmentsList = document.getElementById('giornata-attachments-list');
        if (attachmentsList) {
            attachmentsList.innerHTML = '<p class="text-red-400 text-center py-4">Errore nel caricamento dei file</p>';
        }
    }
};

window.downloadAttachment = (attachmentId, fileName) => {
    messageBox(`Download di ${fileName} in corso...`);
    // In una vera implementazione, qui scaricheresti il file da Firebase Storage
};

window.deleteAttachment = async (attachmentId, fileName) => {
    if (!confirm(`Sei sicuro di voler eliminare "${fileName}"?`)) return;

    try {
        await deleteDoc(doc(collection(db, 'giornate_attachments'), attachmentId));
        messageBox('File eliminato con successo ✓');
        
        // Ricarica allegati
        const currentGiornataForAttachments = window.currentGiornataForAttachments;
        if (currentGiornataForAttachments) {
            await window.loadGiornataAttachments(currentGiornataForAttachments);
        }
    } catch (error) {
        console.error('Errore eliminazione file:', error);
        messageBox('Errore nell\'eliminazione del file');
    }
};

window.uploadGiornataAttachment = async () => {
    const selectedGiornataFile = window.selectedGiornataFile;
    const currentGiornataForAttachments = window.currentGiornataForAttachments;
    
    if (!selectedGiornataFile || !currentGiornataForAttachments) return;

    // Validazione ulteriore sulla dimensione del file
    const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB in bytes
    if (selectedGiornataFile.size > MAX_FILE_SIZE) {
        messageBox('❌ File troppo grande! Dimensione massima: 15 MB');
        return;
    }

    const progressDiv = document.getElementById('giornata-upload-progress');
    const progressBar = document.getElementById('giornata-upload-bar');
    const progressPercentage = document.getElementById('giornata-upload-percentage');
    
    if (progressDiv) progressDiv.classList.remove('hidden');

    try {
        // Simula caricamento con progress bar
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 30;
            if (progress > 90) progress = 90;
            if (progressBar) progressBar.style.width = progress + '%';
            if (progressPercentage) progressPercentage.textContent = Math.floor(progress) + '%';
        }, 200);

        // Crea documento in Firestore per gli allegati
        const attachmentDoc = {
            giornata: currentGiornataForAttachments,
            fileName: selectedGiornataFile.name,
            fileSize: selectedGiornataFile.size,
            fileType: selectedGiornataFile.type,
            uploadedAt: new Date(),
            uploadedBy: window.userId || 'admin'
        };

        // Aggiungi a Firestore
        const attachmentsRef = collection(db, 'giornate_attachments');
        await addDoc(attachmentsRef, attachmentDoc);

        clearInterval(interval);
        if (progressBar) progressBar.style.width = '100%';
        if (progressPercentage) progressPercentage.textContent = '100%';

        setTimeout(() => {
            if (progressDiv) progressDiv.classList.add('hidden');
            if (progressBar) progressBar.style.width = '0%';
            if (progressPercentage) progressPercentage.textContent = '0%';
            
            window.selectedGiornataFile = null;
            const fileInput = document.getElementById('giornata-file-input');
            if (fileInput) fileInput.value = '';
            const fileNameDisplay = document.getElementById('giornata-file-name-display');
            if (fileNameDisplay) fileNameDisplay.textContent = 'Nessun file selezionato';
            const uploadButton = document.getElementById('giornata-upload-button');
            if (uploadButton) uploadButton.disabled = true;
            
            // Ricarica gli allegati
            window.loadGiornataAttachments(currentGiornataForAttachments);
            messageBox('File caricato con successo! ✓');
        }, 500);
    } catch (error) {
        console.error('Errore caricamento file:', error);
        messageBox('Errore nel caricamento del file');
        if (progressDiv) progressDiv.classList.add('hidden');
    }
};

// Export per debug
window.FANTABetState = state;
