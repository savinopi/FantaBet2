/**
 * FANTABet - Modulo Rendering
 * 
 * Contiene tutte le funzioni di rendering dell'interfaccia utente.
 */

import { getTeamLogo } from './config.js';
import * as state from './state.js';
import { showMatchDetails } from './match-details.js';
import { 
    getDocs,
    collection,
    getFirestore,
    getPlayersCollectionRef, 
    getPlayerStatsCollectionRef 
} from './firebase-config.js';
import { calculateStandings } from './bets.js';

// ===================================
// HEADER SEZIONE RIUTILIZZABILE
// ===================================

/**
 * Crea l'HTML dell'header della sezione
 * @param {string} title - Titolo della sezione
 * @param {string} colorClass - Classe colore (es. 'text-yellow-400', 'text-blue-400')
 * @returns {string} HTML dell'header
 */
export const createSectionHeader = (title, colorClass) => {
    return `
        <div class="pb-4 border-b border-gray-700">
            <h1 class="text-2xl sm:text-3xl font-bold ${colorClass}">
                ${title}
            </h1>
        </div>
    `;
};

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
    console.log(`[DEBUG formatDateItalian] Input: "${dateString}" → Date obj: ${date} → isValid: ${!isNaN(date)}`);
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    const formatted = date.toLocaleDateString('it-IT', options);
    console.log(`[DEBUG formatDateItalian] Output: "${formatted}"`);
    return formatted;
};

// ===================================
// RENDERING RISULTATI STORICI
// ===================================

/**
 * Renderizza la tabella dei risultati storici
 * @param {Array} results - Array dei risultati
 */
