/**
 * admin.js - Modulo funzionalità amministratore
 * Gestione utenti, orari giornate, scommesse admin
 */

import { 
    db, 
    getDocs, 
    doc, 
    updateDoc,
    setDoc,
    getDoc,
    addDoc,
    deleteDoc,
    writeBatch,
    query,
    where,
    onSnapshot,
    getUsersCollectionRef,
    getSquadsCollectionRef,
    getScheduleCollectionRef,
    getGiornataBetsCollectionRef,
    getTeamsCollectionRef,
    getResultsCollectionRef,
    getMatchesCollectionRef,
    getPlayersCollectionRef,
    getPlayerStatsCollectionRef,
    getFormationsCollectionRef
} from './firebase-config.js';
import { messageBox, showProgressBar, hideProgressBar, updateProgress } from './utils.js';
import { calculateOdds } from './bets.js';
import { 
    getAllUsersForAdmin,
    setAllUsersForAdmin,
    getNextGiornataNumber,
    getCurrentBetsFilter,
    setCurrentBetsFilter,
    getAdminBetsUnsubscribe,
    setAdminBetsUnsubscribe
} from './state.js';
import { addUnsubscribe, getIsUserAdmin } from './auth.js';

// Variabili per la cache degli orari (saranno settate dall'esterno)
let scheduleCache = null;
let activeGiornataCache = null;
let loadAllSchedules;
let loadActiveGiornata;
let getGiornataSchedule;

/**
 * Imposta le dipendenze esterne per il modulo admin
 */
export const setAdminDependencies = (deps) => {
    loadAllSchedules = deps.loadAllSchedules;
    loadActiveGiornata = deps.loadActiveGiornata;
    getGiornataSchedule = deps.getGiornataSchedule;
    if (deps.scheduleCache !== undefined) scheduleCache = deps.scheduleCache;
    if (deps.activeGiornataCache !== undefined) activeGiornataCache = deps.activeGiornataCache;
};

/**
 * Renderizza la lista degli utenti per l'admin
 */
export const renderAdminUsersList = async (users) => {
    console.log('🔍 renderAdminUsersList called with users:', users);
    const listContainer = document.getElementById('admin-users-list');
    console.log('🔍 admin-users-list element:', listContainer);
    if (!listContainer) {
        console.warn('⚠️ admin-users-list element not found!');
        return;
    }
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
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
                    
                    <!-- Rendi Admin -->
                    <div class="flex flex-col justify-center">
                        <label class="text-xs text-gray-400 mb-1">Rendi Admin</label>
                        <label class="flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                id="isAdmin-${user.id}" 
                                ${user.isAdmin ? 'checked' : ''}
                                class="mr-2 w-4 h-4">
                            <span class="text-sm ${user.isAdmin ? 'text-yellow-400 font-bold' : 'text-gray-300'}">
                                ${user.isAdmin ? 'Sì' : 'No'}
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
                    
                    <!-- Pulsante Elimina -->
                    <div class="flex items-end">
                        <button 
                            onclick="deleteUser('${user.id}', '${(user.email || user.displayName || user.id).replace(/'/g, "\\'")}')" 
                            class="btn-danger w-full text-sm py-2">
                            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                            Elimina
                        </button>
                    </div>
                </div>
            </div>
        `;
        listContainer.appendChild(row);
    });
};

/**
 * Carica gli utenti per l'admin
 */
export const loadUsersForAdmin = async () => {
    console.log('📌 loadUsersForAdmin called');
    const isUserAdmin = getIsUserAdmin();
    console.log('📌 isUserAdmin:', isUserAdmin);
    
    if (!isUserAdmin) {
        messageBox('Solo gli admin possono accedere a questa sezione.');
        return;
    }
    
    try {
        console.log('📌 Fetching users from database...');
        const usersSnapshot = await getDocs(getUsersCollectionRef());
        console.log('📌 Users fetched:', usersSnapshot.docs.length);
        const allUsersForAdmin = usersSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));
        
        console.log('📌 Users mapped:', allUsersForAdmin.length);
        setAllUsersForAdmin(allUsersForAdmin);
        console.log('📌 Calling renderAdminUsersList...');
        await renderAdminUsersList(allUsersForAdmin);
    } catch (error) {
        console.error('Errore caricamento utenti:', error);
        messageBox('Errore nel caricamento degli utenti: ' + error.message);
    }
};

/**
 * Elimina un utente dal database
 * @param {string} uid - ID dell'utente da eliminare
 * @param {string} userIdentifier - Nome/email per il messaggio di conferma
 */
export const deleteUser = async (uid, userIdentifier) => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) {
        messageBox('Solo gli admin possono eliminare utenti.');
        return;
    }
    
    // Conferma eliminazione
    if (!confirm(`Sei sicuro di voler eliminare l'utente "${userIdentifier}"?\n\nQuesta azione è irreversibile e cancellerà:\n- Profilo utente\n- Tutte le scommesse associate`)) {
        return;
    }
    
    try {
        showProgressBar();
        updateProgress(20, 'Eliminazione profilo utente...');
        
        // Elimina il documento utente
        await deleteDoc(doc(getUsersCollectionRef(), uid));
        
        updateProgress(60, 'Eliminazione scommesse utente...');
        
        // Elimina anche le scommesse dell'utente (opzionale, dipende dalla struttura)
        // Se le scommesse sono salvate per giornata, potremmo doverle pulire
        
        updateProgress(100, 'Utente eliminato!');
        hideProgressBar();
        
        messageBox(`Utente "${userIdentifier}" eliminato con successo.`);
        
        // Ricarica la lista utenti
        await loadUsersForAdmin();
        
    } catch (error) {
        console.error('Errore eliminazione utente:', error);
        hideProgressBar();
        messageBox('Errore durante l\'eliminazione: ' + error.message);
    }
};

