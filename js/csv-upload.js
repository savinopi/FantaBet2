/**
 * csv-upload.js - Modulo per gestione upload file CSV
 * Calendario campionato, rose, statistiche
 */

import { 
    db,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    setDoc,
    updateDoc,
    getDoc,
    query,
    limit,
    where,
    getResultsCollectionRef,
    getMatchesCollectionRef,
    getScheduleCollectionRef,
    getPlayersCollectionRef,
    getSquadsCollectionRef,
    getPlayerStatsCollectionRef,
    getTeamsCollectionRef,
    getFormationsCollectionRef,
    getVotesCollectionRef
} from './firebase-config.js';
import { messageBox, showProgressBar, hideProgressBar, updateProgressBar, updateProgress } from './utils.js';
import { getIsUserAdmin } from './auth.js';
import { getAllTeams, getAllResults, setAllResults } from './state.js';

// Variabili per il contenuto CSV caricato
let localCsvContent = null;
let selectedStatsFile = null;
let selectedStatsXlsxFile = null; // File XLSX statistiche
let selectedCalendarXlsxFile = null; // File XLSX calendario
let selectedSquadsXlsxFile = null; // File XLSX rose
let selectedFormationsXlsxFile = null; // File XLSX formazioni

// Coda file formazioni per upload multiplo
let formationsXlsxQueue = [];
let formationsQueueProcessing = false;

// Coda file voti per upload multiplo
let votesXlsxQueue = [];
let votesQueueProcessing = false;

// Dipendenze esterne da settare
let renderHistoricResults = null;
let processCsvContent = null;
let loadActiveGiornata = null;

/**
 * Imposta le dipendenze esterne
 */
export const setCsvUploadDependencies = (deps) => {
    if (deps.renderHistoricResults) renderHistoricResults = deps.renderHistoricResults;
    if (deps.processCsvContent) processCsvContent = deps.processCsvContent;
    if (deps.loadActiveGiornata) loadActiveGiornata = deps.loadActiveGiornata;
};

// ==================== CALENDARIO CAMPIONATO ====================

/**
 * Apre il dialog per selezionare il file CSV
 */
export const triggerFileInput = () => {
    document.getElementById('csv-file-input').click();
};

/**
 * Gestisce la selezione del file CSV
 */
export const handleFileSelect = () => {
    console.log('handleFileSelect chiamato');
    const fileInput = document.getElementById('csv-file-input');
    console.log('Input file trovato:', !!fileInput);
    
    const file = fileInput?.files[0];
    console.log('File selezionato:', file ? {
        nome: file.name,
        tipo: file.type,
        dimensione: file.size
    } : 'nessun file');
    
    const fileNameDisplay = document.getElementById('file-name-display');
    const uploadButton = document.getElementById('upload-button');
    
    console.log('Elementi UI trovati:', {
        fileNameDisplay: !!fileNameDisplay,
        uploadButton: !!uploadButton
    });

    if (file) {
        if (fileNameDisplay) fileNameDisplay.textContent = file.name;
        if (uploadButton) {
            uploadButton.disabled = false;
            uploadButton.classList.remove('btn-secondary');
            uploadButton.classList.add('btn-primary');
        }
        console.log('File selezionato correttamente, UI aggiornata');
    } else {
        if (fileNameDisplay) fileNameDisplay.textContent = 'Nessun file selezionato.';
        if (uploadButton) {
            uploadButton.disabled = true;
            uploadButton.classList.add('btn-secondary');
            uploadButton.classList.remove('btn-primary');
        }
        console.log('Nessun file selezionato, UI resettata');
    }
};

/**
 * Conferma il caricamento del file CSV
 */
export const confirmUpload = async () => {
    console.log('confirmUpload chiamato');
    const isUserAdmin = getIsUserAdmin();
    
    if (!isUserAdmin) {
        console.warn('Tentativo di upload da utente non admin');
        messageBox("Solo gli admin possono caricare file.");
        return;
    }

    const fileInput = document.getElementById('csv-file-input');
    const file = fileInput?.files[0];
    
    console.log('Stato file:', {
        inputTrovato: !!fileInput,
        fileTrovato: !!file,
        dettagliFile: file ? {
            nome: file.name,
            tipo: file.type,
            dimensione: file.size
        } : null
    });

    if (!file) {
        messageBox("Seleziona un file prima di caricarlo.");
        return;
    }

    try {
        // Check if data already exists
        console.log('Verifica dati esistenti...');
        const q = query(getResultsCollectionRef(), limit(1));
        const snapshot = await getDocs(q);
        console.log('Snapshot risultati:', {
            vuoto: snapshot.empty,
            numeroDoc: snapshot.size
        });
        
        let confirmationMessage = "Sei sicuro di voler caricare il file? Eventuali dati esistenti verranno sovrascritti.";

        if (snapshot.empty) {
            confirmationMessage = "Sei sicuro di voler procedere con il caricamento del file?";
        }

        console.log('Richiesta conferma utente');
        if (confirm(confirmationMessage)) {
            console.log('Utente ha confermato, avvio processamento');
            processNewFile();
        } else {
            console.log('Utente ha annullato');
        }
    } catch (error) {
        console.error('Errore durante la verifica dei dati esistenti:', error);
        messageBox("Errore durante la verifica dei dati: " + error.message);
    }
};

/**
 * Processa il nuovo file CSV selezionato
 */
export const processNewFile = () => {
    console.log('processNewFile chiamato');
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) {
        console.warn('Utente non admin, caricamento non permesso');
        return;
    }
    
    const fileInput = document.getElementById('csv-file-input');
    console.log('File input trovato:', !!fileInput);
    
    const file = fileInput.files[0];
    console.log('File selezionato:', file ? {
        nome: file.name,
        tipo: file.type,
        dimensione: file.size
    } : 'nessun file');
    
    const fileNameDisplay = document.getElementById('file-name-display');
    console.log('Display elemento trovato:', !!fileNameDisplay);

    if (!file) {
        if (fileNameDisplay) fileNameDisplay.textContent = 'Nessun file selezionato.';
        console.warn('Nessun file selezionato');
        return;
    }

    if (fileNameDisplay) fileNameDisplay.textContent = file.name;

    const reader = new FileReader();
    reader.onload = async (e) => {
        console.log('File letto con successo');
        localCsvContent = e.target.result;
        console.log('Contenuto CSV (primi 200 caratteri):', localCsvContent.substring(0, 200));
        try {
            if (processCsvContent) {
                await processCsvContent(localCsvContent);
            } else {
                console.error('processCsvContent non è stato settato');
                messageBox("Errore interno: funzione di processamento non disponibile");
            }
        } catch (error) {
            console.error('Errore durante il processamento del CSV:', error);
            messageBox("Errore durante l'elaborazione del file: " + error.message);
        }
    };
    reader.onerror = (error) => {
        console.error('Errore nella lettura del file:', error);
        messageBox("Errore nella lettura del file: " + error);
    };
    
    console.log('Inizio lettura file...');
    reader.readAsText(file);
};

/**
 * Processa dati caricati da file pre-esistente
 */
export const processUploadedData = async (fileName) => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return;
    
    // Se non ho ancora caricato localCsvContent dal file picker, 
    // cerco di recuperare il contenuto dal file pre-caricato dell'ambiente
    if (!localCsvContent) {
        if (typeof window.__file_contents !== 'undefined' && window.__file_contents[fileName]) {
            localCsvContent = window.__file_contents[fileName];
        } else {
            messageBox(`Il contenuto del file "${fileName}" non è disponibile per l'auto-caricamento. Carica il file manualmente.`);
            return;
        }
    }
    
    if (processCsvContent) {
        await processCsvContent(localCsvContent);
    }
};

// ==================== CALENDARIO DA EXCEL (XLSX) ====================

/**
 * Apre il dialog per selezionare il file Excel del calendario
 */
export const triggerCalendarXlsxFileInput = () => {
    document.getElementById('calendar-xlsx-file-input').click();
};

/**
 * Gestisce la selezione del file Excel del calendario
 */
export const handleCalendarXlsxFileSelect = () => {
    const fileInput = document.getElementById('calendar-xlsx-file-input');
    const fileNameDisplay = document.getElementById('calendar-xlsx-file-name-display');
    const uploadButton = document.getElementById('upload-calendar-xlsx-button');
    
    if (fileInput.files.length > 0) {
        selectedCalendarXlsxFile = fileInput.files[0];
        fileNameDisplay.textContent = selectedCalendarXlsxFile.name;
        uploadButton.disabled = false;
        uploadButton.classList.remove('btn-secondary');
        uploadButton.classList.add('btn-primary');
    } else {
        selectedCalendarXlsxFile = null;
        fileNameDisplay.textContent = 'Nessun file selezionato.';
        uploadButton.disabled = true;
        uploadButton.classList.remove('btn-primary');
        uploadButton.classList.add('btn-secondary');
    }
};

/**
 * Conferma il caricamento del calendario da Excel
 */
export const confirmCalendarXlsxUpload = () => {
    if (!selectedCalendarXlsxFile) {
        messageBox('Seleziona un file Excel prima di procedere.');
        return;
    }
    
    if (confirm(`Confermi il caricamento del calendario dal file "${selectedCalendarXlsxFile.name}"?\n\nATTENZIONE: I dati del calendario precedenti verranno sovrascritti.`)) {
        processCalendarXlsxFile();
    }
};

/**
 * Processa il file Excel del calendario usando SheetJS
 * Il file ha layout a doppia colonna:
 * - Riga 1: Titolo
 * - Riga 2: URL lega
 * - Riga 3: vuota
 * - Da riga 4: blocchi giornate (intestazione + 5 partite)
 * - Colonne A-E: giornate dispari (1,3,5...)
 * - Colonne G-K: giornate pari (2,4,6...)
 */
export const processCalendarXlsxFile = async () => {
    if (!selectedCalendarXlsxFile) {
        messageBox('Nessun file selezionato.');
        return;
    }
    
    const uploadButton = document.getElementById('upload-calendar-xlsx-button');
    uploadButton.disabled = true;
    uploadButton.textContent = 'Caricamento...';
    
    // Mostra progress bar
    const progressContainer = document.getElementById('calendar-xlsx-progress');
    if (progressContainer) progressContainer.classList.remove('hidden');
    
    try {
        updateProgress(5, 'Lettura file Excel...', null, null, 'calendar-xlsx-progress');
        
        // Leggi il file Excel con SheetJS
        const arrayBuffer = await selectedCalendarXlsxFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // Cerca il foglio "Calendario", altrimenti usa il primo foglio
        let sheetName = 'Calendario';
        if (!workbook.Sheets[sheetName]) {
            console.warn('Foglio "Calendario" non trovato, uso il primo foglio disponibile');
            sheetName = workbook.SheetNames[0];
        }
        const worksheet = workbook.Sheets[sheetName];
        
        // Converti in array di array (righe)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        console.log('Excel Calendario caricato:', {
            foglio: sheetName,
            righe: jsonData.length
        });
        
        updateProgress(10, 'Parsing giornate...', null, null, 'calendar-xlsx-progress');
        
        // Struttura dati per le partite
        const allMatches = []; // { giornata, homeTeam, homePoints, awayPoints, awayTeam, score }
        const teamNames = new Set();
        
        // Parsing del file - inizia dalla riga 4 (indice 3)
        let currentGiornataLeft = null;
        let currentGiornataRight = null;
        
        for (let i = 3; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;
            
            // Controlla se è una riga intestazione giornata (contiene "Giornata lega")
            const cellA = String(row[0] || '').trim();
            const cellG = String(row[6] || '').trim();
            
            // Colonna sinistra (A) - cerca "Xª Giornata lega"
            if (cellA.includes('Giornata lega')) {
                const matchNum = cellA.match(/(\d+)ª?\s*Giornata/i);
                if (matchNum) {
                    currentGiornataLeft = matchNum[1];
                    console.log(`Trovata giornata sinistra: ${currentGiornataLeft}`);
                }
            }
            
            // Colonna destra (G) - cerca "Xª Giornata lega"
            if (cellG.includes('Giornata lega')) {
                const matchNum = cellG.match(/(\d+)ª?\s*Giornata/i);
                if (matchNum) {
                    currentGiornataRight = matchNum[1];
                    console.log(`Trovata giornata destra: ${currentGiornataRight}`);
                }
            }
            
            // Se la cella A non contiene "Giornata" ma ha una squadra, è una partita
            // Layout partita sinistra: A=Casa, B=P.Casa, C=P.Ospite, D=Ospite, E=Risultato
            if (currentGiornataLeft && cellA && !cellA.includes('Giornata')) {
                const homeTeam = cellA;
                const homePoints = parseFloat(row[1]) || 0;
                const awayPoints = parseFloat(row[2]) || 0;
                const awayTeam = String(row[3] || '').trim();
                const score = String(row[4] || '').trim();
                
                if (homeTeam && awayTeam) {
                    allMatches.push({
                        giornata: currentGiornataLeft,
                        homeTeam,
                        homePoints,
                        awayPoints,
                        awayTeam,
                        score: score || '-'
                    });
                    teamNames.add(homeTeam);
                    teamNames.add(awayTeam);
                }
            }
            
            // Layout partita destra: G=Casa, H=P.Casa, I=P.Ospite, J=Ospite, K=Risultato
            if (currentGiornataRight && cellG && !cellG.includes('Giornata')) {
                const homeTeam = cellG;
                const homePoints = parseFloat(row[7]) || 0;
                const awayPoints = parseFloat(row[8]) || 0;
                const awayTeam = String(row[9] || '').trim();
                const score = String(row[10] || '').trim();
                
                if (homeTeam && awayTeam) {
                    allMatches.push({
                        giornata: currentGiornataRight,
                        homeTeam,
                        homePoints,
                        awayPoints,
                        awayTeam,
                        score: score || '-'
                    });
                    teamNames.add(homeTeam);
                    teamNames.add(awayTeam);
                }
            }
        }
        
        console.log(`Parsing completato: ${allMatches.length} partite trovate, ${teamNames.size} squadre`);
        updateProgress(30, `Trovate ${allMatches.length} partite...`, null, null, 'calendar-xlsx-progress');
        
        // Separa partite giocate da quelle aperte
        const resultsBatch = []; // Partite giocate (con risultato)
        const matchesBatch = []; // Partite da aprire (score = '-')
        
        for (const match of allMatches) {
            if (match.score === '-' || match.score === '') {
                // Partita da aprire
                matchesBatch.push({
                    homeTeam: match.homeTeam,
                    awayTeam: match.awayTeam,
                    giornata: match.giornata,
                    status: 'open',
                    score: null,
                    createdAt: new Date().toISOString()
                });
            } else if (match.score.includes('-')) {
                // Partita giocata
                const [homeGoals, awayGoals] = match.score.split('-').map(g => parseInt(g.trim(), 10));
                let result = null;
                
                if (!isNaN(homeGoals) && !isNaN(awayGoals)) {
                    if (homeGoals > awayGoals) result = '1';
                    else if (homeGoals < awayGoals) result = '2';
                    else result = 'X';
                    
                    resultsBatch.push({
                        homeTeam: match.homeTeam,
                        awayTeam: match.awayTeam,
                        homePoints: match.homePoints,
                        awayPoints: match.awayPoints,
                        result,
                        score: match.score,
                        giornata: match.giornata,
                        status: 'closed',
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }
        
        console.log(`Partite giocate: ${resultsBatch.length}, Partite aperte: ${matchesBatch.length}`);
        
        // Salva le squadre
        updateProgress(40, 'Salvataggio squadre...', null, null, 'calendar-xlsx-progress');
        
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
        
        // Salva i risultati (partite giocate)
        updateProgress(55, 'Salvataggio risultati storici...', null, null, 'calendar-xlsx-progress');
        
        for (let i = 0; i < resultsBatch.length; i++) {
            const res = resultsBatch[i];
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
            
            if (i % 10 === 0) {
                const progress = 55 + Math.floor((i / resultsBatch.length) * 20);
                updateProgress(progress, `Salvati ${i + 1}/${resultsBatch.length} risultati...`, null, null, 'calendar-xlsx-progress');
            }
        }
        
        // Aggiorna partite aperte
        updateProgress(80, 'Aggiornamento partite aperte...', null, null, 'calendar-xlsx-progress');
        
        // Rimuovi partite aperte vecchie
        const matchesRef = getMatchesCollectionRef();
        const oldMatches = await getDocs(query(matchesRef, where('status', '==', 'open')));
        
        for (const docSnapshot of oldMatches.docs) {
            await deleteDoc(docSnapshot.ref);
        }
        
        // Aggiungi nuove partite aperte
        updateProgress(90, 'Creazione nuove partite...', null, null, 'calendar-xlsx-progress');
        
        for (let i = 0; i < matchesBatch.length; i++) {
            await addDoc(matchesRef, matchesBatch[i]);
        }
        
        updateProgress(100, 'Completato!', null, null, 'calendar-xlsx-progress');
        
        messageBox(`Calendario caricato da Excel!\n\n✅ ${teamNames.size} squadre\n✅ ${resultsBatch.length} risultati storici\n✅ ${matchesBatch.length} partite aperte`);
        
        // Reset UI dopo 2 secondi
        setTimeout(() => {
            uploadButton.disabled = false;
            uploadButton.textContent = 'Carica Calendario da Excel';
            if (progressContainer) progressContainer.classList.add('hidden');
            
            // Ricarica la pagina per aggiornare i dati
            if (confirm('Calendario caricato! Vuoi ricaricare la pagina per vedere i nuovi dati?')) {
                window.location.reload();
            }
        }, 2000);
        
    } catch (error) {
        console.error('Errore durante il caricamento del calendario da Excel:', error);
        messageBox('Errore durante il caricamento: ' + error.message);
        uploadButton.disabled = false;
        uploadButton.textContent = 'Carica Calendario da Excel';
        if (progressContainer) progressContainer.classList.add('hidden');
    }
};

// ==================== ROSE (SQUADS) ====================

/**
 * Apre il dialog per selezionare il file CSV delle rose
 */
export const triggerSquadsFileInput = () => {
    document.getElementById('squads-csv-file-input').click();
};

/**
 * Gestisce la selezione del file CSV delle rose
 */
export const handleSquadsFileSelect = () => {
    const fileInput = document.getElementById('squads-csv-file-input');
    const file = fileInput?.files[0];
    
    const fileNameDisplay = document.getElementById('squads-file-name-display');
    const uploadButton = document.getElementById('upload-squads-button');

    if (file) {
        if (fileNameDisplay) fileNameDisplay.textContent = file.name;
        if (uploadButton) {
            uploadButton.disabled = false;
            uploadButton.classList.remove('btn-secondary');
            uploadButton.classList.add('btn-primary');
        }
    } else {
        if (fileNameDisplay) fileNameDisplay.textContent = 'Nessun file selezionato.';
        if (uploadButton) {
            uploadButton.disabled = true;
            uploadButton.classList.add('btn-secondary');
            uploadButton.classList.remove('btn-primary');
        }
    }
};

/**
 * Conferma il caricamento delle rose
 */
export const confirmSquadsUpload = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) {
        messageBox("Solo gli admin possono caricare le rose.");
        return;
    }

    const fileInput = document.getElementById('squads-csv-file-input');
    const file = fileInput?.files[0];

    if (!file) {
        messageBox("Seleziona un file prima di caricarlo.");
        return;
    }

    if (confirm("Sei sicuro di voler caricare le rose? I dati esistenti verranno sovrascritti.")) {
        processSquadsFile();
    }
};