export const renderHistoricResults = (results, giornateData = {}) => {
    const tableContainer = document.getElementById('historic-results-table').parentElement;
    const table = document.getElementById('historic-results-table');
    if (!table) return;

    // Raggruppa i risultati per giornata
    const resultsByGiornata = results.reduce((acc, res) => {
        const giornata = res.giornata || 'Senza Giornata';
        (acc[giornata] = acc[giornata] || []).push(res);
        return acc;
    }, {});

    // Helper: estrai numero dalla stringa
    const extractNumber = s => {
        const m = (s || '').match(/\d+/);
        return m ? parseInt(m[0], 10) : 999;
    };

    // Ordina le giornate
    const sortedGiornate = Object.keys(resultsByGiornata).sort((a, b) => extractNumber(a) - extractNumber(b));

    // Popola il select per filtrare per giornata
    const giornataFilter = document.getElementById('historic-giornata-filter');
    if (giornataFilter) {
        const currentValue = giornataFilter.value;
        giornataFilter.innerHTML = '<option value="all">Tutte le giornate</option>';
        
        sortedGiornate.forEach(giornata => {
            const option = document.createElement('option');
            option.value = giornata;
            option.textContent = giornata.startsWith('Aggiunta Manuale') ? giornata : `Giornata ${giornata}`;
            giornataFilter.appendChild(option);
        });
        
        if (currentValue && giornataFilter.querySelector(`option[value="${currentValue}"]`)) {
            giornataFilter.value = currentValue;
        }
    }

    // Ricrea il container con layout moderno (non più tabella)
    let html = '';

    sortedGiornate.forEach(giornata => {
        const matches = resultsByGiornata[giornata];
        matches.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Raggruppa per data all'interno della giornata
        const matchesByDate = matches.reduce((acc, match) => {
            const date = match.date || 'Senza Data';
            (acc[date] = acc[date] || []).push(match);
            return acc;
        }, {});

        const sortedDates = Object.keys(matchesByDate).sort((a, b) => new Date(a) - new Date(b));

        // Ottieni la data della giornata da giornateData se disponibile
        const giornataDate = giornateData[giornata];
        console.log(`[DEBUG renderHistoricResults] Giornata ${giornata}: giornataDate="${giornataDate}"`);

        // Intestazione Giornata
        html += `
            <div class="mb-8" data-giornata="${giornata}">
                <div class="border-b-2 border-blue-500 pb-3 mb-5 flex items-center justify-between">
                    <div>
                        <h3 class="text-2xl font-bold text-blue-400">
                            ${giornata.startsWith('Aggiunta Manuale') ? giornata : `Giornata ${giornata}`}
                        </h3>
                        ${giornataDate ? `<p class="text-sm text-gray-400 mt-1">${formatDateItalian(giornataDate)}</p>` : '<p class="text-sm text-gray-500 mt-1">Data non disponibile</p>'}
                    </div>
                    <button onclick="openAttachmentsModal('${giornata}', 'Giornata ${giornata}')" 
                        class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 flex-shrink-0">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"></path>
                            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z"></path>
                        </svg>
                        Allegati
                    </button>
                </div>
        `;

        // Per ogni data della giornata
        sortedDates.forEach(date => {
            html += `
                <div class="mb-6" data-giornata="${giornata}">
                    <div class="text-sm font-semibold text-gray-400 mb-3 ml-2">
                        ${formatDateItalian(date)}
                    </div>
            `;

            // Partite della data
            matchesByDate[date].forEach(res => {
                const homeLogo = getTeamLogo(res.homeTeam);
                const awayLogo = getTeamLogo(res.awayTeam);
                
                const [homeGoals, awayGoals] = (res.score && res.score !== 'N/A' && res.score !== '-') 
                    ? res.score.split('-').map(s => parseInt(s.trim(), 10) || 0)
                    : [0, 0];

                // Semplifica i colori: solo 2 stati - Pareggio (giallo) e Vittoria (verde)
                let scoreColor = 'text-gray-300';
                let resultBadgeClass = 'bg-gray-700 text-gray-300';
                let homeTeamClass = 'text-gray-400';
                let awayTeamClass = 'text-gray-400';
                let homeTeamLogoOpacity = 'opacity-50';
                let awayTeamLogoOpacity = 'opacity-50';

                if (res.result === 'X') {
                    // Pareggio
                    resultBadgeClass = 'bg-yellow-600 text-white';
                    scoreColor = 'text-yellow-400';
                    homeTeamClass = 'text-yellow-300 font-bold';
                    awayTeamClass = 'text-yellow-300 font-bold';
                    homeTeamLogoOpacity = 'opacity-100';
                    awayTeamLogoOpacity = 'opacity-100';
                } else {
                    // Vittoria (sia casa che ospiti)
                    resultBadgeClass = 'bg-green-600 text-white';
                    scoreColor = 'text-green-400';
                    
                    if (res.result === '1') {
                        // Casa vince
                        homeTeamClass = 'text-green-300 font-bold';
                        awayTeamClass = 'text-gray-500';
                        homeTeamLogoOpacity = 'opacity-100';
                        awayTeamLogoOpacity = 'opacity-40';
                    } else if (res.result === '2') {
                        // Ospiti vincono
                        homeTeamClass = 'text-gray-500';
                        awayTeamClass = 'text-green-300 font-bold';
                        homeTeamLogoOpacity = 'opacity-40';
                        awayTeamLogoOpacity = 'opacity-100';
                    }
                }

                html += `
                    <div class="bg-gray-800 border border-gray-700 rounded-lg px-2 py-3 sm:p-4 mb-3 hover:bg-gray-750 transition-colors cursor-pointer" onclick="showMatchDetails(${JSON.stringify({
                        giornata: res.giornata,
                        homeTeam: res.homeTeam,
                        awayTeam: res.awayTeam,
                        score: res.score,
                        homePoints: res.homePoints,
                        awayPoints: res.awayPoints
                    }).replace(/"/g, '&quot;')})">
                        <!-- Flex Layout (Horizontal) -->
                        <div class="flex items-center justify-between gap-1 sm:gap-3">
                            <!-- Home Team (Left) -->
                            <div class="flex flex-col items-center min-w-0 flex-1">
                                ${homeLogo ? `
                                    <img src="${homeLogo}" alt="${res.homeTeam}" class="w-8 h-8 sm:w-10 sm:h-10 object-contain mb-0.5 sm:mb-1 flex-shrink-0 ${homeTeamLogoOpacity}" onerror="this.style.display='none'">
                                ` : ''}
                                <p class="text-xs font-bold ${homeTeamClass} truncate w-full text-center">${res.homeTeam}</p>
                            </div>

                            <!-- Score (Center) -->
                            <div class="flex flex-col items-center justify-center gap-0.5 sm:gap-1 flex-shrink-0">
                                <div class="text-2xl sm:text-3xl font-black ${scoreColor} leading-none">
                                    ${res.score ? res.score.split('-').map(s => s.trim()).join('-') : '-'}
                                </div>
                                <div class="flex gap-0.5 text-xs text-gray-500">
                                    <span>${res.homePoints || '-'}</span>
                                    <span class="text-gray-600">|</span>
                                    <span>${res.awayPoints || '-'}</span>
                                </div>
                            </div>

                            <!-- Away Team (Right) -->
                            <div class="flex flex-col items-center min-w-0 flex-1">
                                ${awayLogo ? `
                                    <img src="${awayLogo}" alt="${res.awayTeam}" class="w-8 h-8 sm:w-10 sm:h-10 object-contain mb-0.5 sm:mb-1 flex-shrink-0 ${awayTeamLogoOpacity}" onerror="this.style.display='none'">
                                ` : ''}
                                <p class="text-xs font-bold ${awayTeamClass} truncate w-full text-center">${res.awayTeam}</p>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
        });

        html += `</div>`;
    });

    table.innerHTML = html;
};

// ===================================
// RENDERING CLASSIFICA
// ===================================



/**
 * Renderizza la classifica (versione responsive)
 * Su mobile: versione compatta | Su desktop: versione estesa con ordinamento
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
    
    // Verifica se è desktop (>= 1024px)
    const isDesktop = window.innerWidth >= 1024;
    
    if (isDesktop) {
        // Versione desktop estesa con ordinamento
        container.innerHTML = generateDesktopStandingsHtml(standings);
    } else {
        // Versione mobile compatta
        container.innerHTML = generateMobileStandingsHtml(standings);
    }
    
    // Aggiorna anche la classifica fullscreen se aperta
    const fullscreenContent = document.getElementById('standings-fullscreen-content');
    if (fullscreenContent) {
        fullscreenContent.innerHTML = generateFullStandingsHtml(standings);
    }
};

/**
 * Genera HTML per classifica mobile compatta
 * @param {Array} standings - Classifica
 * @returns {string} HTML
 */
const generateMobileStandingsHtml = (standings) => {
    // Calcola quanti caratteri mostrare in base alla risoluzione dello schermo
    const getMaxTeamNameLength = () => {
        const width = window.innerWidth;
        if (width < 360) return 10;
        if (width < 480) return 13;
        if (width < 640) return 16;
        if (width < 768) return 20;
        return 25;
    };
    
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
    
    standings.forEach((team, index) => {
        const pos = index + 1;
        let posClass = 'text-gray-400';
        if (pos === 1) {
            posClass = 'text-yellow-400 font-bold';
        } else if (pos === 2) {
            posClass = 'text-gray-300 font-semibold';
        } else if (pos === 3) {
            posClass = 'text-orange-400 font-semibold';
        }
        
        const fantasyPoints = (team.fantasyPoints || 0).toFixed(1);
        const maxLength = getMaxTeamNameLength();
        const teamNameSafe = team.team || 'Unknown';
        const squadraDisplay = teamNameSafe.length > maxLength ? teamNameSafe.substring(0, maxLength) + '...' : teamNameSafe;
        
        html += `
            <div style="display: flex; align-items: center; padding: 0.75rem; border-bottom: 1px solid rgba(55, 65, 81, 1); white-space: nowrap; overflow: hidden; cursor: pointer;" class="hover:bg-gray-800 transition" onclick="showTeamStats('${teamNameSafe.replace(/'/g, "\\'")}')"> 
                <div style="width: 30px; text-align: center; flex-shrink: 0;">
                    <span class="${posClass} text-lg font-bold">${pos}</span>
                </div>
                <img src="${getTeamLogo(teamNameSafe)}" alt="${teamNameSafe}" style="width: 24px; height: 24px; margin: 0 0.5rem 0 0.25rem; flex-shrink: 0; display: block;" onerror="this.style.display='none'">
                <div style="flex-grow: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    <span class="text-white font-semibold text-sm" title="${teamNameSafe}" style="display: block;">${squadraDisplay}</span>
                </div>
                <span class="text-blue-400 font-bold text-sm" style="width: 35px; text-align: right; flex-shrink: 0; margin-left: 0.75rem;">${team.points}</span>
                <span class="text-green-400 font-bold text-sm" style="width: 45px; text-align: right; flex-shrink: 0; margin-left: 0.5rem;">${fantasyPoints}</span>
            </div>
        `;
    });
    
    html += `</div>`;
    return html;
};

/**
 * Genera indicatore ordinamento (freccia testuale)
 * @param {string} column - Colonna
 * @returns {string} HTML indicatore
 */
const getSortIndicator = (column) => {
    if (state.standingsSortColumn !== column) {
        return '';
    }
    if (state.standingsSortDirection === 'asc') {
        return ' <span class="text-blue-400 font-bold">↑</span>';
    }
    return ' <span class="text-blue-400 font-bold">↓</span>';
};

/**
 * Genera HTML per classifica desktop estesa con ordinamento
 * @param {Array} standings - Classifica
 * @returns {string} HTML
 */
const generateDesktopStandingsHtml = (standings) => {
    const columns = [
        { key: null, label: '#', sortable: false, width: 'w-12', align: 'text-center' },
        { key: null, label: '', sortable: false, width: 'w-12', align: 'text-center' }, // Logo
        { key: 'team', label: 'Squadra', sortable: true, width: 'min-w-[180px]', align: 'text-left' },
        { key: 'points', label: 'Pt', sortable: true, width: 'w-14', align: 'text-center', color: 'text-blue-400' },
        { key: 'fantasyPoints', label: 'FPt', sortable: true, width: 'w-16', align: 'text-center', color: 'text-green-400' },
        { key: 'played', label: 'G', sortable: true, width: 'w-12', align: 'text-center' },
        { key: 'wins', label: 'V', sortable: true, width: 'w-12', align: 'text-center', color: 'text-green-400' },
        { key: 'draws', label: 'P', sortable: true, width: 'w-12', align: 'text-center', color: 'text-yellow-400' },
        { key: 'losses', label: 'S', sortable: true, width: 'w-12', align: 'text-center', color: 'text-red-400' },
        { key: 'goalsFor', label: 'GF', sortable: true, width: 'w-12', align: 'text-center' },
        { key: 'goalsAgainst', label: 'GS', sortable: true, width: 'w-12', align: 'text-center' },
        { key: 'goalDiff', label: 'DR', sortable: true, width: 'w-14', align: 'text-center' }
    ];
    
    let html = `<div class="bg-gray-900 rounded-lg overflow-hidden">
        <table class="w-full text-sm">
            <thead class="bg-gray-800 text-gray-400 text-xs uppercase">
                <tr>`;
    
    columns.forEach(col => {
        if (col.sortable) {
            const isActive = state.standingsSortColumn === col.key;
            const activeClass = isActive ? 'text-blue-400 bg-gray-700' : '';
            html += `<th class="px-2 py-3 ${col.width} ${col.align} cursor-pointer hover:bg-gray-700 hover:text-blue-400 transition-colors select-none standings-sort-header ${activeClass}" data-sort="${col.key}">
                ${col.label}${getSortIndicator(col.key)}
            </th>`;
        } else {
            html += `<th class="px-2 py-3 ${col.width} ${col.align}">${col.label}</th>`;
        }
    });
    
    html += `</tr></thead><tbody class="divide-y divide-gray-700">`;
    
    standings.forEach((team, index) => {
        const pos = index + 1;
        let posClass = 'text-gray-400';
        if (pos === 1) posClass = 'text-yellow-400 font-bold';
        else if (pos === 2) posClass = 'text-gray-300 font-semibold';
        else if (pos === 3) posClass = 'text-orange-400 font-semibold';
        
        const goalDiff = team.goalsFor - team.goalsAgainst;
        const goalDiffText = goalDiff > 0 ? `+${goalDiff}` : goalDiff.toString();
        const goalDiffClass = goalDiff > 0 ? 'text-green-400' : goalDiff < 0 ? 'text-red-400' : 'text-gray-400';
        
        const teamName = team.team || 'Unknown';
        html += `
            <tr class="hover:bg-gray-800/50 transition-colors cursor-pointer" onclick="showTeamStats('${teamName.replace(/'/g, "\\'")}')">
                <td class="px-2 py-3 text-center ${posClass} font-bold">${pos}</td>
                <td class="px-2 py-3 text-center">
                    <img src="${getTeamLogo(team.team)}" alt="${team.team || 'Unknown'}" class="w-7 h-7 object-contain mx-auto" onerror="this.style.display='none'">
                </td>
                <td class="px-2 py-3 text-left font-semibold text-white">${team.team || 'Unknown'}</td>
                <td class="px-2 py-3 text-center font-bold text-blue-400">${team.points}</td>
                <td class="px-2 py-3 text-center font-semibold text-green-400">${(team.fantasyPoints || 0).toFixed(1)}</td>
                <td class="px-2 py-3 text-center">${team.played}</td>
                <td class="px-2 py-3 text-center text-green-400">${team.wins}</td>
                <td class="px-2 py-3 text-center text-yellow-400">${team.draws}</td>
                <td class="px-2 py-3 text-center text-red-400">${team.losses}</td>
                <td class="px-2 py-3 text-center">${team.goalsFor}</td>
                <td class="px-2 py-3 text-center">${team.goalsAgainst}</td>
                <td class="px-2 py-3 text-center ${goalDiffClass} font-semibold">${goalDiffText}</td>
            </tr>
        `;
    });
    
    html += `</tbody></table></div>`;
    
    // Aggiungi event listener dopo il rendering
    setTimeout(() => {
        document.querySelectorAll('.standings-sort-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const sortKey = e.currentTarget.dataset.sort;
                if (sortKey) {
                    renderStandings(sortKey);
                }
            });
        });
    }, 0);
    
    return html;
};

/**
 * Genera HTML per classifica completa
 * @param {Array} standings - Classifica
 * @returns {string} HTML
 */
const generateFullStandingsHtml = (standings) => {
    let html = `
        <div class="overflow-x-auto -mx-4 sm:mx-0">
        <table class="w-full text-left text-gray-300 text-sm md:text-base">
            <thead class="bg-gray-700 text-gray-400 text-xs md:text-sm uppercase sticky top-0">
                <tr>
                    <th class="px-2 md:px-3 py-3 text-center min-w-[2rem]">#</th>
                    <th class="px-1 md:px-2 py-3 text-center min-w-[2rem]">Logo</th>
                    <th class="px-2 md:px-3 py-3 text-left min-w-[150px] md:min-w-[200px]">Squadra</th>
                    <th class="px-1 md:px-2 py-3 text-center min-w-[3rem]">Pt</th>
                    <th class="px-1 md:px-2 py-3 text-center min-w-[3rem]">FPt</th>
                    <th class="px-1 md:px-2 py-3 text-center min-w-[2.5rem]">G</th>
                    <th class="px-1 md:px-2 py-3 text-center min-w-[2.5rem]">V</th>
                    <th class="px-1 md:px-2 py-3 text-center min-w-[2.5rem]">P</th>
                    <th class="px-1 md:px-2 py-3 text-center min-w-[2.5rem]">S</th>
                    <th class="px-1 md:px-2 py-3 text-center min-w-[2.5rem]">GF</th>
                    <th class="px-1 md:px-2 py-3 text-center min-w-[2.5rem]">GS</th>
                    <th class="px-1 md:px-2 py-3 text-center min-w-[3rem]">DR</th>
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
                <td class="px-2 md:px-3 py-3 text-center ${posClass}">${pos}</td>
                <td class="px-1 md:px-2 py-3 text-center">
                    <img src="${getTeamLogo(team.team)}" alt="${team.team || 'Unknown'}" 
                         class="w-6 h-6 md:w-8 md:h-8 object-contain mx-auto" 
                         onerror="this.style.display='none'">
                </td>
                <td class="px-2 md:px-3 py-3 font-semibold text-white whitespace-normal">${team.team || 'Unknown'}</td>
                <td class="px-1 md:px-2 py-3 text-center font-bold text-blue-400">${team.points}</td>
                <td class="px-1 md:px-2 py-3 text-center text-green-400">${(team.fantasyPoints || 0).toFixed(1)}</td>
                <td class="px-1 md:px-2 py-3 text-center">${team.played}</td>
                <td class="px-1 md:px-2 py-3 text-center text-green-400">${team.wins}</td>
                <td class="px-1 md:px-2 py-3 text-center text-yellow-400">${team.draws}</td>
                <td class="px-1 md:px-2 py-3 text-center text-red-400">${team.losses}</td>
                <td class="px-1 md:px-2 py-3 text-center">${team.goalsFor}</td>
                <td class="px-1 md:px-2 py-3 text-center">${team.goalsAgainst}</td>
                <td class="px-1 md:px-2 py-3 text-center ${goalDiffClass}">${goalDiffText}</td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    return html;
};

// ===================================
// RENDERING PARTITE APERTE
// ===================================

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

let standingsTrendChart = null;

/**
 * Calcola il trend della classifica per ogni giornata
 */
const calculateStandingsTrend = () => {
    const allResults = state.getAllResults();
    
    // Raggruppa i risultati per giornata
    const resultsByGiornata = new Map();
    allResults.forEach(r => {
        const giornataNum = parseInt(r.giornata) || 0;
        if (giornataNum > 0) {
            if (!resultsByGiornata.has(giornataNum)) {
                resultsByGiornata.set(giornataNum, []);
            }
            resultsByGiornata.get(giornataNum).push(r);
        }
    });
    
    if (resultsByGiornata.size === 0) return null;
    
    // Ordina le giornate
    const sortedGiornate = Array.from(resultsByGiornata.keys()).sort((a, b) => a - b);
    
    // Calcola la classifica progressiva per ogni giornata
    const teamTrends = new Map();
    const allTeamsSet = new Set();
    
    // Raccogli tutte le squadre
    allResults.forEach(r => {
        if (r.homeTeam) allTeamsSet.add(r.homeTeam);
        if (r.awayTeam) allTeamsSet.add(r.awayTeam);
    });
    
    // Inizializza le squadre
    allTeamsSet.forEach(team => {
        if (team) teamTrends.set(team, []);
    });
    
    // Per ogni giornata, calcola la classifica cumulativa
    let cumulativeResults = [];
    sortedGiornate.forEach(giornata => {
        const giornataResults = resultsByGiornata.get(giornata);
        cumulativeResults = [...cumulativeResults, ...giornataResults];
        
        // Calcola classifica fino a questa giornata
        const standings = [];
        allTeamsSet.forEach(teamName => {
            const teamResults = cumulativeResults.filter(r => 
                r.homeTeam === teamName || r.awayTeam === teamName
            );
            
            let points = 0;
            let fantasyPoints = 0;
            let goalsFor = 0;
            let goalsAgainst = 0;
            
            teamResults.forEach(r => {
                if (r.homeTeam === teamName) {
                    if (r.result === '1') points += 3;
                    else if (r.result === 'X') points += 1;
                    
                    if (r.score && r.score.includes('-')) {
                        const [home, away] = r.score.split('-').map(g => parseInt(g.trim(), 10));
                        if (!isNaN(home) && !isNaN(away)) {
                            goalsFor += home;
                            goalsAgainst += away;
                        }
                    }
                    
                    if (r.homePoints) fantasyPoints += r.homePoints;
                } else {
                    if (r.result === '2') points += 3;
                    else if (r.result === 'X') points += 1;
                    
                    if (r.score && r.score.includes('-')) {
                        const [home, away] = r.score.split('-').map(g => parseInt(g.trim(), 10));
                        if (!isNaN(home) && !isNaN(away)) {
                            goalsFor += away;
                            goalsAgainst += home;
                        }
                    }
                    
                    if (r.awayPoints) fantasyPoints += r.awayPoints;
                }
            });
            
            standings.push({
                team: teamName,
                points: points,
                fantasyPoints: fantasyPoints,
                goalDifference: goalsFor - goalsAgainst,
                goalsFor: goalsFor,
                goalsAgainst: goalsAgainst
            });
        });
        
        // Ordina usando lo stesso criterio della classifica principale
        standings.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.fantasyPoints !== a.fantasyPoints) return b.fantasyPoints - a.fantasyPoints;
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
            if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst;
            return 0;
        });
        
        // Salva la posizione di ogni squadra in questa giornata
        standings.forEach((team, index) => {
            const teamName = team.team || 'Unknown';
            if (teamTrends.has(teamName)) {
                teamTrends.get(teamName).push({
                    giornata: giornata,
                    position: index + 1,
                    points: team.points
                });
            }
        });
    });
    
    return {
        giornate: sortedGiornate,
        teamTrends: teamTrends
    };
};

/**
 * Renderizza il trend della classifica con Chart.js
 */
export const renderStandingsTrend = () => {
    const canvas = document.getElementById('standings-trend-chart');
    const placeholder = document.getElementById('standings-trend-placeholder');
    
    if (!canvas) return;
    
    const trendData = calculateStandingsTrend();
    
    if (!trendData) {
        if (placeholder) placeholder.style.display = 'flex';
        if (canvas) canvas.style.display = 'none';
        return;
    }
    
    const { giornate, teamTrends } = trendData;
    
    // Nascondi placeholder e mostra canvas
    if (placeholder) placeholder.style.display = 'none';
    if (canvas) canvas.style.display = 'block';
    
    // Distruggi il grafico precedente se esiste
    if (standingsTrendChart) {
        standingsTrendChart.destroy();
    }
    
    // Colori per ogni squadra
    const teamColors = [
        { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
        { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
        { border: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
        { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
        { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
        { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
        { border: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)' },
        { border: '#f97316', bg: 'rgba(249, 115, 22, 0.1)' },
        { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
        { border: '#84cc16', bg: 'rgba(132, 204, 22, 0.1)' }
    ];
    
    // Ordina le squadre per posizione finale
    const finalStandings = Array.from(teamTrends.entries())
        .filter(([team, trend]) => trend && trend.length > 0)
        .map(([team, trend]) => ({
            team: team,
            finalPosition: trend[trend.length - 1].position,
            trend: trend
        }))
        .sort((a, b) => a.finalPosition - b.finalPosition);
    
    // Prepara i dataset per Chart.js
    const datasets = finalStandings.map(({ team, trend }, idx) => {
        const color = teamColors[idx % teamColors.length];
        
        const positions = giornate.map(g => {
            const data = trend.find(t => t.giornata === g);
            return data ? data.position : null;
        });
        
        return {
            label: team,
            data: positions,
            borderColor: color.border,
            backgroundColor: color.bg,
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.1,
            fill: false
        };
    });
    
    // Crea il grafico
    const ctx = canvas.getContext('2d');
    standingsTrendChart = new window.Chart(ctx, {
        type: 'line',
        data: {
            labels: giornate.map(g => `G${g}`),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: window.innerWidth < 768 ? 1 : 2,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: '#e0e7ff',
                        padding: 12,
                        font: {
                            size: window.innerWidth < 768 ? 10 : 12
                        },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#e0e7ff',
                    bodyColor: '#e0e7ff',
                    borderColor: '#1e3a8a',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            const teamName = context.dataset.label;
                            const position = context.parsed.y;
                            return `${teamName}: ${position}° posto`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    reverse: true,
                    beginAtZero: false,
                    ticks: {
                        color: '#9ca3af',
                        stepSize: 1,
                        callback: function(value) {
                            return value + '°';
                        }
                    },
                    grid: {
                        color: 'rgba(75, 85, 99, 0.3)',
                        drawBorder: false
                    },
                    title: {
                        display: true,
                        text: 'Posizione',
                        color: '#9ca3af',
                        font: {
                            size: 12
                        }
                    }
                },
                x: {
                    ticks: {
                        color: '#9ca3af',
                        maxRotation: 45,
                        minRotation: 45,
                        font: {
                            size: window.innerWidth < 768 ? 9 : 11
                        }
                    },
                    grid: {
                        color: 'rgba(75, 85, 99, 0.2)',
                        drawBorder: false
                    },
                    title: {
                        display: true,
                        text: 'Giornata',
                        color: '#9ca3af',
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
    
    // Esponi su window per l'uso inline
    window.standingsTrendChartInstance = standingsTrendChart;
};

// ===================================
// STATISTICHE SQUADRA
// ===================================

/**
 * Mostra le statistiche dettagliate di una squadra
 * @param {string} teamName - Nome della squadra
 */
export const showTeamStats = async (teamName) => {
    const modal = document.getElementById('team-stats-modal');
    const content = document.getElementById('team-stats-content');
    
    if (!modal || !content) {
        console.error('Modal team-stats non trovato');
        return;
    }
    
    // Mostra loading
    content.innerHTML = '<div class="text-center py-8"><div class="animate-spin inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"></div><p class="text-gray-400 mt-4">Caricamento statistiche...</p></div>';
    modal.classList.remove('hidden');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    try {
        // Carica i dati dei giocatori dal database
        const playersSnapshot = await getDocs(getPlayersCollectionRef());
        
        if (playersSnapshot.empty) {
            content.innerHTML = '<p class="text-red-400 text-center py-4">Carica prima i dati delle rose per visualizzare le statistiche</p>';
            return;
        }
        
        // Raggruppa giocatori per squadra
        const teamPlayers = [];
        playersSnapshot.forEach(doc => {
            const player = doc.data();
            if (player.squadName === teamName) {
                teamPlayers.push(player);
            }
        });
        
        if (teamPlayers.length === 0) {
            content.innerHTML = `<p class="text-red-400 text-center py-4">Nessun giocatore trovato per ${teamName}</p>`;
            return;
        }
        
        // Carica le statistiche dei giocatori
        const statsSnapshot = await getDocs(getPlayerStatsCollectionRef());
        
        // Funzione per normalizzare i nomi
        const normalizeName = (name) => {
            return name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        };
        
        // Crea mappa statistiche per nome giocatore normalizzato
        const statsMap = new Map();
        statsSnapshot.forEach(doc => {
            const stat = doc.data();
            if (stat.fantaSquad === teamName) {
                const normalizedName = normalizeName(stat.playerName || stat.Name || '');
                statsMap.set(normalizedName, stat);
            }
        });
        
        // Arricchisci i giocatori con le loro statistiche
        const playersWithStats = teamPlayers.map(player => {
            const normalizedPlayerName = normalizeName(player.playerName);
            const stats = statsMap.get(normalizedPlayerName);
            let ruolo = player.role || player.ruolo || player.R || (stats ? (stats.role || stats.ruolo || stats.R) : null);
            
            return {
                Name: player.playerName,
                R: ruolo,
                Id: stats ? (stats.playerId || stats.Id) : null,
                Fm: stats ? (parseFloat(stats.fm) || 0) : 0,
                Mv: stats ? (parseFloat(stats.mv) || 0) : 0,
                Pv: stats ? (parseInt(stats.pv) || 0) : 0,
                Gf: stats ? (parseInt(stats.gf) || 0) : 0,
                Gs: stats ? (parseInt(stats.gs) || 0) : 0,
                Rp: stats ? (parseInt(stats.rp) || 0) : 0,
                Ass: stats ? (parseInt(stats.ass) || 0) : 0,
                cost: player.cost || 0
            };
        });
        
        // Calcola posizione in classifica
        const standings = calculateStandings(state.allResults);
        const position = standings.findIndex(t => t.team === teamName) + 1;
        
        // Filtra giocatori con almeno 5 presenze
        const playersWithEnoughGames = playersWithStats.filter(p => p.Pv >= 5);
        
        const ruoli = {
            'P': { nome: 'Portiere', emoji: '🧤', color: 'yellow' },
            'D': { nome: 'Difensore', emoji: '🛡️', color: 'blue' },
            'C': { nome: 'Centrocampista', emoji: '⚙️', color: 'green' },
            'A': { nome: 'Attaccante', emoji: '⚽', color: 'red' }
        };
        
        // Trova migliori giocatori per ruolo
        const bestByRole = {};
        Object.keys(ruoli).forEach(ruolo => {
            const playersInRole = playersWithEnoughGames.filter(p => p.R === ruolo);
            if (playersInRole.length > 0) {
                bestByRole[ruolo] = playersInRole.reduce((best, player) => 
                    (player.Fm || 0) > (best.Fm || 0) ? player : best
                );
            }
        });
        
        // Miglior giocatore assoluto
        const bestPlayer = playersWithEnoughGames.length > 0 
            ? playersWithEnoughGames.reduce((best, player) => (player.Fm || 0) > (best.Fm || 0) ? player : best)
            : null;
        
        // Top scorer
        const scorers = playersWithStats.filter(p => (p.Gf || 0) > 0);
        const topScorer = scorers.length > 0 
            ? scorers.reduce((best, player) => (player.Gf || 0) > (best.Gf || 0) ? player : best)
            : playersWithStats[0];
        
        // Top assistman
        const assistmen = playersWithStats.filter(p => (p.Ass || 0) > 0);
        const topAssistman = assistmen.length > 0
            ? assistmen.reduce((best, player) => (player.Ass || 0) > (best.Ass || 0) ? player : best)
            : playersWithStats[0];
        
        // Calcola statistiche squadra per l'header
        const totalCost = playersWithStats.reduce((sum, p) => sum + (p.cost || 0), 0);
        let totalFantaMedia = 0;
        let countFantaMedia = 0;
        let totalMediaVoto = 0;
        let countMediaVoto = 0;
        
        playersWithStats.forEach(player => {
            if (player.Fm) {
                totalFantaMedia += player.Fm;
                countFantaMedia++;
            }
            if (player.Mv) {
                totalMediaVoto += player.Mv;
                countMediaVoto++;
            }
        });
        const avgFantaMedia = countFantaMedia > 0 ? (totalFantaMedia / countFantaMedia).toFixed(2) : '0.00';
        const avgMediaVoto = countMediaVoto > 0 ? (totalMediaVoto / countMediaVoto).toFixed(2) : '0.00';
        
        // Genera HTML
        let html = `
            <!-- Header Squadra -->
            <div class="card bg-gradient-to-br from-slate-900 via-blue-900/50 to-slate-900 border-2 border-blue-400 shadow-xl mb-6">
                <div class="flex flex-col md:flex-row items-center justify-between p-6 gap-4">
                    <div class="flex items-center gap-4">
                        <img src="${getTeamLogo(teamName)}" alt="${teamName}" class="w-20 h-20 object-contain" onerror="this.style.display='none'">
                        <div>
                            <h2 class="text-3xl font-black text-white mb-1">${teamName}</h2>
                            <span class="px-3 py-1 bg-yellow-500 text-black font-bold rounded-full text-sm">#${position} in classifica</span>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 md:flex gap-2 md:gap-3">
                        <div class="bg-purple-700/50 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-purple-500 text-center">
                            <span class="text-gray-300 text-xs sm:text-sm">👥</span>
                            <span class="text-white font-bold ml-0.5 sm:ml-1 text-xs sm:text-sm">${playersWithStats.length}</span>
                        </div>
                        <div class="bg-yellow-700/50 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-yellow-500 text-center">
                            <span class="text-gray-300 text-xs sm:text-sm">💰</span>
                            <span class="text-yellow-300 font-bold ml-0.5 sm:ml-1 text-xs sm:text-sm">${totalCost}</span>
                        </div>
                        <div class="bg-green-700/50 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-green-500 text-center">
                            <span class="text-gray-300 text-xs sm:text-sm">⭐</span>
                            <span class="text-green-300 font-bold ml-0.5 sm:ml-1 text-xs sm:text-sm">MV: ${avgMediaVoto}</span>
                        </div>
                        <div class="bg-blue-700/50 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-blue-500 text-center">
                            <span class="text-gray-300 text-xs sm:text-sm">📊</span>
                            <span class="text-blue-300 font-bold ml-0.5 sm:ml-1 text-xs sm:text-sm">FM: ${avgFantaMedia}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Migliori per Ruolo -->
            <div class="card bg-slate-900 border border-slate-700 mb-6">
                <div class="bg-gradient-to-r from-blue-600 to-purple-600 p-4 rounded-t-xl">
                    <h3 class="text-xl font-bold text-white">🏆 TOP PER RUOLO</h3>
                </div>
                <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        `;
        
        Object.keys(ruoli).forEach(ruolo => {
            const player = bestByRole[ruolo];
            const ruoloInfo = ruoli[ruolo];
            if (player) {
                // Per i portieri, mostra Gol Subiti e Rigori Parati
                const isPortiere = ruolo === 'P';
                const stat1 = isPortiere ? `Gs: ${player.Gs || 0}` : `Gol: ${player.Gf || 0}`;
                const stat1Color = isPortiere ? 'text-red-400' : 'text-green-400';
                const stat2 = isPortiere ? `Rp: ${player.Rp || 0}` : `Ass: ${player.Ass || 0}`;
                const stat2Color = isPortiere ? 'text-yellow-400' : 'text-purple-400';
                
                html += `
                    <div class="bg-slate-800 border border-${ruoloInfo.color}-500/50 rounded-lg p-4">
                        <div class="flex items-center gap-3">
                            ${player.Id ? `<img src="https://content.fantacalcio.it/web/campioncini/20/card/${player.Id}.png?v=466" alt="${player.Name}" class="w-16 h-20 object-cover rounded" onerror="this.style.display='none'">` : ''}
                            <div class="flex-1">
                                <span class="text-xs text-${ruoloInfo.color}-400">${ruoloInfo.emoji} ${ruoloInfo.nome}</span>
                                <h4 class="font-bold text-white">${player.Name}</h4>
                                <div class="text-sm">
                                    <div class="flex gap-4 mt-1">
                                        <span class="text-yellow-400">FM: ${player.Fm?.toFixed(1) || '0.0'}</span>
                                        <span class="text-blue-400">Pv: ${player.Pv || 0}</span>
                                    </div>
                                    <div class="flex gap-4 mt-1">
                                        <span class="${stat1Color}">${stat1}</span>
                                        <span class="${stat2Color}">${stat2}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="bg-slate-800/50 border border-dashed border-slate-600 rounded-lg p-4">
                        <span class="text-gray-500">${ruoloInfo.emoji} ${ruoloInfo.nome}: Nessuno con 5+ presenze</span>
                    </div>
                `;
            }
        });
        
        html += `</div></div>`;
        
        // MVP
        if (bestPlayer) {
            html += `
                <div class="card bg-gradient-to-br from-purple-950/50 to-slate-900 border-2 border-purple-500 mb-6">
                    <div class="bg-gradient-to-r from-purple-600 to-pink-600 p-4 rounded-t-xl">
                        <h3 class="text-xl font-bold text-white">⭐ MVP - MIGLIOR GIOCATORE</h3>
                    </div>
                    <div class="p-6 flex flex-col md:flex-row items-center gap-6">
                        ${bestPlayer.Id ? `<img src="https://content.fantacalcio.it/web/campioncini/20/card/${bestPlayer.Id}.png?v=466" alt="${bestPlayer.Name}" class="w-32 h-40 object-cover rounded-xl border-2 border-purple-500" onerror="this.style.display='none'">` : ''}
                        <div class="flex-1 text-center md:text-left">
                            <h4 class="text-3xl font-black text-white mb-2">${bestPlayer.Name}</h4>
                            <p class="text-purple-300 mb-4">${bestPlayer.R && ruoli[bestPlayer.R] ? ruoli[bestPlayer.R].nome : 'N/A'}</p>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div class="bg-yellow-500/20 border border-yellow-500 rounded-lg p-3 text-center">
                                    <div class="text-xs text-yellow-400">FANTAMEDIA</div>
                                    <div class="text-2xl font-bold text-yellow-400">${bestPlayer.Fm?.toFixed(2) || '0.00'}</div>
                                </div>
                                <div class="bg-blue-500/20 border border-blue-500 rounded-lg p-3 text-center">
                                    <div class="text-xs text-blue-400">PRESENZE</div>
                                    <div class="text-2xl font-bold text-blue-400">${bestPlayer.Pv || 0}</div>
                                </div>
                                <div class="bg-green-500/20 border border-green-500 rounded-lg p-3 text-center">
                                    <div class="text-xs text-green-400">GOL</div>
                                    <div class="text-2xl font-bold text-green-400">${bestPlayer.Gf || 0}</div>
                                </div>
                                <div class="bg-purple-500/20 border border-purple-500 rounded-lg p-3 text-center">
                                    <div class="text-xs text-purple-400">ASSIST</div>
                                    <div class="text-2xl font-bold text-purple-400">${bestPlayer.Ass || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Top Scorer e Assistman
        html += `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="card bg-green-950/30 border border-green-500">
                    <div class="bg-green-600 p-3 rounded-t-xl">
                        <h3 class="font-bold text-white">⚽ TOP SCORER</h3>
                    </div>
                    <div class="p-4">
                        <div class="flex flex-col items-center mb-4">
                            ${topScorer?.Id ? `<img src="https://content.fantacalcio.it/web/campioncini/20/card/${topScorer.Id}.png?v=466" alt="${topScorer?.Name}" class="w-24 h-32 object-cover rounded-lg shadow-2xl border-3 border-green-500 mb-3" onerror="this.style.display='none'">` : ''}
                            <h4 class="text-2xl font-bold text-white text-center">${topScorer?.Name || 'N/A'}</h4>
                        </div>
                        <div class="text-5xl font-black text-green-400 text-center my-2">${topScorer?.Gf || 0}</div>
                        <div class="text-gray-400 text-center mb-4">gol in ${topScorer?.Pv || 0} presenze</div>
                        
                        <!-- Barra Goal -->
                        <div class="bg-gray-800 rounded p-2 mb-3">
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-xs text-gray-300">Goal</span>
                                <span class="text-xs font-bold text-green-400">${topScorer?.Gf || 0}</span>
                            </div>
                            <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div class="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full" style="width: ${Math.min(((topScorer?.Gf || 0) / Math.max(topScorer?.Pv || 1, 1)) * 100, 100)}%"></div>
                            </div>
                        </div>
                        
                        <!-- Barra Assist -->
                        <div class="bg-gray-800 rounded p-2 mb-3">
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-xs text-gray-300">Assist</span>
                                <span class="text-xs font-bold text-blue-400">${topScorer?.Ass || 0}</span>
                            </div>
                            <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div class="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full" style="width: ${Math.min(((topScorer?.Ass || 0) / Math.max(topScorer?.Pv || 1, 1)) * 100, 100)}%"></div>
                            </div>
                        </div>
                        
                        <!-- Barra Goal Contribution -->
                        <div class="bg-gray-800 rounded p-2">
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-xs text-gray-300">Goal Contribution</span>
                                <span class="text-xs font-bold text-purple-400">${(topScorer?.Gf || 0) + (topScorer?.Ass || 0)} (${topScorer?.Gf || 0}G + ${topScorer?.Ass || 0}A) - ${(topScorer?.Gf || 0) + (topScorer?.Ass || 0)}/${topScorer?.Pv || 0}</span>
                            </div>
                            <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div class="bg-gradient-to-r from-purple-500 to-purple-400 h-2 rounded-full" style="width: ${Math.min((((topScorer?.Gf || 0) + (topScorer?.Ass || 0)) / Math.max(topScorer?.Pv || 1, 1)) * 100, 100)}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card bg-cyan-950/30 border border-cyan-500">
                    <div class="bg-cyan-600 p-3 rounded-t-xl">
                        <h3 class="font-bold text-white">🎯 TOP ASSISTMAN</h3>
                    </div>
                    <div class="p-4">
                        <div class="flex flex-col items-center mb-4">
                            ${topAssistman?.Id ? `<img src="https://content.fantacalcio.it/web/campioncini/20/card/${topAssistman.Id}.png?v=466" alt="${topAssistman?.Name}" class="w-24 h-32 object-cover rounded-lg shadow-2xl border-3 border-cyan-500 mb-3" onerror="this.style.display='none'">` : ''}
                            <h4 class="text-2xl font-bold text-white text-center">${topAssistman?.Name || 'N/A'}</h4>
                        </div>
                        <div class="text-5xl font-black text-cyan-400 text-center my-2">${topAssistman?.Ass || 0}</div>
                        <div class="text-gray-400 text-center mb-4">assist in ${topAssistman?.Pv || 0} presenze</div>
                        
                        <!-- Barra Goal -->
                        <div class="bg-gray-800 rounded p-2 mb-3">
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-xs text-gray-300">Goal</span>
                                <span class="text-xs font-bold text-green-400">${topAssistman?.Gf || 0}</span>
                            </div>
                            <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div class="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full" style="width: ${Math.min(((topAssistman?.Gf || 0) / Math.max(topAssistman?.Pv || 1, 1)) * 100, 100)}%"></div>
                            </div>
                        </div>
                        
                        <!-- Barra Assist -->
                        <div class="bg-gray-800 rounded p-2 mb-3">
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-xs text-gray-300">Assist</span>
                                <span class="text-xs font-bold text-blue-400">${topAssistman?.Ass || 0}</span>
                            </div>
                            <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div class="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full" style="width: ${Math.min(((topAssistman?.Ass || 0) / Math.max(topAssistman?.Pv || 1, 1)) * 100, 100)}%"></div>
                            </div>
                        </div>
                        
                        <!-- Barra Goal Contribution -->
                        <div class="bg-gray-800 rounded p-2">
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-xs text-gray-300">Goal Contribution</span>
                                <span class="text-xs font-bold text-purple-400">${(topAssistman?.Gf || 0) + (topAssistman?.Ass || 0)} (${topAssistman?.Gf || 0}G + ${topAssistman?.Ass || 0}A) - ${(topAssistman?.Gf || 0) + (topAssistman?.Ass || 0)}/${topAssistman?.Pv || 0}</span>
                            </div>
                            <div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div class="bg-gradient-to-r from-purple-500 to-purple-400 h-2 rounded-full" style="width: ${Math.min((((topAssistman?.Gf || 0) + (topAssistman?.Ass || 0)) / Math.max(topAssistman?.Pv || 1, 1)) * 100, 100)}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        content.innerHTML = html;
        
    } catch (error) {
        console.error('Errore nel caricamento delle statistiche:', error);
        content.innerHTML = '<p class="text-red-400 text-center py-4">Errore nel caricamento delle statistiche</p>';
    }
};

/**
 * Chiude il modal delle statistiche squadra
 */
export const closeTeamStatsModal = () => {
    const modal = document.getElementById('team-stats-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = '';
        document.body.style.overflow = '';
    }
};

/**
 * Filtra i risultati storici per giornata selezionata
 */
export const filterHistoricResults = () => {
    const giornataFilter = document.getElementById('historic-giornata-filter');
    if (!giornataFilter) return;
    
    const selectedGiornata = giornataFilter.value;
    const container = document.getElementById('historic-results-table');
    const giornataContainers = container.querySelectorAll('[data-giornata]');
    
    giornataContainers.forEach(el => {
        const giornata = el.getAttribute('data-giornata');
        
        if (selectedGiornata === 'all' || giornata === selectedGiornata) {
            el.style.display = '';
        } else {
            el.style.display = 'none';
        }
    });
};

// ===================================
// TEAM OF THE SEASON
// ===================================

export async function renderTeamOfTheSeason() {
    try {
        console.log('🏆 Inizio caricamento Team of the Season...');
        const db = getFirestore();
        
        // Carica giocatori e loro statistiche
        const playersSnapshot = await getDocs(collection(db, 'players'));
        const statsSnapshot = await getDocs(collection(db, 'player_stats'));
        
        console.log(`📊 Giocatori trovati: ${playersSnapshot.docs.length}, Statistiche: ${statsSnapshot.docs.length}`);
        
        // Crea map per statistiche
        const statsMap = new Map();
        statsSnapshot.forEach(doc => {
            const stats = doc.data();
            const normalizedName = normalizeName(stats.playerName);
            statsMap.set(normalizedName, stats);
        });
        
        // Crea array di giocatori con statistiche (solo quelli in squadra)
        const allPlayersWithStats = playersSnapshot.docs
            .map(doc => {
                const player = doc.data();
                const normalizedName = normalizeName(player.playerName);
                const stats = statsMap.get(normalizedName);
                
                return {
                    name: player.playerName,
                    team: player.team || 'No Team',
                    role: player.role || player.R || (stats ? (stats.role || stats.R) : null),
                    mv: stats ? (parseFloat(stats.mv) || 0) : 0,
                    fm: stats ? (parseFloat(stats.fm) || 0) : 0,
                    serieATeam: player.serieATeam || (stats ? stats.serieATeam : null),
                    imageUrl: stats ? stats.imageUrl : null,
                    cost: player.cost || 0
                };
            })
            .filter(p => p.team && p.team !== 'Svincolato' && p.team !== 'No Team') // Solo giocatori in squadra
            .filter(p => p.mv > 0); // Solo con media voto
        
        console.log(`👥 Giocatori in squadra con media voto: ${allPlayersWithStats.length}`);
        
        // Raggruppa per ruolo e ordina
        const roleGroups = {
            'P': [],
            'D': [],
            'C': [],
            'A': []
        };
        
        allPlayersWithStats.forEach(player => {
            if (roleGroups[player.role]) {
                roleGroups[player.role].push(player);
            }
        });
        
        console.log(`📋 Raggruppamento per ruolo: P=${roleGroups['P'].length}, D=${roleGroups['D'].length}, C=${roleGroups['C'].length}, A=${roleGroups['A'].length}`);
        
        // Ordina ogni ruolo per media voto descrescente e prendi i migliori
        const formation = {
            'P': roleGroups['P'].sort((a, b) => b.mv - a.mv).slice(0, 1),
            'D': roleGroups['D'].sort((a, b) => b.mv - a.mv).slice(0, 4),
            'C': roleGroups['C'].sort((a, b) => b.mv - a.mv).slice(0, 3),
            'A': roleGroups['A'].sort((a, b) => b.mv - a.mv).slice(0, 3)
        };
        
        console.log('⚽ Formazione selezionata:', formation);
        
        // Renderizza il campo
        renderTeamOfSeasonField(formation);
        console.log('✅ Team of the Season renderizzato con successo');
        
    } catch (error) {
        console.error('❌ Errore caricamento Team of the Season:', error);
        alert('Errore nel caricamento del Team of the Season. Controlla la console.');
    }
}

function renderTeamOfSeasonField(formation) {
    // Portiere
    const goalkeeperContainer = document.getElementById('team-season-goalkeeper');
    goalkeeperContainer.innerHTML = formation['P'].map(player => createPlayerCard(player)).join('');
    
    // Difensori
    const defendersContainer = document.getElementById('team-season-defenders');
    defendersContainer.innerHTML = formation['D'].map(player => createPlayerCard(player)).join('');
    
    // Centrocampisti
    const midfieldersContainer = document.getElementById('team-season-midfielders');
    midfieldersContainer.innerHTML = formation['C'].map(player => createPlayerCard(player)).join('');
    
    // Attaccanti
    const forwardsContainer = document.getElementById('team-season-forwards');
    forwardsContainer.innerHTML = formation['A'].map(player => createPlayerCard(player)).join('');
}

function createPlayerCard(player) {
    const imageUrl = player.imageUrl || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23666" width="100" height="100"/%3E%3Ccircle cx="50" cy="35" r="20" fill="%23999"/%3E%3Cpath d="M50 55 Q30 55 25 70 L75 70 Q70 55 50 55" fill="%23999"/%3E%3C/svg%3E';
    
    return `
        <div class="flex flex-col items-center">
            <div class="w-16 h-20 sm:w-20 sm:h-24 rounded-lg overflow-hidden border-2 border-yellow-300 shadow-lg bg-gray-800 flex items-center justify-center">
                <img src="${imageUrl}" alt="${player.name}" class="w-full h-full object-cover" onerror="this.style.display='none'">
            </div>
            <div class="text-center mt-2 text-xs sm:text-sm">
                <p class="font-bold text-white truncate max-w-16 sm:max-w-20">${player.name}</p>
                <p class="text-yellow-300 font-semibold">${player.mv.toFixed(2)}</p>
            </div>
        </div>
    `;
}

// ===================================
// ESPORTAZIONI WINDOW
// ===================================

window.renderStandings = renderStandings;
window.renderHistoricResults = renderHistoricResults;
window.renderTeamOfTheSeason = renderTeamOfTheSeason;
window.renderPlacedBets = renderPlacedBets;
window.renderStatistics = renderStatistics;
window.showTeamStats = showTeamStats;
window.closeTeamStatsModal = closeTeamStatsModal;
window.filterHistoricResults = filterHistoricResults;