/**
 * Aggiorna permessi e crediti di un utente
 */
export const updateUserPermissionsAndCredits = async (uid) => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return;
    
    const isAdmin = document.getElementById(`isAdmin-${uid}`).checked;
    const credits = parseInt(document.getElementById(`credits-${uid}`).value, 10);
    const fantaSquad = document.getElementById(`squad-${uid}`).value || null;

    if (isNaN(credits)) {
        messageBox("I crediti devono essere un numero.");
        return;
    }

    try {
        await updateDoc(doc(getUsersCollectionRef(), uid), { 
            isAdmin: isAdmin,
            credits: credits,
            fantaSquad: fantaSquad
        });
        messageBox("Dati utente aggiornati con successo!");
    } catch (error) {
        console.error("Errore aggiornamento utente:", error);
        messageBox("Errore durante l'aggiornamento: " + error.message);
    }
};

/**
 * Carica e renderizza gli orari delle giornate per l'admin
 */
export const loadSchedulesForAdmin = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return;
    
    try {
        // Ricarica la cache
        scheduleCache = null;
        activeGiornataCache = null;
        await loadAllSchedules();
        const activeGiornata = await loadActiveGiornata(true);
        
        const tbody = document.getElementById('schedules-table-body');
        tbody.innerHTML = '';
        
        // Genera righe per tutte le 36 giornate del fantacalcio (Serie A giornate 3-38)
        for (let g = 1; g <= 36; g++) {
            const schedule = await getGiornataSchedule(g);
            const isActive = schedule.isActive === true;
            const deadline = new Date(`${schedule.date}T${schedule.time}:00`);
            const now = new Date();
            const isPast = now >= deadline;
            const isUpcoming = !isPast && (deadline - now) < 7 * 24 * 60 * 60 * 1000; // Prossimi 7 giorni
            
            const row = document.createElement('tr');
            row.className = isPast ? 'bg-gray-800/50 opacity-60' : isUpcoming ? 'bg-yellow-900/20' : isActive ? 'bg-green-900/30' : '';
            
            // Calcola la giornata Serie A corrispondente
            const serieAGiornata = g + 2;
            
            // Calcola countdown
            let countdownText = '';
            if (isPast) {
                countdownText = '<span class="text-gray-500 text-xs">Passata</span>';
            } else {
                const diff = deadline - now;
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                if (days > 0) {
                    countdownText = `<span class="text-blue-400 text-xs">${days}g ${hours}h</span>`;
                } else {
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    countdownText = `<span class="text-yellow-400 font-bold text-xs">${hours}h ${minutes}m</span>`;
                }
            }
            
            row.innerHTML = `
                <td class="px-3 py-2 font-bold ${isUpcoming ? 'text-yellow-400' : isActive ? 'text-green-400' : ''}">${g}</td>
                <td class="px-3 py-2 text-gray-400 text-xs">${serieAGiornata}</td>
                <td class="px-3 py-2">
                    <input type="date" 
                           id="schedule-date-${g}" 
                           value="${schedule.date}" 
                           class="bg-gray-800 text-white px-2 py-1 rounded text-sm w-full"
                           ${isPast ? 'disabled' : ''}>
                </td>
                <td class="px-3 py-2">
                    <input type="time" 
                           id="schedule-time-${g}" 
                           value="${schedule.time}" 
                           class="bg-gray-800 text-white px-2 py-1 rounded text-sm w-full"
                           ${isPast ? 'disabled' : ''}>
                </td>
                <td class="px-3 py-2 text-center">
                    <input type="checkbox" 
                           id="schedule-confirmed-${g}" 
                           ${schedule.confirmed ? 'checked' : ''}
                           class="w-4 h-4"
                           ${isPast ? 'disabled' : ''}>
                </td>
                <td class="px-3 py-2 text-center">
                    <input type="radio" 
                           name="active-giornata" 
                           id="schedule-active-${g}" 
                           value="${g}"
                           ${isActive ? 'checked' : ''}
                           class="w-4 h-4 cursor-pointer"
                           ${isPast ? 'disabled' : ''}>
                </td>
                <td class="px-3 py-2 text-center">
                    ${countdownText}
                </td>
            `;
            
            tbody.appendChild(row);
        }
        
        // Aggiungi event listener ai radio button per aggiornare lo stile della riga
        document.querySelectorAll('input[name="active-giornata"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                // Rimuovi la classe green-900/30 da tutte le righe
                document.querySelectorAll('#schedules-table-body tr').forEach(tr => {
                    tr.classList.remove('bg-green-900/30');
                });
                
                // Aggiungi la classe green-900/30 alla riga selezionata
                if (e.target.checked) {
                    const row = e.target.closest('tr');
                    if (row) {
                        row.classList.add('bg-green-900/30');
                    }
                }
            });
        });
        
        messageBox("Orari caricati correttamente.");
    } catch (error) {
        console.error('Errore caricamento schedules:', error);
        messageBox("Errore nel caricamento degli orari: " + error.message);
    }
};

/**
 * Salva tutti gli orari modificati e la giornata attiva
 */
