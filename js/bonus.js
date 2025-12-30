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
    getTeamCollectionRef,
    getBonusCollectionRef
} from './firebase-config.js';
import { messageBox, showProgressBar, hideProgressBar, updateProgress } from './utils.js';
import { getTeamLogo } from './config.js';
import { getIsUserAdmin, getCurrentUserProfile } from './auth.js';
import { getAllMatches, getAllResults } from './state.js';

// Dati correnti dei bonus
let currentBonusData = [];
let currentUserBonusData = null;
let currentActiveBonusGiornata = null;
let bonusCountdownInterval = null;

// Dipendenze esterne
let loadActiveGiornata = null;
let getGiornataDeadline = null;
let isActiveGiornata = null;
let calculateStandings = null;

/**
 * Imposta le dipendenze esterne
 */
export const setBonusDependencies = (deps) => {
    if (deps.loadActiveGiornata) loadActiveGiornata = deps.loadActiveGiornata;
    if (deps.getGiornataDeadline) getGiornataDeadline = deps.getGiornataDeadline;
    if (deps.isActiveGiornata) isActiveGiornata = deps.isActiveGiornata;
    if (deps.calculateStandings) calculateStandings = deps.calculateStandings;
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
        const teamsSnapshot = await getDocs(getTeamCollectionRef());
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
    const container = document.getElementById('user-bonus-content');
    const squadNameEl = document.getElementById('user-bonus-squad-name');
    const currentUserProfile = getCurrentUserProfile();
    
    if (!container || !squadNameEl) return;
    
    // Verifica che l'utente abbia una squadra assegnata
    if (!currentUserProfile || !currentUserProfile.fantaSquad) {
        container.innerHTML = `
            <div class="text-center py-8">
                <svg class="w-16 h-16 mx-auto text-gray-500 mb-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                </svg>
                <p class="text-gray-400">Non hai una squadra assegnata.</p>
                <p class="text-gray-500 text-sm mt-2">Contatta l'admin per associare una squadra al tuo account.</p>
            </div>
        `;
        squadNameEl.textContent = '';
        return;
    }
    
    try {
        const userSquad = currentUserProfile.fantaSquad;
        squadNameEl.textContent = userSquad;
        
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
    const container = document.getElementById('user-bonus-content');
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
    
    container.innerHTML = `
        <div class="space-y-4">
            <div class="text-center mb-4">
                <h3 class="text-lg font-bold text-yellow-400">Giornata ${nextGiornata}</h3>
                <p class="text-sm text-gray-400">Seleziona i bonus da richiedere</p>
            </div>
            
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <!-- RG -->
                <div class="bg-red-900/20 border border-red-700/50 rounded-lg p-4 text-center">
                    <div class="text-3xl mb-2">×2</div>
                    <div class="text-sm text-gray-400 mb-2">Raddoppia Gol</div>
                    <div class="text-lg font-bold ${rgAvailable > 0 ? 'text-green-400' : 'text-red-400'} mb-2">
                        ${rgAvailable}/${team.RG.total || 0}
                    </div>
                    <label class="flex items-center justify-center cursor-pointer">
                        <input type="checkbox" 
                            data-bonus="RG" 
                            ${rgRequestedThisGiornata ? 'checked' : ''} 
                            ${rgAvailable <= 0 && !rgRequestedThisGiornata ? 'disabled' : ''}
                            onchange="toggleBonusRequest(this, ${nextGiornata})"
                            class="w-5 h-5 text-red-600 focus:ring-red-500">
                        <span class="ml-2 text-sm text-white">Richiedi</span>
                    </label>
                </div>
                
                <!-- 2G -->
                <div class="bg-green-900/20 border border-green-700/50 rounded-lg p-4 text-center">
                    <div class="text-3xl mb-2">+2</div>
                    <div class="text-sm text-gray-400 mb-2">+2 Punti</div>
                    <div class="text-lg font-bold ${twoGAvailable > 0 ? 'text-green-400' : 'text-red-400'} mb-2">
                        ${twoGAvailable}/${team.twoG.total || 0}
                    </div>
                    <label class="flex items-center justify-center cursor-pointer">
                        <input type="checkbox" 
                            data-bonus="twoG" 
                            ${twoGRequestedThisGiornata ? 'checked' : ''} 
                            ${twoGAvailable <= 0 && !twoGRequestedThisGiornata ? 'disabled' : ''}
                            onchange="toggleBonusRequest(this, ${nextGiornata})"
                            class="w-5 h-5 text-green-600 focus:ring-green-500">
                        <span class="ml-2 text-sm text-white">Richiedi</span>
                    </label>
                </div>
                
                <!-- SC -->
                <div class="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 text-center">
                    <div class="text-3xl mb-2">SC</div>
                    <div class="text-sm text-gray-400 mb-2">Scudo</div>
                    <div class="text-lg font-bold ${scAvailable > 0 ? 'text-green-400' : 'text-red-400'} mb-2">
                        ${scAvailable}/${team.SC.total || 0}
                    </div>
                    <label class="flex items-center justify-center cursor-pointer">
                        <input type="checkbox" 
                            data-bonus="SC" 
                            ${scRequestedThisGiornata ? 'checked' : ''} 
                            ${scAvailable <= 0 && !scRequestedThisGiornata ? 'disabled' : ''}
                            onchange="toggleBonusRequest(this, ${nextGiornata})"
                            class="w-5 h-5 text-blue-600 focus:ring-blue-500">
                        <span class="ml-2 text-sm text-white">Richiedi</span>
                    </label>
                </div>
                
                <!-- POTM -->
                <div class="bg-purple-900/20 border border-purple-700/50 rounded-lg p-4 text-center">
                    <div class="text-3xl mb-2">PM</div>
                    <div class="text-sm text-gray-400 mb-2">Player OTM</div>
                    <div class="text-lg font-bold ${potmAvailable > 0 ? 'text-green-400' : 'text-red-400'} mb-2">
                        ${potmAvailable}/${team.POTM.total || 0}
                    </div>
                    <label class="flex items-center justify-center cursor-pointer">
                        <input type="checkbox" 
                            data-bonus="POTM" 
                            ${potmRequestedThisGiornata ? 'checked' : ''} 
                            ${potmAvailable <= 0 && !potmRequestedThisGiornata ? 'disabled' : ''}
                            onchange="toggleBonusRequest(this, ${nextGiornata})"
                            class="w-5 h-5 text-purple-600 focus:ring-purple-500">
                        <span class="ml-2 text-sm text-white">Richiedi</span>
                    </label>
                </div>
            </div>
            
            <div class="text-center mt-4">
                <button onclick="saveUserBonusData()" class="btn-primary px-6 py-2">
                    Salva Richieste Bonus
                </button>
            </div>
        </div>
    `;
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
