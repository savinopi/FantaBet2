/**
 * player-stats.js - Modulo per gestione statistiche calciatori
 * Visualizzazione, filtraggio, ordinamento statistiche
 */

import { 
    db,
    getDocs,
    deleteDoc,
    doc,
    getPlayerStatsCollectionRef,
    getPlayersCollectionRef
} from './firebase-config.js';
import { messageBox, showProgressBar, hideProgressBar, updateProgressBar, updateProgress } from './utils.js';
import { getTeamLogo } from './config.js';
import { getIsUserAdmin } from './auth.js';
import { getAllResults, getPlayerStatsData, setPlayerStatsData } from './state.js';
import { renderStandingsTrend } from './rendering.js';

// Cache per le immagini dei giocatori
const playerImageCache = new Map();

// Variabili per l'ordinamento
let currentSortColumn = 'fm';
let currentSortDirection = 'desc';

// Dati correnti
let currentPlayerStats = [];
let currentFilteredStats = [];
let currentSquadsData = new Map();

// Dipendenze esterne
let renderStatistics = null;

/**
 * Imposta le dipendenze esterne
 */
export const setPlayerStatsDependencies = (deps) => {
    if (deps.renderStatistics) renderStatistics = deps.renderStatistics;
};

// ==================== CANCELLAZIONE DATI ====================

/**
 * Cancella tutte le statistiche dei calciatori
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
 * Cancella tutte le rose (calciatori e aggregati)
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
        
        // Import dinamico per getSquadsCollectionRef
        const { getSquadsCollectionRef } = await import('./firebase-config.js');
        
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

// ==================== VISUALIZZAZIONE STATISTICHE ====================

/**
 * Carica le statistiche pubbliche dei calciatori
 */
export const loadPlayerStats = async () => {
    try {
        const statsCollection = getPlayerStatsCollectionRef();
        const snapshot = await getDocs(statsCollection);
        
        if (snapshot.empty) {
            document.getElementById('player-stats-table').innerHTML = '<tr><td colspan="8" class="text-center text-gray-500 py-8">Nessuna statistica caricata. Contatta l\'admin per il caricamento.</td></tr>';
            return;
        }
        
        // Carica tutte le statistiche (inclusi svincolati)
        const allStats = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            allStats.push(data);
        });
        
        // Popola i filtri
        const squadFilter = document.getElementById('stats-squad-filter');
        
        squadFilter.innerHTML = '<option value="all">Tutte le rose</option>';
        uniqueSquads.forEach(squad => {
            squadFilter.innerHTML += `<option value="${squad}">${squad}</option>`;
        });
        
        // Salva globalmente per i filtri
        currentPlayerStats = allStats;
        currentFilteredStats = allStats;
        window.currentPlayerStats = allStats;
        window.currentFilteredStats = allStats;
        
        // Mostra tutte le statistiche con ordinamento default
        sortPlayerStats(currentSortColumn);
        
    } catch (error) {
        console.error('[LoadPlayerStats] Errore:', error);
        messageBox('Errore nel caricamento delle statistiche: ' + error.message);
    }
};

/**
 * Renderizza la vista delle statistiche calciatori
 */