export const saveAllSchedules = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return;
    
    if (!confirm("Salvare tutte le modifiche agli orari delle giornate?")) {
        return;
    }
    
    try {
        const batch = writeBatch(db);
        
        // Ottieni quale giornata è selezionata come attiva (radio button)
        const activeRadio = document.querySelector('input[name="active-giornata"]:checked');
        const selectedActiveGiornata = activeRadio ? parseInt(activeRadio.value) : null;
        
        // PRIMA: Resetta isActive su TUTTE le giornate
        for (let g = 1; g <= 36; g++) {
            const isActive = (selectedActiveGiornata === g);
            const docRef = doc(getScheduleCollectionRef(), `giornata_${g}`);
            
            batch.set(docRef, { isActive: isActive }, { merge: true });
            
            if (isActive) {
                console.log('[DEBUG saveAllSchedules] Impostando giornata', g, 'come ATTIVA');
            }
        }
        
        // POI: Salva i dati completi delle giornate non passate
        for (let g = 1; g <= 36; g++) {
            const dateInput = document.getElementById(`schedule-date-${g}`);
            const timeInput = document.getElementById(`schedule-time-${g}`);
            const confirmedInput = document.getElementById(`schedule-confirmed-${g}`);
            
            if (!dateInput || !timeInput || !confirmedInput) continue;
            if (dateInput.disabled) continue; // Salta le giornate passate
            
            const scheduleData = {
                giornata: g.toString(),
                date: dateInput.value,
                time: timeInput.value,
                confirmed: confirmedInput.checked
            };
            
            const docRef = doc(getScheduleCollectionRef(), `giornata_${g}`);
            batch.set(docRef, scheduleData, { merge: true });
        }
        
        await batch.commit();
        
        // Ricarica la cache
        scheduleCache = null;
        activeGiornataCache = null;
        await loadAllSchedules();
        await loadActiveGiornata(true);
        
        messageBox("✅ Tutti gli orari e la giornata attiva sono stati salvati con successo!");
        
        // Ricarica la vista
        await loadSchedulesForAdmin();
    } catch (error) {
        console.error('Errore salvataggio schedules:', error);
        messageBox("Errore nel salvataggio degli orari: " + error.message);
    }
};

/**
 * Renderizza il filtro scommesse admin
 */
export const renderAdminBetsFilter = async (filter) => {
    setCurrentBetsFilter(filter);
    
    // Aggiorna pulsanti attivi
    document.getElementById('filter-all').className = filter === 'all' ? 'btn-primary' : 'btn-secondary';
    document.getElementById('filter-pending').className = filter === 'pending' ? 'btn-primary' : 'btn-secondary';
    document.getElementById('filter-settled').className = filter === 'settled' ? 'btn-primary' : 'btn-secondary';
    
    // Ricarica la lista
    const snapshot = await getDocs(getGiornataBetsCollectionRef());
    const allBets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const usersSnapshot = await getDocs(getUsersCollectionRef());
    const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    renderAdminBetsList(allBets, allUsers, filter);
};

/**
 * Renderizza la lista delle scommesse per l'admin
 */
export const renderAdminBetsList = (bets, users, filter = 'pending') => {
    const listContainer = document.getElementById('admin-bets-list');
    if (!listContainer) {
        console.error('Container admin-bets-list non trovato!');
        return;
    }
    listContainer.innerHTML = '';

    if (!bets || bets.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-500">Nessuna scommessa trovata.</p>';
        return;
    }

    // Filtra le scommesse in base al filtro selezionato
    let filteredBets = bets;
    if (filter === 'pending') {
        filteredBets = bets.filter(b => !b.settled);
    } else if (filter === 'settled') {
        filteredBets = bets.filter(b => b.settled);
    }

    if (filteredBets.length === 0) {
        listContainer.innerHTML = `<p class="text-gray-500">Nessuna scommessa ${filter === 'pending' ? 'da liquidare' : filter === 'settled' ? 'liquidata' : ''} trovata.</p>`;
        return;
    }

    // Raggruppa le scommesse per giornata
    const betsByGiornata = filteredBets.reduce((acc, bet) => {
        const g = bet.giornata || 'Sconosciuta';
        if (!acc[g]) acc[g] = [];
        acc[g].push(bet);
        return acc;
    }, {});

    const userMap = (users || []).reduce((m, u) => { 
        m[u.uid || u.id] = u.displayName || u.email || u.id; 
        return m; 
    }, {});
    
    const sortedGiornate = Object.keys(betsByGiornata).sort((a,b) => parseInt(a,10) - parseInt(b,10));

    sortedGiornate.forEach(g => {
        const header = document.createElement('h4');
        header.className = 'text-lg font-bold text-yellow-500 mt-4 mb-2';
        header.textContent = `Giornata ${g}`;
        listContainer.appendChild(header);

        const betsInG = betsByGiornata[g];
        
        betsInG.forEach(bet => {
            const userName = userMap[bet.userId] || bet.userId;
            
            const userCard = document.createElement('div');
            userCard.className = `card p-4 mb-3 ${bet.settled ? (bet.isWinning ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500') : 'border-l-4 border-yellow-500'}`;
            
            let betHTML = `
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h5 class="font-semibold text-green-300 text-lg">${userName}</h5>
                        <div class="text-sm text-gray-400">
                            Puntata: <span class="font-bold text-blue-400">${bet.stake || 0}</span> crediti | 
                            Quota Totale: <span class="font-bold text-blue-400">${bet.quotaTotale ? bet.quotaTotale.toFixed(2) : '-'}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        ${bet.settled ? `
                            <div class="text-sm">
                                <div class="${bet.isWinning ? 'text-green-400' : 'text-red-400'} font-bold text-lg">
                                    ${bet.isWinning ? '✓ VINCENTE' : '✗ PERDENTE'}
                                </div>
                                <div class="text-gray-400">
                                    Vincita: <span class="${bet.isWinning ? 'text-green-400' : 'text-red-400'} font-bold">${bet.winnings ? bet.winnings.toFixed(2) : '0.00'}</span>
                                </div>
                                <div class="text-xs text-gray-500">
                                    Liquidata il: ${bet.settledAt ? new Date(bet.settledAt).toLocaleString('it-IT') : '-'}
                                </div>
                            </div>
                        ` : `
                            <div class="text-yellow-400 font-bold">DA LIQUIDARE</div>
                        `}
                    </div>
                </div>
            `;

            // Mostra i pronostici
            if (bet.predictions && bet.predictions.length > 0) {
                betHTML += '<div class="space-y-2">';
                bet.predictions.forEach(pred => {
                    let resultClass = '';
                    let resultIcon = '';
                    
                    if (bet.settled && bet.detailedResults) {
                        const matchResult = bet.detailedResults.find(r => 
                            r.match === `${pred.homeTeam} vs ${pred.awayTeam}`
                        );
                        if (matchResult) {
                            resultClass = matchResult.correct ? 'bg-green-900/30 border-green-600' : 'bg-red-900/30 border-red-600';
                            resultIcon = matchResult.correct ? 
                                `<span class="text-green-400 font-bold">✓</span> Risultato: ${matchResult.actual}` : 
                                `<span class="text-red-400 font-bold">✗</span> Risultato: ${matchResult.actual}`;
                        }
                    }
                    
                    betHTML += `
                        <div class="p-2 bg-gray-800 rounded-lg border ${resultClass || 'border-gray-700'}">
                            <div class="flex justify-between items-center">
                                <div class="flex-1">
                                    <div class="font-semibold">${pred.homeTeam || '-'} vs ${pred.awayTeam || '-'}</div>
                                    <div class="text-sm text-gray-400">
                                        Pronostico: <span class="font-bold text-blue-400">${pred.prediction}</span> 
                                        (Quota: ${pred.odds ? parseFloat(pred.odds).toFixed(2) : '-'})
                                    </div>
                                </div>
                                ${resultIcon ? `<div class="text-sm ml-4">${resultIcon}</div>` : ''}
                            </div>
                        </div>
                    `;
                });
                betHTML += '</div>';
            }

            userCard.innerHTML = betHTML;
            listContainer.appendChild(userCard);
        });
    });
};

