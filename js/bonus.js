/**
 * bonus.js - Modulo per gestione bonus squadre
 * Gestione bonus admin e utenti (RG, 2G, SC, POTM)
 */

import { 
    db,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    getTeamsCollectionRef,
    getBonusCollectionRef
} from './firebase-config.js';
import { messageBox, showProgressBar, hideProgressBar, updateProgressBar, updateProgress } from './utils.js';
import { getTeamLogo } from './config.js';
import { getIsUserAdmin, getCurrentUserProfile } from './auth.js';
import { getAllMatches, getAllResults } from './state.js';
import { calculateStandings } from './bets.js';

// Dati correnti dei bonus
let currentBonusData = [];
let currentUserBonusData = null;
let currentActiveBonusGiornata = null;
let bonusCountdownInterval = null;

// Dipendenze esterne
let loadActiveGiornata = null;
let getGiornataDeadline = null;
let isActiveGiornata = null;

/**
 * Imposta le dipendenze esterne
 */
export const setBonusDependencies = (deps) => {
    if (deps.loadActiveGiornata) loadActiveGiornata = deps.loadActiveGiornata;
    if (deps.getGiornataDeadline) getGiornataDeadline = deps.getGiornataDeadline;
    if (deps.isActiveGiornata) isActiveGiornata = deps.isActiveGiornata;
};

// ==================== ADMIN BONUS MANAGEMENT ====================

/**
 * Carica i dati dei bonus per l'admin
 */
export const loadBonusData = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) {
        messageBox('Solo gli admin possono gestire i bonus.');
        return;
    }
    
    try {
        // Carica le squadre dal CSV/database
        const teamsSnapshot = await getDocs(getTeamsCollectionRef());
        const teams = teamsSnapshot.docs.map(doc => doc.data().name).sort();
        
        if (teams.length === 0) {
            messageBox('Nessuna squadra trovata. Carica prima il calendario CSV.');
            return;
        }
        
        // Carica i bonus esistenti
        const bonusSnapshot = await getDocs(getBonusCollectionRef());
        const existingBonus = new Map();
        bonusSnapshot.docs.forEach(doc => {
            const data = doc.data();
            existingBonus.set(data.teamName, { id: doc.id, ...data });
        });
        
        // Inizializza i dati bonus per ogni squadra
        currentBonusData = teams.map(teamName => {
            if (existingBonus.has(teamName)) {
                const teamData = existingBonus.get(teamName);
                // Assicura che POTM esista
                if (!teamData.POTM) {
                    teamData.POTM = { total: 0, available: 0, usedInGiornata: [] };
                }
                return teamData;
            } else {
                // Inizializza con valori di default
                return {
                    teamName: teamName,
                    RG: { total: 1, available: 1, usedInGiornata: [] },
                    twoG: { total: 1, available: 1, usedInGiornata: [] },
                    SC: { total: 1, available: 1, usedInGiornata: [] },
                    POTM: { total: 0, available: 0, usedInGiornata: [] }
                };
            }
        });
        
        renderBonusTable();
        
    } catch (error) {
        console.error('Errore caricamento bonus:', error);
        messageBox('Errore nel caricamento dei bonus: ' + error.message);
    }
};

/**
 * Renderizza la tabella dei bonus per l'admin
 */
