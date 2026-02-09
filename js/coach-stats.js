/**
 * coach-stats.js - Modulo per le Statistiche Allenatore
 * Calcola il coefficiente di efficacia delle formazioni schierate
 */

import { 
    getDocs,
    query,
    where,
    getFormationsCollectionRef
} from './firebase-config.js';

// Moduli consentiti per il calcolo della formazione ottimale
const ALLOWED_FORMATIONS = [
    { name: '3-4-3', p: 1, d: 3, c: 4, a: 3 },
    { name: '3-5-2', p: 1, d: 3, c: 5, a: 2 },
    { name: '4-3-3', p: 1, d: 4, c: 3, a: 3 },
    { name: '4-4-2', p: 1, d: 4, c: 4, a: 2 },
    { name: '4-5-1', p: 1, d: 4, c: 5, a: 1 },
    { name: '5-3-2', p: 1, d: 5, c: 3, a: 2 },
    { name: '5-4-1', p: 1, d: 5, c: 4, a: 1 }
];

// Cache dei dati formazioni
let formationsCache = null;
let lastLoadTimestamp = null;

/**
 * Carica tutte le formazioni dal database
 */
export const loadAllFormations = async (forceReload = false) => {
    // Usa cache se disponibile e non forzato il reload
    if (formationsCache && !forceReload && lastLoadTimestamp && (Date.now() - lastLoadTimestamp < 60000)) {
        return formationsCache;
    }
    
    try {
        const snapshot = await getDocs(getFormationsCollectionRef());
        formationsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        lastLoadTimestamp = Date.now();
        return formationsCache;
    } catch (error) {
        console.error('Errore caricamento formazioni:', error);
        return [];
    }
};

/**
 * Ottieni le giornate disponibili dalle formazioni
 */
export const getAvailableGiornate = (formations) => {
    const giornate = new Set();
    formations.forEach(f => {
        if (f.giornata) giornate.add(parseInt(f.giornata));
    });
    return Array.from(giornate).sort((a, b) => a - b);
};

/**
 * Ottieni le squadre disponibili dalle formazioni
 */
export const getAvailableSquadre = (formations) => {
    const squadre = new Set();
    formations.forEach(f => {
        if (f.squadra) squadre.add(f.squadra);
    });
    return Array.from(squadre).sort();
};

/**
 * Calcola la formazione ottimale per una squadra in una giornata
 * 
 * REGOLA: L'ottimale ha lo stesso numero di giocatori della schierata.
 * - Se la schierata ha 11 giocatori: prova tutti i moduli consentiti per trovare il miglior 11
 * - Se la schierata ha < 11 giocatori: usa lo stesso modulo della schierata,
 *   ma scegli i migliori giocatori con voto per ogni ruolo (sostituzione pari ruolo)
 * 
 * @param {Array} players - Lista calciatori con ruolo e fantavoto
 * @param {Object} deployedResult - Risultato di calculateDeployedFormation (players, formation)
 * @returns {Object} - { formation: string, players: [], totalPoints: number }
 */
