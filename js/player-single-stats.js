/**
 * player-single-stats.js - Modulo per statistiche individuali calciatori per giornata
 * Carica i voti dal collection fantabet_votes e mostra stats + grafico per calciatore
 */

import {
    db,
    getDocs,
    query,
    where,
    getVotesCollectionRef,
    getPlayerStatsCollectionRef,
    getPlayersCollectionRef
} from './firebase-config.js';

// ==================== STATE ====================

let allVotes = [];           // Tutti i voti caricati
let allPlayersIndex = [];    // Indice giocatori (codice, nome, ruolo, squadra)
let selectedPlayer = null;   // Giocatore selezionato
let votesChart = null;       // Istanza Chart.js

// ==================== UTILITY ====================

/**
 * Normalizza un nome rimuovendo diacritici e spazi extra
 */
const normalizeName = (name) => {
    return name
        .toLowerCase()
        .trim()
        .normalize('NFD')                  // Decompone i caratteri accentati
        .replace(/[\u0300-\u036f]/g, '')   // Rimuove i diacritici
        .replace(/\s+/g, ' ');             // Normalizza gli spazi
};

// ==================== CARICAMENTO DATI ====================

/**
 * Inizializza la sezione: carica l'indice giocatori e popola il selettore
 */
const initPlayerSingleStats = async () => {
    const container = document.getElementById('player-single-stats-content');
    if (!container) return;

    container.innerHTML = '<p class="text-center text-gray-400 py-8 animate-pulse">Caricamento calciatori...</p>';

    try {
        // Carica tutti i voti da Firebase (una sola volta)
        if (allVotes.length === 0) {
            const votesSnapshot = await getDocs(getVotesCollectionRef());
            allVotes = votesSnapshot.docs.map(doc => doc.data());
            console.log(`[PLAYER-SINGLE] Caricati ${allVotes.length} voti totali`);
        }

        if (allVotes.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <svg class="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <p class="text-gray-400 text-lg font-semibold">Nessun voto disponibile</p>
                    <p class="text-gray-500 text-sm mt-2">Carica i file Excel dei voti dalla sezione Admin per visualizzare le statistiche.</p>
                </div>`;
            return;
        }

        // Costruisci indice univoco giocatori dai voti
        buildPlayersIndex();

        // Popola il selettore
        populatePlayerSelector();

        // Mostra stato iniziale
        container.innerHTML = `
            <div class="text-center py-12">
                <svg class="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
                <p class="text-gray-400 text-lg font-semibold">Seleziona un calciatore</p>
                <p class="text-gray-500 text-sm mt-2">Cerca e seleziona un calciatore per visualizzare le statistiche dettagliate.</p>
            </div>`;

    } catch (error) {
        console.error('[PLAYER-SINGLE] Errore inizializzazione:', error);
        container.innerHTML = `<p class="text-center text-red-400 py-8">Errore nel caricamento: ${error.message}</p>`;
    }
};

/**
 * Costruisce un indice univoco dei giocatori dai voti disponibili
 */
const buildPlayersIndex = () => {
    const playerMap = new Map();

    allVotes.forEach(v => {
        const key = v.codice;
        if (!playerMap.has(key)) {
            playerMap.set(key, {
                codice: v.codice,
                nome: v.nome,
                ruolo: v.ruolo,
                squadraSerieA: v.squadraSerieA
            });
        }
    });

    allPlayersIndex = Array.from(playerMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    console.log(`[PLAYER-SINGLE] Indice giocatori: ${allPlayersIndex.length} calciatori`);
    
    // Debug: mostra i primi 10 e ultimi 10 calciatori per verificare i nomi
    if (allPlayersIndex.length > 0) {
        console.log('[PLAYER-SINGLE] Primi 10 calciatori:', allPlayersIndex.slice(0, 10).map(p => p.nome).join(', '));
        console.log('[PLAYER-SINGLE] Ultimi 10 calciatori:', allPlayersIndex.slice(-10).map(p => p.nome).join(', '));
        
        // Cerca Carnesecchi in particolare per debug
        const carnesecchi = allPlayersIndex.find(p => normalizeName(p.nome).includes('carnesecchi'));
        if (carnesecchi) {
            console.log('[PLAYER-SINGLE] ✅ Carnesecchi trovato:', carnesecchi);
        } else {
            console.log('[PLAYER-SINGLE] ❌ Carnesecchi NON trovato - non ha voti nei file caricati');
        }
    }
};

/**
 * Popola il selettore / autocomplete dei giocatori
 */
const populatePlayerSelector = () => {
    const datalist = document.getElementById('player-single-datalist');
    if (!datalist) return;

    datalist.innerHTML = allPlayersIndex.map(p => {
        const roleLabel = { P: 'POR', D: 'DIF', C: 'CEN', A: 'ATT' }[p.ruolo] || p.ruolo;
        return `<option value="${p.nome}" data-codice="${p.codice}">${p.nome} (${roleLabel} - ${p.squadraSerieA})</option>`;
    }).join('');
};

/**
 * Gestisce la selezione di un calciatore dall'input
 */
const onPlayerSelected = () => {
    const input = document.getElementById('player-single-search');
    const container = document.getElementById('player-single-stats-content');
    if (!input || !container) return;

    const searchValue = input.value.trim();
    if (!searchValue) return;

    const normalizedSearch = normalizeName(searchValue);

    // Trova il giocatore per nome (ricerca esatta normalizzata)
    let player = allPlayersIndex.find(p => normalizeName(p.nome) === normalizedSearch);

    if (!player) {
        // Prova ricerca parziale normalizzata
        player = allPlayersIndex.find(p => normalizeName(p.nome).includes(normalizedSearch));
        
        if (!player) {
            // Nessun giocatore trovato
            container.innerHTML = `
                <div class="text-center py-8">
                    <p class="text-gray-400 mb-2">❌ Calciatore non trovato: <strong>"${searchValue}"</strong></p>
                    <p class="text-gray-500 text-sm">Possibili motivi:</p>
                    <ul class="text-gray-500 text-sm mt-2 space-y-1">
                        <li>• Il calciatore potrebbe non avere voti caricati</li>
                        <li>• Controlla l'ortografia del nome</li>
                        <li>• Usa la lista di autocomplete per selezionare il nome corretto</li>
                    </ul>
                </div>`;
            return;
        }
    }
    
    selectedPlayer = player;
    input.value = player.nome;
    renderPlayerStats();
};

// ==================== RENDERING STATISTICHE ====================

/**
 * Renderizza le statistiche complete del giocatore selezionato
 */
const renderPlayerStats = () => {
    if (!selectedPlayer) return;

    const container = document.getElementById('player-single-stats-content');
    if (!container) return;

    // Filtra i voti del giocatore
    const playerVotes = allVotes
        .filter(v => v.codice === selectedPlayer.codice)
        .sort((a, b) => a.giornata - b.giornata);

    if (playerVotes.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <p class="text-gray-400">Nessun voto trovato per ${selectedPlayer.nome}.</p>
            </div>`;
        return;
    }

    // Calcola statistiche aggregate
    const stats = calculateAggregatedStats(playerVotes);
    const roleInfo = getRoleInfo(selectedPlayer.ruolo);
    const imageUrl = selectedPlayer.codice ? `https://content.fantacalcio.it/web/campioncini/20/card/${selectedPlayer.codice}.png?v=466` : null;

    // Costruisci HTML
    let html = '';

    // === HEADER GIOCATORE ===
    html += `
    <div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border border-${roleInfo.color}-500/30 overflow-hidden mb-6">
        <div class="flex flex-col sm:flex-row items-center gap-4 p-4 sm:p-6">
            <!-- Immagine campioncino -->
            <div class="flex-shrink-0">
                ${imageUrl ? `
                    <img src="${imageUrl}" alt="${selectedPlayer.nome}" 
                         class="w-32 h-40 sm:w-40 sm:h-52 object-cover rounded-xl shadow-2xl border-2 border-${roleInfo.color}-500"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="hidden w-32 h-40 sm:w-40 sm:h-52 bg-gray-700 rounded-xl items-center justify-center border-2 border-${roleInfo.color}-500">
                        <span class="text-5xl text-gray-500">${selectedPlayer.nome.charAt(0)}</span>
                    </div>
                ` : `
                    <div class="w-32 h-40 sm:w-40 sm:h-52 bg-gray-700 rounded-xl flex items-center justify-center border-2 border-${roleInfo.color}-500">
                        <span class="text-5xl text-gray-500">${selectedPlayer.nome.charAt(0)}</span>
                    </div>
                `}
            </div>
            <!-- Info giocatore -->
            <div class="text-center sm:text-left flex-1">
                <h3 class="text-2xl sm:text-3xl font-bold text-white">${selectedPlayer.nome}</h3>
                <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                    <span class="px-3 py-1 rounded-full text-sm font-bold bg-${roleInfo.color}-900/50 text-${roleInfo.color}-300 border border-${roleInfo.color}-500/50">${roleInfo.label}</span>
                    <span class="px-3 py-1 rounded-full text-sm bg-gray-700 text-gray-300">${selectedPlayer.squadraSerieA}</span>
                    <span class="px-3 py-1 rounded-full text-sm bg-gray-700 text-gray-400">ID: ${selectedPlayer.codice}</span>
                </div>
            </div>
        </div>
    </div>`;

    // === STATISTICHE 2025/26 ===
    html += `
    <div class="mb-6">
        <h4 class="text-lg font-bold text-white mb-4">Statistiche 2025/26</h4>
        
        <!-- Card principali -->
        <div class="grid grid-cols-3 gap-3 mb-4">
            <!-- Partite a voto -->
            <div class="bg-gray-800 rounded-xl p-4 text-center border border-gray-700">
                <p class="text-xs text-gray-400 mb-1">Partite a voto</p>
                <div class="flex items-center justify-center gap-2">
                    <span class="text-3xl sm:text-4xl font-bold text-white">${stats.partiteAVoto}</span>
                    <svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>
            </div>
            <!-- Gol -->
            <div class="bg-gray-800 rounded-xl p-4 text-center border border-gray-700">
                <p class="text-xs text-gray-400 mb-1">Gol</p>
                <div class="flex items-center justify-center gap-2">
                    <span class="text-3xl sm:text-4xl font-bold text-white">${stats.golFatti}</span>
                    <span class="text-xl">⚽</span>
                </div>
            </div>
            <!-- Assist -->
            <div class="bg-gray-800 rounded-xl p-4 text-center border border-gray-700">
                <p class="text-xs text-gray-400 mb-1">Assist</p>
                <div class="flex items-center justify-center gap-2">
                    <span class="text-3xl sm:text-4xl font-bold text-white">${stats.assist}</span>
                    <span class="text-xl">👟</span>
                </div>
            </div>
        </div>

        <!-- Dettagli statistiche -->
        <div class="grid grid-cols-2 gap-3">
            ${selectedPlayer.ruolo === 'P' ? `
            <div class="bg-gray-800 rounded-lg p-3 flex items-center justify-between border border-gray-700">
                <span class="text-sm text-gray-400">Gol subiti</span>
                <span class="bg-blue-900/50 text-blue-300 px-3 py-1 rounded-full font-bold text-sm">${stats.golSubiti}</span>
            </div>
            ` : `
            <div class="bg-gray-800 rounded-lg p-3 flex items-center justify-between border border-gray-700">
                <span class="text-sm text-gray-400">Gol casa/trasferta</span>
                <span class="bg-blue-900/50 text-blue-300 px-3 py-1 rounded-full font-bold text-sm">—</span>
            </div>
            `}
            <div class="bg-gray-800 rounded-lg p-3 flex items-center justify-between border border-gray-700">
                <span class="text-sm text-gray-400">Ammonizioni</span>
                <span class="bg-yellow-900/50 text-yellow-300 px-3 py-1 rounded-full font-bold text-sm">${stats.ammonizioni}</span>
            </div>
            <div class="bg-gray-800 rounded-lg p-3 flex items-center justify-between border border-gray-700">
                <span class="text-sm text-gray-400">Rigori segnati/totali</span>
                <span class="bg-blue-900/50 text-blue-300 px-3 py-1 rounded-full font-bold text-sm">${stats.rigoriSegnati}/${stats.rigoriTotali}</span>
            </div>
            <div class="bg-gray-800 rounded-lg p-3 flex items-center justify-between border border-gray-700">
                <span class="text-sm text-gray-400">Espulsioni</span>
                <span class="bg-red-900/50 text-red-300 px-3 py-1 rounded-full font-bold text-sm">${stats.espulsioni}</span>
            </div>
            <div class="bg-gray-800 rounded-lg p-3 flex items-center justify-between border border-gray-700 col-span-2 sm:col-span-1">
                <span class="text-sm text-gray-400">Autoreti</span>
                <span class="bg-gray-700 text-gray-300 px-3 py-1 rounded-full font-bold text-sm">${stats.autoreti}</span>
            </div>
            ${selectedPlayer.ruolo === 'P' ? `
            <div class="bg-gray-800 rounded-lg p-3 flex items-center justify-between border border-gray-700 col-span-2 sm:col-span-1">
                <span class="text-sm text-gray-400">Rigori parati</span>
                <span class="bg-green-900/50 text-green-300 px-3 py-1 rounded-full font-bold text-sm">${stats.rigoriParati}</span>
            </div>
            ` : ''}
        </div>
    </div>`;

    // === MEDIA VOTO ===
    html += `
    <div class="grid grid-cols-2 gap-3 mb-6">
        <div class="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl p-4 text-center border border-blue-500/30">
            <p class="text-xs text-blue-300 mb-1">Media Voto</p>
            <span class="text-3xl font-bold text-blue-400">${stats.mediaVoto}</span>
        </div>
        <div class="bg-gradient-to-br from-teal-900/30 to-teal-800/20 rounded-xl p-4 text-center border border-teal-500/30">
            <p class="text-xs text-teal-300 mb-1">FantaMedia</p>
            <span class="text-3xl font-bold text-teal-400">${stats.fantaMedia}</span>
        </div>
    </div>`;

    // === GRAFICO VOTO E FANTAVOTO ===
    html += `
    <div class="mb-6">
        <h4 class="text-lg font-bold text-white mb-4">Voto e FantaVoto</h4>
        <div class="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <canvas id="player-votes-chart" height="220"></canvas>
        </div>
    </div>`;

    // === TABELLA DETTAGLIO PER GIORNATA ===
    html += `
    <div class="mb-4">
        <h4 class="text-lg font-bold text-white mb-4">Dettaglio per Giornata</h4>
        <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
                <thead class="bg-gray-700">
                    <tr>
                        <th class="px-3 py-2 text-left text-gray-300">G.</th>
                        <th class="px-3 py-2 text-center text-gray-300">Voto</th>
                        <th class="px-3 py-2 text-center text-gray-300">FV</th>
                        <th class="px-3 py-2 text-center text-gray-300">Gf</th>
                        ${selectedPlayer.ruolo === 'P' ? '<th class="px-3 py-2 text-center text-gray-300">Gs</th>' : ''}
                        <th class="px-3 py-2 text-center text-gray-300">Rf</th>
                        <th class="px-3 py-2 text-center text-gray-300">Ass</th>
                        <th class="px-3 py-2 text-center text-gray-300">Amm</th>
                        <th class="px-3 py-2 text-center text-gray-300">Esp</th>
                        ${selectedPlayer.ruolo === 'P' ? '<th class="px-3 py-2 text-center text-gray-300">Rp</th>' : ''}
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-700">`;

    playerVotes.forEach(v => {
        const votoDisplay = v.voto !== null ? v.voto : '<span class="text-gray-500">S.V.</span>';
        const fv = calculateFantaVoto(v);
        const fvDisplay = v.voto !== null ? fv.toFixed(1) : '<span class="text-gray-500">—</span>';
        const votoColor = v.voto !== null ? getVotoColor(v.voto) : '';
        const fvColor = v.voto !== null ? getVotoColor(fv) : '';

        html += `
                    <tr class="hover:bg-gray-700/50">
                        <td class="px-3 py-2 font-semibold text-gray-300">${v.giornata}</td>
                        <td class="px-3 py-2 text-center font-bold ${votoColor}">${votoDisplay}</td>
                        <td class="px-3 py-2 text-center font-bold ${fvColor}">${fvDisplay}</td>
                        <td class="px-3 py-2 text-center ${v.gf > 0 ? 'text-green-400 font-bold' : 'text-gray-500'}">${v.gf || 0}</td>
                        ${selectedPlayer.ruolo === 'P' ? `<td class="px-3 py-2 text-center ${v.gs > 0 ? 'text-red-400 font-bold' : 'text-gray-500'}">${v.gs || 0}</td>` : ''}
                        <td class="px-3 py-2 text-center ${v.rf > 0 ? 'text-green-400 font-bold' : 'text-gray-500'}">${v.rf || 0}</td>
                        <td class="px-3 py-2 text-center ${v.ass > 0 ? 'text-cyan-400 font-bold' : 'text-gray-500'}">${v.ass || 0}</td>
                        <td class="px-3 py-2 text-center ${v.amm > 0 ? 'text-yellow-400 font-bold' : 'text-gray-500'}">${v.amm || 0}</td>
                        <td class="px-3 py-2 text-center ${v.esp > 0 ? 'text-red-400 font-bold' : 'text-gray-500'}">${v.esp || 0}</td>
                        ${selectedPlayer.ruolo === 'P' ? `<td class="px-3 py-2 text-center ${v.rp > 0 ? 'text-green-400 font-bold' : 'text-gray-500'}">${v.rp || 0}</td>` : ''}
                    </tr>`;
    });

    html += `
                </tbody>
            </table>
        </div>
        
        <!-- Legenda colonne -->
        <div class="mt-4 bg-gray-800/50 border border-gray-600/30 rounded-lg p-3">
            <p class="text-xs font-semibold text-teal-400 mb-3">📌 Legenda colonne:</p>
            <div class="grid grid-cols-3 gap-3 text-xs text-gray-400 mb-3">
                <div><span class="font-bold text-gray-300">G.</span> = Giornata</div>
                <div><span class="font-bold text-gray-300">Voto</span> = Voto della giornata</div>
                <div><span class="font-bold text-teal-300">FV</span> = FantaVoto (calcolato)</div>
                
                <div><span class="font-bold text-green-300">Gf</span> = Gol <strong>fatti</strong></div>
                <div><span class="font-bold text-red-300">Gs</span> = Gol <strong>subiti</strong> (portieri)</div>
                <div><span class="font-bold text-green-300">Rf</span> = Rigori <strong>segnati</strong></div>
                
                <div><span class="font-bold text-cyan-300">Ass</span> = <strong>Assist</strong></div>
                <div><span class="font-bold text-yellow-300">Amm</span> = <strong>Ammonizioni</strong></div>
                <div><span class="font-bold text-red-300">Esp</span> = <strong>Espulsioni</strong></div>
                
                <div><span class="font-bold text-green-300">Rp</span> = Rigori <strong>parati</strong> (portieri)</div>
            </div>
            
            <p class="text-xs font-semibold text-teal-400 mb-2">⚙️ Formula FantaVoto:</p>
            <div class="bg-gray-900/50 rounded p-2 font-mono text-xs text-gray-300 space-y-1">
                <div>FV = V + (Gf×3) + (Rf×3) - (Gs×1) + (Ass×1) - (Amm×0.5) - (Esp×1) + (Rp×3) - (Au×1)</div>
                <div class="text-gray-500 mt-1">Dove:</div>
                <div class="text-gray-500">V=Voto | Gf=Gol fatti | Rf=Rigori segnati | Gs=Gol subiti | Ass=Assist | Amm/Esp=Disciplina | Rp=Rigori parati | Au=Autogol</div>
            </div>
        </div>
    </div>`;

    container.innerHTML = html;

    // Renderizza il grafico
    renderVotesChart(playerVotes);
};

// ==================== CALCOLO STATISTICHE ====================

/**
 * Calcola le statistiche aggregate dai voti
 */
const calculateAggregatedStats = (playerVotes) => {
    const votati = playerVotes.filter(v => v.voto !== null);

    // Gol fatti INCLUDE i rigori segnati (Rf)
    const golFatti = playerVotes.reduce((s, v) => s + (v.gf || 0) + (v.rf || 0), 0);
    const golSubiti = playerVotes.reduce((s, v) => s + (v.gs || 0), 0);
    const assist = playerVotes.reduce((s, v) => s + (v.ass || 0), 0);
    const ammonizioni = playerVotes.reduce((s, v) => s + (v.amm || 0), 0);
    const espulsioni = playerVotes.reduce((s, v) => s + (v.esp || 0), 0);
    const autoreti = playerVotes.reduce((s, v) => s + (v.au || 0), 0);
    const rigoriParati = playerVotes.reduce((s, v) => s + (v.rp || 0), 0);
    const rigoriSegnati = playerVotes.reduce((s, v) => s + (v.rf || 0), 0);
    const rigoriCalciati = playerVotes.reduce((s, v) => s + (v.rf || 0) + (v.rs || 0), 0);

    const sumVoti = votati.reduce((s, v) => s + v.voto, 0);
    const mediaVoto = votati.length > 0 ? (sumVoti / votati.length).toFixed(2) : '—';

    // FantaMedia: media dei fantavoti
    const fantaVotiValues = votati.map(v => calculateFantaVoto(v));
    const fantaMedia = fantaVotiValues.length > 0
        ? (fantaVotiValues.reduce((s, fv) => s + fv, 0) / fantaVotiValues.length).toFixed(2)
        : '—';

    return {
        partiteAVoto: votati.length,
        golFatti,
        golSubiti,
        assist,
        ammonizioni,
        espulsioni,
        autoreti,
        rigoriParati,
        rigoriSegnati,
        rigoriTotali: rigoriCalciati,
        mediaVoto,
        fantaMedia
    };
};

/**
 * Calcola il fantavoto di una singola giornata
 * Bonus fantacalcio standard:
 *   +3 per gol (attaccanti/centrocampisti/difensori), -1 per gol subito (portieri)
 *   +1 per assist, -0.5 per ammonizione, -1 per espulsione
 *   +3 per rigore parato, -3 per rigore sbagliato, -1 per autogol
 *   +3 per gol portiere/difensore, +3 per gol centrocampista = standard +3 tutti
 */
const calculateFantaVoto = (v) => {
    if (v.voto === null || v.voto === undefined) return 0;

    let fv = v.voto;
    fv += (v.gf || 0) * 3;       // Gol fatti: +3
    fv += (v.rf || 0) * 3;       // Rigori segnati: +3 (contati come gol)
    fv -= (v.gs || 0) * 1;       // Gol subiti (portieri): -1
    fv += (v.ass || 0) * 1;      // Assist: +1
    fv -= (v.amm || 0) * 0.5;    // Ammonizione: -0.5
    fv -= (v.esp || 0) * 1;      // Espulsione: -1
    fv += (v.rp || 0) * 3;       // Rigori parati: +3
    fv -= (v.au || 0) * 1;       // Autogol: -1

    return fv;
};

// ==================== GRAFICO ====================

/**
 * Renderizza il grafico Chart.js con voto e fantavoto per giornata
 */
const renderVotesChart = (playerVotes) => {
    const canvas = document.getElementById('player-votes-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    // Distruggi grafico precedente
    if (votesChart) {
        votesChart.destroy();
        votesChart = null;
    }

    // Dati per tutte le 38 giornate
    const labels = [];
    const votiData = [];
    const fantaVotiData = [];

    // Mappa giornata -> voto
    const voteMap = new Map();
    playerVotes.forEach(v => voteMap.set(v.giornata, v));

    // Trova max giornata disponibile
    const maxGiornata = Math.max(...playerVotes.map(v => v.giornata), 38);
    const displayMax = Math.min(maxGiornata, 38);

    for (let g = 1; g <= displayMax; g++) {
        labels.push(g);
        const v = voteMap.get(g);
        if (v && v.voto !== null) {
            votiData.push(v.voto);
            fantaVotiData.push(calculateFantaVoto(v));
        } else {
            votiData.push(null);
            fantaVotiData.push(null);
        }
    }

    const ctx = canvas.getContext('2d');

    votesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Voto',
                    data: votiData,
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                    borderRadius: 3,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8,
                    order: 2
                },
                {
                    label: 'FantaVoto',
                    data: fantaVotiData,
                    backgroundColor: 'rgba(20, 184, 166, 0.7)',
                    borderColor: 'rgba(20, 184, 166, 1)',
                    borderWidth: 1,
                    borderRadius: 3,
                    barPercentage: 0.6,
                    categoryPercentage: 0.8,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: '#9CA3AF',
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 20,
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: '#F3F4F6',
                    bodyColor: '#D1D5DB',
                    borderColor: 'rgba(75, 85, 99, 0.5)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        title: (items) => `Giornata ${items[0].label}`,
                        label: (item) => {
                            const val = item.parsed.y;
                            return val !== null ? `${item.dataset.label}: ${val.toFixed(1)}` : '';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(75, 85, 99, 0.3)' },
                    ticks: {
                        color: '#9CA3AF',
                        font: { size: 10 },
                        maxRotation: 0
                    }
                },
                y: {
                    beginAtZero: true,
                    suggestedMax: 16,
                    grid: {
                        color: 'rgba(75, 85, 99, 0.3)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#9CA3AF',
                        font: { size: 11 },
                        stepSize: 2
                    }
                }
            }
        }
    });
};