/**
 * Aggiorna la scommessa di un utente (admin)
 */
export const updateUserBet = async (betId) => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return;
    
    const select = document.getElementById(`bet-edit-${betId}`);
    if (!select) return;
    const newPrediction = select.value;
    try {
        const betDocRef = doc(getGiornataBetsCollectionRef(), betId);
        await updateDoc(betDocRef, { prediction: newPrediction });
        messageBox("Pronostico aggiornato con successo.");
    } catch (error) {
        console.error("Errore aggiornamento scommessa:", error);
        messageBox("Errore durante l'aggiornamento della scommessa.");
    }
};

// ==================== FUNZIONI DI PULIZIA DATABASE ====================

/**
 * Cancella tutti i dati del database (risultati, squadre, partite, scommesse)
 */
export const clearHistoricResultsAndTeams = async (confirmed) => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return; 
    
    const confirmModal = document.getElementById('confirm-modal');
    
    if (!confirmed) {
        confirmModal.classList.remove('hidden');
        return;
    }
    
    confirmModal.classList.add('hidden');
    
    showProgressBar('Reset Totale Database');

    const collectionsToClear = [
        getTeamsCollectionRef(), 
        getResultsCollectionRef(), 
        getMatchesCollectionRef(),
        getGiornataBetsCollectionRef()
    ];
    
    let totalDeleted = 0;
    let totalDocs = 0;

    try {
        // Prima conta tutti i documenti
        const snapshots = await Promise.all(collectionsToClear.map(ref => getDocs(ref)));
        totalDocs = snapshots.reduce((sum, snapshot) => sum + snapshot.docs.length, 0);
        
        updateProgress(10, 'Inizio cancellazione...', 0, totalDocs);
        
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
                updateProgress(progress, `Cancellazione ${collectionRef.id}...`, currentIndex, totalDocs);
            }
            console.log(`Cancellati ${collectionDeleted} documenti dalla collezione: ${collectionRef.id}`);
        }
        
        updateProgress(100, 'Completato!', totalDocs, totalDocs);
        
        setTimeout(() => {
            hideProgressBar();
            messageBox(`Cancellazione completa! Eliminati ${totalDeleted} documenti totali. L'app è stata resettata.`);
        }, 500);
        
    } catch (error) {
        console.error("Errore durante la cancellazione dei dati:", error);
        hideProgressBar();
        messageBox(`Errore grave durante la cancellazione. Controlla i permessi di scrittura/cancellazione su Firebase. Errore: ${error.message}`);
    }
};

/**
 * Cancella tutti i risultati storici
 */
export const clearHistoricResults = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return;
    
    if (!confirm('Sei sicuro di voler cancellare TUTTI i risultati storici? Questa azione è irreversibile.')) {
        return;
    }
    
    showProgressBar('Cancellazione Risultati Storici');
    
    try {
        const snapshot = await getDocs(getResultsCollectionRef());
        const totalDocs = snapshot.docs.length;
        let deletedCount = 0;
        
        for (const docSnapshot of snapshot.docs) {
            await deleteDoc(doc(getResultsCollectionRef(), docSnapshot.id));
            deletedCount++;
            
            const progress = (deletedCount / totalDocs) * 100;
            updateProgress(progress, `Cancellazione in corso...`, deletedCount, totalDocs);
        }
        
        hideProgressBar();
        messageBox(`Cancellati ${deletedCount} risultati storici.`);
        console.log(`Cancellati ${deletedCount} risultati storici`);
        
    } catch (error) {
        console.error("Errore cancellazione risultati storici:", error);
        hideProgressBar();
        messageBox(`Errore durante la cancellazione: ${error.message}`);
    }
};