/**
 * Processa il file CSV delle rose
 */
export const processSquadsFile = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) return;

    const fileInput = document.getElementById('squads-csv-file-input');
    const file = fileInput?.files[0];

    if (!file) {
        messageBox("Nessun file selezionato.");
        return;
    }

    showProgressBar('Caricamento rose in corso...');

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const text = e.target.result;
            const lines = text.split('\n').map(line => line.trim()).filter(line => line);
            
            if (lines.length === 0) {
                hideProgressBar();
                messageBox("Il file CSV è vuoto.");
                return;
            }

            // Carica prima le statistiche per ottenere i playerId
            updateProgress(10, 'Caricamento IDs dai dati statistici...');
            const statsCollection = getPlayerStatsCollectionRef();
            const statsSnapshot = await getDocs(statsCollection);
            const playerIdMap = new Map(); // Nome normalizzato -> playerId
            
            statsSnapshot.forEach(doc => {
                const stat = doc.data();
                const normalizedName = (stat.playerName || '').trim().toLowerCase();
                playerIdMap.set(normalizedName, stat.playerId);
            });
            
            console.log(`IDs caricati: ${playerIdMap.size} giocatori trovati`);
            // Debug: mostra alcuni nomi caricati
            const sampleNames = Array.from(playerIdMap.entries()).slice(0, 3);
            console.log('Esempio nomi da statistiche:', sampleNames);

            // Parse CSV: Squadra;Ruolo;Calciatore;Squadra (Serie A);Costo
            const players = [];
            const squads = new Map(); // squadra -> array di giocatori
            
            let processedLines = 0;
            
            for (const line of lines) {
                const columns = line.split(';').map(col => col.trim().replace(/^["']|["']$/g, ''));
                
                // Salta righe vuote o incomplete
                if (columns.length < 5) continue;
                if (!columns[0] || !columns[1] || !columns[2]) continue;
                
                const squadName = columns[0];
                const role = columns[1];
                const playerName = columns[2];
                const serieATeam = columns[3];
                const cost = parseFloat(columns[4]) || 0;
                
                // Salta intestazioni o righe non valide
                if (role === 'Ruolo' || squadName === 'Squadra') continue;
                if (!squadName || squadName.includes('Crediti Residui')) continue;
                
                // Cerca l'ID del giocatore
                const normalizedName = playerName.trim().toLowerCase();
                const playerId = playerIdMap.get(normalizedName);
                
                const playerData = {
                    squadName: squadName,
                    role: role,
                    playerName: playerName,
                    serieATeam: serieATeam,
                    cost: cost,
                    playerId: playerId || null  // Aggiungi l'ID se trovato
                };
                
                players.push(playerData);
                
                // Raggruppa per squadra
                if (!squads.has(squadName)) {
                    squads.set(squadName, []);
                }
                squads.get(squadName).push(playerData);
                
                processedLines++;
                
                // Aggiorna progress bar
                if (processedLines % 10 === 0) {
                    const progress = Math.min(50, (processedLines / lines.length) * 40);
                    updateProgress(10 + progress, `Processate ${processedLines} righe...`);
                }
            }
            
            console.log('Rose parsate:', { 
                totaleGiocatori: players.length, 
                numeroSquadre: squads.size,
                giocatoriConId: players.filter(p => p.playerId).length
            });
            
            // Debug: Mostra alcuni giocatori con e senza ID
            const playersWithId = players.filter(p => p.playerId);
            const playersWithoutId = players.filter(p => !p.playerId);
            if (playersWithId.length > 0) {
                console.log('Esempio giocatore CON ID:', playersWithId[0]);
            }
            if (playersWithoutId.length > 0) {
                console.log('Esempio giocatore SENZA ID:', playersWithoutId[0]);
                console.log(`Totale giocatori senza ID: ${playersWithoutId.length}`);
            }
            
            updateProgress(50, 'Salvataggio giocatori in corso...');
            
            // Salva i giocatori in Firestore
            const playersCollection = getPlayersCollectionRef();
            
            // Prima cancella tutti i giocatori esistenti
            const existingPlayersSnapshot = await getDocs(playersCollection);
            const deletePromises = existingPlayersSnapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
            
            updateProgress(60, 'Salvataggio nuovi giocatori...');
            
            // Salva i nuovi giocatori
            let savedCount = 0;
            for (const player of players) {
                await addDoc(playersCollection, player);
                savedCount++;
                
                if (savedCount % 20 === 0) {
                    const progress = 60 + (savedCount / players.length) * 30;
                    updateProgress(progress, `Salvati ${savedCount}/${players.length} giocatori...`);
                }
            }
            
            updateProgress(90, 'Salvataggio informazioni squadre...');
            
            // Salva le informazioni aggregate per squadra
            const squadsCollection = getSquadsCollectionRef();
            
            // Cancella squadre esistenti
            const existingSquadsSnapshot = await getDocs(squadsCollection);
            const deleteSquadsPromises = existingSquadsSnapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deleteSquadsPromises);
            
            // Salva nuove squadre
            for (const [squadName, squadPlayers] of squads.entries()) {
                const squadData = {
                    name: squadName,
                    playerCount: squadPlayers.length,
                    totalCost: squadPlayers.reduce((sum, p) => sum + p.cost, 0),
                    roles: {
                        P: squadPlayers.filter(p => p.role === 'P').length,
                        D: squadPlayers.filter(p => p.role === 'D').length,
                        C: squadPlayers.filter(p => p.role === 'C').length,
                        A: squadPlayers.filter(p => p.role === 'A').length
                    }
                };
                await addDoc(squadsCollection, squadData);
            }
            
            updateProgress(100, 'Completato!');
            
            // Mostra riepilogo
            renderSquadsData(squads);
            
            hideProgressBar();
            messageBox(`Rose caricate con successo!\n\nSquadre: ${squads.size}\nGiocatori totali: ${players.length}`);
            
        } catch (error) {
            console.error('Errore durante il processamento del file rose:', error);
            hideProgressBar();
            messageBox("Errore durante il caricamento: " + error.message);
        }
    };

    reader.onerror = () => {
        hideProgressBar();
        messageBox("Errore nella lettura del file.");
    };

    reader.readAsText(file, 'UTF-8');
};

/**
 * Renderizza i dati delle rose caricate
 */