// ==================== UTILITÀ ====================

const getRoleInfo = (ruolo) => {
    const roles = {
        P: { label: 'Portiere', color: 'yellow' },
        D: { label: 'Difensore', color: 'green' },
        C: { label: 'Centrocampista', color: 'blue' },
        A: { label: 'Attaccante', color: 'red' }
    };
    return roles[ruolo] || { label: ruolo, color: 'gray' };
};

const getVotoColor = (voto) => {
    if (voto >= 7) return 'text-green-400';
    if (voto >= 6) return 'text-blue-300';
    if (voto >= 5.5) return 'text-yellow-400';
    if (voto >= 5) return 'text-orange-400';
    return 'text-red-400';
};

/**
 * Forza il ricaricamento dei dati (utile dopo nuovo upload)
 */
const refreshPlayerSingleStats = () => {
    allVotes = [];
    allPlayersIndex = [];
    selectedPlayer = null;
    const input = document.getElementById('player-single-search');
    if (input) input.value = '';
    initPlayerSingleStats();
};

// ==================== WINDOW EXPORTS ====================

window.initPlayerSingleStats = initPlayerSingleStats;
window.onPlayerSingleSelected = onPlayerSelected;
window.refreshPlayerSingleStats = refreshPlayerSingleStats;

/**
 * Funzione di debug: cerca un calciatore nell'indice
 * Uso: debugSearchPlayer('carnesecchi') nella console
 */