/**
 * Cancella tutte le partite aperte
 */
export const clearOpenMatches = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return;
    
    if (!confirm('Sei sicuro di voler cancellare TUTTE le partite aperte? Questa azione è irreversibile.')) {
        return;
    }
    
    showProgressBar('Cancellazione Partite Aperte');
    
    try {
        const q = query(getMatchesCollectionRef(), where('status', '==', 'open'));
        const snapshot = await getDocs(q);
        const totalDocs = snapshot.docs.length;
        let deletedCount = 0;
        
        for (const docSnapshot of snapshot.docs) {
            await deleteDoc(doc(getMatchesCollectionRef(), docSnapshot.id));
            deletedCount++;
            
            const progress = (deletedCount / totalDocs) * 100;
            updateProgress(progress, `Cancellazione in corso...`, deletedCount, totalDocs);
        }
        
        hideProgressBar();
        messageBox(`Cancellate ${deletedCount} partite aperte.`);
        console.log(`Cancellate ${deletedCount} partite aperte`);
        
    } catch (error) {
        console.error("Errore cancellazione partite aperte:", error);
        hideProgressBar();
        messageBox(`Errore durante la cancellazione: ${error.message}`);
    }
};

/**
 * Cancella tutte le scommesse
 */
export const clearAllBets = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return;
    
    if (!confirm('Sei sicuro di voler cancellare TUTTE le scommesse? I crediti NON verranno restituiti agli utenti. Questa azione è irreversibile.')) {
        return;
    }
    
    showProgressBar('Cancellazione Scommesse');
    
    try {
        const snapshot = await getDocs(getGiornataBetsCollectionRef());
        const totalDocs = snapshot.docs.length;
        let deletedCount = 0;
        
        for (const docSnapshot of snapshot.docs) {
            await deleteDoc(doc(getGiornataBetsCollectionRef(), docSnapshot.id));
            deletedCount++;
            
            const progress = (deletedCount / totalDocs) * 100;
            updateProgress(progress, `Cancellazione in corso...`, deletedCount, totalDocs);
        }
        
        hideProgressBar();
        messageBox(`Cancellate ${deletedCount} scommesse.`);
        console.log(`Cancellate ${deletedCount} scommesse`);
        
    } catch (error) {
        console.error("Errore cancellazione scommesse:", error);
        hideProgressBar();
        messageBox(`Errore durante la cancellazione: ${error.message}`);
    }
};

/**
 * Cancella le formazioni di una giornata specifica
 */
export const clearFormationsForGiornata = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return;
    
    // Chiedi la giornata all'utente
    const giornataInput = prompt('Inserisci il numero della giornata da resettare (es. 21):', '');
    if (giornataInput === null || giornataInput.trim() === '') {
        return; // Utente ha cancellato
    }
    
    const giornata = parseInt(giornataInput);
    if (isNaN(giornata) || giornata < 1 || giornata > 38) {
        messageBox('Errore: Inserisci un numero di giornata valido (1-38)');
        return;
    }
    
    if (!confirm(`Sei sicuro di voler cancellare TUTTE le formazioni della giornata ${giornata}? Questa azione è irreversibile.`)) {
        return;
    }
    
    showProgressBar(`Cancellazione Formazioni Giornata ${giornata}`);
    
    try {
        const formationsCollection = getFormationsCollectionRef();
        const q = query(formationsCollection, where('giornata', '==', giornata));
        const snapshot = await getDocs(q);
        
        const totalDocs = snapshot.docs.length;
        if (totalDocs === 0) {
            hideProgressBar();
            messageBox(`Nessuna formazione trovata per la giornata ${giornata}.`);
            return;
        }
        
        let deletedCount = 0;
        
        for (const docSnapshot of snapshot.docs) {
            await deleteDoc(docSnapshot.ref);
            deletedCount++;
            
            const progress = (deletedCount / totalDocs) * 100;
            updateProgress(progress, `Cancellazione in corso...`, deletedCount, totalDocs);
        }
        
        hideProgressBar();
        messageBox(`Cancellate ${deletedCount} formazioni della giornata ${giornata}.`);
        console.log(`Cancellate ${deletedCount} formazioni della giornata ${giornata}`);
        
    } catch (error) {
        console.error("Errore cancellazione formazioni:", error);
        hideProgressBar();
        messageBox(`Errore durante la cancellazione: ${error.message}`);
    }
};

/**
 * Cancella TUTTE le formazioni di tutte le giornate
 */
export const clearAllFormations = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return;
    
    if (!confirm(`Sei sicuro di voler cancellare TUTTE le formazioni di tutte le giornate? Questa azione è irreversibile.`)) {
        return;
    }
    
    showProgressBar(`Cancellazione Tutte le Formazioni`);
    
    try {
        const formationsCollection = getFormationsCollectionRef();
        const snapshot = await getDocs(formationsCollection);
        
        const totalDocs = snapshot.docs.length;
        if (totalDocs === 0) {
            hideProgressBar();
            messageBox(`Nessuna formazione trovata nel database.`);
            return;
        }
        
        let deletedCount = 0;
        
        for (const docSnapshot of snapshot.docs) {
            await deleteDoc(docSnapshot.ref);
            deletedCount++;
            
            const progress = (deletedCount / totalDocs) * 100;
            updateProgress(progress, `Cancellazione in corso...`, deletedCount, totalDocs);
        }
        
        hideProgressBar();
        messageBox(`Cancellate ${deletedCount} formazioni da tutte le giornate.`);
        console.log(`Cancellate ${deletedCount} formazioni da tutte le giornate`);
        
    } catch (error) {
        console.error("Errore cancellazione formazioni:", error);
        hideProgressBar();
        messageBox(`Errore durante la cancellazione: ${error.message}`);
    }
};