const renderBonusTable = () => {
    const container = document.getElementById('bonus-cards-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    currentBonusData.forEach((team, index) => {
        // Calcola quanti bonus sono stati usati
        const rgUsedCount = team.RG.usedInGiornata ? team.RG.usedInGiornata.length : 0;
        const twoGUsedCount = team.twoG.usedInGiornata ? team.twoG.usedInGiornata.length : 0;
        const scUsedCount = team.SC.usedInGiornata ? team.SC.usedInGiornata.length : 0;
        const potmUsedCount = team.POTM.usedInGiornata ? team.POTM.usedInGiornata.length : 0;
        
        const rgAvailable = (team.RG.total || 1) - rgUsedCount;
        const twoGAvailable = (team.twoG.total || 1) - twoGUsedCount;
        const scAvailable = (team.SC.total || 1) - scUsedCount;
        const potmAvailable = (team.POTM.total || 0) - potmUsedCount;
        
        // Crea una card per ogni squadra
        const card = document.createElement('div');
        card.className = 'bg-gray-800 border border-gray-700 rounded-lg p-3';
        
        card.innerHTML = `
            <!-- Header squadra -->
            <div class="flex items-center justify-between mb-3 pb-2 border-b border-gray-700">
                <h4 class="font-bold text-white text-base">${team.teamName}</h4>
            </div>
            
            <!-- Grid 4 colonne per i bonus -->
            <div class="grid grid-cols-4 gap-2">
                <!-- Colonna RG -->
                <div class="bg-red-900/10 rounded-lg p-2">
                    <div class="flex items-center justify-center mb-2">
                        <span class="w-8 h-8 bg-red-900 text-red-300 rounded font-bold flex items-center justify-center text-lg">×2</span>
                    </div>
                    
                    <div class="mb-2">
                        <label class="text-xs text-gray-400 block text-center mb-1">Totali</label>
                        <input 
                            type="number" 
                            min="0" 
                            max="10" 
                            value="${team.RG.total || 1}"
                            data-team="${team.teamName}" 
                            data-bonus="RG"
                            class="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-center text-white text-sm"
                            onchange="updateBonusTotal(this)">
                    </div>
                    
                    <div class="text-center mb-2">
                        <span class="text-xs text-gray-400">Disp:</span>
                        <span class="text-${rgAvailable > 0 ? 'green' : 'gray'}-400 font-bold ml-1">${rgAvailable}</span>
                    </div>
                    
                    <div class="space-y-1">
                        ${renderCompactBonusSelects(team.teamName, 'RG', team.RG.usedInGiornata, team.RG.total || 1)}
                    </div>
                </div>
                
                <!-- Colonna 2G -->
                <div class="bg-green-900/10 rounded-lg p-2">
                    <div class="flex items-center justify-center mb-2">
                        <span class="w-8 h-8 bg-green-900 text-green-300 rounded font-bold flex items-center justify-center text-lg">+2</span>
                    </div>
                    
                    <div class="mb-2">
                        <label class="text-xs text-gray-400 block text-center mb-1">Totali</label>
                        <input 
                            type="number" 
                            min="0" 
                            max="10" 
                            value="${team.twoG.total || 1}"
                            data-team="${team.teamName}" 
                            data-bonus="twoG"
                            class="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-center text-white text-sm"
                            onchange="updateBonusTotal(this)">
                    </div>
                    
                    <div class="text-center mb-2">
                        <span class="text-xs text-gray-400">Disp:</span>
                        <span class="text-${twoGAvailable > 0 ? 'green' : 'gray'}-400 font-bold ml-1">${twoGAvailable}</span>
                    </div>
                    
                    <div class="space-y-1">
                        ${renderCompactBonusSelects(team.teamName, 'twoG', team.twoG.usedInGiornata, team.twoG.total || 1)}
                    </div>
                </div>
                
                <!-- Colonna SC -->
                <div class="bg-blue-900/10 rounded-lg p-2">
                    <div class="flex items-center justify-center mb-2">
                        <span class="w-8 h-8 bg-blue-900 text-blue-300 rounded font-bold flex items-center justify-center text-sm">SC</span>
                    </div>
                    
                    <div class="mb-2">
                        <label class="text-xs text-gray-400 block text-center mb-1">Totali</label>
                        <input 
                            type="number" 
                            min="0" 
                            max="10" 
                            value="${team.SC.total || 1}"
                            data-team="${team.teamName}" 
                            data-bonus="SC"
                            class="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-center text-white text-sm"
                            onchange="updateBonusTotal(this)">
                    </div>
                    
                    <div class="text-center mb-2">
                        <span class="text-xs text-gray-400">Disp:</span>
                        <span class="text-${scAvailable > 0 ? 'green' : 'gray'}-400 font-bold ml-1">${scAvailable}</span>
                    </div>
                    
                    <div class="space-y-1">
                        ${renderCompactBonusSelects(team.teamName, 'SC', team.SC.usedInGiornata, team.SC.total || 1)}
                    </div>
                </div>
                
                <!-- Colonna POTM -->
                <div class="bg-purple-900/10 rounded-lg p-2">
                    <div class="flex items-center justify-center mb-2">
                        <span class="w-8 h-8 bg-purple-900 text-purple-300 rounded font-bold flex items-center justify-center text-xs">PM</span>
                    </div>
                    
                    <div class="mb-2">
                        <label class="text-xs text-gray-400 block text-center mb-1">Totali</label>
                        <input 
                            type="number" 
                            min="0" 
                            max="10" 
                            value="${team.POTM.total || 0}"
                            data-team="${team.teamName}" 
                            data-bonus="POTM"
                            class="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-center text-white text-sm"
                            onchange="updateBonusTotal(this)">
                    </div>
                    
                    <div class="text-center mb-2">
                        <span class="text-xs text-gray-400">Disp:</span>
                        <span class="text-${potmAvailable > 0 ? 'green' : 'gray'}-400 font-bold ml-1">${potmAvailable}</span>
                    </div>
                    
                    <div class="space-y-1">
                        ${renderCompactBonusSelects(team.teamName, 'POTM', team.POTM.usedInGiornata, team.POTM.total || 0)}
                    </div>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
};

/**
 * Renderizza i select compatti per i bonus usati
 */
const renderCompactBonusSelects = (teamName, bonusType, usedInGiornata, total) => {
    const used = usedInGiornata || [];
    const colorClass = bonusType === 'RG' ? 'text-red-400' : 
                      bonusType === 'twoG' ? 'text-green-400' : 
                      bonusType === 'SC' ? 'text-blue-400' :
                      'text-purple-400';
    
    let html = '';
    
    // Mostra un select per ogni bonus totale
    for (let i = 0; i < total; i++) {
        const selectedGiornata = used[i] || null;
        html += `
            <select 
                data-team="${teamName}" 
                data-bonus="${bonusType}"
                data-index="${i}"
                class="w-full bg-gray-700 border border-gray-600 rounded px-1 py-1 text-xs ${selectedGiornata ? colorClass : 'text-gray-300'}"
                onchange="updateBonusUsage(this)">
                <option value="">-</option>
                ${generateGiornataOptionsAdmin(selectedGiornata)}
            </select>
        `;
    }
    
    return html || '<span class="text-xs text-gray-500 block text-center">Nessuno</span>';
};

/**
 * Genera le opzioni per le giornate - versione ADMIN (tutte selezionabili)
 */
const generateGiornataOptionsAdmin = (selected) => {
    let options = '';
    for (let i = 1; i <= 36; i++) {
        options += `<option value="${i}" ${selected === i ? 'selected' : ''}>G.${i}</option>`;
    }
    return options;
};

/**
 * Aggiorna il totale di bonus disponibili
 */
export const updateBonusTotal = (inputElement) => {
    const teamName = inputElement.getAttribute('data-team');
    const bonusType = inputElement.getAttribute('data-bonus');
    const newTotal = parseInt(inputElement.value) || 0;
    
    // Trova il team nei dati
    const team = currentBonusData.find(t => t.teamName === teamName);
    if (team) {
        team[bonusType].total = newTotal;
        
        // Aggiorna la visualizzazione
        renderBonusTable();
    }
};

/**
 * Aggiorna l'uso di un bonus quando si cambia il select
 */
export const updateBonusUsage = (selectElement) => {
    const teamName = selectElement.getAttribute('data-team');
    const bonusType = selectElement.getAttribute('data-bonus');
    const index = parseInt(selectElement.getAttribute('data-index'));
    const giornata = selectElement.value ? parseInt(selectElement.value) : null;
    
    // Trova il team nei dati
    const team = currentBonusData.find(t => t.teamName === teamName);
    if (team) {
        // Inizializza l'array se non esiste
        if (!team[bonusType].usedInGiornata) {
            team[bonusType].usedInGiornata = [];
        }
        
        // Aggiorna il valore all'indice specificato
        if (giornata !== null) {
            team[bonusType].usedInGiornata[index] = giornata;
        } else {
            // Se viene deselezionato, rimuovi l'elemento
            team[bonusType].usedInGiornata.splice(index, 1);
        }
        
        // Rimuovi elementi undefined/null
        team[bonusType].usedInGiornata = team[bonusType].usedInGiornata.filter(g => g !== null && g !== undefined);
        
        // Aggiorna visivamente
        const colorClass = bonusType === 'RG' ? 'text-red-400' : 
                          bonusType === 'twoG' ? 'text-green-400' : 
                          'text-blue-400';
        
        if (giornata !== null) {
            selectElement.classList.remove('text-gray-300');
            selectElement.classList.add(colorClass);
        } else {
            selectElement.classList.add('text-gray-300');
            selectElement.classList.remove('text-red-400', 'text-green-400', 'text-blue-400');
        }
        
        // Aggiorna il contatore disponibili
        renderBonusTable();
    }
};

/**
 * Salva i dati dei bonus nel database
 */
export const saveBonusData = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) {
        messageBox('Solo gli admin possono salvare i bonus.');
        return;
    }
    
    if (!currentBonusData || currentBonusData.length === 0) {
        messageBox('Nessun dato da salvare. Carica prima i dati.');
        return;
    }
    
    if (!confirm('Salvare le modifiche ai bonus?')) {
        return;
    }
    
    try {
        showProgressBar('Salvataggio Bonus');
        
        const bonusCollection = getBonusCollectionRef();
        let savedCount = 0;
        
        for (const team of currentBonusData) {
            updateProgress(
                (savedCount / currentBonusData.length) * 100, 
                `Salvataggio ${team.teamName}...`,
                savedCount,
                currentBonusData.length
            );
            
            const bonusData = {
                teamName: team.teamName,
                RG: team.RG,
                twoG: team.twoG,
                SC: team.SC,
                POTM: team.POTM,
                lastUpdate: new Date().toISOString()
            };
            
            // Se esiste già un documento, aggiornalo; altrimenti creane uno nuovo
            if (team.id) {
                await updateDoc(doc(bonusCollection, team.id), bonusData);
            } else {
                const docRef = await addDoc(bonusCollection, bonusData);
                team.id = docRef.id; // Salva l'ID per futuri aggiornamenti
            }
            
            savedCount++;
        }
        
        updateProgress(100, 'Completato!');
        
        setTimeout(() => {
            hideProgressBar();
            messageBox(`Salvati i bonus per ${savedCount} squadre!`);
        }, 500);
        
    } catch (error) {
        console.error('Errore salvataggio bonus:', error);
        hideProgressBar();
        messageBox('Errore nel salvataggio: ' + error.message);
    }
};

// ==================== USER BONUS MANAGEMENT ====================

/**
 * Carica i bonus per l'utente corrente
 */
export const loadUserBonuses = async () => {
    const container = document.getElementById('user-bonus-list');
    const currentUserProfile = getCurrentUserProfile();
    
    if (!container) return;
    
    // Verifica che l'utente abbia una squadra assegnata
    if (!currentUserProfile || !currentUserProfile.fantaSquad) {
        container.innerHTML = `
            <div class="text-center py-8">
                <svg class="w-16 h-16 mx-auto text-gray-500 mb-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                </svg>
                <p class="text-gray-400">Non hai una squadra assegnata.</p>
                <p class="text-gray-500 text-sm mt-2">Contatta l'admin per associare una squadra al tuo account.</p>
                <button onclick="location.reload()" class="btn-secondary mt-4 px-4 py-2">Ricarica pagina</button>
            </div>
        `;
        return;
    }
    
    try {
        const userSquad = currentUserProfile.fantaSquad;
        
        // Carica i bonus per la squadra dell'utente
        const bonusSnapshot = await getDocs(getBonusCollectionRef());
        let userBonusDoc = null;
        
        bonusSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.teamName === userSquad) {
                userBonusDoc = { id: doc.id, ...data };
            }
        });
        
        // Se non esistono bonus per questa squadra, inizializza
        if (!userBonusDoc) {
            userBonusDoc = {
                teamName: userSquad,
                RG: { total: 0, available: 0, usedInGiornata: [] },
                twoG: { total: 0, available: 0, usedInGiornata: [] },
                SC: { total: 0, available: 0, usedInGiornata: [] },
                POTM: { total: 0, available: 0, usedInGiornata: [] }
            };
        }
        
        // Assicurati che POTM esista nell'oggetto
        if (!userBonusDoc.POTM) {
            userBonusDoc.POTM = { total: 0, available: 0, usedInGiornata: [] };
        }
        
        currentUserBonusData = userBonusDoc;
        
        // Carica la giornata ATTIVA dal database
        const activeGiornata = loadActiveGiornata ? await loadActiveGiornata() : null;
        
        if (!activeGiornata) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <svg class="w-16 h-16 mx-auto text-gray-500 mb-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                    </svg>
                    <p class="text-gray-400">Nessuna giornata attiva al momento.</p>
                    <p class="text-gray-500 text-sm mt-2">Contatta l'admin per attivare una giornata.</p>
                </div>
            `;
            return;
        }
        
        currentActiveBonusGiornata = activeGiornata;
        await renderUserBonusCard();
        
        // Avvia timer per aggiornare il countdown ogni secondo
        if (bonusCountdownInterval) clearInterval(bonusCountdownInterval);
        
    } catch (error) {
        console.error('Errore caricamento bonus utente:', error);
        container.innerHTML = `
            <div class="text-center py-8">
                <p class="text-red-400">Errore nel caricamento dei bonus: ${error.message}</p>
            </div>
        `;
    }
};