const calculateOptimalFormation = (players, deployedResult) => {
    // Filtra solo i calciatori con fantavoto valido (hanno preso voto)
    const eligiblePlayers = players.filter(p => p.fantavoto !== null && p.fantavoto > 0);
    
    // Raggruppa per ruolo
    const byRole = {
        P: eligiblePlayers.filter(p => p.ruolo === 'P').sort((a, b) => b.fantavoto - a.fantavoto),
        D: eligiblePlayers.filter(p => p.ruolo === 'D').sort((a, b) => b.fantavoto - a.fantavoto),
        C: eligiblePlayers.filter(p => p.ruolo === 'C').sort((a, b) => b.fantavoto - a.fantavoto),
        A: eligiblePlayers.filter(p => p.ruolo === 'A').sort((a, b) => b.fantavoto - a.fantavoto)
    };
    
    const deployedCount = deployedResult ? deployedResult.players.length : 0;
    
    // CASO 1: La schierata ha 11 giocatori → prova tutti i moduli consentiti
    if (deployedCount >= 11) {
        let bestFormation = null;
        let bestPlayers = [];
        let bestTotal = 0;
        
        for (const formation of ALLOWED_FORMATIONS) {
            if (byRole.P.length < formation.p) continue;
            if (byRole.D.length < formation.d) continue;
            if (byRole.C.length < formation.c) continue;
            if (byRole.A.length < formation.a) continue;
            
            const selected = [
                ...byRole.P.slice(0, formation.p),
                ...byRole.D.slice(0, formation.d),
                ...byRole.C.slice(0, formation.c),
                ...byRole.A.slice(0, formation.a)
            ];
            
            const total = selected.reduce((sum, p) => sum + p.fantavoto, 0);
            
            if (total > bestTotal) {
                bestTotal = total;
                bestFormation = formation.name;
                bestPlayers = selected;
            }
        }
        
        if (bestFormation) {
            return { formation: bestFormation, players: bestPlayers, totalPoints: bestTotal };
        }
    }
    
    // CASO 2: La schierata ha < 11 giocatori (o caso 1 fallito)
    // Usa lo stesso modulo della schierata, sostituendo solo a parità di ruolo
    if (deployedResult && deployedCount > 0) {
        // Conta ruoli nella formazione schierata
        const deployedRoles = {
            P: deployedResult.players.filter(p => p.ruolo === 'P').length,
            D: deployedResult.players.filter(p => p.ruolo === 'D').length,
            C: deployedResult.players.filter(p => p.ruolo === 'C').length,
            A: deployedResult.players.filter(p => p.ruolo === 'A').length
        };
        
        // Seleziona i migliori per ogni ruolo rispettando la distribuzione della schierata
        const optimalPlayers = [
            ...byRole.P.slice(0, deployedRoles.P),
            ...byRole.D.slice(0, deployedRoles.D),
            ...byRole.C.slice(0, deployedRoles.C),
            ...byRole.A.slice(0, deployedRoles.A)
        ];
        
        const totalPoints = optimalPlayers.reduce((sum, p) => sum + p.fantavoto, 0);
        const formationStr = `${deployedRoles.D}-${deployedRoles.C}-${deployedRoles.A}`;
        
        return {
            formation: formationStr,
            players: optimalPlayers,
            totalPoints
        };
    }
    
    return { formation: null, players: [], totalPoints: 0 };
};

/**
 * Verifica se un modulo (D-C-A) è tra quelli consentiti
 */
export const isValidFormation = (d, c, a) => {
    return ALLOWED_FORMATIONS.some(f => f.d === d && f.c === c && f.a === a);
};

/**
 * Calcola il punteggio della formazione effettivamente schierata
 * Simula la logica delle sostituzioni "Hybrid" del fantacalcio:
 * 
 * STEP 1: Per ogni titolare senza voto, cerca il primo sostituto dalla panchina
 *         dello STESSO RUOLO (in ordine di panchina)
 * 
 * STEP 2: Se non c'è un sostituto dello stesso ruolo, entra il primo panchinaro
 *         con voto (in ordine) che configura un MODULO VALIDO
 *         (cambio modulo con validazione)
 * 
 * @param {Array} players - Lista calciatori della formazione
 * @returns {Object} - { players: [], totalPoints: number, formation: string }
 */
