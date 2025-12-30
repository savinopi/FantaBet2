/**
 * FANTABet - Modulo Rendering
 * 
 * Contiene tutte le funzioni di rendering dell'interfaccia utente.
 */

import { getTeamLogo } from './config.js';
import * as state from './state.js';

// ===================================
// FORMATTAZIONE DATE
// ===================================

/**
 * Formatta data in formato italiano
 * @param {string} dateString - Data in formato stringa
 * @returns {string} Data formattata
 */
export const formatDateItalian = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('it-IT', options);
};

// ===================================
// RENDERING RISULTATI STORICI
// ===================================

/**
 * Renderizza la tabella dei risultati storici
 * @param {Array} results - Array dei risultati
 */
export const renderHistoricResults = (results) => {
    const tableBody = document.getElementById('historic-results-table');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    // Raggruppa i risultati per giornata
    const resultsByGiornata = results.reduce((acc, res) => {
        const giornata = res.giornata || 'Senza Giornata';
        (acc[giornata] = acc[giornata] || []).push(res);
        return acc;
    }, {});

    const resultMap = { '1': 'Vittoria Casa (1)', 'X': 'Pareggio (X)', '2': 'Vittoria Ospite (2)' };

    // Helper: estrai numero dalla stringa
    const extractNumber = s => {
        const m = (s || '').match(/\d+/);
        return m ? parseInt(m[0], 10) : 999;
    };

    // Ordina le giornate
    const sortedGiornate = Object.keys(resultsByGiornata).sort((a, b) => extractNumber(a) - extractNumber(b));

    // Costruisci DOM usando fragment
    const frag = document.createDocumentFragment();

    sortedGiornate.forEach(giornata => {
        // Ordina le partite per data
        resultsByGiornata[giornata].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Intestazione Giornata
        const headerRow = document.createElement('tr');
        headerRow.className = 'giornata-header bg-gray-700';
        headerRow.innerHTML = `<th colspan="6" class="text-left">${giornata.startsWith('Aggiunta Manuale') ? giornata : 'Giornata ' + giornata}</th>`;
        frag.appendChild(headerRow);

        // Partite della Giornata
        resultsByGiornata[giornata].forEach(res => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-800';
            
            // Classi per evidenziare il vincitore
            let homeTeamClass = 'text-white font-semibold';
            let awayTeamClass = 'text-white font-semibold';
            
            if (res.result === '1') {
                homeTeamClass = 'text-blue-400 font-bold';
                awayTeamClass = 'text-gray-500 font-normal';
            } else if (res.result === '2') {
                homeTeamClass = 'text-gray-500 font-normal';
                awayTeamClass = 'text-blue-400 font-bold';
            } else if (res.result === 'X') {
                homeTeamClass = 'text-orange-400 font-semibold';
                awayTeamClass = 'text-orange-400 font-semibold';
            }
            
            row.innerHTML = `
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${giornata}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-blue-400 font-medium">${formatDateItalian(res.date)}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm ${homeTeamClass}">${res.homeTeam}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm ${awayTeamClass}">${res.awayTeam}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm font-bold text-center ${res.result === '1' ? 'text-green-500' : res.result === '2' ? 'text-red-500' : 'text-yellow-500'}">${resultMap[res.result] || '-'}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm font-bold text-center text-blue-400">${res.score || '-'}</td>
            `;
            frag.appendChild(row);
        });
    });

    tableBody.appendChild(frag);
};

// ===================================
// RENDERING CLASSIFICA
// ===================================

/**
 * Calcola la classifica dalle partite
 * @param {Array} results - Risultati delle partite
 * @returns {Array} Classifica ordinata
 */