const renderPlayerStatsView = (stats) => {
    const tableBody = document.getElementById('player-stats-table');
    if (!tableBody) {
        return;
    }
    
    if (stats.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-gray-500 py-4">Nessun giocatore trovato con i filtri selezionati.</td></tr>';
        return;
    }
    
    const getSortIcon = (column) => {
        if (currentSortColumn !== column) {
            return '<svg class="w-3 h-3 inline ml-1 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path d="M5 12a1 1 0 102 0V6.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L5 6.414V12zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z"></path></svg>';
        }
        if (currentSortDirection === 'asc') {
            return '<svg class="w-3 h-3 inline ml-1 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd"></path></svg>';
        } else {
            return '<svg class="w-3 h-3 inline ml-1 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>';
        }
    };
    
    const roleColors = {
        'P': 'text-yellow-400',
        'D': 'text-blue-400',
        'C': 'text-green-400',
        'A': 'text-red-400'
    };
    
    // Compila solo il tbody (la tabella è già nel HTML)
    let html = '';
    stats.forEach(stat => {
        html += `
            <tr class="border-t border-gray-700 hover:bg-gray-700/50 transition-colors text-xs sm:text-sm">
                <td class="px-3 py-2 text-left sticky left-0 bg-gray-800 hover:bg-gray-700/50">
                    <span class="font-semibold">${stat.playerName || '-'}</span>
                </td>
                <td class="px-2 py-2 text-center text-xs">
                    <span class="text-purple-400">${stat.fantaSquad || '-'}</span>
                </td>
                <td class="px-2 py-2 text-center">
                    <span class="text-xs ${roleColors[stat.role] || 'text-gray-400'} font-bold">${stat.role || '-'}</span>
                </td>
                <td class="px-2 py-2 text-left text-xs">${stat.serieATeam || '-'}</td>
                <td class="px-2 py-2 text-center font-semibold">${stat.pv || '-'}</td>
                <td class="px-2 py-2 text-center text-green-400 font-bold">${stat.mv !== undefined ? stat.mv.toFixed(2) : '-'}</td>
                <td class="px-2 py-2 text-center ${stat.fm > 6 ? 'text-blue-400 font-bold' : stat.fm < 6 ? 'text-red-400' : ''}">${stat.fm !== undefined ? stat.fm.toFixed(1) : '-'}</td>
                <td class="px-2 py-2 text-center ${stat.gf > 0 ? 'text-green-400 font-bold' : ''}">${stat.gf || '-'}</td>
                <td class="px-2 py-2 text-center">${stat.gs || '-'}</td>
                <td class="px-2 py-2 text-center">${stat.rp || '-'}</td>
                <td class="px-2 py-2 text-center">${stat.rc || '-'}</td>
                <td class="px-2 py-2 text-center ${stat.rPlus > 0 ? 'text-green-400 font-bold' : ''}">${stat.rPlus || '-'}</td>
                <td class="px-2 py-2 text-center ${stat.rMinus > 0 ? 'text-red-400 font-bold' : ''}">${stat.rMinus || '-'}</td>
                <td class="px-2 py-2 text-center ${stat.ass > 0 ? 'text-blue-400 font-bold' : ''}">${stat.ass || '-'}</td>
                <td class="px-2 py-2 text-center ${stat.amm > 0 ? 'text-yellow-400' : ''}">${stat.amm || '-'}</td>
                <td class="px-2 py-2 text-center ${stat.esp > 0 ? 'text-red-500 font-bold' : ''}">${stat.esp || '-'}</td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
};

/**
 * Ordina le statistiche dei calciatori
 */
export const sortPlayerStats = (column) => {
    
    if (!currentFilteredStats || currentFilteredStats.length === 0) {
        console.warn('[SortPlayerStats] Nessun dato da ordinare');
        return;
    }
    
    // Se clicco sulla stessa colonna, inverto la direzione
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // Nuova colonna: default decrescente per numeri, crescente per testo
        currentSortColumn = column;
        const textColumns = ['playerName', 'fantaSquad', 'role', 'serieATeam'];
        currentSortDirection = textColumns.includes(column) ? 'asc' : 'desc';
    }
    
    
    // Ordina i dati
    const sorted = [...currentFilteredStats].sort((a, b) => {
        let valA = a[column];
        let valB = b[column];
        
        // Gestione valori nulli/undefined
        if (valA === null || valA === undefined) valA = 0;
        if (valB === null || valB === undefined) valB = 0;
        
        // Confronto
        if (typeof valA === 'string' && typeof valB === 'string') {
            return currentSortDirection === 'asc' 
                ? valA.localeCompare(valB) 
                : valB.localeCompare(valA);
        } else {
            return currentSortDirection === 'asc' 
                ? valA - valB 
                : valB - valA;
        }
    });
    
    currentFilteredStats = sorted;
    window.currentFilteredStats = sorted;
    
    // Aggiorna visual indicators nei header
    updateSortIndicators(column);
    
    renderPlayerStatsView(sorted);
};

/**
 * Aggiorna i visual indicators di ordinamento nei header
 */
const updateSortIndicators = (column) => {
    
    const headers = document.querySelectorAll('thead th');
    if (!headers || headers.length === 0) {
        console.warn('[UpdateSortIndicators] Nessun header trovato');
        return;
    }
    
    headers.forEach(header => {
        const onclick = header.getAttribute('onclick');
        if (!onclick) return;
        
        const match = onclick.match(/'([^']+)'/);
        if (!match) return;
        
        const colName = match[1];
        
        if (colName === column) {
            // Rimuovi frecce precedenti
            header.textContent = header.textContent.replace(/↑|↓/g, '').trim();
            
            if (currentSortDirection === 'asc') {
                header.textContent += ' ↑';
            } else {
                header.textContent += ' ↓';
            }
            header.classList.add('text-blue-400');
        } else {
            // Rimuovi frecce dalle altre colonne
            header.textContent = header.textContent.replace(/↑|↓/g, '').trim();
            header.classList.remove('text-blue-400');
        }
    });
};

/**
 * Filtra le statistiche dei calciatori
 */
export const filterPlayerStats = () => {
    
    if (!currentPlayerStats || currentPlayerStats.length === 0) {
        console.warn('[FilterPlayerStats] Nessun dato per filtrare');
        return;
    }
    
    const squadFilter = document.getElementById('stats-squad-filter').value;
    const roleFilter = document.getElementById('stats-role-filter').value;
    
    
    let filtered = [...currentPlayerStats];
    
    // Applica filtri
    if (squadFilter !== 'all') {
        filtered = filtered.filter(s => s.fantaSquad === squadFilter);
    }
    
    if (roleFilter !== 'all') {
        filtered = filtered.filter(s => s.role === roleFilter);
    }
    
    // Salva i dati filtrati e applica l'ordinamento corrente
    currentFilteredStats = filtered;
    window.currentFilteredStats = filtered;
    sortPlayerStats(currentSortColumn);
};

// ==================== LEADERBOARDS (Home Page) ====================

/**
 * Carica le classifiche dei giocatori per la home page
 */
export const loadPlayerLeaderboards = async () => {
    try {
        const playerStatsRef = getPlayerStatsCollectionRef();
        const snapshot = await getDocs(playerStatsRef);
        
        if (snapshot.empty) {
            document.getElementById('player-statistics-container').innerHTML = 
                '<p class="text-sm sm:text-base text-gray-500 text-center py-4 col-span-full">Nessuna statistica disponibile</p>';
            return;
        }
        
        const allStats = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Escludi giocatori svincolati (senza squadra)
            if (data.fantaSquad && data.fantaSquad !== 'SVINCOLATI') {
                allStats.push({
                    ...data,
                    gf: Number(data.gf) || 0,
                    ass: Number(data.ass) || 0,
                    gs: Number(data.gs) || 0,
                    fm: Number(data.fm) || 0,
                    pv: Number(data.pv) || 0
                });
            }
        });
        
        // Calcola il numero totale di giornate di Serie A giocate
        const allResults = getAllResults();
        const lastFantaGiornata = allResults.length > 0 
            ? Math.max(...allResults.map(r => parseInt(r.giornata) || 0))
            : 0;
        const totalGiornate = lastFantaGiornata + 2; // Converti giornata fanta in giornata Serie A
        
        // Top 3 Marcatori (gol segnati)
        const topScorers = allStats
            .filter(p => p.gf > 0)
            .sort((a, b) => b.gf - a.gf)
            .slice(0, 3);
        
        // Top 3 Assistman
        const topAssistmen = allStats
            .filter(p => p.ass > 0)
            .sort((a, b) => b.ass - a.ass)
            .slice(0, 3);
        
        // Top 3 Portieri (meno gol subiti, min 3 presenze)
        const topGoalkeepers = allStats
            .filter(p => p.role === 'P' && p.pv >= 3)
            .sort((a, b) => a.gs - b.gs)
            .slice(0, 3);
        
        // Top 3 FantaMedia (min 3 presenze)
        const topFantaMedia = allStats
            .filter(p => p.pv >= 3 && p.fm > 0)
            .sort((a, b) => b.fm - a.fm)
            .slice(0, 3);
        
        renderPlayerLeaderboards({
            scorers: topScorers,
            assistmen: topAssistmen,
            goalkeepers: topGoalkeepers,
            fantaMedia: topFantaMedia
        }, totalGiornate);
        
    } catch (error) {
        console.error('Errore caricamento statistiche calciatori:', error);
        document.getElementById('player-statistics-container').innerHTML = 
            '<p class="text-sm sm:text-base text-red-500 text-center py-4 col-span-full">Errore nel caricamento delle statistiche</p>';
    }
};

/**
 * Renderizza le classifiche dei giocatori
 */
const renderPlayerLeaderboards = (data, totalGiornate = 0) => {
    const container = document.getElementById('player-statistics-container');
    if (!container) return;
    
    const getRoleBadge = (role) => {
        const badges = {
            'P': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
            'D': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
            'C': 'bg-green-500/20 text-green-300 border-green-500/30',
            'A': 'bg-red-500/20 text-red-300 border-red-500/30'
        };
        return badges[role] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    };
    
    const renderLeaderboard = (title, players, statKey, statLabel, icon, cardColor, iconColor, statColor) => {
        if (players.length === 0) {
            return `
                <div class="bg-gradient-to-br ${cardColor} border ${iconColor.replace('text-', 'border-')}/50 rounded-lg p-4">
                    <div class="flex items-center mb-3">
                        ${icon}
                        <h4 class="text-sm font-bold ${iconColor} uppercase ml-2">${title}</h4>
                    </div>
                    <p class="text-gray-400 text-sm">Nessun dato disponibile</p>
                </div>
            `;
        }
        
        const playersList = players.map((p, idx) => {
            const logoUrl = getTeamLogo(p.fantaSquad);
            const isFirst = idx === 0;
            const presenze = p.pv || 0;
            const presenzeText = `${presenze}/${totalGiornate}`;
            
            return `
                <div class="flex items-center justify-between ${isFirst ? 'py-3 mb-2 border-b-2' : 'py-2.5'} ${idx < players.length - 1 && !isFirst ? 'border-b border-gray-700/30' : ''} ${isFirst ? 'border-' + iconColor.replace('text-', '') + '/50' : ''}">
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-1 min-w-0">
                            ${logoUrl ? `<img src="${logoUrl}" alt="${p.fantaSquad}" class="${isFirst ? 'w-10 h-10' : 'w-7 h-7'} object-contain flex-shrink-0" onerror="this.style.display='none'">` : ''}
                            <div class="flex-1 min-w-0">
                                <p class="${isFirst ? 'text-base sm:text-lg' : 'text-sm'} font-bold text-white truncate">${p.playerName || 'N/A'}</p>
                                <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    <span class="${isFirst ? 'text-xs' : 'text-xs'} px-2 py-0.5 rounded border ${getRoleBadge(p.role)} font-bold">${p.role}</span>
                                    <span class="${isFirst ? 'text-sm' : 'text-xs'} ${isFirst ? iconColor : 'text-gray-400'} font-semibold truncate">${p.fantaSquad || 'N/A'}</span>
                                    <span class="text-xs text-gray-500">• ${presenzeText}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="text-right ml-3 flex-shrink-0">
                        <p class="${isFirst ? 'text-3xl sm:text-4xl' : 'text-2xl'} font-bold ${statColor}">${statKey === 'fm' ? Number(p[statKey]).toFixed(1) : p[statKey]}</p>
                        <p class="text-xs text-gray-400 uppercase">${statLabel}</p>
                    </div>
                </div>
            `;
        }).join('');
        
        return `
            <div class="bg-gradient-to-br ${cardColor} border ${iconColor.replace('text-', 'border-')}/50 rounded-lg p-4">
                <div class="flex items-center mb-3">
                    ${icon}
                    <h4 class="text-sm font-bold ${iconColor} uppercase ml-2">${title}</h4>
                </div>
                <div class="space-y-0">
                    ${playersList}
                </div>
            </div>
        `;
    };
    
    const scorersIcon = '<svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clip-rule="evenodd"></path></svg>';
    
    const assistIcon = '<svg class="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path></svg>';
    
    const gkIcon = '<svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>';
    
    const fmIcon = '<svg class="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>';
    
    container.innerHTML = `
        ${renderLeaderboard('Top Marcatori', data.scorers, 'gf', 'gol', scorersIcon, 'from-red-900/30 to-red-800/20', 'text-red-400', 'text-red-400')}
        ${renderLeaderboard('Top Assist', data.assistmen, 'ass', 'assist', assistIcon, 'from-blue-900/30 to-blue-800/20', 'text-blue-400', 'text-blue-400')}
        ${renderLeaderboard('Migliori Portieri', data.goalkeepers, 'gs', 'gol sub.', gkIcon, 'from-yellow-900/30 to-yellow-800/20', 'text-yellow-400', 'text-yellow-400')}
        ${renderLeaderboard('Miglior FantaMedia', data.fantaMedia, 'fm', 'FM', fmIcon, 'from-purple-900/30 to-purple-800/20', 'text-purple-400', 'text-purple-400')}
    `;
};

// ==================== VISUALIZZAZIONE ROSE ====================

/**
 * Carica i dati delle rose per la visualizzazione pubblica
 */
export const loadSquadsData = async () => {
    try {
        const playersCollection = getPlayersCollectionRef();
        const statsCollection = getPlayerStatsCollectionRef();
        
        // Carica le statistiche per ottenere gli IDs e tutti i dati
        const statsSnapshot = await getDocs(statsCollection);
        const playerIdMap = new Map(); // Nome normalizzato -> playerId
        const allStats = []; // Array con tutte le statistiche
        
        statsSnapshot.forEach(doc => {
            const stat = doc.data();
            allStats.push(stat);
            const normalizedName = (stat.playerName || '').trim().toLowerCase();
            playerIdMap.set(normalizedName, stat.playerId);
        });
        
        // Salva le statistiche nello stato globale per renderSquadsView
        setPlayerStatsData(allStats);
        
        // Carica i giocatori dalle Rose
        const snapshot = await getDocs(playersCollection);
        
        if (snapshot.empty) {
            document.getElementById('squads-view-container').innerHTML = '<p class="text-center text-gray-500 py-8">Nessuna rosa caricata. Contatta l\'admin per il caricamento.</p>';
            return;
        }
        
        // Raggruppa i giocatori per squadra e arricchisci con playerId
        const squadsMap = new Map();
        let enrichedCount = 0;
        
        snapshot.forEach(doc => {
            const player = doc.data();
            
            // Prova a trovare il playerId dalle statistiche
            const normalizedName = (player.playerName || '').trim().toLowerCase();
            if (!player.playerId && playerIdMap.has(normalizedName)) {
                player.playerId = playerIdMap.get(normalizedName);
                enrichedCount++;
            }
            
            if (!squadsMap.has(player.squadName)) {
                squadsMap.set(player.squadName, []);
            }
            squadsMap.get(player.squadName).push(player);
        });
        
        // Debug: Mostra il primo giocatore per controllare se ha playerId
        if (squadsMap.size > 0) {
            const firstPlayers = squadsMap.values().next().value;
            if (firstPlayers && firstPlayers.length > 0) {
            }
        }
        
        // Popola il filtro squadre
        const filterSelect = document.getElementById('squads-filter');
        filterSelect.innerHTML = '<option value="all">Tutte le squadre</option>';
        Array.from(squadsMap.keys()).sort().forEach(squadName => {
            filterSelect.innerHTML += `<option value="${squadName}">${squadName}</option>`;
        });
        
        // Salva i dati globalmente per il filtro
        currentSquadsData = squadsMap;
        window.currentSquadsData = squadsMap;
        
        // Mostra tutte le squadre
        renderSquadsView(squadsMap);
        
    } catch (error) {
        console.error('Errore nel caricamento delle rose:', error);
        messageBox('Errore nel caricamento delle rose.');
    }
};

/**
 * Renderizza la vista delle rose
 */
const renderSquadsView = (squadsMap) => {
    const container = document.getElementById('squads-grid');
    if (!container) return;
    
    if (squadsMap.size > 0) {
        const firstPlayers = squadsMap.values().next().value;
    }
    
    // Importa le statistiche globali
    let allPlayerStats = getPlayerStatsData() || [];
    
    // Crea una map nome -> statistiche per lookup veloce
    const statsMap = new Map();
    for (const stat of allPlayerStats) {
        const normalizedName = (stat.playerName || '').trim().toLowerCase();
        statsMap.set(normalizedName, stat);
    }
    
    let html = '';
    
    // Ordina le squadre alfabeticamente
    const sortedSquads = Array.from(squadsMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    
    // Icone per i ruoli
    const roleIcons = {
        P: '🧤',
        D: '🛡️',
        C: '⚙️',
        A: '⚽'
    };
    
    const roleLabels = { 
        P: 'Portieri', 
        D: 'Difensori', 
        C: 'Centrocampisti', 
        A: 'Attaccanti' 
    };
    
    const roleSectionColors = {
        P: 'from-yellow-600/20 to-yellow-600/10 border-yellow-500/30',
        D: 'from-blue-600/20 to-blue-600/10 border-blue-500/30',
        C: 'from-green-600/20 to-green-600/10 border-green-500/30',
        A: 'from-red-600/20 to-red-600/10 border-red-500/30'
    };
    
    const roleBgColors = { 
        P: 'from-yellow-900 to-yellow-800', 
        D: 'from-blue-900 to-blue-800', 
        C: 'from-green-900 to-green-800', 
        A: 'from-red-900 to-red-800' 
    };
    
    const roleBorderColors = { 
        P: 'border-yellow-600', 
        D: 'border-blue-600', 
        C: 'border-green-600', 
        A: 'border-red-600' 
    };

    // Funzione per ottenere le iniziali del giocatore
    const getPlayerInitials = (playerName) => {
        if (!playerName) return '?';
        const names = playerName.split(' ');
        if (names.length >= 2) {
            return (names[0][0] + names[names.length - 1][0]).toUpperCase();
        }
        return playerName.substring(0, 2).toUpperCase();
    };

    // Funzione per ottenere colore per le iniziali basato sul ruolo
    const getInitialsBgColor = (role) => {
        const colors = {
            P: 'bg-yellow-600',
            D: 'bg-blue-600',
            C: 'bg-green-600',
            A: 'bg-red-600'
        };
        return colors[role] || 'bg-gray-600';
    };
    
    for (const [squadName, players] of sortedSquads) {
        const totalCost = players.reduce((sum, p) => sum + p.cost, 0);
        const squadLogoUrl = getTeamLogo(squadName);
        
        // Calcola la media di FantaMedia per la squadra
        let totalFantaMedia = 0;
        let countFantaMedia = 0;
        let totalMediaVoto = 0;
        let countMediaVoto = 0;
        
        players.forEach(player => {
            const normalizedName = (player.playerName || '').trim().toLowerCase();
            const stat = statsMap.get(normalizedName);
            if (stat && stat.fm) {
                totalFantaMedia += stat.fm;
                countFantaMedia++;
            }
            if (stat && stat.mv) {
                totalMediaVoto += stat.mv;
                countMediaVoto++;
            }
        });
        const avgFantaMedia = countFantaMedia > 0 ? (totalFantaMedia / countFantaMedia).toFixed(2) : '-';
        const avgMediaVoto = countMediaVoto > 0 ? (totalMediaVoto / countMediaVoto).toFixed(2) : '-';
        
        // Header della squadra
        html += `
            <div class="bg-gray-900 border-2 border-purple-600 rounded-xl overflow-hidden shadow-2xl">
                <!-- Header squadra con logo e info -->
                <div class="bg-gradient-to-r from-purple-900 via-purple-800 to-purple-900 p-4 border-b-2 border-purple-600">
                    <div class="flex items-center gap-4 mb-3">
                        <img src="${squadLogoUrl}" alt="${squadName}" class="w-14 h-14 object-contain rounded-lg bg-white/5 p-1 border border-purple-500" onerror="this.style.display='none'">
                        <div class="flex-1">
                            <h3 class="text-2xl font-bold text-white tracking-wide">${squadName}</h3>
                            <div class="flex gap-3 mt-2 text-sm flex-wrap">
                                <div class="bg-purple-700/50 px-3 py-1 rounded-full border border-purple-500">
                                    <span class="text-gray-300">👥</span>
                                    <span class="text-white font-bold ml-1">${players.length}</span>
                                </div>
                                <div class="bg-yellow-700/50 px-3 py-1 rounded-full border border-yellow-500">
                                    <span class="text-gray-300">💰</span>
                                    <span class="text-yellow-300 font-bold ml-1">${totalCost}</span>
                                </div>
                                <div class="bg-green-700/50 px-3 py-1 rounded-full border border-green-500">
                                    <span class="text-gray-300">⭐</span>
                                    <span class="text-green-300 font-bold ml-1">MV Avg: ${avgMediaVoto}</span>
                                </div>
                                <div class="bg-blue-700/50 px-3 py-1 rounded-full border border-blue-500">
                                    <span class="text-gray-300">📊</span>
                                    <span class="text-blue-300 font-bold ml-1">FM Avg: ${avgFantaMedia}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- Barra statistiche ruoli -->
                    <div class="flex gap-2 text-xs">
                        ${['P', 'D', 'C', 'A'].map(role => {
                            const count = players.filter(p => p.role === role).length;
                            return `<span class="bg-gray-800/50 px-2 py-1 rounded">${roleIcons[role]} ${roleLabels[role]}: <span class="font-bold">${count}</span></span>`;
                        }).join('')}
                    </div>
                </div>
                
                <!-- Contenuto rose raggruppate per ruolo -->
                <div class="p-4 space-y-6">
        `;
        
        // Raggruppa i giocatori per ruolo
        const roleOrder = { P: 0, D: 1, C: 2, A: 3 };
        const groupedByRole = {};
        
        for (const player of players) {
            const role = player.role || 'N/A';
            if (!groupedByRole[role]) {
                groupedByRole[role] = [];
            }
            groupedByRole[role].push(player);
        }
        
        // Renderizza ogni ruolo in ordine
        for (const role of ['P', 'D', 'C', 'A']) {
            const rolePlayers = groupedByRole[role] || [];
            if (rolePlayers.length === 0) continue;
            
            // Ordina per costo decrescente
            rolePlayers.sort((a, b) => b.cost - a.cost);
            
            const bgColor = roleSectionColors[role];
            
            html += `
                <div class="bg-gradient-to-r ${bgColor} border rounded-lg p-4">
                    <h4 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <span class="text-2xl">${roleIcons[role]}</span>
                        ${roleLabels[role]} (${rolePlayers.length})
                    </h4>
                    
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            `;
            
            for (const player of rolePlayers) {
                const initials = getPlayerInitials(player.playerName);
                const bgGradient = roleBgColors[role];
                const borderColor = roleBorderColors[role];
                const initialsColor = getInitialsBgColor(role);
                
                // Recupera le statistiche del giocatore
                const normalizedName = (player.playerName || '').trim().toLowerCase();
                const playerStat = statsMap.get(normalizedName);
                
                const media = playerStat && playerStat.mv !== undefined ? playerStat.mv.toFixed(2) : '-';
                const fantaMedia = playerStat && playerStat.fm !== undefined ? playerStat.fm.toFixed(1) : '-';
                const fantaMediaNum = playerStat && playerStat.fm !== undefined ? parseFloat(playerStat.fm) : null;
                
                // Determina il colore per FantaMedia
                let fmColor = 'text-gray-400';
                if (fantaMediaNum !== null) {
                    if (fantaMediaNum > 6) fmColor = 'text-blue-400';
                    else if (fantaMediaNum < 6) fmColor = 'text-red-400';
                    else fmColor = 'text-white';
                }
                
                // Costruisci URL immagine se esiste l'ID
                const playerImageUrl = null; // Rimosso caricamento immagini per performance
                
                html += `
                    <div class="group relative bg-gray-800 border-2 ${borderColor} rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-105">
                        <!-- Placeholder con iniziali (rimosso caricamento immagini) -->
                        <div class="relative h-40 bg-gradient-to-b ${bgGradient} flex items-center justify-center overflow-hidden">
                            <div class="w-full h-full flex flex-col items-center justify-center">
                                <div class="w-16 h-16 rounded-full ${initialsColor} flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                                    ${initials}
                                </div>
                               </div>
                            <div class="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity bg-black"></div>
                        </div>
                        
                        <!-- Badge ruolo in alto a destra -->
                        <div class="absolute top-2 right-2 z-20">
                            <div class="w-8 h-8 rounded-full ${initialsColor} flex items-center justify-center text-white font-bold text-sm border-2 border-white shadow-lg">
                                ${roleIcons[role]}
                            </div>
                        </div>
                        
                        <!-- Info giocatore -->
                        <div class="p-3 bg-gray-800 border-t ${borderColor}">
                            <h5 class="text-sm font-bold text-white mb-1 line-clamp-2 group-hover:text-yellow-300 transition-colors">
                                ${player.playerName}
                            </h5>
                            <p class="text-xs text-gray-400 mb-2 line-clamp-1">
                                ${player.serieATeam}
                            </p>
                            <div class="space-y-2 pt-2 border-t border-gray-700">
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-gray-500">Costo</span>
                                    <span class="font-bold text-yellow-300">${player.cost}</span>
                                </div>
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-gray-500">Media</span>
                                    <span class="font-bold text-green-400">${media}</span>
                                </div>
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-gray-500">FM</span>
                                    <span class="font-bold ${fmColor}">${fantaMedia}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            html += `
                    </div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
    }
    
    if (squadsMap.size === 0) {
        html = '<p class="col-span-full text-center text-gray-400 py-12 text-lg">Nessuna squadra trovata.</p>';
    }
    
    container.innerHTML = html;
};

/**
 * Filtra la vista delle rose
 */
export const filterSquadView = () => {
    const filterValue = document.getElementById('squads-filter').value;
    
    if (!currentSquadsData || currentSquadsData.size === 0) return;
    
    if (filterValue === 'all') {
        renderSquadsView(currentSquadsData);
    } else {
        const filteredMap = new Map();
        if (currentSquadsData.has(filterValue)) {
            filteredMap.set(filterValue, currentSquadsData.get(filterValue));
        }
        renderSquadsView(filteredMap);
    }
};

// ==================== STATISTICHE LEGA ====================

/**
 * Carica i dati della sezione Statistiche Lega
 */
export const loadLeagueStatsData = () => {
    try {
        // Richiama le funzioni esistenti per popolare i container
        if (renderStatistics) renderStatistics();
        loadPlayerLeaderboards();
    } catch (error) {
        console.error('Errore caricamento statistiche lega:', error);
    }
};

/**
 * Carica il grafico dell'andamento classifica
 */
export const loadStandingsTrendChart = () => {
    try {
        if (renderStandingsTrend) renderStandingsTrend();
    } catch (error) {
        console.error('Errore caricamento andamento classifica:', error);
    }
};

// Esporta variabili per window
window.currentPlayerStats = currentPlayerStats;
window.currentFilteredStats = currentFilteredStats;
window.currentSquadsData = currentSquadsData;

// Esporta funzioni globali
window.loadPlayerStats = loadPlayerStats;
window.sortPlayerStats = sortPlayerStats;
window.filterPlayerStats = filterPlayerStats;
window.loadPlayerLeaderboards = loadPlayerLeaderboards;
window.clearPlayerStats = clearPlayerStats;
window.clearSquadsData = clearSquadsData;
window.loadSquadsData = loadSquadsData;
window.filterSquadView = filterSquadView;
window.filterSquads = filterSquadView; // Alias per compatibilità HTML
window.loadLeagueStatsData = loadLeagueStatsData;
window.loadStandingsTrendChart = loadStandingsTrendChart;