export const calculateDeployedFormation = (players) => {
    // Ordina i calciatori per campo 'ordine' per preservare l'ordine dall'Excel
    const sorted = [...players].sort((a, b) => (a.ordine || 999) - (b.ordine || 999));
    
    // Separa titolari e panchina mantenendo l'ordine
    const titolari = sorted.filter(p => p.sezione === 'TITOLARE');
    const panchina = sorted.filter(p => p.sezione === 'PANCHINA');
    
    const deployed = [];
    const missingSlots = []; // Ruoli dei titolari senza voto
    
    // Prima passa: aggiungi i titolari che hanno giocato
    for (const player of titolari) {
        const hasVoto = player.voto_base !== null && player.voto_base > 0;
        if (hasVoto) {
            deployed.push({ ...player, isSubstitute: false });
        } else {
            missingSlots.push(player.ruolo);
        }
    }
    
    // STEP 1: Sostituzioni PARI RUOLO (in ordine di panchina)
    const usedFromPanchina = new Set();
    const unfilledSlots = []; // Slot che non hanno trovato pari ruolo
    
    for (const missingRole of missingSlots) {
        let found = false;
        
        for (const sub of panchina) {
            if (usedFromPanchina.has(sub.calciatore)) continue;
            if (sub.ruolo !== missingRole) continue;
            
            const hasVoto = sub.voto_base !== null && sub.voto_base > 0;
            if (hasVoto) {
                deployed.push({ ...sub, isSubstitute: true });
                usedFromPanchina.add(sub.calciatore);
                found = true;
                break;
            }
        }
        
        if (!found) {
            unfilledSlots.push(missingRole);
        }
    }
    
    // STEP 2: Sostituzioni CROSS-RUOLO con validazione modulo
    // Per gli slot rimasti, cerchiamo combinazioni di panchinari che formano un modulo valido
    if (unfilledSlots.length > 0) {
        // Panchinari disponibili con voto (non ancora usati)
        const availableSubs = panchina.filter(p => 
            !usedFromPanchina.has(p.calciatore) && 
            p.voto_base !== null && p.voto_base > 0
        );
        
        // Trova la combinazione valida che rispetta l'ordine di panchina
        // Usa ricorsione: prova combinazioni di N giocatori dalla panchina (in ordine)
        // e verifica che il modulo risultante sia valido
        const findValidCombination = (available, needed, currentDeployed) => {
            if (needed === 0) {
                // Verifica se la formazione è valida
                const byRole = {
                    D: currentDeployed.filter(p => p.ruolo === 'D').length,
                    C: currentDeployed.filter(p => p.ruolo === 'C').length,
                    A: currentDeployed.filter(p => p.ruolo === 'A').length
                };
                return isValidFormation(byRole.D, byRole.C, byRole.A) ? [] : null;
            }
            
            for (let i = 0; i < available.length; i++) {
                const sub = available[i];
                const newDeployed = [...currentDeployed, sub];
                const remaining = available.slice(i + 1);
                const result = findValidCombination(remaining, needed - 1, newDeployed);
                if (result !== null) {
                    return [sub, ...result];
                }
            }
            
            return null; // Nessuna combinazione valida
        };
        
        const validSubs = findValidCombination(availableSubs, unfilledSlots.length, deployed);
        
        if (validSubs) {
            for (const sub of validSubs) {
                deployed.push({ ...sub, isSubstitute: true });
                usedFromPanchina.add(sub.calciatore);
            }
        }
    }
    
    // Limita a 11 giocatori (1 portiere + 10 di movimento)
    const portiere = deployed.filter(p => p.ruolo === 'P').slice(0, 1);
    const movimento = deployed.filter(p => p.ruolo !== 'P').slice(0, 10);
    const finalDeployed = [...portiere, ...movimento];
    
    // Calcola il punteggio totale usando fantavoto
    const totalPoints = finalDeployed.reduce((sum, p) => sum + (p.fantavoto || 0), 0);
    
    // Calcola il modulo schierato
    const byRole = {
        P: finalDeployed.filter(p => p.ruolo === 'P').length,
        D: finalDeployed.filter(p => p.ruolo === 'D').length,
        C: finalDeployed.filter(p => p.ruolo === 'C').length,
        A: finalDeployed.filter(p => p.ruolo === 'A').length
    };
    
    const formation = `${byRole.D}-${byRole.C}-${byRole.A}`;
    
    return {
        players: finalDeployed,
        totalPoints,
        formation
    };
};