const renderSquadsData = (squadsMap) => {
    const container = document.getElementById('squads-data-container');
    if (!container) return;
    
    let html = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">';
    
    for (const [squadName, players] of squadsMap.entries()) {
        const totalCost = players.reduce((sum, p) => sum + p.cost, 0);
        const roles = {
            P: players.filter(p => p.role === 'P').length,
            D: players.filter(p => p.role === 'D').length,
            C: players.filter(p => p.role === 'C').length,
            A: players.filter(p => p.role === 'A').length
        };
        
        html += `
            <div class="bg-gray-800 border border-purple-700/50 rounded-lg p-4">
                <h5 class="text-lg font-bold text-purple-400 mb-2">${squadName}</h5>
                <div class="text-sm text-gray-300 space-y-1">
                    <p>Giocatori: <span class="font-bold">${players.length}</span></p>
                    <p>Costo totale: <span class="font-bold text-yellow-400">${totalCost}</span></p>
                    <div class="flex justify-between mt-2 pt-2 border-t border-gray-700">
                        <span>P: ${roles.P}</span>
                        <span>D: ${roles.D}</span>
                        <span>C: ${roles.C}</span>
                        <span>A: ${roles.A}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
};

// ==================== ROSE DA EXCEL (XLSX) ====================

/**
 * Apre il dialog per selezionare il file Excel delle rose
 */
export const triggerSquadsXlsxFileInput = () => {
    document.getElementById('squads-xlsx-file-input').click();
};

/**
 * Gestisce la selezione del file Excel delle rose
 */
export const handleSquadsXlsxFileSelect = () => {
    const fileInput = document.getElementById('squads-xlsx-file-input');
    const fileNameDisplay = document.getElementById('squads-xlsx-file-name-display');
    const uploadButton = document.getElementById('upload-squads-xlsx-button');
    
    if (fileInput.files.length > 0) {
        selectedSquadsXlsxFile = fileInput.files[0];
        fileNameDisplay.textContent = selectedSquadsXlsxFile.name;
        uploadButton.disabled = false;
        uploadButton.classList.remove('btn-secondary');
        uploadButton.classList.add('btn-primary');
    } else {
        selectedSquadsXlsxFile = null;
        fileNameDisplay.textContent = 'Nessun file selezionato.';
        uploadButton.disabled = true;
        uploadButton.classList.remove('btn-primary');
        uploadButton.classList.add('btn-secondary');
    }
};

/**
 * Conferma il caricamento delle rose da Excel
 */
export const confirmSquadsXlsxUpload = () => {
    if (!selectedSquadsXlsxFile) {
        messageBox('Seleziona un file Excel prima di procedere.');
        return;
    }
    
    if (confirm(`Confermi il caricamento delle rose dal file "${selectedSquadsXlsxFile.name}"?\n\nATTENZIONE: Le rose precedenti verranno sovrascritte.`)) {
        processSquadsXlsxFile();
    }
};

/**
 * Processa il file Excel delle rose usando SheetJS
 * Layout a doppia colonna:
 * - Riga 1: Titolo
 * - Riga 2: URL
 * - Riga 3: Note
 * - Riga 4: Vuota
 * - Da riga 5: Blocchi squadre (nome squadra + header + calciatori + crediti residui)
 * - Colonne A-D: squadre dispari
 * - Colonne F-I: squadre pari
 */
export const processSquadsXlsxFile = async () => {
    if (!selectedSquadsXlsxFile) {
        messageBox('Nessun file selezionato.');
        return;
    }
    
    const uploadButton = document.getElementById('upload-squads-xlsx-button');
    uploadButton.disabled = true;
    uploadButton.textContent = 'Caricamento...';
    
    // Mostra progress bar
    const progressContainer = document.getElementById('squads-xlsx-progress');
    if (progressContainer) progressContainer.classList.remove('hidden');
    
    try {
        updateProgress(5, 'Lettura file Excel...', null, null, 'squads-xlsx-progress');
        
        // Leggi il file Excel con SheetJS
        const arrayBuffer = await selectedSquadsXlsxFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // Cerca il foglio "TutteLeRose", altrimenti usa il primo foglio
        let sheetName = 'TutteLeRose';
        if (!workbook.Sheets[sheetName]) {
            console.warn('Foglio "TutteLeRose" non trovato, uso il primo foglio disponibile');
            sheetName = workbook.SheetNames[0];
        }
        const worksheet = workbook.Sheets[sheetName];
        
        // Converti in array di array (righe)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        console.log('Excel Rose caricato:', {
            foglio: sheetName,
            righe: jsonData.length
        });
        
        updateProgress(10, 'Caricamento IDs dai dati statistici...', null, null, 'squads-xlsx-progress');
        
        // Carica prima le statistiche per ottenere i playerId
        const statsCollection = getPlayerStatsCollectionRef();
        const statsSnapshot = await getDocs(statsCollection);
        const playerIdMap = new Map(); // Nome normalizzato -> playerId
        
        statsSnapshot.forEach(doc => {
            const stat = doc.data();
            const normalizedName = (stat.playerName || '').trim().toLowerCase();
            playerIdMap.set(normalizedName, stat.playerId);
        });
        
        console.log(`[DEBUG ROSE] IDs caricati: ${playerIdMap.size} giocatori trovati`);
        console.log('[DEBUG ROSE] Primi 10 nomi caricati:', Array.from(playerIdMap.keys()).slice(0, 10));
        
        updateProgress(20, 'Parsing rose...', null, null, 'squads-xlsx-progress');
        
        // Struttura per raccogliere i dati
        const players = [];
        const squads = new Map(); // squadra -> array di giocatori
        
        // Stato parser per le due colonne
        let currentSquadLeft = null;
        let currentSquadRight = null;
        let playersLeftCount = 0;
        let playersRightCount = 0;
        let isHeaderRowLeft = false;
        let isHeaderRowRight = false;
        
        // Parsing del file - inizia dalla riga 5 (indice 4)
        for (let i = 4; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;
            
            const cellA = String(row[0] || '').trim();
            const cellF = String(row[5] || '').trim();
            
            // === Colonna SINISTRA (A-D) ===
            
            // Controlla se è "Crediti Residui" - fine blocco squadra
            if (cellA.includes('Crediti Residui')) {
                // Se la squadra non ha calciatori, la ignoriamo (squadra vuota)
                if (currentSquadLeft && playersLeftCount === 0) {
                    console.log(`Squadra "${currentSquadLeft}" ignorata (nessun calciatore)`);
                    squads.delete(currentSquadLeft);
                }
                currentSquadLeft = null;
                playersLeftCount = 0;
                isHeaderRowLeft = false;
            }
            // Controlla se è la riga header "Ruolo"
            else if (cellA === 'Ruolo') {
                isHeaderRowLeft = true;
            }
            // Controlla se è un ruolo valido (P/D/C/A) = è un calciatore
            else if (['P', 'D', 'C', 'A'].includes(cellA) && currentSquadLeft) {
                const role = cellA;
                const playerName = String(row[1] || '').trim();
                const serieATeam = String(row[2] || '').trim();
                const cost = parseFloat(row[3]) || 0;
                
                if (playerName) {
                    const normalizedName = playerName.trim().toLowerCase();
                    const playerId = playerIdMap.get(normalizedName);
                    
                    const playerData = {
                        squadName: currentSquadLeft,
                        role: role,
                        playerName: playerName,
                        serieATeam: serieATeam,
                        cost: cost,
                        playerId: playerId || null
                    };
                    
                    players.push(playerData);
                    squads.get(currentSquadLeft).push(playerData);
                    playersLeftCount++;
                }
            }
            // Altrimenti potrebbe essere il nome di una squadra
            else if (cellA && !cellA.includes('Rose lega') && !cellA.includes('http') && !cellA.includes('Calciatori non') && cellA !== 'Ruolo') {
                // Nuova squadra a sinistra
                currentSquadLeft = cellA;
                playersLeftCount = 0;
                isHeaderRowLeft = false;
                if (!squads.has(currentSquadLeft)) {
                    squads.set(currentSquadLeft, []);
                }
            }
            
            // === Colonna DESTRA (F-I) ===
            
            // Controlla se è "Crediti Residui" - fine blocco squadra
            if (cellF.includes('Crediti Residui')) {
                // Se la squadra non ha calciatori, la ignoriamo (squadra vuota)
                if (currentSquadRight && playersRightCount === 0) {
                    console.log(`Squadra "${currentSquadRight}" ignorata (nessun calciatore)`);
                    squads.delete(currentSquadRight);
                }
                currentSquadRight = null;
                playersRightCount = 0;
                isHeaderRowRight = false;
            }
            // Controlla se è la riga header "Ruolo"
            else if (cellF === 'Ruolo') {
                isHeaderRowRight = true;
            }
            // Controlla se è un ruolo valido (P/D/C/A) = è un calciatore
            else if (['P', 'D', 'C', 'A'].includes(cellF) && currentSquadRight) {
                const role = cellF;
                const playerName = String(row[6] || '').trim();
                const serieATeam = String(row[7] || '').trim();
                const cost = parseFloat(row[8]) || 0;
                
                if (playerName) {
                    const normalizedName = playerName.trim().toLowerCase();
                    const playerId = playerIdMap.get(normalizedName);
                    
                    const playerData = {
                        squadName: currentSquadRight,
                        role: role,
                        playerName: playerName,
                        serieATeam: serieATeam,
                        cost: cost,
                        playerId: playerId || null
                    };
                    
                    players.push(playerData);
                    squads.get(currentSquadRight).push(playerData);
                    playersRightCount++;
                }
            }
            // Altrimenti potrebbe essere il nome di una squadra
            else if (cellF && !cellF.includes('Rose lega') && !cellF.includes('http') && !cellF.includes('Calciatori non') && cellF !== 'Ruolo') {
                // Nuova squadra a destra
                currentSquadRight = cellF;
                playersRightCount = 0;
                isHeaderRowRight = false;
                if (!squads.has(currentSquadRight)) {
                    squads.set(currentSquadRight, []);
                }
            }
        }
        
        // Controllo finale per squadre vuote rimaste
        if (currentSquadLeft && playersLeftCount === 0) {
            console.log(`Squadra "${currentSquadLeft}" ignorata (nessun calciatore)`);
            squads.delete(currentSquadLeft);
        }
        if (currentSquadRight && playersRightCount === 0) {
            console.log(`Squadra "${currentSquadRight}" ignorata (nessun calciatore)`);
            squads.delete(currentSquadRight);
        }
        
        console.log('[DEBUG ROSE] Rose parsate:', { 
            totaleGiocatori: players.length, 
            numeroSquadre: squads.size,
            giocatoriConId: players.filter(p => p.playerId).length
        });
        
        // Debug: Mostra i giocatori di ogni squadra
        for (const [squadName, squadPlayers] of squads.entries()) {
            console.log(`[DEBUG ROSE] Squadra "${squadName}": ${squadPlayers.length} giocatori`);
            if (squadPlayers.length > 0) {
                console.log(`  Primi giocatori: ${squadPlayers.slice(0, 3).map(p => p.playerName).join(', ')}`);
            }
        }
        
        // Debug: Controlla se Moreo è presente
        const moreoPlayer = players.find(p => p.playerName.toLowerCase().includes('moreo'));
        if (moreoPlayer) {
            console.log(`[DEBUG ROSE] ✅ MOREO TROVATO nella squadra: ${moreoPlayer.squadName}`, moreoPlayer);
        } else {
            console.log('[DEBUG ROSE] ⚠️ MOREO NON TROVATO nel file Excel!');
        }
        
        updateProgress(40, 'Cancellazione rose precedenti...', null, null, 'squads-xlsx-progress');
        
        // Salva i giocatori in Firestore
        const playersCollection = getPlayersCollectionRef();
        
        // Prima cancella tutti i giocatori esistenti
        const existingPlayersSnapshot = await getDocs(playersCollection);
        const deletePromises = existingPlayersSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        
        updateProgress(50, 'Salvataggio nuovi giocatori...', null, null, 'squads-xlsx-progress');
        
        // Salva i nuovi giocatori
        let savedCount = 0;
        for (const player of players) {
            console.log(`[DEBUG ROSE] Salvando giocatore: ${player.playerName} -> Squadra: ${player.squadName}`);
            await addDoc(playersCollection, player);
            savedCount++;
            
            if (savedCount % 20 === 0) {
                const progress = 50 + (savedCount / players.length) * 30;
                updateProgress(progress, `Salvati ${savedCount}/${players.length} giocatori...`, null, null, 'squads-xlsx-progress');
            }
        }
        
        updateProgress(85, 'Salvataggio informazioni squadre...', null, null, 'squads-xlsx-progress');
        
        // Salva le informazioni aggregate per squadra
        const squadsCollection = getSquadsCollectionRef();
        
        // Cancella squadre esistenti
        const existingSquadsSnapshot = await getDocs(squadsCollection);
        const deleteSquadsPromises = existingSquadsSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deleteSquadsPromises);
        
        // Salva nuove squadre
        for (const [squadName, squadPlayers] of squads.entries()) {
            const squadData = {
                name: squadName,
                playerCount: squadPlayers.length,
                totalCost: squadPlayers.reduce((sum, p) => sum + p.cost, 0),
                roles: {
                    P: squadPlayers.filter(p => p.role === 'P').length,
                    D: squadPlayers.filter(p => p.role === 'D').length,
                    C: squadPlayers.filter(p => p.role === 'C').length,
                    A: squadPlayers.filter(p => p.role === 'A').length
                }
            };
            await addDoc(squadsCollection, squadData);
        }
        
        updateProgress(100, 'Completato!', null, null, 'squads-xlsx-progress');
        
        // Mostra riepilogo
        renderSquadsData(squads);
        
        console.log('[DEBUG ROSE] ✅ Caricamento completato! Squadre salvate in Firebase:', Array.from(squads.keys()));
        messageBox(`Rose caricate da Excel!\n\n✅ ${squads.size} squadre\n✅ ${players.length} giocatori totali\n✅ ${players.filter(p => p.playerId).length} con ID statistiche`);
        
        // Reset UI dopo 2 secondi
        setTimeout(() => {
            uploadButton.disabled = false;
            uploadButton.textContent = 'Carica Rose da Excel';
            if (progressContainer) progressContainer.classList.add('hidden');
        }, 2000);
        
    } catch (error) {
        console.error('Errore durante il caricamento delle rose da Excel:', error);
        messageBox('Errore durante il caricamento: ' + error.message);
        uploadButton.disabled = false;
        uploadButton.textContent = 'Carica Rose da Excel';
        if (progressContainer) progressContainer.classList.add('hidden');
    }
};

// ==================== STATISTICHE CALCIATORI ====================

/**
 * Apre il dialog per selezionare il file CSV delle statistiche
 */
export const triggerStatsFileInput = () => {
    document.getElementById('stats-csv-file-input').click();
};

/**
 * Gestisce la selezione del file CSV delle statistiche
 */
export const handleStatsFileSelect = () => {
    const fileInput = document.getElementById('stats-csv-file-input');
    const fileNameDisplay = document.getElementById('stats-file-name-display');
    const uploadButton = document.getElementById('upload-stats-button');
    
    if (fileInput.files.length > 0) {
        selectedStatsFile = fileInput.files[0];
        fileNameDisplay.textContent = selectedStatsFile.name;
        uploadButton.disabled = false;
        uploadButton.classList.remove('btn-secondary');
        uploadButton.classList.add('btn-primary');
    } else {
        selectedStatsFile = null;
        fileNameDisplay.textContent = 'Nessun file selezionato.';
        uploadButton.disabled = true;
        uploadButton.classList.remove('btn-primary');
        uploadButton.classList.add('btn-secondary');
    }
};

/**
 * Conferma il caricamento delle statistiche
 */
export const confirmStatsUpload = () => {
    if (!selectedStatsFile) {
        messageBox('Seleziona un file CSV prima di procedere.');
        return;
    }
    
    if (confirm(`Confermi il caricamento delle statistiche dal file "${selectedStatsFile.name}"?\n\nATTENZIONE: Le statistiche precedenti verranno sovrascritte.`)) {
        processStatsFile();
    }
};

/**
 * Processa il file CSV delle statistiche
 */
export const processStatsFile = async () => {
    if (!selectedStatsFile) {
        messageBox('Nessun file selezionato.');
        return;
    }
    
    const uploadButton = document.getElementById('upload-stats-button');
    uploadButton.disabled = true;
    uploadButton.textContent = 'Caricamento...';
    
    try {
        const text = await selectedStatsFile.text();
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
            throw new Error('File CSV vuoto o non valido.');
        }
        
        // Parse delle statistiche
        const stats = [];
        const playersCollection = getPlayersCollectionRef();
        const statsCollection = getPlayerStatsCollectionRef();
        
        // Carica tutte le rose per associare i calciatori alle squadre fantacalcio
        updateProgress(0, 'Caricamento rose...', null, null, 'stats-progress');
        const playersSnapshot = await getDocs(playersCollection);
        const playerToSquadMap = new Map(); // Nome calciatore -> Rosa fantacalcio
        
        playersSnapshot.forEach(doc => {
            const player = doc.data();
            // Chiave: nome calciatore normalizzato
            const normalizedName = player.playerName.trim().toLowerCase();
            playerToSquadMap.set(normalizedName, player.squadName);
        });
        
        console.log(`[DEBUG STATS] Rose caricate da Firebase: ${playerToSquadMap.size} calciatori trovati`);
        console.log('[DEBUG STATS] Primi 10 calciatori caricati dalle rose:', Array.from(playerToSquadMap.entries()).slice(0, 10));
        const moreoInRose = playerToSquadMap.get('moreo');
        console.log(`[DEBUG STATS] Moreo nelle rose Firebase: ${moreoInRose ? 'SÌ (' + moreoInRose + ')' : 'NO'}`);
        
        // Parsing del CSV (salta l'header)
        let validLines = 0;
        let skippedLines = 0;
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const columns = line.split(';').map(col => col.trim().replace(/^["']|["']$/g, ''));
            
            // Verifica che ci siano abbastanza colonne (17 colonne)
            if (columns.length < 17) {
                console.warn(`Riga ${i} ignorata: colonne insufficienti (${columns.length}/17)`, columns);
                skippedLines++;
                continue;
            }
            
            const playerName = columns[2].trim();
            const normalizedName = playerName.toLowerCase();
            const fantaSquad = playerToSquadMap.get(normalizedName) || 'SVINCOLATI';
            
            // Debug per Moreo
            if (playerName.toLowerCase().includes('moreo')) {
                console.log(`[DEBUG STATS] MOREO trovato nelle statistiche CSV: fantaSquad=${fantaSquad}`, {playerName, normalizedName});
            }
            
            const statData = {
                playerId: columns[0],
                role: columns[1],
                playerName: playerName,
                serieATeam: columns[3],
                fantaSquad: fantaSquad,
                pv: parseFloat(columns[4]) || 0,
                mv: parseFloat(columns[5]) || 0,
                fm: parseFloat(columns[6]) || 0,
                gf: parseInt(columns[7]) || 0,
                gs: parseInt(columns[8]) || 0,
                rp: parseInt(columns[9]) || 0,
                rc: parseInt(columns[10]) || 0,
                rPlus: parseInt(columns[11]) || 0,
                rMinus: parseInt(columns[12]) || 0,
                ass: parseInt(columns[13]) || 0,
                amm: parseInt(columns[14]) || 0,
                esp: parseInt(columns[15]) || 0,
                au: parseInt(columns[16]) || 0,
                lastUpdate: new Date().toISOString()
            };
            
            stats.push(statData);
            validLines++;
            
            // Progress update ogni 50 righe
            if (validLines % 50 === 0) {
                const progress = Math.floor((validLines / (lines.length - 1)) * 50);
                updateProgress(progress, `Parsing: ${validLines} calciatori...`, null, null, 'stats-progress');
            }
        }
        
        console.log(`Parsing completato: ${validLines} statistiche valide, ${skippedLines} righe ignorate`);
        updateProgress(50, `Cancellazione statistiche precedenti...`, null, null, 'stats-progress');
        
        // Cancella tutte le statistiche esistenti
        const existingStatsSnapshot = await getDocs(statsCollection);
        const deletePromises = existingStatsSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        
        console.log(`${deletePromises.length} statistiche precedenti cancellate`);
        updateProgress(60, `Salvataggio nuove statistiche...`, null, null, 'stats-progress');
        
        // Salva le nuove statistiche
        for (let i = 0; i < stats.length; i++) {
            await addDoc(statsCollection, stats[i]);
            
            // Progress update ogni 20 salvataggi
            if (i % 20 === 0 || i === stats.length - 1) {
                const progress = 60 + Math.floor((i / stats.length) * 40);
                updateProgress(progress, `Salvate ${i + 1}/${stats.length} statistiche...`, null, null, 'stats-progress');
            }
        }
        
        updateProgress(100, 'Completato!', null, null, 'stats-progress');
        messageBox(`Statistiche caricate con successo! ${validLines} calciatori aggiornati.`);
        
        // Mostra riepilogo
        renderStatsSummary(stats);
        
        // Reset UI
        setTimeout(() => {
            uploadButton.disabled = false;
            uploadButton.textContent = 'Carica Statistiche';
        }, 2000);
        
    } catch (error) {
        console.error('Errore durante il caricamento delle statistiche:', error);
        messageBox('Errore durante il caricamento: ' + error.message);
        uploadButton.disabled = false;
        uploadButton.textContent = 'Carica Statistiche';
    }
};

// ==================== STATISTICHE DA EXCEL (XLSX) ====================

/**
 * Apre il dialog per selezionare il file Excel delle statistiche
 */
export const triggerStatsXlsxFileInput = () => {
    document.getElementById('stats-xlsx-file-input').click();
};

/**
 * Gestisce la selezione del file Excel delle statistiche
 */
export const handleStatsXlsxFileSelect = () => {
    const fileInput = document.getElementById('stats-xlsx-file-input');
    const fileNameDisplay = document.getElementById('stats-xlsx-file-name-display');
    const uploadButton = document.getElementById('upload-stats-xlsx-button');
    
    if (fileInput.files.length > 0) {
        selectedStatsXlsxFile = fileInput.files[0];
        fileNameDisplay.textContent = selectedStatsXlsxFile.name;
        uploadButton.disabled = false;
        uploadButton.classList.remove('btn-secondary');
        uploadButton.classList.add('btn-primary');
    } else {
        selectedStatsXlsxFile = null;
        fileNameDisplay.textContent = 'Nessun file selezionato.';
        uploadButton.disabled = true;
        uploadButton.classList.remove('btn-primary');
        uploadButton.classList.add('btn-secondary');
    }
};

/**
 * Conferma il caricamento delle statistiche da Excel
 */
export const confirmStatsXlsxUpload = () => {
    if (!selectedStatsXlsxFile) {
        messageBox('Seleziona un file Excel prima di procedere.');
        return;
    }
    
    if (confirm(`Confermi il caricamento delle statistiche dal file "${selectedStatsXlsxFile.name}"?\n\nATTENZIONE: Le statistiche precedenti verranno sovrascritte.`)) {
        processStatsXlsxFile();
    }
};

/**
 * Processa il file Excel delle statistiche usando SheetJS
 */
export const processStatsXlsxFile = async () => {
    if (!selectedStatsXlsxFile) {
        messageBox('Nessun file selezionato.');
        return;
    }
    
    const uploadButton = document.getElementById('upload-stats-xlsx-button');
    uploadButton.disabled = true;
    uploadButton.textContent = 'Caricamento...';
    
    try {
        // Leggi il file Excel con SheetJS
        const arrayBuffer = await selectedStatsXlsxFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // Cerca il foglio "Tutti", altrimenti usa il primo foglio
        let sheetName = 'Tutti';
        if (!workbook.Sheets[sheetName]) {
            console.warn('Foglio "Tutti" non trovato, uso il primo foglio disponibile');
            sheetName = workbook.SheetNames[0];
        }
        const worksheet = workbook.Sheets[sheetName];
        
        // Converti in array di array (righe)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        // Il file ha: Riga 1 = Titolo, Riga 2 = Intestazioni, Dati da Riga 3
        // Quindi servono almeno 3 righe (indici 0, 1, 2+)
        if (jsonData.length < 3) {
            throw new Error('File Excel vuoto o non valido. Deve contenere almeno il titolo, le intestazioni e una riga di dati.');
        }
        
        console.log('Excel caricato:', {
            foglio: sheetName,
            righe: jsonData.length,
            colonne: jsonData[1]?.length,
            intestazioni: jsonData[1] // Riga 2 = intestazioni (indice 1)
        });
        
        // Parse delle statistiche
        const stats = [];
        const playersCollection = getPlayersCollectionRef();
        const statsCollection = getPlayerStatsCollectionRef();
        
        // Carica tutte le rose per associare i calciatori alle squadre fantacalcio
        updateProgress(0, 'Caricamento rose...', null, null, 'stats-progress');
        const playersSnapshot = await getDocs(playersCollection);
        const playerToSquadMap = new Map(); // Nome calciatore -> Rosa fantacalcio
        
        playersSnapshot.forEach(doc => {
            const player = doc.data();
            // Chiave: nome calciatore normalizzato
            const normalizedName = player.playerName.trim().toLowerCase();
            playerToSquadMap.set(normalizedName, player.squadName);
        });
        
        console.log(`[DEBUG STATS XLSX] Rose caricate da Firebase: ${playerToSquadMap.size} calciatori trovati`);
        console.log('[DEBUG STATS XLSX] Primi 10 calciatori:', Array.from(playerToSquadMap.entries()).slice(0, 10));
        const moreoInRose = playerToSquadMap.get('moreo');
        console.log(`[DEBUG STATS XLSX] Moreo nelle rose Firebase: ${moreoInRose ? 'SÌ (' + moreoInRose + ')' : 'NO'}`);
        
        // Parsing del file Excel
        // Riga 0 = Titolo (ignorata), Riga 1 = Intestazioni (ignorata), Dati da Riga 2+
        // Colonne Excel: A=Id, B=R, C=Rm(IGNORATA), D=Nome, E=Squadra, F=Pv, G=Mv, H=Fm, I=Gf, J=Gs, K=Rp, L=Rc, M=R+, N=R-, O=Ass, P=Amm, Q=Esp, R=Au
        // Indici:        0=Id, 1=R, 2=Rm(IGNORATA), 3=Nome, 4=Squadra, 5=Pv, 6=Mv, 7=Fm, 8=Gf, 9=Gs, 10=Rp, 11=Rc, 12=R+, 13=R-, 14=Ass, 15=Amm, 16=Esp, 17=Au
        let validLines = 0;
        let skippedLines = 0;
        
        for (let i = 2; i < jsonData.length; i++) { // Inizia da indice 2 (riga 3 Excel)
            const row = jsonData[i];
            if (!row || row.length === 0) continue;
            
            // Verifica che ci siano abbastanza colonne (18 colonne: A-R)
            if (row.length < 18) {
                console.warn(`Riga ${i + 1} ignorata: colonne insufficienti (${row.length}/18)`, row);
                skippedLines++;
                continue;
            }
            
            // Colonna D (indice 3) = Nome
            const playerName = String(row[3] || '').trim();
            if (!playerName) {
                skippedLines++;
                continue;
            }
            
            const normalizedName = playerName.toLowerCase();
            const fantaSquad = playerToSquadMap.get(normalizedName) || 'SVINCOLATI';
            
            // Debug per Moreo
            if (playerName.toLowerCase().includes('moreo')) {
                console.log(`[DEBUG STATS XLSX] MOREO trovato nelle statistiche XLSX: fantaSquad=${fantaSquad}`, {playerName, normalizedName});
            }
            
            // Mappatura colonne (ignorando colonna C=Rm)
            const statData = {
                playerId: String(row[0] || ''),      // A = Id
                role: String(row[1] || ''),          // B = R (ruolo)
                // row[2] = Rm (IGNORATA)
                playerName: playerName,              // D = Nome
                serieATeam: String(row[4] || ''),    // E = Squadra
                fantaSquad: fantaSquad,
                pv: parseFloat(row[5]) || 0,         // F = Pv
                mv: parseFloat(row[6]) || 0,         // G = Mv
                fm: parseFloat(row[7]) || 0,         // H = Fm
                gf: parseInt(row[8]) || 0,           // I = Gf
                gs: parseInt(row[9]) || 0,           // J = Gs
                rp: parseInt(row[10]) || 0,          // K = Rp
                rc: parseInt(row[11]) || 0,          // L = Rc
                rPlus: parseInt(row[12]) || 0,       // M = R+
                rMinus: parseInt(row[13]) || 0,      // N = R-
                ass: parseInt(row[14]) || 0,         // O = Ass
                amm: parseInt(row[15]) || 0,         // P = Amm
                esp: parseInt(row[16]) || 0,         // Q = Esp
                au: parseInt(row[17]) || 0,          // R = Au
                lastUpdate: new Date().toISOString()
            };
            
            stats.push(statData);
            validLines++;
            
            // Progress update ogni 50 righe
            if (validLines % 50 === 0) {
                const progress = Math.floor((validLines / (jsonData.length - 2)) * 50); // -2 perché saltiamo titolo e intestazioni
                updateProgress(progress, `Parsing: ${validLines} calciatori...`, null, null, 'stats-progress');
            }
        }
        
        console.log(`Parsing completato: ${validLines} statistiche valide, ${skippedLines} righe ignorate`);
        updateProgress(50, `Cancellazione statistiche precedenti...`, null, null, 'stats-progress');
        
        // Cancella tutte le statistiche esistenti
        const existingStatsSnapshot = await getDocs(statsCollection);
        const deletePromises = existingStatsSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        
        console.log(`${deletePromises.length} statistiche precedenti cancellate`);
        updateProgress(60, `Salvataggio nuove statistiche...`, null, null, 'stats-progress');
        
        // Salva le nuove statistiche
        for (let i = 0; i < stats.length; i++) {
            await addDoc(statsCollection, stats[i]);
            
            // Progress update ogni 20 salvataggi
            if (i % 20 === 0 || i === stats.length - 1) {
                const progress = 60 + Math.floor((i / stats.length) * 40);
                updateProgress(progress, `Salvate ${i + 1}/${stats.length} statistiche...`, null, null, 'stats-progress');
            }
        }
        
        updateProgress(100, 'Completato!', null, null, 'stats-progress');
        messageBox(`Statistiche caricate con successo da Excel! ${validLines} calciatori aggiornati.`);
        
        // Mostra riepilogo
        renderStatsSummary(stats);
        
        // Reset UI
        setTimeout(() => {
            uploadButton.disabled = false;
            uploadButton.textContent = 'Carica da Excel';
        }, 2000);
        
    } catch (error) {
        console.error('Errore durante il caricamento delle statistiche da Excel:', error);
        messageBox('Errore durante il caricamento: ' + error.message);
        uploadButton.disabled = false;
        uploadButton.textContent = 'Carica da Excel';
    }
};

/**
 * Renderizza il riepilogo delle statistiche caricate
 */
const renderStatsSummary = (stats) => {
    const container = document.getElementById('stats-summary-container');
    if (!container) return;
    
    // Raggruppa per rosa fantacalcio
    const squadStats = new Map();
    stats.forEach(stat => {
        if (!squadStats.has(stat.fantaSquad)) {
            squadStats.set(stat.fantaSquad, []);
        }
        squadStats.get(stat.fantaSquad).push(stat);
    });
    
    let html = '<div class="bg-gray-800 border border-blue-700/50 rounded-lg p-4 mb-4">';
    html += '<h5 class="text-lg font-bold text-blue-400 mb-3">Riepilogo Statistiche Caricate</h5>';
    html += '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">';
    
    // Ordina le squadre alfabeticamente
    const sortedSquads = Array.from(squadStats.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    
    for (const [squadName, players] of sortedSquads) {
        const totalPv = players.reduce((sum, p) => sum + p.pv, 0);
        const avgFm = players.length > 0 ? (players.reduce((sum, p) => sum + p.fm, 0) / players.length).toFixed(2) : '0.00';
        
        html += `
            <div class="bg-gray-700 rounded p-3 text-center">
                <p class="text-sm font-bold text-white">${squadName}</p>
                <p class="text-xs text-gray-400 mt-1">${players.length} giocatori</p>
                <p class="text-xs text-blue-300">PV tot: ${totalPv}</p>
                <p class="text-xs text-green-300">FM media: ${avgFm}</p>
            </div>
        `;
    }
    
    html += '</div></div>';
    container.innerHTML = html;
};

// ==================== FORMAZIONI GIORNATE ====================

/**
 * Apre il dialog per selezionare il file CSV delle formazioni
 */
export const triggerFormationsFileInput = () => {
    document.getElementById('formations-csv-file-input').click();
};

/**
 * Gestisce la selezione del file CSV delle formazioni
 */
export const handleFormationsFileSelect = () => {
    const fileInput = document.getElementById('formations-csv-file-input');
    const fileNameDisplay = document.getElementById('formations-file-name-display');
    const uploadButton = document.getElementById('upload-formations-button');

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        fileNameDisplay.textContent = file.name;
        uploadButton.disabled = false;
        uploadButton.classList.remove('btn-secondary');
        uploadButton.classList.add('btn-primary');
    } else {
        fileNameDisplay.textContent = 'Nessun file selezionato.';
        uploadButton.disabled = true;
        uploadButton.classList.add('btn-secondary');
        uploadButton.classList.remove('btn-primary');
    }
};

/**
 * Conferma il caricamento delle formazioni
 */
export const confirmFormationsUpload = async () => {
    const isUserAdmin = getIsUserAdmin();
    if (!isUserAdmin) {
        messageBox("Solo gli admin possono caricare le formazioni.");
        return;
    }

    const fileInput = document.getElementById('formations-csv-file-input');
    const file = fileInput?.files[0];

    if (!file) {
        messageBox("Seleziona un file prima di caricarlo.");
        return;
    }

    if (confirm("Sei sicuro di voler caricare le formazioni? I dati esistenti per questa giornata verranno sovrascritti.")) {
        processFormationsFile();
    }
};

/**
 * Processa il file CSV delle formazioni
 */
export const processFormationsFile = async () => {
    const fileInput = document.getElementById('formations-csv-file-input');
    const file = fileInput?.files[0];

    if (!file) {
        messageBox("Nessun file selezionato.");
        return;
    }

    const uploadButton = document.getElementById('upload-formations-button');
    uploadButton.disabled = true;
    uploadButton.textContent = 'Caricamento...';

    showProgressBar('Caricamento formazioni in corso...');

    try {
        const text = await file.text();
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);

        if (lines.length === 0) {
            throw new Error('File CSV vuoto.');
        }

        updateProgress(10, 'Parsing CSV...');

        // Parse CSV - Tracciato: giornata;match_id;squadra;avversario;lato;punteggio_match;formazione;sezione;ruolo;calciatore;voto_base;fantavoto;ha_giocato;fantavoto_in_verde;record_tipo;bonus_nome;bonus_valore
        const formazioni = [];
        const bonuses = []; // Per i bonus squadra (record_tipo === MODIFICATORE)
        const giornateSet = new Set();
        const squadreSet = new Set();
        let processedLines = 0;
        const ordinePerSquadraCSV = {}; // Per preservare l'ordine dei calciatori

        // Salta header
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;

            const columns = line.split(';').map(col => col.trim().replace(/^["']|["']$/g, ''));

            // Controllo colonne sufficienti
            if (columns.length < 17) continue;

            const giornata = parseInt(columns[0]) || 0;
            const matchId = columns[1];
            const squadra = columns[2];
            const avversario = columns[3];
            const lato = columns[4];
            const punteggio = columns[5];
            const formazione = columns[6];
            const sezione = columns[7]; // TITOLARE o PANCHINA
            const ruolo = columns[8];
            const calciatore = columns[9];
            const voto_base = parseFloat(columns[10]) || null;
            const fantavoto = parseFloat(columns[11]) || null;
            const ha_giocato = parseInt(columns[12]) || 0;
            const fantavoto_in_verde = parseInt(columns[13]) || 0;
            const record_tipo = columns[14];
            const bonus_nome = columns[15];
            const bonus_valore = parseFloat(columns[16]) || 0;

            giornateSet.add(giornata);

            // Se è una riga MODIFICATORE, salva il bonus
            if (record_tipo === 'MODIFICATORE') {
                // Valida che il bonus abbia almeno un nome e un valore valido
                if (bonus_nome && bonus_valore > 0) {
                    squadreSet.add(squadra);
                    const bonus_data = {
                        giornata,
                        matchId,
                        squadra,
                        avversario,
                        bonus: {
                            nome: bonus_nome,
                            valore: bonus_valore
                        },
                        timestamp: new Date().toISOString(),
                        created_at: new Date()
                    };
                    bonuses.push(bonus_data);
                }
                processedLines++;
                continue; // Salta al prossimo record
            }

            // Se è un GIOCATORE, valida i dati
            if (!calciatore) continue;

            squadreSet.add(squadra);

            // Incrementa l'ordine per questa squadra
            if (!ordinePerSquadraCSV[squadra]) ordinePerSquadraCSV[squadra] = 0;
            ordinePerSquadraCSV[squadra]++;

            const formazione_data = {
                giornata,
                matchId,
                squadra,
                avversario,
                lato,
                punteggio,
                formazione,
                sezione, // TITOLARE/PANCHINA
                ruolo,
                calciatore,
                voto_base,
                fantavoto,
                ha_giocato: ha_giocato === 1,
                fantavoto_in_verde,
                ordine: ordinePerSquadraCSV[squadra],
                record_tipo,
                // Metadati
                timestamp: new Date().toISOString(),
                created_at: new Date()
            };

            formazioni.push(formazione_data);
            processedLines++;

            if (processedLines % 50 === 0) {
                const progress = Math.min(70, 10 + (processedLines / lines.length) * 60);
                updateProgress(progress, `Processate ${processedLines} righe...`);
            }
        }

        if (formazioni.length === 0) {
            throw new Error('Nessun dato valido trovato nel CSV.');
        }

        console.log(`✅ Formazioni parsate: ${formazioni.length} record`, {
            giornate: Array.from(giornateSet).length,
            squadre: Array.from(squadreSet).length,
            giornateList: Array.from(giornateSet).sort((a, b) => a - b),
            squadreList: Array.from(squadreSet).sort()
        });
        
        // DEBUG: Stampa dettagli per giornata e squadra
        const byGiornataSquadra = {};
        formazioni.forEach(f => {
            const key = `${f.giornata}_${f.squadra}`;
            if (!byGiornataSquadra[key]) byGiornataSquadra[key] = 0;
            byGiornataSquadra[key]++;
        });
        
        console.log(`📋 Dettagli per giornata-squadra:`, byGiornataSquadra);
        
        Array.from(giornateSet).sort((a, b) => a - b).forEach(g => {
            console.log(`  Giornata ${g}:`);
            Array.from(squadreSet).sort().forEach(s => {
                const count = byGiornataSquadra[`${g}_${s}`] || 0;
                if (count > 0) {
                    console.log(`    - ${s}: ${count} giocatori`);
                }
            });
        });

        updateProgress(75, 'Salvataggio dati in Firestore...');

        // Salva i dati in Firestore
        const formationsCollection = getFormationsCollectionRef();

        // Per ogni giornata, cancella i dati precedenti e carica i nuovi
        for (const giornata of giornateSet) {
            // Carica documenti esistenti per questa giornata
            const q = query(formationsCollection, where('giornata', '==', giornata));
            const snapshot = await getDocs(q);

            // Cancella documenti precedenti
            const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
            await Promise.all(deletePromises);
        }

        // Salva nuovi documenti
        let savedCount = 0;
        const savedByGiornataSquadra = {};
        for (const formazione of formazioni) {
            await addDoc(formationsCollection, formazione);
            savedCount++;
            
            // Traccia il salvataggio
            const key = `${formazione.giornata}_${formazione.squadra}`;
            if (!savedByGiornataSquadra[key]) savedByGiornataSquadra[key] = 0;
            savedByGiornataSquadra[key]++;

            if (savedCount % 50 === 0) {
                const progress = 75 + (savedCount / formazioni.length) * 15;
                updateProgress(progress, `Salvati ${savedCount}/${formazioni.length} record...`);
            }
        }
        
        console.log(`✅ ${savedCount}/${formazioni.length} record salvati in Firestore`, savedByGiornataSquadra);

        // Salva i bonus
        if (bonuses.length > 0) {
            const { collection } = await import('./firebase-config.js');
            const db = (await import('./firebase-config.js')).db;
            const bonusesCollection = collection(db, 'fantabet_squad_bonuses');
            
            // Cancella bonus precedenti per questa giornata
            for (const giornata of giornateSet) {
                const q = query(bonusesCollection, where('giornata', '==', giornata));
                const snapshot = await getDocs(q);
                const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);
            }

            // Salva nuovi bonus
            for (const bonus of bonuses) {
                await addDoc(bonusesCollection, bonus);
            }
            
            console.log(`Bonus salvati: ${bonuses.length}`);
        }

        updateProgress(100, 'Completato!');

        // Aggiorna la cache delle formazioni e renderizza la classifica
        const { loadFormationsCache } = await import('./bets.js');
        await loadFormationsCache(true); // Force reload
        
        // Ri-renderizza la classifica se visibile
        const { renderStandings } = await import('./rendering.js');
        if (window.renderStandings) {
            try {
                await window.renderStandings();
            } catch (e) {
                console.warn('Classifica non aggiornabile (potrebbe non essere caricata):', e.message);
            }
        }

        // Mostra riepilogo
        renderFormationsData(formazioni, giornateSet, squadreSet);

        hideProgressBar();
        messageBox(`Formazioni caricate con successo!\n\nGiornate: ${giornateSet.size}\nSquadre: ${squadreSet.size}\nRecord totali: ${formazioni.length}\nBonus: ${bonuses.length}`);

        // Reset UI
        uploadButton.disabled = false;
        uploadButton.textContent = 'Carica Formazioni';
        fileInput.value = '';
        document.getElementById('formations-file-name-display').textContent = 'Nessun file selezionato.';
        uploadButton.classList.add('btn-secondary');
        uploadButton.classList.remove('btn-primary');

    } catch (error) {
        console.error('Errore durante il processamento formazioni:', error);
        hideProgressBar();
        messageBox("Errore durante il caricamento: " + error.message);
        uploadButton.disabled = false;
        uploadButton.textContent = 'Carica Formazioni';
    }
};

/**
 * Renderizza il riepilogo delle formazioni caricate
 */
const renderFormationsData = (formazioni, giornateSet, squadreSet) => {
    const container = document.getElementById('formations-data-container');
    if (!container) return;
    
    console.log(`🎯 Rendering formazioni - totali: ${formazioni.length}`);
    console.log(`   Giornate: ${Array.from(giornateSet).sort((a, b) => a - b).join(', ')}`);
    console.log(`   Squadre: ${Array.from(squadreSet).sort().join(', ')}`);

    // Raggruppa per giornata e squadra
    const datiGiornate = new Map();
    formazioni.forEach(f => {
        if (!datiGiornate.has(f.giornata)) {
            datiGiornate.set(f.giornata, new Map());
        }
        if (!datiGiornate.get(f.giornata).has(f.squadra)) {
            datiGiornate.get(f.giornata).set(f.squadra, {
                titolari: [],
                panchina: [],
                bonus: []
            });
        }
        const squadraData = datiGiornate.get(f.giornata).get(f.squadra);
        
        if (f.sezione === 'TITOLARE') {
            squadraData.titolari.push(f);
        } else if (f.sezione === 'PANCHINA') {
            squadraData.panchina.push(f);
        }
        
        if (f.bonus && f.bonus.nome) {
            squadraData.bonus.push(f.bonus);
        }
    });

    let html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">';

    // Mostra per giornata
    const sortedGiornate = Array.from(datiGiornate.keys()).sort((a, b) => a - b);
    
    for (const giornata of sortedGiornate) {
        const squadreData = datiGiornate.get(giornata);
        let titolariTotali = 0;
        let pancinaTotali = 0;
        let bonusTotali = 0;

        squadreData.forEach(data => {
            titolariTotali += data.titolari.length;
            pancinaTotali += data.panchina.length;
            bonusTotali += data.bonus.length;
        });

        html += `
            <div class="bg-gray-800 border border-orange-700/50 rounded-lg p-4">
                <h5 class="text-lg font-bold text-orange-400 mb-3">Giornata ${giornata}</h5>
                <div class="text-sm text-gray-300 space-y-2">
                    <p>Squadre: <span class="font-bold">${squadreData.size}</span></p>
                    <p>Titolari: <span class="font-bold text-green-400">${titolariTotali}</span></p>
                    <p>Panchina: <span class="font-bold text-yellow-400">${pancinaTotali}</span></p>
                    <p>Bonus applicati: <span class="font-bold text-blue-400">${bonusTotali}</span></p>
                </div>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
};

// ==================== FORMAZIONI DA EXCEL (XLSX) - UPLOAD MULTIPLO ====================

/**
 * Apre il dialog per selezionare i file Excel delle formazioni (multipli)
 */
export const triggerFormationsXlsxFileInput = () => {
    document.getElementById('formations-xlsx-file-input').click();
};

/**
 * Aggiorna la UI della coda file formazioni
 */
const updateFormationsQueueUI = () => {
    const queueContainer = document.getElementById('formations-xlsx-queue-container');
    const queueList = document.getElementById('formations-xlsx-queue-list');
    const queueCount = document.getElementById('formations-xlsx-queue-count');
    const uploadButton = document.getElementById('upload-formations-xlsx-button');
    const clearButton = document.getElementById('clear-formations-queue-button');
    
    if (formationsXlsxQueue.length === 0) {
        queueContainer?.classList.add('hidden');
        clearButton?.classList.add('hidden');
        uploadButton.disabled = true;
        uploadButton.classList.remove('btn-primary');
        uploadButton.classList.add('btn-secondary');
        return;
    }
    
    queueContainer?.classList.remove('hidden');
    clearButton?.classList.remove('hidden');
    queueCount.textContent = formationsXlsxQueue.length;
    
    // Genera lista file
    queueList.innerHTML = formationsXlsxQueue.map((file, index) => `
        <li class="flex items-center justify-between gap-2 text-sm py-1 px-2 rounded ${file.status === 'completed' ? 'bg-green-900/30' : file.status === 'processing' ? 'bg-blue-900/30' : file.status === 'error' ? 'bg-red-900/30' : 'bg-gray-700/30'}">
            <div class="flex items-center gap-2 flex-1 min-w-0">
                <span class="flex-shrink-0">
                    ${file.status === 'completed' ? '✅' : file.status === 'processing' ? '⏳' : file.status === 'error' ? '❌' : '📄'}
                </span>
                <span class="truncate ${file.status === 'completed' ? 'text-green-300' : file.status === 'error' ? 'text-red-300' : 'text-gray-300'}" title="${file.file.name}">
                    ${file.file.name}
                </span>
                ${file.giornata ? `<span class="flex-shrink-0 text-xs bg-orange-600/50 px-1.5 py-0.5 rounded">G${file.giornata}</span>` : ''}
            </div>
            ${file.status === 'pending' ? `
                <button onclick="removeFromFormationsQueue(${index})" class="text-red-400 hover:text-red-300 flex-shrink-0" title="Rimuovi">
                    ✕
                </button>
            ` : ''}
            ${file.status === 'error' ? `<span class="text-xs text-red-400 flex-shrink-0" title="${file.error}">${file.error?.substring(0, 30)}...</span>` : ''}
        </li>
    `).join('');
    
    // Abilita/disabilita pulsante upload
    const pendingFiles = formationsXlsxQueue.filter(f => f.status === 'pending').length;
    if (pendingFiles > 0 && !formationsQueueProcessing) {
        uploadButton.disabled = false;
        uploadButton.classList.remove('btn-secondary');
        uploadButton.classList.add('btn-primary');
        uploadButton.textContent = `🚀 Carica ${pendingFiles} File in Coda`;
    } else if (formationsQueueProcessing) {
        uploadButton.disabled = true;
        uploadButton.textContent = '⏳ Elaborazione in corso...';
    } else {
        uploadButton.disabled = true;
        uploadButton.classList.remove('btn-primary');
        uploadButton.classList.add('btn-secondary');
        uploadButton.textContent = '🚀 Carica Formazioni da Excel';
    }
};

/**
 * Rimuove un file dalla coda formazioni
 */
export const removeFromFormationsQueue = (index) => {
    if (formationsXlsxQueue[index]?.status === 'pending') {
        formationsXlsxQueue.splice(index, 1);
        updateFormationsQueueUI();
    }
};

/**
 * Svuota la coda dei file formazioni
 */
export const clearFormationsQueue = () => {
    if (formationsQueueProcessing) {
        messageBox('Impossibile svuotare la coda durante l\'elaborazione.');
        return;
    }
    formationsXlsxQueue = [];
    document.getElementById('formations-xlsx-file-input').value = '';
    updateFormationsQueueUI();
};

/**
 * Gestisce la selezione dei file Excel delle formazioni (multipli)
 */
export const handleFormationsXlsxFileSelect = () => {
    const fileInput = document.getElementById('formations-xlsx-file-input');
    
    if (fileInput.files.length > 0) {
        // Aggiungi i nuovi file alla coda
        for (const file of fileInput.files) {
            // Evita duplicati controllando il nome file
            const alreadyInQueue = formationsXlsxQueue.some(f => f.file.name === file.name && f.status === 'pending');
            if (!alreadyInQueue) {
                formationsXlsxQueue.push({
                    file: file,
                    status: 'pending', // pending, processing, completed, error
                    giornata: null,
                    error: null
                });
            }
        }
        
        // Mantieni compatibilità con vecchio codice
        selectedFormationsXlsxFile = fileInput.files[0];
        
        updateFormationsQueueUI();
        
        // Reset input per permettere ri-selezione stesso file
        fileInput.value = '';
    }
};

/**
 * Conferma il caricamento delle formazioni da Excel (coda multipla)
 */
export const confirmFormationsXlsxUpload = () => {
    const pendingFiles = formationsXlsxQueue.filter(f => f.status === 'pending');
    
    if (pendingFiles.length === 0) {
        messageBox('Seleziona almeno un file Excel prima di procedere.');
        return;
    }
    
    const fileList = pendingFiles.map(f => `  • ${f.file.name}`).join('\n');
    const message = pendingFiles.length === 1 
        ? `Confermi il caricamento delle formazioni dal file:\n${fileList}\n\n⚠️ ATTENZIONE: Le formazioni precedenti per la giornata verranno sovrascritte.`
        : `Confermi il caricamento delle formazioni da ${pendingFiles.length} file:\n${fileList}\n\n⚠️ ATTENZIONE: Le formazioni precedenti per ogni giornata verranno sovrascritte.`;
    
    if (confirm(message)) {
        processFormationsXlsxQueue();
    }
};

/**
 * Processa la coda dei file formazioni uno alla volta
 */
const processFormationsXlsxQueue = async () => {
    if (formationsQueueProcessing) return;
    
    formationsQueueProcessing = true;
    updateFormationsQueueUI();
    
    const queueStatus = document.getElementById('formations-xlsx-queue-status');
    const currentFileSpan = document.getElementById('formations-xlsx-current-file');
    const queueCurrentSpan = document.getElementById('formations-xlsx-queue-current');
    const queueTotalSpan = document.getElementById('formations-xlsx-queue-total');
    
    const pendingFiles = formationsXlsxQueue.filter(f => f.status === 'pending');
    const totalFiles = pendingFiles.length;
    
    queueStatus?.classList.remove('hidden');
    queueTotalSpan.textContent = totalFiles;
    
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < formationsXlsxQueue.length; i++) {
        const queueItem = formationsXlsxQueue[i];
        
        if (queueItem.status !== 'pending') continue;
        
        processedCount++;
        queueCurrentSpan.textContent = processedCount;
        currentFileSpan.textContent = `Elaborazione: ${queueItem.file.name}`;
        
        queueItem.status = 'processing';
        updateFormationsQueueUI();
        
        try {
            // Imposta il file corrente per la funzione di processing
            selectedFormationsXlsxFile = queueItem.file;
            
            // Processa il file
            const result = await processFormationsXlsxFileSingle(queueItem.file);
            
            queueItem.status = 'completed';
            queueItem.giornata = result.giornata;
            successCount++;
            
        } catch (error) {
            console.error(`Errore elaborazione ${queueItem.file.name}:`, error);
            queueItem.status = 'error';
            queueItem.error = error.message;
            errorCount++;
        }
        
        updateFormationsQueueUI();
    }
    
    formationsQueueProcessing = false;
    queueStatus?.classList.add('hidden');
    
    updateFormationsQueueUI();
    
    // Messaggio finale riepilogativo
    let summaryMessage = `📊 Elaborazione completata!\n\n`;
    summaryMessage += `✅ File elaborati con successo: ${successCount}\n`;
    if (errorCount > 0) {
        summaryMessage += `❌ File con errori: ${errorCount}\n`;
    }
    
    const completedFiles = formationsXlsxQueue.filter(f => f.status === 'completed');
    if (completedFiles.length > 0) {
        const giornate = completedFiles.map(f => f.giornata).filter(g => g).sort((a, b) => a - b);
        summaryMessage += `\n📅 Giornate caricate: ${giornate.join(', ')}`;
    }
    
    messageBox(summaryMessage);
};