/**
 * Reset crediti di tutti gli utenti a 100
 */
export const resetUserCredits = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return;
    
    if (!confirm('Sei sicuro di voler reimpostare i crediti di TUTTI gli utenti a 100? Questa azione è irreversibile.')) {
        return;
    }
    
    showProgressBar('Reset Crediti Utenti');
    
    try {
        const snapshot = await getDocs(getUsersCollectionRef());
        const totalDocs = snapshot.docs.length;
        let updatedCount = 0;
        
        for (const docSnapshot of snapshot.docs) {
            await updateDoc(doc(getUsersCollectionRef(), docSnapshot.id), { credits: 100 });
            updatedCount++;
            
            const progress = (updatedCount / totalDocs) * 100;
            updateProgress(progress, `Reset in corso...`, updatedCount, totalDocs);
        }
        
        hideProgressBar();
        messageBox(`Crediti reimpostati per ${updatedCount} utenti.`);
        console.log(`Crediti reimpostati per ${updatedCount} utenti`);
    } catch (error) {
        console.error("Errore reset crediti:", error);
        hideProgressBar();
        messageBox(`Errore durante il reset: ${error.message}`);
    }
};

/**
 * Cancella tutte le squadre
 */
export const clearAllTeams = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return;
    
    if (!confirm('Sei sicuro di voler cancellare TUTTE le squadre? Questa azione è irreversibile e potrebbe causare problemi se ci sono partite o risultati associati.')) {
        return;
    }
    
    showProgressBar('Cancellazione Squadre');
    
    try {
        const snapshot = await getDocs(getTeamsCollectionRef());
        const totalDocs = snapshot.docs.length;
        let deletedCount = 0;
        
        for (const docSnapshot of snapshot.docs) {
            await deleteDoc(doc(getTeamsCollectionRef(), docSnapshot.id));
            deletedCount++;
            
            const progress = (deletedCount / totalDocs) * 100;
            updateProgress(progress, `Cancellazione in corso...`, deletedCount, totalDocs);
        }
        
        hideProgressBar();
        messageBox(`Cancellate ${deletedCount} squadre.`);
        console.log(`Cancellate ${deletedCount} squadre`);
    } catch (error) {
        console.error("Errore cancellazione squadre:", error);
        hideProgressBar();
        messageBox(`Errore durante la cancellazione: ${error.message}`);
    }
};

// ==================== FUNZIONI GESTIONE PARTITE E RISULTATI ====================

/**
 * Aggiunge un risultato storico
 */
export const addHistoricResult = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return;
    
    const homeTeam = document.getElementById('historic-home-team').value;
    const awayTeam = document.getElementById('historic-away-team').value;
    const result = document.getElementById('historic-result').value;
    const date = document.getElementById('historic-date').value;

    if (!homeTeam || !awayTeam || !result || !date || homeTeam === awayTeam) {
        messageBox("Seleziona entrambe le squadre, il risultato e la data. Le squadre non possono essere le stesse.");
        return;
    }

    try {
        await addDoc(getResultsCollectionRef(), {
            homeTeam,
            awayTeam,
            result, // '1', 'X', '2'
            date,
            giornata: 'Aggiunta Manuale',
            score: 'N/A'
        });
        messageBox(`Risultato storico ${result} (${homeTeam} vs ${awayTeam}) salvato.`);
    } catch (error) {
        console.error("Errore salvataggio risultato storico:", error);
        messageBox("Errore nel salvataggio del risultato storico.");
    }
};

/**
 * Aggiunge una nuova squadra
 */
export const addTeam = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return;
    
    const teamNameInput = document.getElementById('new-team-name');
    const teamName = teamNameInput.value.trim();
    
    if (!teamName) {
        messageBox("Inserisci un nome per la squadra.");
        return;
    }
    
    try {
        const teamId = teamName.toLowerCase().replace(/[^a-z0-9]/g, '');
        await setDoc(doc(getTeamsCollectionRef(), teamId), {
            name: teamName
        });
        teamNameInput.value = '';
        messageBox(`Squadra "${teamName}" aggiunta.`);
    } catch (error) {
        console.error("Errore salvataggio squadra:", error);
        messageBox(`Errore nel salvataggio della squadra ${teamName}.`);
    }
};

/**
 * Calcola e salva una nuova partita
 */
export const calculateAndSaveMatch = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return;
    
    const homeTeam = document.getElementById('new-match-home-team').value;
    const awayTeam = document.getElementById('new-match-away-team').value;
    const date = document.getElementById('new-match-date').value;

    if (!homeTeam || !awayTeam || homeTeam === awayTeam || !date) {
        messageBox("Seleziona due squadre diverse e una data.");
        return;
    }
    
    const odds = calculateOdds(homeTeam, awayTeam);
    
    // Recupera tutte le partite aperte e determina la prossima giornata disponibile
    const openMatchesSnapshot = await getDocs(query(getMatchesCollectionRef(), where('status', '==', 'open')));
    let nextGiornata = 1;
    if (!openMatchesSnapshot.empty) {
        const maxGiornata = openMatchesSnapshot.docs.reduce((max, d) => {
            const g = parseInt(d.data().giornata || '0', 10) || 0;
            return Math.max(max, g);
        }, 0);
        // prossima giornata libera = max + 1
        nextGiornata = Math.max(1, maxGiornata + 1);
    }

    try {
        await addDoc(getMatchesCollectionRef(), {
            homeTeam,
            awayTeam,
            date,
            odds, // { '1': 2.50, 'X': 3.00, '2': 3.50 }
            status: 'open',
            score: null, // Nuovo campo score, nullo finché non chiusa
            giornata: nextGiornata.toString(),
            createdAt: new Date().toISOString()
        });
        messageBox(`Partita ${homeTeam} vs ${awayTeam} aperta per la Giornata ${nextGiornata} con quote: 1=${odds['1']}, X=${odds['X']}, 2=${odds['2']}`);
    } catch (error) {
        console.error("Errore salvataggio partita:", error);
        messageBox("Errore nel salvataggio della partita aperta.");
    }
};