/**
 * Calcola le statistiche di efficacia per una squadra in una giornata
 * @param {Array} formations - Formazioni della squadra per quella giornata
 * @returns {Object} - Statistiche dettagliate
 */
export const calculateCoachEfficiency = (formations) => {
    const deployed = calculateDeployedFormation(formations);
    const optimal = calculateOptimalFormation(formations, deployed);
    
    // Se non ci sono abbastanza dati per calcolare, ritorna null
    if (deployed.players.length === 0 && (!optimal.formation || optimal.totalPoints === 0)) {
        return null;
    }
    
    // Calcola il coefficiente (evita divisione per zero)
    const efficiency = optimal.totalPoints > 0 
        ? (deployed.totalPoints / optimal.totalPoints) * 100 
        : (deployed.totalPoints > 0 ? 100 : 0);
    
    // Trova i calciatori che potevano essere sostituiti
    const deployedNames = new Set(deployed.players.map(p => p.calciatore));
    const optimalNames = new Set(optimal.players.map(p => p.calciatore));
    
    const shouldHavePlayed = optimal.players.filter(p => !deployedNames.has(p.calciatore));
    const shouldNotHavePlayed = deployed.players.filter(p => !optimalNames.has(p.calciatore));
    
    return {
        giornata: formations[0]?.giornata,
        squadra: formations[0]?.squadra,
        deployed: {
            players: deployed.players,
            totalPoints: deployed.totalPoints,
            formation: deployed.formation,
            count: deployed.players.length
        },
        optimal: {
            players: optimal.players,
            totalPoints: optimal.totalPoints,
            formation: optimal.formation,
            count: optimal.players.length
        },
        efficiency: Math.round(efficiency * 100) / 100,
        pointsDifference: optimal.totalPoints - deployed.totalPoints,
        shouldHavePlayed,
        shouldNotHavePlayed
    };
};

/**
 * Calcola le statistiche per tutte le squadre in un range di giornate
 * @param {Array} formations - Tutte le formazioni
 * @param {number} fromGiornata - Giornata iniziale
 * @param {number} toGiornata - Giornata finale
 * @returns {Object} - { bySquad: {}, byGiornata: {}, ranking: [] }
 */