export const calculateStandings = (results) => {
    const standings = {};
    
    results.forEach(res => {
        // Inizializza squadre se non presenti
        if (!standings[res.homeTeam]) {
            standings[res.homeTeam] = {
                team: res.homeTeam,
                played: 0, wins: 0, draws: 0, losses: 0,
                goalsFor: 0, goalsAgainst: 0, points: 0, fantasyPoints: 0
            };
        }
        if (!standings[res.awayTeam]) {
            standings[res.awayTeam] = {
                team: res.awayTeam,
                played: 0, wins: 0, draws: 0, losses: 0,
                goalsFor: 0, goalsAgainst: 0, points: 0, fantasyPoints: 0
            };
        }
        
        const home = standings[res.homeTeam];
        const away = standings[res.awayTeam];
        
        home.played++;
        away.played++;
        
        // Parse score
        if (res.score && res.score !== 'N/A' && res.score !== '-') {
            const [homeGoals, awayGoals] = res.score.split('-').map(s => parseInt(s.trim(), 10) || 0);
            home.goalsFor += homeGoals;
            home.goalsAgainst += awayGoals;
            away.goalsFor += awayGoals;
            away.goalsAgainst += homeGoals;
        }
        
        // Calcola punti
        if (res.result === '1') {
            home.wins++;
            home.points += 3;
            away.losses++;
        } else if (res.result === '2') {
            away.wins++;
            away.points += 3;
            home.losses++;
        } else if (res.result === 'X') {
            home.draws++;
            away.draws++;
            home.points += 1;
            away.points += 1;
        }
        
        // Fantasy points (se presenti)
        if (res.homeFantasyPoints) home.fantasyPoints += parseFloat(res.homeFantasyPoints) || 0;
        if (res.awayFantasyPoints) away.fantasyPoints += parseFloat(res.awayFantasyPoints) || 0;
    });
    
    // Converti in array e ordina
    return Object.values(standings).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.fantasyPoints !== a.fantasyPoints) return b.fantasyPoints - a.fantasyPoints;
        const diffA = a.goalsFor - a.goalsAgainst;
        const diffB = b.goalsFor - b.goalsAgainst;
        return diffB - diffA;
    });
};

/**
 * Renderizza la classifica
 * @param {string|null} sortColumn - Colonna per ordinamento
 */