/**
 * Chiude una partita e salva il punteggio
 */
export const closeMatchAndSaveScore = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return;

    const matchId = document.getElementById('match-to-close-select').value;
    const finalScore = document.getElementById('final-score-input').value.trim();

    if (!matchId) {
        messageBox("Seleziona una partita da chiudere.");
        return;
    }

    if (!finalScore || !finalScore.match(/^\d+-\d+$/)) {
         messageBox("Inserisci il punteggio finale nel formato corretto (es: 3-1).");
         return;
    }
    
    const [homeGoals, awayGoals] = finalScore.split('-').map(g => parseInt(g.trim(), 10));

    let result;
    if (homeGoals > awayGoals) {
        result = '1';
    } else if (homeGoals < awayGoals) {
        result = '2';
    } else {
        result = 'X';
    }

    try {
        const matchRef = doc(getMatchesCollectionRef(), matchId);
        const matchData = (await getDoc(matchRef)).data();
        const giornata = matchData.giornata;
        
        // 1. Chiudi il match
        await updateDoc(matchRef, {
            status: 'closed',
            score: finalScore,
            result: result
        });

        // 2. Verifica se tutti i match della giornata sono chiusi
        const qOpenMatches = query(
            getMatchesCollectionRef(),
            where('giornata', '==', giornata),
            where('status', '==', 'open')
        );
        const openMatchesSnap = await getDocs(qOpenMatches);

        // Se non ci sono più partite aperte nella giornata
        if (openMatchesSnap.empty) {
            // 3. Liquida tutte le scommesse della giornata
            const liquidated = await liquidateGiornataBets(giornata);
            if (liquidated) {
                messageBox(`Giornata ${giornata} completata! Scommesse liquidate e crediti aggiornati.`);
            }
        } else {
            messageBox(`Partita chiusa: ${finalScore}. Rimangono ancora ${openMatchesSnap.size} partite da chiudere per la giornata ${giornata}.`);
        }

        document.getElementById('final-score-input').value = '';

    } catch (error) {
        console.error("Errore chiusura partita:", error);
        messageBox(`Errore durante la chiusura della partita: ${error.message}`);
    }
};

/**
 * Liquida le scommesse di una giornata
 */
export const liquidateGiornataBets = async (giornata) => {
    try {
        const qBets = query(
            getGiornataBetsCollectionRef(),
            where('giornata', '==', giornata.toString())
        );
        const betsSnapshot = await getDocs(qBets);
        
        // Ottieni i match chiusi della giornata
        const qMatches = query(
            getMatchesCollectionRef(),
            where('giornata', '==', giornata.toString()),
            where('status', '==', 'closed')
        );
        const matchesSnapshot = await getDocs(qMatches);
        const closedMatches = new Map(
            matchesSnapshot.docs.map(doc => [doc.id, doc.data()])
        );

        // Batch write per aggiornare i crediti degli utenti
        const batch = writeBatch(db);
        const userUpdates = new Map();

        // Processa ogni scommessa
        betsSnapshot.docs.forEach(betDoc => {
            const bet = betDoc.data();
            const match = closedMatches.get(bet.matchId);
            
            if (match && match.result) {
                const userId = bet.userId;
                let creditsChange = -bet.stake;
                
                // Se la previsione era corretta
                if (bet.prediction === match.result) {
                    const win = bet.stake * parseFloat(bet.odds);
                    creditsChange += win;
                }

                userUpdates.set(
                    userId, 
                    (userUpdates.get(userId) || 0) + creditsChange
                );
            }
        });

        // Applica gli aggiornamenti dei crediti
        for (const [userId, creditsChange] of userUpdates) {
            const userRef = doc(getUsersCollectionRef(), userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const currentCredits = userSnap.data().credits || 0;
                batch.update(userRef, {
                    credits: currentCredits + creditsChange
                });
            }
        }

        // Esegui il batch
        await batch.commit();

        messageBox(`Scommesse liquidate per la giornata ${giornata}. ${userUpdates.size} utenti aggiornati.`);
        return true;
    } catch (error) {
        console.error("Errore liquidazione scommesse:", error);
        messageBox(`Errore durante la liquidazione delle scommesse: ${error.message}`);
        return false;
    }
};

/**
 * Aggiorna le partite aperte con la giornata attiva
 */
export const updateOpenMatchesWithActiveGiornata = async () => {
    if (loadActiveGiornata) {
        const activeGiornata = await loadActiveGiornata();
        if (activeGiornata) {
            console.log('Aggiornamento partite con giornata attiva:', activeGiornata);
            // Questa funzione deve essere chiamata dal modulo rendering.js
            return activeGiornata;
        }
    }
    return null;
};

// ==================== FUNZIONI CANCELLAZIONE ROSE E STATISTICHE ====================

/**
 * Cancella tutte le rose squadre
 */