export const calculateAllCoachStats = (formations, fromGiornata, toGiornata) => {
    const bySquad = {};
    const byGiornata = {};
    
    // Filtra per range giornate
    const filtered = formations.filter(f => {
        const g = parseInt(f.giornata);
        return g >= fromGiornata && g <= toGiornata;
    });
    
    // Raggruppa per squadra e giornata
    const grouped = {};
    filtered.forEach(f => {
        const key = `${f.squadra}_${f.giornata}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(f);
    });
    
    // Calcola le statistiche per ogni gruppo
    Object.keys(grouped).forEach(key => {
        const [squadra, giornata] = key.split('_');
        const stats = calculateCoachEfficiency(grouped[key]);
        
        if (stats) {
            // Aggiungi a bySquad
            if (!bySquad[squadra]) {
                bySquad[squadra] = {
                    squadra,
                    giornate: {},
                    totalEfficiency: 0,
                    count: 0
                };
            }
            bySquad[squadra].giornate[giornata] = stats;
            bySquad[squadra].totalEfficiency += stats.efficiency;
            bySquad[squadra].count++;
            
            // Aggiungi a byGiornata
            if (!byGiornata[giornata]) {
                byGiornata[giornata] = {};
            }
            byGiornata[giornata][squadra] = stats;
        }
    });
    
    // Calcola media efficacia per ogni squadra
    Object.keys(bySquad).forEach(squadra => {
        bySquad[squadra].averageEfficiency = bySquad[squadra].count > 0 
            ? Math.round((bySquad[squadra].totalEfficiency / bySquad[squadra].count) * 100) / 100 
            : 0;
    });
    
    // Crea classifica allenatori
    const ranking = Object.values(bySquad)
        .sort((a, b) => b.averageEfficiency - a.averageEfficiency)
        .map((squad, index) => ({
            position: index + 1,
            squadra: squad.squadra,
            averageEfficiency: squad.averageEfficiency,
            giornateAnalizzate: squad.count
        }));
    
    return { bySquad, byGiornata, ranking };
};

/**
 * Rendering della sezione Statistiche Allenatore
 */
export const renderCoachStats = async () => {
    const container = document.getElementById('coach-stats-content');
    if (!container) return;
    
    container.innerHTML = '<p class="text-center text-gray-400 py-8">Caricamento statistiche allenatore...</p>';
    
    try {
        const formations = await loadAllFormations();
        
        if (!formations || formations.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-8">Nessuna formazione caricata. Carica prima i file delle formazioni dalla sezione Admin.</p>';
            return;
        }
        
        const giornate = getAvailableGiornate(formations);
        const squadre = getAvailableSquadre(formations);
        
        if (giornate.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-8">Nessuna giornata disponibile.</p>';
            return;
        }
        
        // Popola i filtri
        populateCoachStatsFilters(giornate, squadre);
        
        // Calcola statistiche per tutte le giornate disponibili
        const fromGiornata = giornate[0];
        const toGiornata = giornate[giornate.length - 1];
        
        // Imposta i valori dei filtri
        document.getElementById('coach-from-giornata').value = fromGiornata;
        document.getElementById('coach-to-giornata').value = toGiornata;
        
        // Calcola e renderizza
        updateCoachStatsDisplay();
        
    } catch (error) {
        console.error('Errore rendering statistiche allenatore:', error);
        container.innerHTML = '<p class="text-center text-red-400 py-8">Errore durante il caricamento delle statistiche.</p>';
    }
};

/**
 * Popola i filtri per le giornate
 */
const populateCoachStatsFilters = (giornate, squadre) => {
    const fromSelect = document.getElementById('coach-from-giornata');
    const toSelect = document.getElementById('coach-to-giornata');
    const squadraSelect = document.getElementById('coach-squadra-filter');
    
    if (fromSelect && toSelect) {
        fromSelect.innerHTML = giornate.map(g => `<option value="${g}">G${g}</option>`).join('');
        toSelect.innerHTML = giornate.map(g => `<option value="${g}">G${g}</option>`).join('');
        toSelect.value = giornate[giornate.length - 1];
    }
    
    if (squadraSelect) {
        squadraSelect.innerHTML = '<option value="all">Tutte le squadre</option>' +
            squadre.map(s => `<option value="${s}">${s}</option>`).join('');
    }
};

/**
 * Aggiorna la visualizzazione delle statistiche in base ai filtri
 */
export const updateCoachStatsDisplay = async () => {
    const container = document.getElementById('coach-stats-content');
    if (!container) return;
    
    const fromGiornata = parseInt(document.getElementById('coach-from-giornata')?.value || 1);
    const toGiornata = parseInt(document.getElementById('coach-to-giornata')?.value || 38);
    const squadraFilter = document.getElementById('coach-squadra-filter')?.value || 'all';
    
    const formations = await loadAllFormations();
    const stats = calculateAllCoachStats(formations, fromGiornata, toGiornata);
    
    // Renderizza la classifica allenatori (sempre visibile)
    let html = renderCoachRanking(stats.ranking, squadraFilter);
    
    // Renderizza la tabella dettagliata per giornata SOLO se è selezionata una squadra
    if (squadraFilter !== 'all') {
        html += renderCoachDetailTable(stats.bySquad, stats.byGiornata, squadraFilter, fromGiornata, toGiornata);
    } else {
        html += `
            <div class="bg-gray-800/50 rounded-lg p-4 text-center">
                <p class="text-gray-400 text-sm">
                    <svg class="w-5 h-5 inline-block mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                    </svg>
                    Seleziona una squadra dal filtro sopra per visualizzare il dettaglio delle giornate.
                </p>
            </div>
        `;
    }
    
    container.innerHTML = html;
};

/**
 * Renderizza la classifica allenatori
 */
const renderCoachRanking = (ranking, squadraFilter) => {
    const filtered = squadraFilter === 'all' 
        ? ranking 
        : ranking.filter(r => r.squadra === squadraFilter);
    
    let html = `
        <div class="mb-6">
            <h4 class="text-lg font-bold text-yellow-400 mb-3 flex items-center gap-2">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/>
                </svg>
                Classifica Allenatori
            </h4>
            
            <!-- Layout Cards per Mobile -->
            <div class="space-y-2">`;
    
    filtered.forEach((coach, index) => {
        const effClass = coach.averageEfficiency >= 95 ? 'text-green-400 bg-green-900/30' 
            : coach.averageEfficiency >= 85 ? 'text-yellow-400 bg-yellow-900/30' 
            : coach.averageEfficiency >= 75 ? 'text-orange-400 bg-orange-900/30' 
            : 'text-red-400 bg-red-900/30';
        
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        const posClass = index < 3 ? 'text-yellow-400' : 'text-gray-400';
        
        html += `
            <div class="bg-gray-800 rounded-lg p-3 border border-gray-700 flex items-center gap-3">
                <!-- Posizione -->
                <div class="flex-shrink-0 w-10 text-center">
                    <span class="text-lg ${posClass} font-bold">${medal || coach.position}</span>
                </div>
                
                <!-- Info Squadra -->
                <div class="flex-1 min-w-0">
                    <div class="font-semibold text-white text-sm leading-tight truncate">${coach.squadra}</div>
                    <div class="text-xs text-gray-500">${coach.giornateAnalizzate} giornate</div>
                </div>
                
                <!-- Efficacia -->
                <div class="flex-shrink-0">
                    <div class="px-3 py-1.5 rounded-lg ${effClass} font-bold text-base">
                        ${coach.averageEfficiency.toFixed(1)}%
                    </div>
                </div>
            </div>`;
    });
    
    html += `</div></div>`;
    
    return html;
};

/**
 * Renderizza la tabella dettagliata per giornata
 */
const renderCoachDetailTable = (bySquad, byGiornata, squadraFilter, fromGiornata, toGiornata) => {
    const giornate = Object.keys(byGiornata).map(Number).sort((a, b) => a - b);
    
    let html = `
        <div class="mb-6">
            <h4 class="text-lg font-bold text-blue-400 mb-3 flex items-center gap-2">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                    <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
                </svg>
                Dettaglio per Giornata
            </h4>`;
    
    // Per ogni giornata mostra le squadre
    giornate.forEach(giornata => {
        const squadre = byGiornata[giornata] || {};
        const squadreList = Object.keys(squadre);
        
        if (squadraFilter !== 'all') {
            if (!squadre[squadraFilter]) return;
        }
        
        html += `
            <div class="mb-4">
                <h5 class="text-md font-semibold text-gray-300 mb-2 bg-gray-700/50 px-3 py-1 rounded">
                    Giornata ${giornata}
                </h5>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">`;
        
        const filteredSquadre = squadraFilter === 'all' 
            ? squadreList 
            : squadreList.filter(s => s === squadraFilter);
        
        filteredSquadre.forEach(squadra => {
            const stat = squadre[squadra];
            if (!stat) return;
            
            const effClass = stat.efficiency >= 95 ? 'bg-green-600' 
                : stat.efficiency >= 85 ? 'bg-yellow-600' 
                : stat.efficiency >= 75 ? 'bg-orange-600' 
                : 'bg-red-600';
            
            html += `
                <div class="bg-gray-800 rounded-lg p-3 border border-gray-700">
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-semibold text-white">${squadra}</span>
                        <span class="px-2 py-0.5 rounded text-xs font-bold text-white ${effClass}">${stat.efficiency.toFixed(1)}%</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-xs mb-2">
                        <div class="bg-gray-700/50 rounded p-2">
                            <span class="text-gray-400">Schierata:</span>
                            <span class="text-white font-bold ml-1">${stat.deployed.totalPoints.toFixed(1)}</span>
                            <span class="text-gray-500 ml-1">(${stat.deployed.formation})</span>
                        </div>
                        <div class="bg-gray-700/50 rounded p-2">
                            <span class="text-gray-400">Ottimale:</span>
                            <span class="text-green-400 font-bold ml-1">${stat.optimal.totalPoints.toFixed(1)}</span>
                            <span class="text-gray-500 ml-1">(${stat.optimal.formation})</span>
                        </div>
                    </div>
                    ${stat.pointsDifference > 0 ? `
                        <div class="text-xs text-red-400">
                            📉 Punti persi: ${stat.pointsDifference.toFixed(1)}
                        </div>
                    ` : `
                        <div class="text-xs text-green-400">
                            ✅ Formazione ottimale!
                        </div>
                    `}
                    <button onclick="showCoachDetail('${squadra}', ${giornata})" class="mt-4 w-full px-4 py-3 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors shadow-md">
                        Vedi dettaglio →
                    </button>
                </div>`;
        });
        
        html += `</div></div>`;
    });
    
    html += `</div>`;
    
    return html;
};