/**
 * Processa un singolo file Excel delle formazioni
 * @param {File} file - Il file Excel da processare
 * @returns {Promise<{giornata: number, formazioni: number, bonuses: number}>} Risultato con la giornata processata
 */
const processFormationsXlsxFileSingle = async (file) => {
    // Mostra progress bar
    const progressContainer = document.getElementById('formations-xlsx-progress');
    if (progressContainer) progressContainer.classList.remove('hidden');
    
    updateProgress(5, `Lettura ${file.name}...`, null, null, 'formations-xlsx-progress');
    
    // Leggi il file Excel con SheetJS
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Cerca un foglio che contiene "Formazioni" nel nome
    let sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('formazioni'));
    if (!sheetName) {
        sheetName = workbook.SheetNames[0];
        console.warn('Foglio "Formazioni" non trovato, uso il primo foglio:', sheetName);
    }
    console.log('Fogli disponibili:', workbook.SheetNames);
    console.log('Foglio selezionato:', sheetName);
    
    const worksheet = workbook.Sheets[sheetName];
    
    // Converti in array di array (righe)
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    console.log('Righe totali nel file:', jsonData.length);
    console.log('Prime 5 righe:', jsonData.slice(0, 5));
    
    // Contatori ordine per preservare l'ordine dei calciatori per ogni squadra
    // Fondamentale per la corretta simulazione delle sostituzioni dalla panchina
    const ordinePerSquadra = {};
    
    // Estrai la giornata dal nome del foglio (es. "Formazioni 21 giornata" -> 21)
    let giornata = 0;
    const giornataMatch = sheetName.match(/(\d+)\s*giornata/i);
    if (giornataMatch) {
        giornata = parseInt(giornataMatch[1]);
    } else {
        // Prova a cercare nel titolo del foglio (riga 1)
        if (jsonData[0]) {
            const titleMatch = String(jsonData[0][0] || '').match(/Giornata\s*(\d+)/i);
            if (titleMatch) {
                giornata = parseInt(titleMatch[1]);
            }
        }
    }
    
    if (giornata === 0) {
        throw new Error('Impossibile determinare la giornata dal file. Assicurati che il nome del foglio contenga "Formazioni XX giornata" oppure che la prima riga contenga "Giornata XX".');
    }
    
    console.log('Excel Formazioni caricato:', {
        foglio: sheetName,
        giornata: giornata
    });
    
    updateProgress(15, `Parsing formazioni giornata ${giornata}...`, null, null, 'formations-xlsx-progress');
    
    // Struttura dati
    const formazioni = [];
    const bonuses = [];
    const squadreSet = new Set();
    
    // Stato parser
    let currentSquadLeft = null;
    let currentSquadRight = null;
    let currentAvversarioLeft = null;
    let currentAvversarioRight = null;
    let currentResultLeft = null;
    let currentResultRight = null;
    let currentModuloLeft = null;
    let currentModuloRight = null;
    let currentSectionLeft = 'TITOLARE';
    let currentSectionRight = 'TITOLARE';
    let matchIdCounter = 0;
    let currentMatchIdLeft = null;
    let currentMatchIdRight = null;

    // Funzione helper per parsare numeri con virgola italiana
    const parseItalianNumber = (str) => {
        if (!str) return 0;
        const normalized = String(str).replace(',', '.');
        return parseFloat(normalized) || 0;
    };
    
    // Parsing del file - inizia dalla riga 4 (indice 3)
    for (let i = 3; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;
        
        const cellA = String(row[0] || '').trim();
        const cellB = String(row[1] || '').trim();
        const cellC = String(row[2] || '').trim();
        const cellD = String(row[3] || '').trim();
        const cellE = String(row[4] || '').trim();
        
        const cellG = String(row[6] || '').trim();
        const cellH = String(row[7] || '').trim();
        const cellI = String(row[8] || '').trim();
        const cellJ = String(row[9] || '').trim();
        const cellK = String(row[10] || '').trim();
        
        // Debug: mostra le prime righe per capire la struttura
        if (i < 10) {
            console.log(`Riga ${i}: A="${cellA}" B="${cellB}" C="${cellC}" D="${cellD}" E="${cellE}" | G="${cellG}" H="${cellH}"`);
        }
        
        // === Identificazione righe speciali ===
        const cellF = String(row[5] || '').trim();
        const resultPattern = /^\d+-\d+$/;
        
        let foundResult = null;
        if (cellE && resultPattern.test(cellE)) {
            foundResult = cellE;
        } else if (cellF && resultPattern.test(cellF)) {
            foundResult = cellF;
        }
        
        if (foundResult && cellA && cellG) {
            matchIdCounter++;
            currentMatchIdLeft = `G${giornata}_M${matchIdCounter}`;
            currentMatchIdRight = currentMatchIdLeft;

            currentSquadLeft = cellA;
            currentSquadRight = cellG;
            currentAvversarioLeft = cellG;
            currentAvversarioRight = cellA;
            currentResultLeft = foundResult;
            currentResultRight = foundResult;
            currentSectionLeft = 'TITOLARE';
            currentSectionRight = 'TITOLARE';

            squadreSet.add(currentSquadLeft);
            squadreSet.add(currentSquadRight);

            console.log(`Partita trovata: ${currentSquadLeft} vs ${currentSquadRight} (${foundResult})`);
            continue;
        }
        
        // Riga modulo
        if (cellA && cellA.match(/^\d{3,4}/) && !cellB) {
            currentModuloLeft = cellA;
        }
        if (cellG && cellG.match(/^\d{3,4}/) && !cellH) {
            currentModuloRight = cellG;
        }
        
        // Riga "Panchina"
        if (cellB === 'Panchina' || cellA === 'Panchina') {
            currentSectionLeft = 'PANCHINA';
        }
        if (cellH === 'Panchina' || cellG === 'Panchina') {
            currentSectionRight = 'PANCHINA';
        }
        
        // Riga "Modificatore difesa"
        if (cellA === 'Modificatore difesa' && currentSquadLeft) {
            const valore = parseItalianNumber(cellE);
            if (valore !== 0) {
                bonuses.push({
                    giornata,
                    matchId: currentMatchIdLeft,
                    squadra: currentSquadLeft,
                    avversario: currentAvversarioLeft,
                    bonus: { nome: 'Modificatore difesa', valore },
                    timestamp: new Date().toISOString()
                });
            }
        }
        if (cellG === 'Modificatore difesa' && currentSquadRight) {
            const valore = parseItalianNumber(cellK);
            if (valore !== 0) {
                bonuses.push({
                    giornata,
                    matchId: currentMatchIdRight,
                    squadra: currentSquadRight,
                    avversario: currentAvversarioRight,
                    bonus: { nome: 'Modificatore difesa', valore },
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        // Riga "Modificatore fairplay"
        if (cellA === 'Modificatore fairplay' && currentSquadLeft) {
            const valore = parseItalianNumber(cellE);
            if (valore !== 0) {
                bonuses.push({
                    giornata,
                    matchId: currentMatchIdLeft,
                    squadra: currentSquadLeft,
                    avversario: currentAvversarioLeft,
                    bonus: { nome: 'Modificatore fairplay', valore },
                    timestamp: new Date().toISOString()
                });
            }
        }
        if (cellG === 'Modificatore fairplay' && currentSquadRight) {
            const valore = parseItalianNumber(cellK);
            if (valore !== 0) {
                bonuses.push({
                    giornata,
                    matchId: currentMatchIdRight,
                    squadra: currentSquadRight,
                    avversario: currentAvversarioRight,
                    bonus: { nome: 'Modificatore fairplay', valore },
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        // Riga "Altri bonus"
        if (cellA === 'Altri bonus' && currentSquadLeft) {
            const valore = parseItalianNumber(cellE);
            if (valore !== 0) {
                bonuses.push({
                    giornata,
                    matchId: currentMatchIdLeft,
                    squadra: currentSquadLeft,
                    avversario: currentAvversarioLeft,
                    bonus: { nome: 'Altri bonus', valore },
                    timestamp: new Date().toISOString()
                });
            }
        }
        if (cellG === 'Altri bonus' && currentSquadRight) {
            const valore = parseItalianNumber(cellK);
            if (valore !== 0) {
                bonuses.push({
                    giornata,
                    matchId: currentMatchIdRight,
                    squadra: currentSquadRight,
                    avversario: currentAvversarioRight,
                    bonus: { nome: 'Altri bonus', valore },
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        // Riga "TOTALE:" - fine del blocco squadra
        if (cellC && String(cellC).includes('TOTALE')) {
            currentSquadLeft = null;
            currentModuloLeft = null;
            currentSectionLeft = 'TITOLARE';
        }
        if (cellI && String(cellI).includes('TOTALE')) {
            currentSquadRight = null;
            currentModuloRight = null;
            currentSectionRight = 'TITOLARE';
        }
        
        // === Righe calciatori ===
        // Colonna sinistra
        if (['P', 'D', 'C', 'A'].includes(cellA) && cellB && currentSquadLeft) {
            const ruolo = cellA;
            const calciatore = cellB.replace(/\s*\*\s*$/, '');
            
            const voto_base = parseItalianNumber(cellD) || null;
            const fantavoto = parseItalianNumber(cellE) || null;
            const ha_giocato = voto_base !== null && voto_base > 0;
            
            // Incrementa l'ordine per questa squadra (preserva l'ordine dall'Excel)
            if (!ordinePerSquadra[currentSquadLeft]) ordinePerSquadra[currentSquadLeft] = 0;
            ordinePerSquadra[currentSquadLeft]++;
            
            formazioni.push({
                giornata,
                matchId: currentMatchIdLeft,
                squadra: currentSquadLeft,
                avversario: currentAvversarioLeft,
                lato: 'casa',
                punteggio: currentResultLeft,
                formazione: currentModuloLeft,
                sezione: currentSectionLeft,
                ruolo,
                calciatore,
                voto_base,
                fantavoto,
                ha_giocato,
                ordine: ordinePerSquadra[currentSquadLeft],
                record_tipo: 'GIOCATORE',
                timestamp: new Date().toISOString()
            });
        }
        
        // Colonna destra
        if (['P', 'D', 'C', 'A'].includes(cellG) && cellH && currentSquadRight) {
            const ruolo = cellG;
            const calciatore = cellH.replace(/\s*\*\s*$/, '');
            const voto_base = parseItalianNumber(cellJ) || null;
            const fantavoto = parseItalianNumber(cellK) || null;
            const ha_giocato = voto_base !== null && voto_base > 0;
            
            // Incrementa l'ordine per questa squadra (preserva l'ordine dall'Excel)
            if (!ordinePerSquadra[currentSquadRight]) ordinePerSquadra[currentSquadRight] = 0;
            ordinePerSquadra[currentSquadRight]++;
            
            formazioni.push({
                giornata,
                matchId: currentMatchIdRight,
                squadra: currentSquadRight,
                avversario: currentAvversarioRight,
                lato: 'ospite',
                punteggio: currentResultRight,
                formazione: currentModuloRight,
                sezione: currentSectionRight,
                ruolo,
                calciatore,
                voto_base,
                fantavoto,
                ha_giocato,
                ordine: ordinePerSquadra[currentSquadRight],
                record_tipo: 'GIOCATORE',
                timestamp: new Date().toISOString()
            });
        }
    }
    
    console.log(`Formazioni parsate: ${formazioni.length} giocatori, ${bonuses.length} bonus`);
    
    if (formazioni.length === 0) {
        throw new Error('Nessuna formazione trovata nel file. Verifica il formato.');
    }
    
    updateProgress(50, `Cancellazione formazioni giornata ${giornata}...`, null, null, 'formations-xlsx-progress');
    
    // Salva i dati in Firestore
    const formationsCollection = getFormationsCollectionRef();
    
    // Cancella formazioni esistenti per questa giornata
    const q = query(formationsCollection, where('giornata', '==', giornata));
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    updateProgress(60, `Salvataggio formazioni giornata ${giornata}...`, null, null, 'formations-xlsx-progress');
    
    // Salva nuove formazioni
    let savedCount = 0;
    const savedBySquadra = {};
    for (const formazione of formazioni) {
        await addDoc(formationsCollection, formazione);
        savedCount++;
        
        // Traccia per squadra
        if (!savedBySquadra[formazione.squadra]) savedBySquadra[formazione.squadra] = 0;
        savedBySquadra[formazione.squadra]++;
        
        if (savedCount % 30 === 0) {
            const progress = 60 + (savedCount / formazioni.length) * 25;
            updateProgress(progress, `Salvati ${savedCount}/${formazioni.length} record...`, null, null, 'formations-xlsx-progress');
        }
    }
    
    console.log(`✅ XLSX Giornata ${giornata}: Salvati ${savedCount} record`, {
        squadre: savedBySquadra,
        totalFormazioni: formazioni.length
    });
    
    // Salva i bonus
    updateProgress(85, 'Salvataggio bonus...', null, null, 'formations-xlsx-progress');
    
    if (bonuses.length > 0) {
        const { collection } = await import('./firebase-config.js');
        const dbModule = await import('./firebase-config.js');
        const bonusesCollection = collection(dbModule.db, 'fantabet_squad_bonuses');
        
        // Cancella bonus precedenti per questa giornata
        const qBonus = query(bonusesCollection, where('giornata', '==', giornata));
        const snapshotBonus = await getDocs(qBonus);
        const deleteBonusPromises = snapshotBonus.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deleteBonusPromises);
        
        // Salva nuovi bonus
        for (const bonus of bonuses) {
            await addDoc(bonusesCollection, bonus);
        }
        
        console.log(`Bonus salvati: ${bonuses.length}`);
    }

    updateProgress(100, `Completato giornata ${giornata}!`, null, null, 'formations-xlsx-progress');

    // Mostra riepilogo
    const giornateSet = new Set([giornata]);
    renderFormationsData(formazioni, giornateSet, squadreSet);

    // Nascondi progress bar dopo un breve delay
    setTimeout(() => {
        const progressContainer = document.getElementById('formations-xlsx-progress');
        if (progressContainer) progressContainer.classList.add('hidden');
    }, 1000);

    return {
        giornata,
        formazioni: formazioni.length,
        bonuses: bonuses.length
    };
};

/**
 * Processa il file Excel delle formazioni usando SheetJS (wrapper per retrocompatibilità)
 * Usa la coda se ci sono più file, altrimenti processa singolo file
 */
export const processFormationsXlsxFile = async () => {
    // Se ci sono file in coda, usa la coda
    if (formationsXlsxQueue.length > 0) {
        confirmFormationsXlsxUpload();
        return;
    }
    
    // Altrimenti processa singolo file per retrocompatibilità
    if (!selectedFormationsXlsxFile) {
        messageBox('Nessun file selezionato.');
        return;
    }
    
    const uploadButton = document.getElementById('upload-formations-xlsx-button');
    uploadButton.disabled = true;
    uploadButton.textContent = 'Caricamento...';
    
    try {
        const result = await processFormationsXlsxFileSingle(selectedFormationsXlsxFile);
        let message = `Formazioni caricate da Excel!\n\n✅ Giornata ${result.giornata}\n✅ ${result.formazioni} giocatori\n✅ ${result.bonuses} bonus`;
        if (result.risultati > 0) {
            message += `\n✅ ${result.risultati} risultati campionato aggiornati`;
        }
        messageBox(message);
    } catch (error) {
        console.error('Errore durante il caricamento delle formazioni da Excel:', error);
        messageBox('Errore durante il caricamento: ' + error.message);
    } finally {
        uploadButton.disabled = false;
        uploadButton.textContent = '🚀 Carica Formazioni da Excel';
    }
};

/**
 * Riferimento alla collection Firestore per le formazioni
 */
// Nota: getFormationsCollectionRef è già importato da firebase-config.js

// ==================== VOTI FANTACALCIO DA EXCEL (XLSX) - UPLOAD MULTIPLO ====================

/**
 * Apre il dialog per selezionare i file Excel dei voti (multipli)
 */
export const triggerVotesXlsxFileInput = () => {
    document.getElementById('votes-xlsx-file-input').click();
};

/**
 * Aggiorna la UI della coda file voti
 */
const updateVotesQueueUI = () => {
    const queueContainer = document.getElementById('votes-xlsx-queue-container');
    const queueList = document.getElementById('votes-xlsx-queue-list');
    const queueCount = document.getElementById('votes-xlsx-queue-count');
    const uploadButton = document.getElementById('upload-votes-xlsx-button');
    const clearButton = document.getElementById('clear-votes-queue-button');
    
    if (votesXlsxQueue.length === 0) {
        queueContainer?.classList.add('hidden');
        clearButton?.classList.add('hidden');
        uploadButton.disabled = true;
        uploadButton.classList.remove('btn-primary');
        uploadButton.classList.add('btn-secondary');
        return;
    }
    
    queueContainer?.classList.remove('hidden');
    clearButton?.classList.remove('hidden');
    queueCount.textContent = votesXlsxQueue.length;
    
    // Genera lista file
    queueList.innerHTML = votesXlsxQueue.map((file, index) => `
        <li class="flex items-center justify-between gap-2 text-sm py-1 px-2 rounded ${file.status === 'completed' ? 'bg-green-900/30' : file.status === 'processing' ? 'bg-blue-900/30' : file.status === 'error' ? 'bg-red-900/30' : 'bg-gray-700/30'}">
            <div class="flex items-center gap-2 flex-1 min-w-0">
                <span class="flex-shrink-0">
                    ${file.status === 'completed' ? '✅' : file.status === 'processing' ? '⏳' : file.status === 'error' ? '❌' : '📄'}
                </span>
                <span class="truncate ${file.status === 'completed' ? 'text-green-300' : file.status === 'error' ? 'text-red-300' : 'text-gray-300'}" title="${file.file.name}">
                    ${file.file.name}
                </span>
                ${file.giornata ? `<span class="flex-shrink-0 text-xs bg-teal-600/50 px-1.5 py-0.5 rounded">G${file.giornata}</span>` : ''}
            </div>
            ${file.status === 'pending' ? `
                <button onclick="removeFromVotesQueue(${index})" class="text-red-400 hover:text-red-300 flex-shrink-0" title="Rimuovi">
                    ✕
                </button>
            ` : ''}
            ${file.status === 'error' ? `<span class="text-xs text-red-400 flex-shrink-0" title="${file.error}">${file.error?.substring(0, 30)}...</span>` : ''}
        </li>
    `).join('');
    
    // Abilita/disabilita pulsante upload
    const pendingFiles = votesXlsxQueue.filter(f => f.status === 'pending').length;
    if (pendingFiles > 0 && !votesQueueProcessing) {
        uploadButton.disabled = false;
        uploadButton.classList.remove('btn-secondary');
        uploadButton.classList.add('btn-primary');
        uploadButton.textContent = `🚀 Carica ${pendingFiles} File Voti in Coda`;
    } else if (votesQueueProcessing) {
        uploadButton.disabled = true;
        uploadButton.textContent = '⏳ Elaborazione in corso...';
    } else {
        uploadButton.disabled = true;
        uploadButton.classList.remove('btn-primary');
        uploadButton.classList.add('btn-secondary');
        uploadButton.textContent = '🚀 Carica Voti da Excel';
    }
};

/**
 * Rimuove un file dalla coda voti
 */
export const removeFromVotesQueue = (index) => {
    if (votesXlsxQueue[index]?.status === 'pending') {
        votesXlsxQueue.splice(index, 1);
        updateVotesQueueUI();
    }
};

/**
 * Svuota la coda dei file voti
 */
export const clearVotesQueue = () => {
    if (votesQueueProcessing) {
        messageBox('Impossibile svuotare la coda durante l\'elaborazione.');
        return;
    }
    votesXlsxQueue = [];
    document.getElementById('votes-xlsx-file-input').value = '';
    updateVotesQueueUI();
};

/**
 * Gestisce la selezione dei file Excel dei voti (multipli)
 */
export const handleVotesXlsxFileSelect = () => {
    const fileInput = document.getElementById('votes-xlsx-file-input');
    
    if (fileInput.files.length > 0) {
        // Aggiungi i nuovi file alla coda
        for (const file of fileInput.files) {
            // Evita duplicati controllando il nome file
            const alreadyInQueue = votesXlsxQueue.some(f => f.file.name === file.name && f.status === 'pending');
            if (!alreadyInQueue) {
                votesXlsxQueue.push({
                    file: file,
                    status: 'pending', // pending, processing, completed, error
                    giornata: null,
                    error: null
                });
            }
        }
        
        updateVotesQueueUI();
        
        // Reset input per permettere ri-selezione stesso file
        fileInput.value = '';
    }
};

/**
 * Conferma il caricamento dei voti da Excel (coda multipla)
 */
export const confirmVotesXlsxUpload = () => {
    const pendingFiles = votesXlsxQueue.filter(f => f.status === 'pending');
    
    if (pendingFiles.length === 0) {
        messageBox('Seleziona almeno un file Excel prima di procedere.');
        return;
    }
    
    const fileList = pendingFiles.map(f => `  • ${f.file.name}`).join('\n');
    const message = pendingFiles.length === 1 
        ? `Confermi il caricamento dei voti dal file:\n${fileList}\n\n⚠️ ATTENZIONE: I voti precedenti per la giornata verranno sovrascritti.`
        : `Confermi il caricamento dei voti da ${pendingFiles.length} file:\n${fileList}\n\n⚠️ ATTENZIONE: I voti precedenti per ogni giornata verranno sovrascritti.`;
    
    if (confirm(message)) {
        processVotesXlsxQueue();
    }
};

/**
 * Processa la coda dei file voti uno alla volta
 */
const processVotesXlsxQueue = async () => {
    if (votesQueueProcessing) return;
    
    votesQueueProcessing = true;
    updateVotesQueueUI();
    
    const queueStatus = document.getElementById('votes-xlsx-queue-status');
    const currentFileSpan = document.getElementById('votes-xlsx-current-file');
    const queueCurrentSpan = document.getElementById('votes-xlsx-queue-current');
    const queueTotalSpan = document.getElementById('votes-xlsx-queue-total');
    
    const pendingFiles = votesXlsxQueue.filter(f => f.status === 'pending');
    const totalFiles = pendingFiles.length;
    
    queueStatus?.classList.remove('hidden');
    queueTotalSpan.textContent = totalFiles;
    
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < votesXlsxQueue.length; i++) {
        const queueItem = votesXlsxQueue[i];
        
        if (queueItem.status !== 'pending') continue;
        
        processedCount++;
        queueCurrentSpan.textContent = processedCount;
        currentFileSpan.textContent = `Elaborazione: ${queueItem.file.name}`;
        
        queueItem.status = 'processing';
        updateVotesQueueUI();
        
        try {
            const result = await processVotesXlsxFileSingle(queueItem.file);
            
            queueItem.status = 'completed';
            queueItem.giornata = result.giornata;
            successCount++;
            
        } catch (error) {
            console.error(`Errore elaborazione voti ${queueItem.file.name}:`, error);
            queueItem.status = 'error';
            queueItem.error = error.message;
            errorCount++;
        }
        
        updateVotesQueueUI();
    }
    
    votesQueueProcessing = false;
    queueStatus?.classList.add('hidden');
    
    updateVotesQueueUI();
    
    // Messaggio finale riepilogativo
    let summaryMessage = `📊 Elaborazione voti completata!\n\n`;
    summaryMessage += `✅ File elaborati con successo: ${successCount}\n`;
    if (errorCount > 0) {
        summaryMessage += `❌ File con errori: ${errorCount}\n`;
    }
    
    const completedFiles = votesXlsxQueue.filter(f => f.status === 'completed');
    if (completedFiles.length > 0) {
        const giornate = completedFiles.map(f => f.giornata).filter(g => g).sort((a, b) => a - b);
        summaryMessage += `\n📅 Giornate caricate: ${giornate.join(', ')}`;
    }
    
    messageBox(summaryMessage);
};

/**
 * Processa un singolo file Excel dei voti (foglio "Statistico")
 * Il file ha blocchi per ogni squadra di Serie A con: riga nome squadra, riga intestazioni, righe giocatori
 * @param {File} file - Il file Excel da processare
 * @returns {Promise<{giornata: number, totalePlayers: number, totaleSquadre: number}>}
 */
const processVotesXlsxFileSingle = async (file) => {
    // Mostra progress bar
    const progressContainer = document.getElementById('votes-xlsx-progress');
    if (progressContainer) progressContainer.classList.remove('hidden');
    
    updateProgress(5, `Lettura ${file.name}...`, null, null, 'votes-xlsx-progress');
    
    // Leggi il file Excel con SheetJS
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    console.log('[VOTI] Fogli disponibili:', workbook.SheetNames);
    
    // Cerca il foglio "Statistico"
    let sheetName = workbook.SheetNames.find(name => name.toLowerCase().includes('statistico'));
    if (!sheetName) {
        throw new Error('Foglio "Statistico" non trovato nel file Excel. Fogli disponibili: ' + workbook.SheetNames.join(', '));
    }
    console.log('[VOTI] Foglio selezionato:', sheetName);
    
    const worksheet = workbook.Sheets[sheetName];
    
    // Converti in array di array (righe)
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    console.log('[VOTI] Righe totali nel file:', jsonData.length);
    console.log('[VOTI] Prime 10 righe:', jsonData.slice(0, 10));
    
    // Estrai la giornata dal titolo (prima riga del foglio o dal nome del file)
    // Possibili formati: "Voti Fantacalcio 1ª giornata di campionato" oppure nome file "Voti_Fantacalcio_Stagione_2025_26_Giornata_1.xlsx"
    let giornata = 0;
    
    // Prova prima dalla prima riga del foglio
    if (jsonData[0]) {
        const titleRow = String(jsonData[0][0] || '');
        const titleMatch = titleRow.match(/(\d+)[ªa]?\s*giornata/i);
        if (titleMatch) {
            giornata = parseInt(titleMatch[1]);
        }
    }
    
    // Se non trovato, prova dal nome del file
    if (giornata === 0) {
        const fileNameMatch = file.name.match(/[Gg]iornata[_\s]*(\d+)/i);
        if (fileNameMatch) {
            giornata = parseInt(fileNameMatch[1]);
        }
    }
    
    if (giornata === 0) {
        throw new Error('Impossibile determinare la giornata dal file. Assicurati che il titolo contenga "Xª giornata" oppure che il nome file contenga "Giornata_X".');
    }
    
    console.log(`[VOTI] Giornata rilevata: ${giornata}`);
    
    updateProgress(15, `Parsing voti giornata ${giornata}...`, null, null, 'votes-xlsx-progress');
    
    // Funzione helper per parsare numeri con virgola italiana o asterisco
    const parseVoto = (str) => {
        if (!str && str !== 0) return null;
        let s = String(str).trim();
        // Rimuovi asterisco (indica subentrato o simili)
        s = s.replace(/\*/g, '');
        if (s === '' || s === '-' || s.toLowerCase() === 'sv' || s.toLowerCase() === 's.v.') return null;
        s = s.replace(',', '.');
        const val = parseFloat(s);
        return isNaN(val) ? null : val;
    };
    
    const parseIntSafe = (str) => {
        if (!str && str !== 0) return 0;
        const s = String(str).trim().replace(',', '.');
        return parseInt(s) || 0;
    };
    
    // Parsing del foglio Statistico
    // Struttura: blocchi per squadra di Serie A
    // Ogni blocco: 1) Riga con nome squadra (cella A non vuota, cella B vuota o "Ruolo")
    //              2) Riga intestazioni: Cod. Ruolo Nome Voto Gf Gs Rp Rs Rf Au Amm Esp Ass
    //              3) Righe giocatori fino al prossimo blocco squadra
    
    const votes = [];
    let currentTeam = null;
    let inHeaderRow = false;
    let teamCount = 0;
    
    // Indici colonna nel foglio Statistico (possono variare, li determiniamo dall'header)
    // Default basato su screenshot: A=Cod, B=Ruolo, C=Nome, D=Voto, E=Gf, F=Gs, G=Rp, H=Rs, I=Rf, J=Au, K=Amm, L=Esp, M=Ass
    let colMap = {
        cod: 0, ruolo: 1, nome: 2, voto: 3,
        gf: 4, gs: 5, rp: 6, rs: 7, rf: 8,
        au: 9, amm: 10, esp: 11, ass: 12
    };
    
    for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;
        
        const cellA = String(row[0] || '').trim();
        const cellB = String(row[1] || '').trim();
        const cellC = String(row[2] || '').trim();
        const cellD = String(row[3] || '').trim();
        
        // Salta righe di disclaimer/titolo (prime righe con testo lungo)
        if (i < 5 && (cellA.toLowerCase().includes('voti fantacalcio') || 
                       cellA.toLowerCase().includes('solo su') || 
                       cellA.toLowerCase().includes('questo file') ||
                       cellA.toLowerCase().includes('da considerarsi'))) {
            continue;
        }
        
        // Rileva riga intestazioni colonne: contiene "Cod" o "Cod." nella colonna A e "Ruolo" nella B
        if ((cellA.toLowerCase().startsWith('cod') && cellB.toLowerCase().startsWith('ruol'))) {
            inHeaderRow = true;
            // Mappa le colonne dinamicamente
            for (let c = 0; c < row.length; c++) {
                const header = String(row[c] || '').trim().toLowerCase();
                if (header.startsWith('cod')) colMap.cod = c;
                else if (header === 'ruolo' || header === 'r') colMap.ruolo = c;
                else if (header === 'nome') colMap.nome = c;
                else if (header === 'voto') colMap.voto = c;
                else if (header === 'gf') colMap.gf = c;
                else if (header === 'gs') colMap.gs = c;
                else if (header === 'rp') colMap.rp = c;
                else if (header === 'rs') colMap.rs = c;
                else if (header === 'rf') colMap.rf = c;
                else if (header === 'au') colMap.au = c;
                else if (header === 'amm') colMap.amm = c;
                else if (header === 'esp') colMap.esp = c;
                else if (header === 'ass') colMap.ass = c;
            }
            console.log(`[VOTI] Intestazioni trovate per ${currentTeam}:`, colMap);
            continue;
        }
        
        // Rileva riga nome squadra:
        // - Ha un valore in cellA ma il codice (colMap.cod) non è numerico
        // - Non è una riga intestazione
        if (cellA && !inHeaderRow) {
            const codiceCell = String(row[colMap.cod] || '').trim();
            const isNumeric = /^\d+$/.test(codiceCell);  // Controlla nella colonna corretta
            
            // Se il codice non è un numero, potrebbe essere una squadra
            if (!isNumeric) {
                const possibleTeamName = cellA;
                // Se la riga ha poche colonne riempite, è probabilmente un nome squadra
                const filledCols = row.filter(c => String(c || '').trim() !== '').length;
                if (filledCols <= 3) {
                    currentTeam = possibleTeamName;
                    teamCount++;
                    inHeaderRow = false; // Reset - aspettiamo la riga intestazioni
                    console.log(`[VOTI] Squadra trovata: "${currentTeam}" (riga ${i + 1})`);
                    continue;
                }
            }
        }
        
        // Reset flag header dopo averlo usato (ma processa comunque la prima riga di giocatori)
        if (inHeaderRow) {
            inHeaderRow = false;
            // Non fare continue! La riga deve essere processata come giocatore
        }
        
        // Riga giocatore: ha un codice numerico in colonna A
        if (currentTeam && cellA) {
            const codice = String(row[colMap.cod] || '').trim();
            const ruolo = String(row[colMap.ruolo] || '').trim();
            const nome = String(row[colMap.nome] || '').trim();
            const voto = parseVoto(row[colMap.voto]);
            
            // Salta se non ha nome o codice
            if (!nome || !codice) continue;
            
            const playerVote = {
                giornata: giornata,
                codice: codice,
                ruolo: ruolo,
                nome: nome,
                squadraSerieA: currentTeam,
                voto: voto,
                gf: parseIntSafe(row[colMap.gf]),
                gs: parseIntSafe(row[colMap.gs]),
                rp: parseIntSafe(row[colMap.rp]),
                rs: parseIntSafe(row[colMap.rs]),
                rf: parseIntSafe(row[colMap.rf]),
                au: parseIntSafe(row[colMap.au]),
                amm: parseIntSafe(row[colMap.amm]),
                esp: parseIntSafe(row[colMap.esp]),
                ass: parseIntSafe(row[colMap.ass]),
                timestamp: new Date().toISOString()
            };
            
            votes.push(playerVote);
        }
    }
    
    // Conta giocatori unici per debug
    const uniquePlayers = new Map();
    votes.forEach(v => {
        const key = `${v.codice}_${v.ruolo}`;
        uniquePlayers.set(key, v.nome);
    });
    
    const roleDistribution = { 'P': 0, 'D': 0, 'C': 0, 'A': 0 };
    votes.forEach(v => {
        if (roleDistribution.hasOwnProperty(v.ruolo)) {
            roleDistribution[v.ruolo]++;
        }
    });
    
    console.log(`[VOTI] Parsing completato: ${votes.length} voti, ${uniquePlayers.size} giocatori unici per ${teamCount} squadre`);
    console.log(`[VOTI] Distribuzione per ruolo: P=${roleDistribution.P}, D=${roleDistribution.D}, C=${roleDistribution.C}, A=${roleDistribution.A}`);
    
    // Debug: mostra i primi portieri
    const goalkeepers = votes.filter(v => v.ruolo === 'P').slice(0, 5);
    if (goalkeepers.length > 0) {
        console.log(`[VOTI] Portieri trovati (primi 5):`, goalkeepers.map(p => `${p.nome} (${p.codice}) - ${p.squadraSerieA}`).join(', '));
    } else {
        console.warn(`[VOTI] ⚠️ NESSUN PORTIERE TROVATO!`);
    }
    
    if (votes.length === 0) {
        throw new Error(`Nessun voto trovato nel foglio "Statistico" per la giornata ${giornata}. Controllare il formato del file.`);
    }
    
    updateProgress(40, `Cancellazione voti precedenti giornata ${giornata}...`, null, null, 'votes-xlsx-progress');
    
    // Cancella i voti esistenti per questa giornata
    const votesCollection = getVotesCollectionRef();
    const existingVotesQuery = query(votesCollection, where('giornata', '==', giornata));
    const existingVotesSnapshot = await getDocs(existingVotesQuery);
    
    if (existingVotesSnapshot.docs.length > 0) {
        console.log(`[VOTI] Cancellazione ${existingVotesSnapshot.docs.length} voti precedenti per giornata ${giornata}`);
        const deletePromises = existingVotesSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
    }
    
    updateProgress(55, `Salvataggio ${votes.length} voti giornata ${giornata}...`, null, null, 'votes-xlsx-progress');
    
    // Salva i nuovi voti in Firestore
    let savedCount = 0;
    for (const vote of votes) {
        await addDoc(votesCollection, vote);
        savedCount++;
        
        if (savedCount % 30 === 0 || savedCount === votes.length) {
            const progress = 55 + Math.floor((savedCount / votes.length) * 40);
            updateProgress(progress, `Salvati ${savedCount}/${votes.length} voti...`, null, null, 'votes-xlsx-progress');
        }
    }
    
    updateProgress(100, 'Completato!', null, null, 'votes-xlsx-progress');
    
    // Mostra riepilogo
    renderVotesSummary(votes, giornata);
    
    console.log(`[VOTI] ✅ Giornata ${giornata}: ${savedCount} voti salvati per ${teamCount} squadre`);
    
    return {
        giornata: giornata,
        totalePlayers: votes.length,
        totaleSquadre: teamCount
    };
};

/**
 * Renderizza il riepilogo dei voti caricati
 */
const renderVotesSummary = (votes, giornata) => {
    const container = document.getElementById('votes-summary-container');
    if (!container) return;
    
    // Raggruppa per squadra Serie A
    const teamVotes = new Map();
    votes.forEach(v => {
        if (!teamVotes.has(v.squadraSerieA)) {
            teamVotes.set(v.squadraSerieA, []);
        }
        teamVotes.get(v.squadraSerieA).push(v);
    });
    
    let html = '<div class="bg-gray-800 border border-teal-700/50 rounded-lg p-4 mb-4">';
    html += `<h5 class="text-lg font-bold text-teal-400 mb-3">Riepilogo Voti Giornata ${giornata}</h5>`;
    html += `<p class="text-sm text-gray-300 mb-3">${votes.length} giocatori totali • ${teamVotes.size} squadre</p>`;
    html += '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">';
    
    // Ordina le squadre alfabeticamente
    const sortedTeams = Array.from(teamVotes.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    
    for (const [teamName, players] of sortedTeams) {
        const votati = players.filter(p => p.voto !== null).length;
        const mediaVoto = votati > 0 ? (players.filter(p => p.voto !== null).reduce((sum, p) => sum + p.voto, 0) / votati).toFixed(2) : '-';
        const golFatti = players.reduce((sum, p) => sum + p.gf, 0);
        
        html += `
            <div class="bg-gray-700 rounded p-3 text-center">
                <p class="text-sm font-bold text-white">${teamName}</p>
                <p class="text-xs text-gray-400 mt-1">${players.length} giocatori</p>
                <p class="text-xs text-teal-300">Votati: ${votati}</p>
                <p class="text-xs text-blue-300">Media: ${mediaVoto}</p>
                ${golFatti > 0 ? `<p class="text-xs text-green-300">Gol: ${golFatti}</p>` : ''}
            </div>
        `;
    }
    
    html += '</div></div>';
    container.innerHTML = html;
};

// Esporta variabili di stato per accesso esterno
export const getLocalCsvContent = () => localCsvContent;
export const setLocalCsvContent = (content) => { localCsvContent = content; };

// Esporta tutte le funzioni globali
window.triggerFileInput = triggerFileInput;
window.handleFileSelect = handleFileSelect;
window.confirmUpload = confirmUpload;
window.processNewFile = processNewFile;
window.processUploadedData = processUploadedData;
window.triggerSquadsFileInput = triggerSquadsFileInput;
window.handleSquadsFileSelect = handleSquadsFileSelect;
window.confirmSquadsUpload = confirmSquadsUpload;
window.processSquadsFile = processSquadsFile;
window.triggerFormationsFileInput = triggerFormationsFileInput;
window.handleFormationsFileSelect = handleFormationsFileSelect;
window.confirmFormationsUpload = confirmFormationsUpload;
window.processFormationsFile = processFormationsFile;
window.triggerStatsFileInput = triggerStatsFileInput;
window.handleStatsFileSelect = handleStatsFileSelect;
window.confirmStatsUpload = confirmStatsUpload;
window.processStatsFile = processStatsFile;
window.triggerStatsXlsxFileInput = triggerStatsXlsxFileInput;
window.handleStatsXlsxFileSelect = handleStatsXlsxFileSelect;
window.confirmStatsXlsxUpload = confirmStatsXlsxUpload;
window.processStatsXlsxFile = processStatsXlsxFile;
window.triggerCalendarXlsxFileInput = triggerCalendarXlsxFileInput;
window.handleCalendarXlsxFileSelect = handleCalendarXlsxFileSelect;
window.confirmCalendarXlsxUpload = confirmCalendarXlsxUpload;
window.processCalendarXlsxFile = processCalendarXlsxFile;
window.triggerSquadsXlsxFileInput = triggerSquadsXlsxFileInput;
window.handleSquadsXlsxFileSelect = handleSquadsXlsxFileSelect;
window.confirmSquadsXlsxUpload = confirmSquadsXlsxUpload;
window.processSquadsXlsxFile = processSquadsXlsxFile;
window.triggerFormationsXlsxFileInput = triggerFormationsXlsxFileInput;
window.handleFormationsXlsxFileSelect = handleFormationsXlsxFileSelect;
window.confirmFormationsXlsxUpload = confirmFormationsXlsxUpload;
window.processFormationsXlsxFile = processFormationsXlsxFile;
window.removeFromFormationsQueue = removeFromFormationsQueue;
window.clearFormationsQueue = clearFormationsQueue;
window.triggerVotesXlsxFileInput = triggerVotesXlsxFileInput;
window.handleVotesXlsxFileSelect = handleVotesXlsxFileSelect;
window.confirmVotesXlsxUpload = confirmVotesXlsxUpload;
window.removeFromVotesQueue = removeFromVotesQueue;
window.clearVotesQueue = clearVotesQueue;