export const clearSquadsData = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return;
    
    if (!confirm('Sei sicuro di voler cancellare TUTTE le rose squadre (calciatori e aggregati)? Questa azione è irreversibile.')) {
        return;
    }
    
    showProgressBar('Cancellazione Rose');
    
    try {
        updateProgress(0, 'Cancellazione calciatori...');
        
        // Cancella tutti i calciatori
        const playersSnapshot = await getDocs(getPlayersCollectionRef());
        const playerDocs = playersSnapshot.docs.length;
        let deletedPlayers = 0;
        
        for (const docSnapshot of playersSnapshot.docs) {
            await deleteDoc(doc(getPlayersCollectionRef(), docSnapshot.id));
            deletedPlayers++;
            
            const progress = (deletedPlayers / playerDocs) * 50;
            updateProgress(progress, `Cancellazione calciatori...`, deletedPlayers, playerDocs);
        }
        
        updateProgress(50, 'Cancellazione info squadre...');
        
        // Cancella le informazioni aggregate squadre
        const squadsSnapshot = await getDocs(getSquadsCollectionRef());
        const squadDocs = squadsSnapshot.docs.length;
        let deletedSquads = 0;
        
        for (const docSnapshot of squadsSnapshot.docs) {
            await deleteDoc(doc(getSquadsCollectionRef(), docSnapshot.id));
            deletedSquads++;
            
            const progress = 50 + (deletedSquads / squadDocs) * 50;
            updateProgress(progress, `Cancellazione info squadre...`, deletedSquads, squadDocs);
        }
        
        hideProgressBar();
        messageBox(`Cancellate ${deletedPlayers} calciatori e ${deletedSquads} squadre.`);
        console.log(`Rose cancellate: ${deletedPlayers} calciatori, ${deletedSquads} squadre`);
        
        // Pulisci il container visualizzazione
        const container = document.getElementById('squads-data-container');
        if (container) {
            container.innerHTML = '<p class="text-gray-500 text-sm">Nessun dato rose caricato.</p>';
        }
    } catch (error) {
        console.error("Errore cancellazione rose:", error);
        hideProgressBar();
        messageBox(`Errore durante la cancellazione: ${error.message}`);
    }
};

/**
 * Cancella tutte le statistiche calciatori
 */
export const clearPlayerStats = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return;
    
    if (!confirm('Sei sicuro di voler cancellare TUTTE le statistiche dei calciatori? Questa azione è irreversibile.')) {
        return;
    }
    
    showProgressBar('Cancellazione Statistiche');
    
    try {
        const statsSnapshot = await getDocs(getPlayerStatsCollectionRef());
        const totalDocs = statsSnapshot.docs.length;
        let deletedCount = 0;
        
        updateProgress(0, 'Cancellazione statistiche in corso...');
        
        for (const docSnapshot of statsSnapshot.docs) {
            await deleteDoc(doc(getPlayerStatsCollectionRef(), docSnapshot.id));
            deletedCount++;
            
            const progress = (deletedCount / totalDocs) * 100;
            updateProgress(progress, `Cancellazione statistiche...`, deletedCount, totalDocs);
        }
        
        hideProgressBar();
        messageBox(`Cancellate ${deletedCount} statistiche calciatori.`);
        console.log(`Cancellate ${deletedCount} statistiche`);
        
        // Pulisci il container visualizzazione
        const summaryContainer = document.getElementById('stats-summary-container');
        if (summaryContainer) {
            summaryContainer.innerHTML = '';
        }
        const dataContainer = document.getElementById('stats-data-container');
        if (dataContainer) {
            dataContainer.innerHTML = '<p class="text-gray-500 text-sm">Nessuna statistica caricata.</p>';
        }
    } catch (error) {
        console.error("Errore cancellazione statistiche:", error);
        hideProgressBar();
        messageBox(`Errore durante la cancellazione: ${error.message}`);
    }
};

/**
 * Espone le funzioni admin a window per l'uso nell'HTML
 */
export const setupGlobalAdminFunctions = () => {
    window.loadUsersForAdmin = loadUsersForAdmin;
    window.renderAdminUsersList = renderAdminUsersList;
    window.updateUserPermissionsAndCredits = updateUserPermissionsAndCredits;
    window.deleteUser = deleteUser;
    window.loadSchedulesForAdmin = loadSchedulesForAdmin;
    window.saveAllSchedules = saveAllSchedules;
    window.renderAdminBetsFilter = renderAdminBetsFilter;
    window.updateUserBet = updateUserBet;
    
    // Funzioni di pulizia
    window.clearHistoricResultsAndTeams = clearHistoricResultsAndTeams;
    window.clearHistoricResults = clearHistoricResults;
    window.clearOpenMatches = clearOpenMatches;
    window.clearAllBets = clearAllBets;
    window.clearFormationsForGiornata = clearFormationsForGiornata;
    window.clearAllFormations = clearAllFormations;
    window.resetUserCredits = resetUserCredits;
    window.clearAllTeams = clearAllTeams;
    window.clearSquadsData = clearSquadsData;
    window.clearPlayerStats = clearPlayerStats;
    
    // Funzioni gestione partite e risultati
    window.addHistoricResult = addHistoricResult;
    window.addTeam = addTeam;
    window.closeMatchAndSaveScore = closeMatchAndSaveScore;
    window.calculateAndSaveMatch = calculateAndSaveMatch;
    window.updateOpenMatchesWithActiveGiornata = updateOpenMatchesWithActiveGiornata;
    
    // Configura i callback per le tab admin
    window.adminTabCallbacks = {
        onUsersTab: loadUsersForAdmin,
        onSchedulesTab: loadSchedulesForAdmin,
        onBetsTab: async () => {
            // Carica prima gli utenti poi setup listener
            await loadUsersForAdmin();
            const allUsers = getAllUsersForAdmin();
            const giornataNum = getNextGiornataNumber();
            if (window.setupAdminBetsListener) {
                window.setupAdminBetsListener(giornataNum, allUsers);
            }
        }
    };
};