/**
 * Mostra il dettaglio formazione schierata vs ottimale
 */
export const showCoachDetail = async (squadra, giornata) => {
    const formations = await loadAllFormations();
    const squadFormations = formations.filter(f => f.squadra === squadra && parseInt(f.giornata) === parseInt(giornata));
    
    if (squadFormations.length === 0) {
        alert('Formazione non trovata.');
        return;
    }
    
    const stats = calculateCoachEfficiency(squadFormations);
    
    if (!stats) {
        alert('Impossibile calcolare le statistiche per questa formazione.');
        return;
    }
    
    // Crea e mostra il modal
    showCoachDetailModal(stats);
};

/**
 * Mostra il modal con il dettaglio
 */
const showCoachDetailModal = (stats) => {
    // Rimuovi modal esistente se presente
    const existingModal = document.getElementById('coach-detail-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'coach-detail-modal';
    modal.className = 'fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    const deployedByRole = groupPlayersByRole(stats.deployed.players);
    const optimalByRole = groupPlayersByRole(stats.optimal.players);
    
    // Nomi dei calciatori che hanno giocato ma non dovevano
    const shouldNotHavePlayedNames = new Set(stats.shouldNotHavePlayed.map(p => p.calciatore));
    // Nomi dei calciatori che dovevano giocare ma non hanno giocato
    const shouldHavePlayedNames = new Set(stats.shouldHavePlayed.map(p => p.calciatore));
    
    modal.innerHTML = `
        <div class="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div class="sticky top-0 bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
                <h3 class="text-lg font-bold text-white">
                    ${stats.squadra} - Giornata ${stats.giornata}
                </h3>
                <button onclick="document.getElementById('coach-detail-modal').remove()" class="text-gray-400 hover:text-white">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            
            <div class="p-2 md:p-4">
                <!-- Riepilogo - 3 colonne su una riga -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 1.5rem;">
                    <div class="bg-gray-800 rounded p-1.5 md:p-3 text-center">
                        <div class="text-xs text-gray-400">Schierata</div>
                        <div class="text-base md:text-xl font-bold text-white">${stats.deployed.totalPoints.toFixed(1)}</div>
                        <div class="text-xs text-gray-500">${stats.deployed.formation}</div>
                    </div>
                    <div class="bg-gray-800 rounded p-1.5 md:p-3 text-center">
                        <div class="text-xs text-gray-400">Efficacia</div>
                        <div class="text-base md:text-xl font-bold ${stats.efficiency >= 95 ? 'text-green-400' : stats.efficiency >= 85 ? 'text-yellow-400' : 'text-red-400'}">
                            ${stats.efficiency.toFixed(1)}%
                        </div>
                    </div>
                    <div class="bg-gray-800 rounded p-1.5 md:p-3 text-center">
                        <div class="text-xs text-gray-400">Ottimale</div>
                        <div class="text-base md:text-xl font-bold text-green-400">${stats.optimal.totalPoints.toFixed(1)}</div>
                        <div class="text-xs text-gray-500">${stats.optimal.formation}</div>
                    </div>
                </div>
                
                <!-- Confronto formazioni -->
                <div class="grid grid-cols-2 gap-4">
                    <!-- Formazione Schierata -->
                    <div>
                        <h4 class="text-md font-semibold text-amber-400 mb-2 text-center">Formazione Schierata</h4>
                        ${renderFormationList(stats.deployed.players, shouldNotHavePlayedNames, 'deployed')}
                    </div>
                    
                    <!-- Formazione Ottimale -->
                    <div>
                        <h4 class="text-md font-semibold text-green-400 mb-2 text-center">Formazione Ottimale</h4>
                        ${renderFormationList(stats.optimal.players, shouldHavePlayedNames, 'optimal')}
                    </div>
                </div>
                
                <!-- Legenda -->
                <div class="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-400">
                    <span class="inline-block mr-4">🔴 Da non schierare</span>
                    <span class="inline-block mr-4">🟢 Da schierare</span>
                    <span class="inline-block"><span class="text-cyan-400">↑</span> Subentrato</span>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
};

/**
 * Raggruppa i giocatori per ruolo
 */
const groupPlayersByRole = (players) => {
    return {
        P: players.filter(p => p.ruolo === 'P'),
        D: players.filter(p => p.ruolo === 'D'),
        C: players.filter(p => p.ruolo === 'C'),
        A: players.filter(p => p.ruolo === 'A')
    };
};

/**
 * Renderizza la lista formazione
 */
const renderFormationList = (players, highlightNames, type) => {
    const byRole = groupPlayersByRole(players);
    const roleOrder = ['P', 'D', 'C', 'A'];
    const roleNames = { P: 'POR', D: 'DIF', C: 'CEN', A: 'ATT' };
    const roleColors = { P: 'text-yellow-400', D: 'text-green-400', C: 'text-blue-400', A: 'text-red-400' };
    
    let html = '<div class="space-y-1">';
    
    roleOrder.forEach(role => {
        const rolePlayers = byRole[role] || [];
        rolePlayers.forEach(p => {
            const isHighlighted = highlightNames.has(p.calciatore);
            const highlightClass = isHighlighted 
                ? (type === 'deployed' ? 'bg-red-900/30 border-red-500/50' : 'bg-green-900/30 border-green-500/50')
                : 'bg-gray-800 border-gray-700';
            const icon = isHighlighted ? (type === 'deployed' ? '🔴' : '🟢') : '';
            // Indicatore per sostituti dalla panchina
            const subIcon = p.isSubstitute ? '<span class="text-xs text-cyan-400" title="Subentrato dalla panchina">↑</span>' : '';
            
            html += `
                <div class="flex items-center justify-between p-2 rounded border ${highlightClass} text-sm">
                    <div class="flex items-center gap-2">
                        <span class="${roleColors[role]} font-bold text-xs">${roleNames[role]}</span>
                        <span class="text-white">${p.calciatore}</span>
                        ${subIcon}
                        ${icon}
                    </div>
                    <span class="text-gray-300 font-semibold">${p.fantavoto?.toFixed(1) || '-'}</span>
                </div>
            `;
        });
    });
    
    html += '</div>';
    return html;
};

// Esporta funzioni per uso globale
window.renderCoachStats = renderCoachStats;
window.updateCoachStatsDisplay = updateCoachStatsDisplay;
window.showCoachDetail = showCoachDetail;