/**
 * Renderizza la card dei bonus per l'utente
 */
const renderUserBonusCard = async () => {
    const container = document.getElementById('user-bonus-list');
    if (!container || !currentUserBonusData) return;
    
    const team = currentUserBonusData;
    const nextGiornata = currentActiveBonusGiornata;
    const currentUserProfile = getCurrentUserProfile();
    
    // Calcola bonus disponibili
    const rgUsed = (team.RG.usedInGiornata || []).length;
    const twoGUsed = (team.twoG.usedInGiornata || []).length;
    const scUsed = (team.SC.usedInGiornata || []).length;
    const potmUsed = (team.POTM.usedInGiornata || []).length;
    
    const rgAvailable = (team.RG.total || 0) - rgUsed;
    const twoGAvailable = (team.twoG.total || 0) - twoGUsed;
    const scAvailable = (team.SC.total || 0) - scUsed;
    const potmAvailable = (team.POTM.total || 0) - potmUsed;
    
    // Verifica se già richiesto per questa giornata
    const rgRequestedThisGiornata = (team.RG.usedInGiornata || []).includes(nextGiornata);
    const twoGRequestedThisGiornata = (team.twoG.usedInGiornata || []).includes(nextGiornata);
    const scRequestedThisGiornata = (team.SC.usedInGiornata || []).includes(nextGiornata);
    const potmRequestedThisGiornata = (team.POTM.usedInGiornata || []).includes(nextGiornata);

    // Trova la partita della prossima giornata per questa squadra
    const userSquad = currentUserProfile?.fantaSquad;
    const allMatches = getAllMatches() || [];
    const nextMatch = allMatches.find(m => {
        const matchGiornata = parseInt(m.giornata);
        return matchGiornata === nextGiornata && 
               (m.homeTeam === userSquad || m.awayTeam === userSquad);
    });

    // Calcola la classifica con i risultati attuali
    const allResults = getAllResults() || [];
    const standings = calculateStandings(allResults);
    const getTeamPosition = (teamName) => {
        const pos = standings.findIndex(s => s.team === teamName) + 1;
        return pos > 0 ? pos : '-';
    };

    // Sezione Match Preview
    let opponentInfo = '';
    if (nextMatch) {
        const homeTeam = nextMatch.homeTeam;
        const awayTeam = nextMatch.awayTeam;
        const isUserHome = homeTeam === userSquad;
        const opponent = isUserHome ? awayTeam : homeTeam;
        
        const userLogo = getTeamLogo(userSquad);
        const opponentLogo = getTeamLogo(opponent);
        const userPosition = getTeamPosition(userSquad);
        const opponentPosition = getTeamPosition(opponent);
        
        opponentInfo = `
            <div class="bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 border-2 border-yellow-600 rounded-xl p-3 sm:p-6 mb-4 sm:mb-6 shadow-2xl">
                <div class="flex items-center justify-center mb-3 sm:mb-4">
                    <svg class="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 mr-2 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path>
                    </svg>
                    <h3 class="text-lg sm:text-2xl font-bold text-yellow-400">Giornata ${nextGiornata}</h3>
                </div>
                
                <!-- Match Preview Desktop -->
                <div class="hidden md:flex md:items-center md:justify-between gap-4">
                    <div class="flex items-center gap-3 flex-1">
                        <div class="relative flex-shrink-0">
                            ${userLogo && isUserHome ? `<img src="${userLogo}" alt="${homeTeam}" class="w-20 h-20 object-contain" onerror="this.style.display='none'">` : opponentLogo && !isUserHome ? `<img src="${opponentLogo}" alt="${homeTeam}" class="w-20 h-20 object-contain" onerror="this.style.display='none'">` : `<div class="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center"><span class="text-2xl">🏠</span></div>`}
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="font-bold text-gray-300 text-base mb-1 leading-tight truncate">${homeTeam}</p>
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-900 text-blue-300 whitespace-nowrap">🏠 CASA</span>
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-700 text-yellow-400">#${isUserHome ? userPosition : opponentPosition}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-center px-4">
                        <div class="bg-gradient-to-br from-yellow-500 to-orange-500 text-gray-900 font-black text-3xl px-6 py-3 rounded-lg shadow-xl">VS</div>
                    </div>
                    
                    <div class="flex items-center gap-3 flex-1">
                        <div class="relative flex-shrink-0">
                            ${userLogo && !isUserHome ? `<img src="${userLogo}" alt="${awayTeam}" class="w-20 h-20 object-contain" onerror="this.style.display='none'">` : opponentLogo && isUserHome ? `<img src="${opponentLogo}" alt="${awayTeam}" class="w-20 h-20 object-contain" onerror="this.style.display='none'">` : `<div class="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center"><span class="text-2xl">✈️</span></div>`}
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="font-bold text-gray-300 text-base mb-1 leading-tight truncate">${awayTeam}</p>
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-900 text-orange-300 whitespace-nowrap">✈️ TRASF.</span>
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-700 text-yellow-400">#${!isUserHome ? userPosition : opponentPosition}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Match Preview Mobile -->
                <div class="md:hidden flex items-stretch gap-2">
                    <div class="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800/40 to-gray-700/20 border border-gray-600/50 rounded-lg p-2">
                        <div class="relative mb-2">
                            ${isUserHome ? (userLogo ? `<img src="${userLogo}" alt="${homeTeam}" class="w-12 h-12 object-contain" onerror="this.style.display='none'">` : `<div class="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center"><span class="text-lg">🏠</span></div>`) : (opponentLogo ? `<img src="${opponentLogo}" alt="${homeTeam}" class="w-12 h-12 object-contain" onerror="this.style.display='none'">` : `<div class="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center"><span class="text-lg">🏠</span></div>`)}
                        </div>
                        <p class="font-bold text-gray-200 text-xs text-center mb-1.5 leading-tight line-clamp-2 px-1">${homeTeam}</p>
                        <div class="flex flex-col gap-1 w-full items-center">
                            <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-600/70 text-white w-full max-w-[90%]">🏠</span>
                            <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-600 text-yellow-400">#${isUserHome ? userPosition : opponentPosition}</span>
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-center px-1">
                        <div class="bg-gradient-to-br from-yellow-400 to-orange-500 text-gray-900 font-black text-lg px-3 py-2 rounded-lg shadow-lg">VS</div>
                    </div>
                    
                    <div class="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800/40 to-gray-700/20 border border-gray-600/50 rounded-lg p-2">
                        <div class="relative mb-2">
                            ${!isUserHome ? (userLogo ? `<img src="${userLogo}" alt="${awayTeam}" class="w-12 h-12 object-contain" onerror="this.style.display='none'">` : `<div class="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center"><span class="text-lg">✈️</span></div>`) : (opponentLogo ? `<img src="${opponentLogo}" alt="${awayTeam}" class="w-12 h-12 object-contain" onerror="this.style.display='none'">` : `<div class="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center"><span class="text-lg">✈️</span></div>`)}
                        </div>
                        <p class="font-bold text-gray-200 text-xs text-center mb-1.5 leading-tight line-clamp-2 px-1">${awayTeam}</p>
                        <div class="flex flex-col gap-1 w-full items-center">
                            <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-600/70 text-white w-full max-w-[90%]">✈️</span>
                            <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-600 text-yellow-400">#${!isUserHome ? userPosition : opponentPosition}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        opponentInfo = `
            <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
                <p class="text-center text-gray-400">
                    <svg class="w-5 h-5 inline mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                    </svg>
                    Prossima Giornata: <span class="font-bold">${nextGiornata}</span> - Partita non ancora disponibile
                </p>
            </div>
        `;
    }
    
    // Mini Classifica - Filtra solo le 2 squadre coinvolte nello stile della home
    let miniStandings = '';
    if (nextMatch) {
        const homeTeam = nextMatch.homeTeam;
        const awayTeam = nextMatch.awayTeam;
        const homeStats = standings.find(s => s.team === homeTeam);
        const awayStats = standings.find(s => s.team === awayTeam);
        
        if (homeStats && awayStats) {
            // Filtra le 2 squadre e ordina per posizione
            const twoTeams = standings.filter(s => s.team === homeTeam || s.team === awayTeam)
                .sort((a, b) => {
                    const posA = standings.findIndex(s => s.team === a.team) + 1;
                    const posB = standings.findIndex(s => s.team === b.team) + 1;
                    return posA - posB;
                });
            
            // Genera HTML nello stile della classifica home (mobile)
            let html = `<div class="bg-gray-900 rounded">
                <div style="display: flex; align-items: center; padding: 0.75rem; border-bottom: 1px solid rgba(55, 65, 81, 1); background-color: rgba(31, 41, 55, 1); white-space: nowrap;">
                    <div style="width: 30px; text-align: left; flex-shrink: 0;">
                        <span class="text-gray-400 text-xs font-bold uppercase">#</span>
                    </div>
                    <div style="width: 24px; flex-shrink: 0;"></div>
                    <div style="flex-grow: 1; text-align: left;">
                        <span class="text-gray-400 text-xs font-bold uppercase">Squadra</span>
                    </div>
                    <span class="text-gray-400 text-xs font-bold uppercase" style="width: 35px; text-align: right; flex-shrink: 0; margin-left: 0.75rem;">Pt</span>
                    <span class="text-gray-400 text-xs font-bold uppercase" style="width: 45px; text-align: center; flex-shrink: 0; margin-left: 0.5rem;">PTI</span>
                </div>
            `;
            
            twoTeams.forEach(team => {
                const pos = standings.findIndex(s => s.team === team.team) + 1;
                let posClass = 'text-gray-400';
                if (pos === 1) {
                    posClass = 'text-yellow-400 font-bold';
                } else if (pos === 2) {
                    posClass = 'text-gray-300 font-semibold';
                } else if (pos === 3) {
                    posClass = 'text-orange-400 font-semibold';
                }
                
                const fantasyPoints = (team.fantasyPoints || 0).toFixed(1);
                const teamNameSafe = team.team || 'Unknown';
                
                html += `
                    <div style="display: flex; align-items: center; padding: 0.75rem; border-bottom: 1px solid rgba(55, 65, 81, 1); white-space: nowrap; overflow: hidden;">
                        <div style="width: 30px; text-align: center; flex-shrink: 0;">
                            <span class="${posClass} text-lg font-bold">${pos}</span>
                        </div>
                        <img src="${getTeamLogo(teamNameSafe)}" alt="${teamNameSafe}" style="width: 24px; height: 24px; margin: 0 0.5rem 0 0.25rem; flex-shrink: 0; display: block;" onerror="this.style.display='none'">
                        <div style="flex-grow: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            <span class="text-white font-semibold text-sm" title="${teamNameSafe}" style="display: block;">${teamNameSafe}</span>
                        </div>
                        <span class="text-blue-400 font-bold text-sm" style="width: 35px; text-align: right; flex-shrink: 0; margin-left: 0.75rem;">${team.points}</span>
                        <span class="text-green-400 font-bold text-sm" style="width: 45px; text-align: right; flex-shrink: 0; margin-left: 0.5rem;">${fantasyPoints}</span>
                    </div>
                `;
            });
            
            html += `</div>`;
            miniStandings = `
                <div class="bg-gray-900/50 border border-gray-700 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
                    <h4 class="text-center text-sm sm:text-lg font-bold text-yellow-500 mb-2 sm:mb-3 flex items-center justify-center">
                        <svg class="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path>
                            <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"></path>
                        </svg>
                        Classifica
                    </h4>
                    ${html}
                    <div class="text-center mt-2 text-xs text-gray-500">
                        Pt=Punti | PTI=Punti Fantacalcio
                    </div>
                </div>
            `;
        }
    }

    container.innerHTML = `
        <!-- Countdown Deadline Bonus -->
        <div id="bonus-deadline-info" class="mb-4 sm:mb-6">
            <!-- Will be rendered by renderBonusDeadlineCountdown -->
        </div>
        
        ${opponentInfo}
        ${miniStandings}
        
        <!-- Info header -->
        <div class="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <p class="text-xs sm:text-base text-gray-200 flex items-start sm:items-center">
                <svg class="w-5 h-5 mr-2 text-blue-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                </svg>
                <span class="leading-tight">Richiedi i <span class="font-bold text-yellow-400">bonus</span> che vuoi utilizzare per la Giornata <span class="font-bold text-green-400">${nextGiornata}</span>. <span class="hidden sm:inline">Ogni giornata può essere usato <span class="font-bold">solo un bonus.</span></span></span>
            </p>
        </div>
        
        <!-- Grid colonne per i bonus -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <!-- Colonna RG (Raddoppio Goal) -->
            <div class="bg-gradient-to-br from-red-900/20 to-red-800/10 border-2 border-red-700/50 rounded-xl p-3 sm:p-6 hover:border-red-500 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/30">
                <div class="flex items-center justify-center mb-3 sm:mb-4">
                    <div class="relative">
                        <div class="absolute inset-0 bg-red-500 rounded-full blur-lg sm:blur-xl opacity-50 animate-pulse"></div>
                        <div class="relative w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-red-600 to-red-800 rounded-full flex items-center justify-center shadow-2xl border-2 sm:border-4 border-red-400">
                            <img src="https://raw.githubusercontent.com/savinopi/FantaBet2/main/assets/football-in-midair.png" alt="Football" class="relative w-12 h-12 sm:w-16 sm:h-16 object-contain" style="filter: brightness(0) invert(1) drop-shadow(2px 2px 4px rgba(0,0,0,0.5));" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect fill=%22%23888%22 width=%2264%22 height=%2264%22/%3E%3Ctext x=%2232%22 y=%2240%22 font-size=%2212%22 fill=%22%23fff%22 text-anchor=%22middle%22 font-weight=%22bold%22%3ERG%3C/text%3E%3C/svg%3E'">
                            <span class="absolute -top-1 -right-1 flex h-5 w-5 sm:h-6 sm:w-6">
                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span class="relative inline-flex rounded-full h-5 w-5 sm:h-6 sm:w-6 bg-red-500 items-center justify-center text-white text-xs font-bold">×2</span>
                            </span>
                        </div>
                    </div>
                </div>
                <h3 class="text-center text-base sm:text-xl font-black text-red-400 mb-1 sm:mb-2 tracking-wide leading-tight">RADDOPPIO GOAL</h3>
                <p class="text-center text-xs text-gray-400 mb-3 sm:mb-4 italic leading-tight">Raddoppia i gol effettuati</p>
                <div class="text-center mb-3 sm:mb-4 bg-gray-900/50 rounded-lg py-1.5 sm:py-2 px-2 sm:px-3">
                    <span class="text-xs text-gray-400">Disponibili: </span>
                    <span class="text-xl sm:text-3xl font-black ${rgAvailable > 0 ? 'text-green-400' : 'text-gray-500'}">${rgAvailable}</span>
                    <span class="text-xs sm:text-base text-gray-500"> / ${team.RG.total || 1}</span>
                </div>
                <div class="flex items-center justify-center">
                    <label class="flex items-center cursor-pointer ${rgAvailable === 0 && !rgRequestedThisGiornata ? 'opacity-50 cursor-not-allowed' : ''} group">
                        <input type="checkbox" data-bonus="RG"
                            ${rgRequestedThisGiornata ? 'checked' : ''}
                            ${rgAvailable === 0 && !rgRequestedThisGiornata ? 'disabled' : ''}
                            onchange="toggleBonusRequest(this, ${nextGiornata})"
                            class="w-5 h-5 sm:w-6 sm:h-6 text-red-600 bg-gray-700 border-2 border-gray-600 rounded focus:ring-2 focus:ring-red-500 cursor-pointer">
                        <span class="ml-2 sm:ml-3 text-sm sm:text-base text-white font-bold group-hover:text-red-400 transition-colors">
                            ${rgRequestedThisGiornata ? '✓ Richiesto' : 'Richiedi'}
                        </span>
                    </label>
                </div>
            </div>
            
            <!-- Colonna 2G (Assegna 2 Goal) -->
            <div class="bg-gradient-to-br from-green-900/20 to-green-800/10 border-2 border-green-700/50 rounded-xl p-3 sm:p-6 hover:border-green-500 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/30 ${twoGAvailable > 0 ? '' : 'opacity-60'}">
                <div class="flex items-center justify-center mb-3 sm:mb-4">
                    <div class="relative">
                        <div class="absolute inset-0 bg-green-500 rounded-full blur-lg sm:blur-xl opacity-50 animate-pulse"></div>
                        <div class="relative w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-green-600 to-green-800 rounded-full flex items-center justify-center shadow-2xl border-2 sm:border-4 border-green-400">
                            <div class="relative w-full h-full flex items-center justify-center">
                                <img src="https://raw.githubusercontent.com/savinopi/FantaBet2/main/assets/football-ball.png" alt="Football" class="absolute w-9 h-9 sm:w-12 sm:h-12 object-contain -translate-x-2 sm:-translate-x-3" style="filter: brightness(0) invert(1) drop-shadow(2px 2px 4px rgba(0,0,0,0.5));" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect fill=%22%23888%22 width=%2264%22 height=%2264%22/%3E%3C/svg%3E'">
                                <img src="https://raw.githubusercontent.com/savinopi/FantaBet2/main/assets/football-ball.png" alt="Football" class="absolute w-9 h-9 sm:w-12 sm:h-12 object-contain translate-x-2 sm:translate-x-3" style="filter: brightness(0) invert(1) drop-shadow(2px 2px 4px rgba(0,0,0,0.5));" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect fill=%22%23888%22 width=%2264%22 height=%2264%22/%3E%3C/svg%3E'">
                            </div>
                            <span class="absolute -top-1 -right-1 flex h-5 w-5 sm:h-6 sm:w-6">
                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span class="relative inline-flex rounded-full h-5 w-5 sm:h-6 sm:w-6 bg-green-500 items-center justify-center text-white text-xs font-bold">+2</span>
                            </span>
                        </div>
                    </div>
                </div>
                <h3 class="text-center text-base sm:text-xl font-black text-green-400 mb-1 sm:mb-2 tracking-wide leading-tight">ASSEGNA 2 GOAL</h3>
                <p class="text-center text-xs text-gray-400 mb-3 sm:mb-4 italic leading-tight">Aggiungi 2 gol extra</p>
                <div class="text-center mb-3 sm:mb-4 bg-gray-900/50 rounded-lg py-1.5 sm:py-2 px-2 sm:px-3">
                    <span class="text-xs text-gray-400">Disponibili: </span>
                    <span class="text-xl sm:text-3xl font-black ${twoGAvailable > 0 ? 'text-green-400' : 'text-gray-500'}">${twoGAvailable}</span>
                    <span class="text-xs sm:text-base text-gray-500"> / ${team.twoG.total || 1}</span>
                </div>
                <div class="flex items-center justify-center">
                    <label class="flex items-center cursor-pointer ${twoGAvailable === 0 && !twoGRequestedThisGiornata ? 'opacity-50 cursor-not-allowed' : ''} group">
                        <input type="checkbox" data-bonus="twoG"
                            ${twoGRequestedThisGiornata ? 'checked' : ''}
                            ${twoGAvailable === 0 && !twoGRequestedThisGiornata ? 'disabled' : ''}
                            onchange="toggleBonusRequest(this, ${nextGiornata})"
                            class="w-5 h-5 sm:w-6 sm:h-6 text-green-600 bg-gray-700 border-2 border-gray-600 rounded focus:ring-2 focus:ring-green-500 cursor-pointer">
                        <span class="ml-2 sm:ml-3 text-sm sm:text-base text-white font-bold group-hover:text-green-400 transition-colors">
                            ${twoGRequestedThisGiornata ? '✓ Richiesto' : 'Richiedi'}
                        </span>
                    </label>
                </div>
            </div>
            
            <!-- Colonna SC (Scudo) -->
            <div class="bg-gradient-to-br from-blue-900/20 to-blue-800/10 border-2 border-blue-700/50 rounded-xl p-3 sm:p-6 hover:border-blue-500 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/30">
                <div class="flex items-center justify-center mb-3 sm:mb-4">
                    <div class="relative">
                        <div class="absolute inset-0 bg-blue-500 rounded-full blur-lg sm:blur-xl opacity-50 animate-pulse"></div>
                        <div class="relative w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center shadow-2xl border-2 sm:border-4 border-blue-400">
                            <img src="https://raw.githubusercontent.com/savinopi/FantaBet2/main/assets/football-sports-gloves.png" alt="Gloves" class="w-9 h-9 sm:w-14 sm:h-14 object-contain" style="filter: brightness(0) invert(1) drop-shadow(2px 2px 4px rgba(0,0,0,0.5));" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect fill=%22%23888%22 width=%2264%22 height=%2264%22/%3E%3Ctext x=%2232%22 y=%2240%22 font-size=%2212%22 fill=%22%23fff%22 text-anchor=%22middle%22 font-weight=%22bold%22%3ESC%3C/text%3E%3C/svg%3E'">
                            <span class="absolute -top-1 -right-1 flex h-5 w-5 sm:h-6 sm:w-6">
                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span class="relative inline-flex rounded-full h-5 w-5 sm:h-6 sm:w-6 bg-blue-500 items-center justify-center text-xs">🛡️</span>
                            </span>
                        </div>
                    </div>
                </div>
                <h3 class="text-center text-base sm:text-xl font-black text-blue-400 mb-1 sm:mb-2 tracking-wide leading-tight">SCUDO</h3>
                <p class="text-center text-xs text-gray-400 mb-3 sm:mb-4 italic leading-tight">Clean-sheet garantito</p>
                <div class="text-center mb-3 sm:mb-4 bg-gray-900/50 rounded-lg py-1.5 sm:py-2 px-2 sm:px-3">
                    <span class="text-xs text-gray-400">Disponibili: </span>
                    <span class="text-xl sm:text-3xl font-black ${scAvailable > 0 ? 'text-green-400' : 'text-gray-500'}">${scAvailable}</span>
                    <span class="text-xs sm:text-base text-gray-500"> / ${team.SC.total || 1}</span>
                </div>
                <div class="flex items-center justify-center">
                    <label class="flex items-center cursor-pointer ${scAvailable === 0 && !scRequestedThisGiornata ? 'opacity-50 cursor-not-allowed' : ''} group">
                        <input type="checkbox" data-bonus="SC"
                            ${scRequestedThisGiornata ? 'checked' : ''}
                            ${scAvailable === 0 && !scRequestedThisGiornata ? 'disabled' : ''}
                            onchange="toggleBonusRequest(this, ${nextGiornata})"
                            class="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 bg-gray-700 border-2 border-gray-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer">
                        <span class="ml-2 sm:ml-3 text-sm sm:text-base text-white font-bold group-hover:text-blue-400 transition-colors">
                            ${scRequestedThisGiornata ? '✓ Richiesto' : 'Richiedi'}
                        </span>
                    </label>
                </div>
            </div>
            
            <!-- Colonna POTM -->
            <div class="bg-gradient-to-br from-purple-900/20 to-purple-800/10 border-2 ${potmRequestedThisGiornata ? 'border-purple-500 shadow-lg shadow-purple-500/20' : 'border-purple-700/50'} rounded-xl p-3 sm:p-6 ${potmAvailable > 0 ? '' : 'opacity-60'}">
                <div class="flex items-center justify-center mb-3 sm:mb-4">
                    <div class="relative">
                        <div class="absolute inset-0 bg-purple-500 rounded-full blur-lg sm:blur-xl opacity-50 ${potmAvailable > 0 ? 'animate-pulse' : ''}"></div>
                        <div class="relative w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center shadow-2xl border-2 sm:border-4 border-purple-400 p-2 sm:p-3">
                            <img src="https://raw.githubusercontent.com/savinopi/FantaBet2/main/assets/ea-sports_fc_logo-freelogovectors.net_.png" alt="EA Sports FC" class="w-full h-full object-contain" style="filter: brightness(0) invert(1);" onerror="this.style.display='none'">
                            <span class="absolute -top-1 -right-1 flex h-5 w-5 sm:h-6 sm:w-6">
                                <span class="${potmAvailable > 0 ? 'animate-ping' : ''} absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                <span class="relative inline-flex rounded-full h-5 w-5 sm:h-6 sm:w-6 bg-purple-500 items-center justify-center text-xs">⭐</span>
                            </span>
                        </div>
                    </div>
                </div>
                <h3 class="text-center text-base sm:text-xl font-black text-purple-400 mb-1 sm:mb-2 tracking-wide leading-tight">EA FC POTM</h3>
                <p class="text-center text-xs sm:text-sm text-gray-400 mb-4 italic">Player of the Month</p>
                <div class="text-center mb-3 sm:mb-4 bg-gray-900/50 rounded-lg py-1.5 sm:py-2 px-2 sm:px-3">
                    <span class="text-xs text-gray-400">Disponibili: </span>
                    <span class="text-xl sm:text-3xl font-black ${potmAvailable > 0 ? 'text-green-400' : 'text-gray-500'}">${potmAvailable}</span>
                    <span class="text-xs sm:text-base text-gray-500"> / ${team.POTM.total || 0}</span>
                </div>
                <div class="flex items-center justify-center">
                    <label class="flex items-center cursor-pointer ${potmAvailable === 0 && !potmRequestedThisGiornata ? 'opacity-50 cursor-not-allowed' : ''} group">
                        <input type="checkbox" data-bonus="POTM"
                            ${potmRequestedThisGiornata ? 'checked' : ''}
                            ${potmAvailable === 0 && !potmRequestedThisGiornata ? 'disabled' : ''}
                            onchange="toggleBonusRequest(this, ${nextGiornata})"
                            class="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 bg-gray-700 border-2 border-gray-600 rounded focus:ring-2 focus:ring-purple-500 cursor-pointer">
                        <span class="ml-2 sm:ml-3 text-sm sm:text-base text-white font-bold group-hover:text-purple-400 transition-colors">
                            ${potmRequestedThisGiornata ? '✓ Richiesto' : 'Richiedi'}
                        </span>
                    </label>
                </div>
            </div>
        </div>
    `;
    
    // Renderizza il countdown deadline
    await renderBonusDeadlineCountdown(nextGiornata);
    
    // Aggiungi il bottone invia richiesta bonus
    const bonusContainer = document.getElementById('user-bonus-container');
    if (bonusContainer) {
        // Crea il container per il bottone se non esiste
        let submitButtonContainer = document.getElementById('bonus-submit-button-container');
        if (!submitButtonContainer) {
            submitButtonContainer = document.createElement('div');
            submitButtonContainer.id = 'bonus-submit-button-container';
            submitButtonContainer.className = 'mt-4 sm:mt-6 flex justify-center';
            bonusContainer.appendChild(submitButtonContainer);
        }
        
        // Verifica se la deadline è scaduta
        let isDeadlineExpired = false;
        try {
            if (getGiornataDeadline) {
                const { deadline } = await getGiornataDeadline(nextGiornata);
                const now = new Date();
                isDeadlineExpired = now >= deadline;
            }
        } catch (error) {
            console.error('Errore verificando deadline:', error);
        }
        
        submitButtonContainer.innerHTML = `
            <button 
                onclick="saveUserBonusData()" 
                ${isDeadlineExpired ? 'disabled' : ''}
                class="flex items-center justify-center gap-2 sm:gap-3 px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base sm:text-lg rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl ${isDeadlineExpired ? 'cursor-not-allowed' : 'hover:scale-105'}"
                title="${isDeadlineExpired ? 'Deadline scaduta' : 'Invia la tua richiesta bonus'}">
                <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2m0 0v-8m0 8l-6-4m6 4l6-4"></path>
                </svg>
                <span>Invia Richiesta Bonus</span>
            </button>
        `;
    }
};

/**
 * Toggle richiesta bonus utente
 */
export const toggleBonusRequest = async (checkbox, giornata) => {
    const bonusType = checkbox.getAttribute('data-bonus');
    
    if (!currentUserBonusData) return;
    
    // Verifica che la deadline non sia scaduta
    if (getGiornataDeadline) {
        try {
            const { deadline } = await getGiornataDeadline(giornata);
            const now = new Date();
            
            if (now >= deadline) {
                checkbox.checked = !checkbox.checked;
                messageBox(`⏰ La deadline per richiedere i bonus è scaduta!\n\nOra: ${now.toLocaleString('it-IT')}\nDeadline: ${deadline.toLocaleString('it-IT')}`);
                return;
            }
        } catch (error) {
            console.error('Errore controllo deadline:', error);
        }
    }
    
    // Verifica che la giornata sia la giornata attiva
    if (isActiveGiornata) {
        try {
            const isActive = await isActiveGiornata(giornata);
            if (!isActive) {
                checkbox.checked = !checkbox.checked;
                messageBox('❌ Puoi richiedere bonus solo per la giornata attiva!');
                return;
            }
        } catch (error) {
            console.error('Errore controllo giornata attiva:', error);
        }
    }
    
    // Se l'utente sta selezionando un bonus
    if (checkbox.checked) {
        // Verifica se c'è già un altro bonus richiesto per questa giornata
        const bonusTypes = ['RG', 'twoG', 'SC', 'POTM'];
        let anotherBonusAlreadyRequested = false;
        
        bonusTypes.forEach(type => {
            if (type !== bonusType) {
                const usedArray = currentUserBonusData[type].usedInGiornata || [];
                if (usedArray.includes(giornata)) {
                    anotherBonusAlreadyRequested = true;
                }
            }
        });
        
        // Se un altro bonus è già richiesto, mostra errore e deseleziona
        if (anotherBonusAlreadyRequested) {
            checkbox.checked = false;
            messageBox('⚠️ Puoi richiedere solo UN bonus per giornata! Deseleziona prima l\'altro bonus.');
            return;
        }
        
        // Inizializza l'array se non esiste
        if (!currentUserBonusData[bonusType].usedInGiornata) {
            currentUserBonusData[bonusType].usedInGiornata = [];
        }
        
        const usedArray = currentUserBonusData[bonusType].usedInGiornata;
        const alreadyRequested = usedArray.includes(giornata);
        
        if (!alreadyRequested) {
            // Aggiungi la richiesta
            usedArray.push(giornata);
        }
    } else {
        // L'utente sta deselezionando
        const usedArray = currentUserBonusData[bonusType].usedInGiornata || [];
        const alreadyRequested = usedArray.includes(giornata);
        
        if (alreadyRequested) {
            // Rimuovi la richiesta
            const index = usedArray.indexOf(giornata);
            if (index > -1) {
                usedArray.splice(index, 1);
            }
        }
    }
    
    // Aggiorna la visualizzazione
    await renderUserBonusCard();
};

/**
 * Salva i bonus dell'utente
 */
export const saveUserBonusData = async () => {
    const currentUserProfile = getCurrentUserProfile();
    
    if (!currentUserBonusData) {
        messageBox('Nessun dato da salvare.');
        return;
    }
    
    if (!currentUserProfile || !currentUserProfile.fantaSquad) {
        messageBox('Non hai una squadra assegnata.');
        return;
    }
    
    // Verifica che la deadline non sia scaduta
    if (loadActiveGiornata && getGiornataDeadline) {
        try {
            const activeGiornata = await loadActiveGiornata();
            if (!activeGiornata) {
                messageBox('❌ Nessuna giornata attiva al momento.');
                return;
            }
            
            const { deadline } = await getGiornataDeadline(activeGiornata);
            const now = new Date();
            
            if (now >= deadline) {
                messageBox(`⏰ La deadline per richiedere i bonus è scaduta!\n\nOra: ${now.toLocaleString('it-IT')}\nDeadline: ${deadline.toLocaleString('it-IT')}`);
                return;
            }
        } catch (error) {
            console.error('Errore controllo deadline:', error);
        }
    }
    
    if (!confirm('Salvare le modifiche ai tuoi bonus?')) {
        return;
    }
    
    try {
        showProgressBar('Salvataggio Bonus');
        
        const bonusCollection = getBonusCollectionRef();
        
        const bonusData = {
            teamName: currentUserBonusData.teamName,
            RG: currentUserBonusData.RG,
            twoG: currentUserBonusData.twoG,
            SC: currentUserBonusData.SC,
            POTM: currentUserBonusData.POTM,
            lastUpdate: new Date().toISOString()
        };
        
        // Se esiste già un documento, aggiornalo; altrimenti creane uno nuovo
        if (currentUserBonusData.id) {
            await updateDoc(doc(bonusCollection, currentUserBonusData.id), bonusData);
        } else {
            const docRef = await addDoc(bonusCollection, bonusData);
            currentUserBonusData.id = docRef.id;
        }
        
        updateProgress(100, 'Completato!');
        
        setTimeout(() => {
            hideProgressBar();
            messageBox('Bonus salvati con successo!');
        }, 500);
        
    } catch (error) {
        console.error('Errore salvataggio bonus utente:', error);
        hideProgressBar();
        messageBox('Errore nel salvataggio: ' + error.message);
    }
};

// ==================== NOTIFICHE BONUS ====================

/**
 * Chiude la notifica dei bonus pendenti
 */
export const dismissBonusNotification = () => {
    const notification = document.getElementById('bonus-notification');
    if (notification) {
        notification.classList.add('animate-fade-out');
        setTimeout(() => notification.remove(), 300);
    }
};

// ==================== STATISTICHE AGGIUNTIVE ====================

/**
 * Toggle per mostrare/nascondere le statistiche aggiuntive
 */
export const toggleAdditionalStats = () => {
    const additionalStats = document.getElementById('additional-stats');
    const toggleBtn = document.getElementById('toggle-stats-btn');
    const toggleText = document.getElementById('toggle-stats-text');
    const toggleIcon = document.getElementById('toggle-stats-icon');
    
    if (additionalStats && toggleBtn && toggleText && toggleIcon) {
        if (additionalStats.classList.contains('hidden')) {
            // Mostra
            additionalStats.classList.remove('hidden');
            toggleText.textContent = 'Nascondi statistiche';
            toggleIcon.style.transform = 'rotate(180deg)';
        } else {
            // Nascondi
            additionalStats.classList.add('hidden');
            toggleText.textContent = 'Vedi altre statistiche';
            toggleIcon.style.transform = 'rotate(0deg)';
        }
    }
};

// Esporta getter per dati bonus
export const getCurrentBonusData = () => currentBonusData;
export const getCurrentUserBonusData = () => currentUserBonusData;

/**
 * Renderizza il countdown deadline per i bonus
 */
export const renderBonusDeadlineCountdown = async (giornata) => {
    const countdownEl = document.getElementById('bonus-deadline-info');
    if (!countdownEl) return;
    
    try {
        // Verifica che getGiornataDeadline sia stato impostato
        if (!getGiornataDeadline) {
            console.error('getGiornataDeadline non è stato inizializzato');
            return;
        }
        
        const { deadline, confirmed } = await getGiornataDeadline(giornata);
        const now = new Date();
        const isPast = now >= deadline;
        
        if (isPast) {
            countdownEl.innerHTML = `
                <div class="bg-red-900/30 border-l-4 border-red-500 p-3 sm:p-4 rounded-lg">
                    <div class="flex items-start">
                        <svg class="w-5 h-5 sm:w-6 sm:h-6 text-red-400 mr-2 sm:mr-3 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                        </svg>
                        <div class="flex-1 min-w-0">
                            <p class="text-red-300 font-bold text-sm sm:text-lg">⏰ BONUS CHIUSI</p>
                            <p class="text-red-200 text-xs sm:text-sm mt-1">
                                <span class="hidden sm:inline">La deadline per richiedere i bonus della Giornata ${giornata} è scaduta il</span>
                                <span class="sm:hidden">Scadenza G${giornata}:</span>
                                ${deadline.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                                <span class="mx-1">•</span>
                                ${deadline.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                </div>
            `;
            
            // Disabilita tutte le checkbox
            document.querySelectorAll('#user-bonus-list input[type="checkbox"]').forEach(checkbox => {
                checkbox.disabled = true;
            });
            
            return;
        }
        
        // Calcola tempo rimanente
        const diff = deadline - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        // Colore: VERDE se non scaduto, ROSSO se scaduto
        const bgColor = 'bg-green-900/20';
        const borderColor = 'border-green-500';
        const textColor = 'text-green-300';
        const iconColor = 'text-green-400';
        const statusIcon = `<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>`;
        
        const confirmedBadge = confirmed 
            ? `<span class="ml-2 px-2 py-1 bg-green-600 text-white text-xs rounded-full">✓ Confermato</span>`
            : `<span class="ml-2 px-2 py-1 bg-orange-600 text-white text-xs rounded-full">⚠ Da confermare</span>`;
        
        const urgentClass = (days === 0 && hours < 1) ? 'countdown-urgent' : '';
        
        countdownEl.innerHTML = `
            <div class="${bgColor} border-l-4 ${borderColor} p-3 sm:p-4 rounded-lg ${urgentClass}">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div class="flex items-start">
                        <svg class="w-5 h-5 sm:w-6 sm:h-6 ${iconColor} mr-2 sm:mr-3 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                            ${statusIcon}
                        </svg>
                        <div class="flex-1 min-w-0">
                            <p class="${textColor} font-bold text-sm sm:text-lg leading-tight">
                                Scadenza bonus G${giornata}
                                ${confirmedBadge}
                            </p>
                            <p class="text-gray-300 text-xs sm:text-sm mt-1">
                                <span class="hidden sm:inline">${deadline.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                <span class="sm:hidden">${deadline.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
                                <span class="mx-1">•</span>
                                ${deadline.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                    <div class="text-left sm:text-right flex-shrink-0">
                        <p class="text-gray-400 text-xs mb-1">Tempo rimanente:</p>
                        <div class="flex space-x-1 sm:space-x-2 text-center">
                            ${days > 0 ? `
                                <div class="bg-gray-800 px-2 sm:px-3 py-1 sm:py-2 rounded">
                                    <p class="${textColor} text-lg sm:text-2xl font-bold leading-tight">${days}</p>
                                    <p class="text-gray-400 text-xs">gg</p>
                                </div>
                            ` : ''}
                            <div class="bg-gray-800 px-2 sm:px-3 py-1 sm:py-2 rounded">
                                <p class="${textColor} text-lg sm:text-2xl font-bold leading-tight">${hours}</p>
                                <p class="text-gray-400 text-xs">ore</p>
                            </div>
                            <div class="bg-gray-800 px-2 sm:px-3 py-1 sm:py-2 rounded">
                                <p class="${textColor} text-lg sm:text-2xl font-bold leading-tight">${minutes}</p>
                                <p class="text-gray-400 text-xs">min</p>
                            </div>
                            ${days === 0 && hours < 1 ? `
                                <div class="bg-gray-800 px-2 sm:px-3 py-1 sm:py-2 rounded">
                                    <p class="${textColor} text-lg sm:text-2xl font-bold leading-tight">${seconds}</p>
                                    <p class="text-gray-400 text-xs">sec</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Errore rendering countdown bonus:', error);
        countdownEl.innerHTML = '';
    }
};

// Esporta funzioni globali
window.loadBonusData = loadBonusData;
window.saveBonusData = saveBonusData;
window.updateBonusTotal = updateBonusTotal;
window.updateBonusUsage = updateBonusUsage;
window.loadUserBonuses = loadUserBonuses;
window.saveUserBonusData = saveUserBonusData;
window.toggleBonusRequest = toggleBonusRequest;
window.dismissBonusNotification = dismissBonusNotification;
window.toggleAdditionalStats = toggleAdditionalStats;
window.renderBonusDeadlineCountdown = renderBonusDeadlineCountdown;