export const renderStandings = (sortColumn = null) => {
    const container = document.getElementById('standings-container');
    if (!container) return;
    
    const results = state.allResults;
    if (!results || results.length === 0) {
        container.innerHTML = '<p class="text-sm sm:text-base text-gray-500 text-center py-4 px-4">Carica i risultati per visualizzare la classifica</p>';
        return;
    }
    
    let standings = calculateStandings(results);
    
    // Gestione ordinamento
    if (sortColumn) {
        if (state.standingsSortColumn === sortColumn) {
            state.setStandingsSortDirection(state.standingsSortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            state.setStandingsSortColumn(sortColumn);
            state.setStandingsSortDirection('desc');
        }
        
        standings.sort((a, b) => {
            let valA = a[sortColumn];
            let valB = b[sortColumn];
            
            if (typeof valA === 'string') {
                return state.standingsSortDirection === 'asc' 
                    ? valA.localeCompare(valB) 
                    : valB.localeCompare(valA);
            }
            
            return state.standingsSortDirection === 'asc' ? valA - valB : valB - valA;
        });
    }
    
    // Genera HTML tabella
    const getSortIndicator = (col) => {
        if (state.standingsSortColumn !== col) return '';
        return state.standingsSortDirection === 'asc' ? ' ↑' : ' ↓';
    };
    
    let html = `
        <div class="overflow-x-auto">
            <table class="w-full text-left text-gray-300" style="table-layout: fixed;">
                <thead class="bg-gray-700/80 text-gray-400 text-xs uppercase">
                    <tr>
                        <th style="width: 30px; padding: 0.5rem 0.25rem; text-align: center;">#</th>
                        <th style="width: 35px; padding: 0.5rem 0.15rem;"></th>
                        <th style="width: 60px; padding: 0.5rem 0.25rem; text-align: left; cursor: pointer;" onclick="renderStandings('team')">
                            Squadra${getSortIndicator('team')}
                        </th>
                        <th style="width: 35px; padding: 0.5rem 0.15rem; text-align: center; cursor: pointer;" onclick="renderStandings('points')">
                            Pt${getSortIndicator('points')}
                        </th>
                        <th style="width: 40px; padding: 0.5rem 0.15rem; text-align: center; cursor: pointer;" onclick="renderStandings('fantasyPoints')">
                            FPt${getSortIndicator('fantasyPoints')}
                        </th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-700/50">
    `;
    
    standings.forEach((team, index) => {
        const pos = index + 1;
        let posClass = 'text-gray-400';
        if (pos === 1) posClass = 'text-yellow-400 font-bold';
        else if (pos === 2) posClass = 'text-gray-300 font-semibold';
        else if (pos === 3) posClass = 'text-orange-400 font-semibold';
        
        const goalDiff = team.goalsFor - team.goalsAgainst;
        const goalDiffText = goalDiff > 0 ? `+${goalDiff}` : goalDiff.toString();
        
        html += `
            <tr class="hover:bg-gray-700/50 transition-colors">
                <td style="padding: 0.5rem 0.25rem; text-align: center;" class="${posClass}">${pos}</td>
                <td style="padding: 0.5rem 0.15rem;">
                    <img src="${getTeamLogo(team.team)}" alt="${team.team}" 
                         class="w-7 h-7 object-contain mx-auto" 
                         onerror="this.style.display='none'">
                </td>
                <td style="padding: 0.5rem 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" 
                    class="font-semibold text-white text-sm" title="${team.team}">
                    ${team.team.length > 10 ? team.team.substring(0, 10) + '...' : team.team}
                </td>
                <td style="padding: 0.5rem 0.15rem; text-align: center;" class="font-bold text-blue-400">${team.points}</td>
                <td style="padding: 0.5rem 0.15rem; text-align: center;" class="text-green-400">${team.fantasyPoints.toFixed(1)}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Aggiorna anche la classifica fullscreen se aperta
    const fullscreenContent = document.getElementById('standings-fullscreen-content');
    if (fullscreenContent) {
        fullscreenContent.innerHTML = generateFullStandingsHtml(standings);
    }
};

/**
 * Genera HTML per classifica completa
 * @param {Array} standings - Classifica
 * @returns {string} HTML
 */
const generateFullStandingsHtml = (standings) => {
    let html = `
        <table class="w-full text-left text-gray-300">
            <thead class="bg-gray-700 text-gray-400 text-sm uppercase">
                <tr>
                    <th class="px-3 py-3 text-center w-10">#</th>
                    <th class="px-2 py-3 w-12"></th>
                    <th class="px-3 py-3 text-left">Squadra</th>
                    <th class="px-2 py-3 text-center w-12">Pt</th>
                    <th class="px-2 py-3 text-center w-12">FPt</th>
                    <th class="px-2 py-3 text-center w-10">G</th>
                    <th class="px-2 py-3 text-center w-10">V</th>
                    <th class="px-2 py-3 text-center w-10">P</th>
                    <th class="px-2 py-3 text-center w-10">S</th>
                    <th class="px-2 py-3 text-center w-10">GF</th>
                    <th class="px-2 py-3 text-center w-10">GS</th>
                    <th class="px-2 py-3 text-center w-12">DR</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-700">
    `;
    
    standings.forEach((team, index) => {
        const pos = index + 1;
        let posClass = 'text-gray-400';
        if (pos === 1) posClass = 'text-yellow-400 font-bold';
        else if (pos === 2) posClass = 'text-gray-300 font-semibold';
        else if (pos === 3) posClass = 'text-orange-400 font-semibold';
        
        const goalDiff = team.goalsFor - team.goalsAgainst;
        const goalDiffText = goalDiff > 0 ? `+${goalDiff}` : goalDiff.toString();
        const goalDiffClass = goalDiff > 0 ? 'text-green-400' : goalDiff < 0 ? 'text-red-400' : 'text-gray-400';
        
        html += `
            <tr class="hover:bg-gray-700/50 transition-colors">
                <td class="px-3 py-3 text-center ${posClass}">${pos}</td>
                <td class="px-2 py-3">
                    <img src="${getTeamLogo(team.team)}" alt="${team.team}" 
                         class="w-8 h-8 object-contain mx-auto" 
                         onerror="this.style.display='none'">
                </td>
                <td class="px-3 py-3 font-semibold text-white">${team.team}</td>
                <td class="px-2 py-3 text-center font-bold text-blue-400">${team.points}</td>
                <td class="px-2 py-3 text-center text-green-400">${team.fantasyPoints.toFixed(1)}</td>
                <td class="px-2 py-3 text-center">${team.played}</td>
                <td class="px-2 py-3 text-center text-green-400">${team.wins}</td>
                <td class="px-2 py-3 text-center text-yellow-400">${team.draws}</td>
                <td class="px-2 py-3 text-center text-red-400">${team.losses}</td>
                <td class="px-2 py-3 text-center">${team.goalsFor}</td>
                <td class="px-2 py-3 text-center">${team.goalsAgainst}</td>
                <td class="px-2 py-3 text-center ${goalDiffClass}">${goalDiffText}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    return html;
};

// ===================================
// RENDERING PARTITE APERTE
// ===================================

/**
 * Renderizza le partite aperte per scommesse
 * @param {Array} matches - Array delle partite
 * @param {number} giornata - Numero giornata
 */
export const renderOpenMatches = (matches, giornata) => {
    const container = document.getElementById('open-matches-container');
    const noMatchesEl = document.getElementById('no-open-matches');
    const giornataTitle = document.getElementById('betting-giornata-title');
    
    if (!container) return;
    
    // Aggiorna titolo giornata
    if (giornataTitle) {
        giornataTitle.textContent = `Giornata ${giornata}`;
    }
    
    if (!matches || matches.length === 0) {
        container.innerHTML = '';
        if (noMatchesEl) noMatchesEl.classList.remove('hidden');
        return;
    }
    
    if (noMatchesEl) noMatchesEl.classList.add('hidden');
    
    let html = '';
    
    matches.forEach(match => {
        const hasUserBet = match.userBet && match.userBet.stake > 0;
        const userPrediction = match.userBet?.prediction || state.currentPredictions[match.id];
        
        // Genera opzioni scommessa
        const options = ['1', 'X', '2'];
        const optionLabels = { '1': '1', 'X': 'X', '2': '2' };
        
        let optionsHtml = options.map(opt => {
            const odds = match.odds?.[opt] || '-';
            const isSelected = userPrediction === opt;
            const isSaved = hasUserBet && match.userBet.prediction === opt;
            
            let classes = 'bet-option rounded-lg text-center';
            if (isSaved) {
                classes += ' saved-bet';
            } else if (isSelected) {
                classes += ' local-selected';
            }
            
            if (hasUserBet) {
                classes += ' pointer-events-none opacity-50';
            }
            
            return `
                <div class="${classes}" 
                     data-match-id="${match.id}" 
                     data-prediction="${opt}"
                     onclick="recordPrediction('${match.id}', '${opt}')">
                    <div class="text-lg font-bold">${optionLabels[opt]}</div>
                    <div class="text-sm text-blue-400">${odds}</div>
                </div>
            `;
        }).join('');
        
        html += `
            <div id="match-${match.id}" class="card mb-4">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center space-x-3 flex-1">
                        <img src="${getTeamLogo(match.homeTeam)}" alt="${match.homeTeam}" 
                             class="w-10 h-10 object-contain" onerror="this.style.display='none'">
                        <span class="font-semibold text-white truncate">${match.homeTeam}</span>
                    </div>
                    <div class="text-gray-400 px-4">vs</div>
                    <div class="flex items-center space-x-3 flex-1 justify-end">
                        <span class="font-semibold text-white truncate">${match.awayTeam}</span>
                        <img src="${getTeamLogo(match.awayTeam)}" alt="${match.awayTeam}" 
                             class="w-10 h-10 object-contain" onerror="this.style.display='none'">
                    </div>
                </div>
                
                <div class="text-center text-sm text-gray-400 mb-3">
                    ${formatDateItalian(match.date)}
                </div>
                
                <div class="grid grid-cols-3 gap-3">
                    ${optionsHtml}
                </div>
                
                ${hasUserBet ? `
                    <div class="mt-3 text-center text-sm text-green-400">
                        ✓ Scommessa piazzata: ${match.userBet.prediction} @ ${match.userBet.odds}
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
};

// ===================================
// RENDERING SCOMMESSE PIAZZATE
// ===================================

/**
 * Renderizza le scommesse piazzate dall'utente
 * @param {Array} bets - Array delle scommesse
 */
export const renderPlacedBets = (bets) => {
    const container = document.getElementById('placed-bets-container');
    if (!container) return;
    
    if (!bets || bets.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <svg class="w-16 h-16 mx-auto mb-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path>
                    <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"></path>
                </svg>
                <p class="text-lg font-semibold">Nessuna scommessa piazzata</p>
                <p class="text-sm mt-2">Le tue scommesse appariranno qui</p>
            </div>
        `;
        return;
    }
    
    // Ordina per giornata (più recente prima)
    const sortedBets = [...bets].sort((a, b) => parseInt(b.giornata) - parseInt(a.giornata));
    
    let html = '';
    
    sortedBets.forEach(bet => {
        const statusClass = bet.settled 
            ? (bet.isWinning ? 'bg-green-900/30 border-green-500' : 'bg-red-900/30 border-red-500')
            : 'bg-gray-800 border-gray-700';
        
        const statusText = bet.settled
            ? (bet.isWinning ? `✓ VINTA: +${bet.winnings?.toFixed(2)} Cr` : '✗ PERSA')
            : '⏳ In attesa';
        
        const statusTextClass = bet.settled
            ? (bet.isWinning ? 'text-green-400' : 'text-red-400')
            : 'text-yellow-400';
        
        let predictionsHtml = bet.predictions?.map(pred => `
            <div class="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                <div class="flex-1">
                    <span class="text-sm">${pred.homeTeam}</span>
                    <span class="text-gray-500 mx-2">vs</span>
                    <span class="text-sm">${pred.awayTeam}</span>
                </div>
                <div class="flex items-center space-x-2">
                    <span class="px-2 py-1 rounded bg-gray-700 text-sm font-bold">${pred.prediction}</span>
                    <span class="text-blue-400 text-sm">@${pred.odds}</span>
                </div>
            </div>
        `).join('') || '';
        
        html += `
            <div class="card ${statusClass} border-2 mb-4">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold text-white">Giornata ${bet.giornata}</h3>
                    <span class="${statusTextClass} font-semibold">${statusText}</span>
                </div>
                
                <div class="mb-4">
                    ${predictionsHtml}
                </div>
                
                <div class="flex justify-between items-center pt-3 border-t border-gray-700">
                    <div>
                        <span class="text-gray-400 text-sm">Puntata:</span>
                        <span class="text-white font-bold ml-2">${bet.stake} Cr</span>
                    </div>
                    <div>
                        <span class="text-gray-400 text-sm">Quota:</span>
                        <span class="text-blue-400 font-bold ml-2">${bet.quotaTotale?.toFixed(2)}</span>
                    </div>
                    <div>
                        <span class="text-gray-400 text-sm">Vincita pot.:</span>
                        <span class="text-green-400 font-bold ml-2">${bet.potentialWinnings?.toFixed(2)} Cr</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
};

// ===================================
// RENDERING STATISTICHE
// ===================================

/**
 * Renderizza le statistiche generali
 */
export const renderStatistics = () => {
    const container = document.getElementById('statistics-container');
    if (!container) return;
    
    const results = state.allResults;
    if (!results || results.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center">Nessuna statistica disponibile</p>';
        return;
    }
    
    // Calcola statistiche
    let totalMatches = results.length;
    let homeWins = results.filter(r => r.result === '1').length;
    let draws = results.filter(r => r.result === 'X').length;
    let awayWins = results.filter(r => r.result === '2').length;
    
    let totalGoals = 0;
    results.forEach(r => {
        if (r.score && r.score !== 'N/A' && r.score !== '-') {
            const [home, away] = r.score.split('-').map(s => parseInt(s.trim(), 10) || 0);
            totalGoals += home + away;
        }
    });
    
    const avgGoals = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(2) : 0;
    
    container.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-gray-800 rounded-lg p-4 text-center">
                <div class="text-3xl font-bold text-blue-400">${totalMatches}</div>
                <div class="text-sm text-gray-400">Partite Giocate</div>
            </div>
            <div class="bg-gray-800 rounded-lg p-4 text-center">
                <div class="text-3xl font-bold text-green-400">${homeWins}</div>
                <div class="text-sm text-gray-400">Vittorie Casa</div>
            </div>
            <div class="bg-gray-800 rounded-lg p-4 text-center">
                <div class="text-3xl font-bold text-yellow-400">${draws}</div>
                <div class="text-sm text-gray-400">Pareggi</div>
            </div>
            <div class="bg-gray-800 rounded-lg p-4 text-center">
                <div class="text-3xl font-bold text-red-400">${awayWins}</div>
                <div class="text-sm text-gray-400">Vittorie Ospite</div>
            </div>
        </div>
        <div class="mt-4 bg-gray-800 rounded-lg p-4 text-center">
            <div class="text-3xl font-bold text-purple-400">${avgGoals}</div>
            <div class="text-sm text-gray-400">Media Gol per Partita</div>
        </div>
    `;
};

// ===================================
// RENDERING ANDAMENTO CLASSIFICA
// ===================================

/**
 * Renderizza il trend della classifica (placeholder)
 */
export const renderStandingsTrend = () => {
    // Questa funzione richiede Chart.js per il grafico
    // Implementazione completa rimandata
    console.log('renderStandingsTrend: TODO - implementare con Chart.js');
};

// ===================================
// ESPORTAZIONI WINDOW
// ===================================

window.renderStandings = renderStandings;
window.renderHistoricResults = renderHistoricResults;
window.renderOpenMatches = renderOpenMatches;
window.renderPlacedBets = renderPlacedBets;
window.renderStatistics = renderStatistics;