window.debugSearchPlayer = (searchTerm) => {
    if (allPlayersIndex.length === 0) {
        console.log('❌ Nessun calciatore caricato ancora. Accedi prima alla sezione "Statistiche Calciatori Singoli"');
        return;
    }
    
    const normalized = normalizeName(searchTerm);
    const matches = allPlayersIndex.filter(p => 
        normalizeName(p.nome).includes(normalized) ||
        p.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (matches.length === 0) {
        console.log(`❌ NON trovato: "${searchTerm}"`);
        console.log(`📊 Indice contiene ${allPlayersIndex.length} calciatori totali`);
        console.log('Esempi:', allPlayersIndex.slice(0, 5).map(p => p.nome).join(', '));
        
        // Debug avanzato: cerca nel raw dei voti
        console.log('\n🔍 Ricerca nei voti RAW (non normalizzati):');
        const rawMatches = allVotes.filter(v => 
            v.nome && v.nome.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (rawMatches.length > 0) {
            console.log(`⚠️ Trovati ${rawMatches.length} voti per "${searchTerm}":`);
            // Raggruppa per codice e nome
            const grouped = new Map();
            rawMatches.forEach(v => {
                const key = `${v.codice}`;
                if (!grouped.has(key)) {
                    grouped.set(key, {
                        codice: v.codice,
                        nome: v.nome,
                        ruolo: v.ruolo,
                        squadra: v.squadraSerieA,
                        voti: 0
                    });
                }
                grouped.get(key).voti++;
            });
            grouped.forEach(g => {
                console.log(`   • ${g.nome} (${g.ruolo} - ${g.squadra}) ID:${g.codice} - ${g.voti} voti`);
            });
        } else {
            console.log(`❌ Nemmeno nei voti RAW`);
        }
    } else {
        console.log(`✅ Trovati ${matches.length} calciatore(i) per "${searchTerm}":`);
        matches.forEach(p => {
            console.log(`   • ${p.nome} (${p.ruolo} - ${p.squadraSerieA}) - ID: ${p.codice}`);
        });
    }
};

/**
 * Debug: mostra tutti i calciatori per squadra
 */
window.debugPlayersByTeam = (teamName) => {
    if (allPlayersIndex.length === 0) {
        console.log('❌ Nessun calciatore caricato');
        return;
    }
    
    const matches = allPlayersIndex.filter(p => 
        p.squadraSerieA.toLowerCase().includes(teamName.toLowerCase())
    );
    
    console.log(`📋 ${matches.length} calciatori di "${teamName}":`);
    matches.forEach(p => {
        console.log(`   • ${p.nome} (${p.ruolo}) ID:${p.codice}`);
    });
};
