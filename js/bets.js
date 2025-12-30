/**
 * bets.js - Modulo gestione scommesse
 * Funzioni per piazzare, visualizzare e gestire le scommesse
 */

import { 
    db, 
    query, 
    where, 
    getDocs, 
    getDoc,
    setDoc,
    doc, 
    onSnapshot,
    getGiornataBetsCollectionRef
} from './firebase-config.js';
import { getTeamLogo } from './config.js';
import { messageBox } from './utils.js';
import { 
    getCurrentPredictions, 
    setCurrentPredictions, 
    clearCurrentPredictions,
    getOpenMatches, 
    setOpenMatches,
    getNextGiornataNumber, 
    setNextGiornataNumber,
    getUserId, 
    getUserCredits,
    getIsUserAdmin,
    getDeadlineHasPassed,
    setDeadlineHasPassed,
    getCountdownInterval,
    setCountdownInterval,
    clearCountdownInterval,
    getCurrentBetsFilter,
    getAdminBetsUnsubscribe,
    setAdminBetsUnsubscribe
} from './state.js';
import { adjustCredits, addUnsubscribe } from './auth.js';

// Import di funzioni che saranno definite altrove
let getGiornataDeadline;
let isDeadlinePassed;
let checkPendingBonusRequests;
let renderAdminBetsList;

// Setter per dipendenze esterne
export const setBetsDependencies = (deps) => {
    getGiornataDeadline = deps.getGiornataDeadline;
    isDeadlinePassed = deps.isDeadlinePassed;
    checkPendingBonusRequests = deps.checkPendingBonusRequests;
    renderAdminBetsList = deps.renderAdminBetsList;
};

/**
 * Registra localmente la previsione per un singolo match
 */
export const recordPrediction = (matchId, prediction) => {
    const openMatches = getOpenMatches();
    const currentPredictions = getCurrentPredictions();
    
    // Verifica se l'utente ha già scommesse confermate per questa giornata
    const hasConfirmedBets = openMatches.some(m => m.userBet && m.userBet.stake > 0);
    if (hasConfirmedBets) {
        messageBox("Non puoi modificare le scommesse dopo averle confermate per questa giornata.");
        return;
    }

    const matchContainer = document.getElementById(`match-${matchId}`);
    if (!matchContainer) return;
    
    // Rimuovi la classe 'local-selected' da tutte le opzioni di questo match
    matchContainer.querySelectorAll('.bet-option').forEach(el => {
        el.classList.remove('local-selected');
    });
    
    const selectedElement = matchContainer.querySelector(`[data-match-id="${matchId}"][data-prediction="${prediction}"]`);
    
    // Aggiorna sempre la previsione (no toggle)
    currentPredictions[matchId] = prediction;
    setCurrentPredictions(currentPredictions);
    
    if (selectedElement) {
        selectedElement.classList.add('local-selected');
    }

    updateGiornataBetButton();
};

/**
 * Funzione di utilità per abilitare/disabilitare il pulsante di salvataggio
 */
export const updateGiornataBetButton = () => {
    const button = document.getElementById('place-giornata-bet-button');
    const stakeInput = document.getElementById('bet-stake-input');
    const winPreviewEl = document.getElementById('win-preview');
    
    if (!button || !stakeInput) return;

    const openMatches = getOpenMatches();
    const currentPredictions = getCurrentPredictions();
    const userCredits = getUserCredits();
    
    const requiredMatches = openMatches.length;
    const predictedMatches = Object.keys(currentPredictions).length;
    const stake = parseInt(stakeInput.value, 10);
    
    // Calcola la vincita potenziale (puntata × quota totale)
    let potentialWin = 0;
    let quotaTotale = 1;
    
    if (predictedMatches > 0 && stake > 0) {
        openMatches.forEach(match => {
            const prediction = currentPredictions[match.id];
            if (prediction && match.odds && match.odds[prediction]) {
                const quota = parseFloat(match.odds[prediction]);
                quotaTotale *= quota;
            }
        });
        
        // Vincita = Puntata totale × Quota totale
        potentialWin = stake * quotaTotale;
    }
    
    // Aggiorna l'anteprima della vincita
    if (winPreviewEl) {
        if (predictedMatches === requiredMatches && stake > 0) {
            const profitto = potentialWin - stake;
            
            winPreviewEl.innerHTML = `
                <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
                    <h4 class="text-sm font-semibold text-gray-400 mb-2">Anteprima Vincita</h4>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <p class="text-xs text-gray-500">Puntata Totale</p>
                            <p class="text-lg font-bold text-white">${stake.toFixed(2)} Cr</p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500">Quota Totale</p>
                            <p class="text-lg font-bold text-blue-400">${quotaTotale.toFixed(2)}</p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500">Vincita Potenziale</p>
                            <p class="text-xl font-bold text-green-400">${potentialWin.toFixed(2)} Cr</p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500">Profitto Netto</p>
                            <p class="text-xl font-bold ${profitto >= 0 ? 'text-green-400' : 'text-red-400'}">${profitto >= 0 ? '+' : ''}${profitto.toFixed(2)} Cr</p>
                        </div>
                    </div>
                    <div class="mt-3 pt-3 border-t border-gray-700">
                        <p class="text-xs text-gray-500 mb-1">Quote selezionate:</p>
                        <div class="flex flex-wrap gap-2">
                            ${openMatches.map(m => {
                                const pred = currentPredictions[m.id];
                                return pred ? `<span class="text-xs bg-gray-700 px-2 py-1 rounded">${m.homeTeam.substring(0,10)} vs ${m.awayTeam.substring(0,10)}: ${pred} @ ${m.odds[pred]}</span>` : '';
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
        } else {
            winPreviewEl.innerHTML = `
                <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
                    <p class="text-sm text-gray-500">Seleziona tutte le partite e inserisci la puntata per vedere l'anteprima della vincita</p>
                </div>
            `;
        }
    }
    
    if (requiredMatches === 0) {
        button.disabled = true;
        button.textContent = "Nessuna partita aperta per scommettere.";
        return;
    }

    // Verifica se l'utente ha già scommesse confermate
    const hasConfirmedBets = openMatches.some(m => m.userBet && m.userBet.stake > 0);
    if (hasConfirmedBets) {
        button.disabled = true;
        button.textContent = "Hai già confermato le scommesse per questa giornata";
        button.classList.replace('btn-primary', 'btn-secondary');
        return;
    }

    // Aggiorna il testo del pulsante in base allo stato
    if (predictedMatches === requiredMatches) {
        const totalStake = stake;
        if (totalStake > userCredits || totalStake <= 0) {
            button.disabled = true;
            button.textContent = totalStake > userCredits ? 
                `Crediti insufficienti! (${totalStake} Cr richiesti)` : 
                'Inserisci una puntata valida';
            button.classList.replace('btn-primary', 'btn-danger');
        } else {
            button.disabled = false;
            button.textContent = `Conferma Scommesse Giornata (${totalStake} Crediti)`;
            button.classList.replace('btn-danger', 'btn-primary');
        }
    } else {
        button.disabled = true;
        button.textContent = `Devi selezionare TUTTE le partite (${predictedMatches}/${requiredMatches})`;
        button.classList.replace('btn-primary', 'btn-secondary');
        button.classList.remove('btn-danger');
    }
};

/**
 * Salva tutte le predizioni per la giornata
 */
export const placeBetForGiornata = async () => {
    console.log('placeBetForGiornata chiamato');
    
    const stakeInput = document.getElementById('bet-stake-input');
    const totalStake = parseInt(stakeInput.value, 10);
    
    const openMatches = getOpenMatches();
    const currentPredictions = getCurrentPredictions();
    const userId = getUserId();
    const userCredits = getUserCredits();
    const nextGiornataNumber = getNextGiornataNumber();
    
    const requiredMatches = openMatches.length;
    const predictedMatches = Object.keys(currentPredictions).length;
    
    const currentGiornata = nextGiornataNumber.toString();
    console.log('Stato scommessa:', {
        giornata: currentGiornata,
        requiredMatches,
        predictedMatches,
        totalStake,
        userCredits,
        currentPredictions
    });
    
    // CONTROLLO DEADLINE: Verifica se è ancora possibile scommettere
    try {
        const deadlinePassed = await isDeadlinePassed(currentGiornata);
        if (deadlinePassed) {
            const { deadline, confirmed } = await getGiornataDeadline(currentGiornata);
            const status = confirmed ? 'confermato' : 'stimato';
            messageBox(`⏰ SCOMMESSE CHIUSE!\n\nLa deadline per questa giornata è scaduta.\nOrario di chiusura (${status}): ${deadline.toLocaleString('it-IT')}`);
            return;
        }
    } catch (error) {
        console.error('Errore verifica deadline:', error);
        messageBox("Errore nella verifica della deadline. Riprova.");
        return;
    }
    
    // Verifica se ci sono già scommesse SALVATE su Firestore per questa giornata
    try {
        const qExistingBets = query(
            getGiornataBetsCollectionRef(),
            where('userId', '==', userId),
            where('giornata', '==', currentGiornata)
        );
        const existingBetsSnapshot = await getDocs(qExistingBets);
        
        if (!existingBetsSnapshot.empty) {
            console.warn('Scommesse già presenti per questa giornata:', existingBetsSnapshot.size);
            messageBox("Hai già piazzato le scommesse per questa giornata. Non puoi modificarle.");
            return;
        }
    } catch (error) {
        console.error('Errore verifica scommesse esistenti:', error);
        messageBox("Errore durante la verifica delle scommesse esistenti.");
        return;
    }
    
    if (predictedMatches !== requiredMatches) {
        messageBox(`Devi selezionare OBBLIGATORIAMENTE un pronostico per tutte e ${requiredMatches} le partite della giornata.`);
        return;
    }
    
    if (totalStake <= 0 || isNaN(totalStake)) {
        messageBox("La puntata per la giornata deve essere un numero positivo.");
        return;
    }

    if (totalStake > userCredits) {
        messageBox(`Crediti insufficienti. La puntata totale (${totalStake} crediti) supera il saldo disponibile (${userCredits}).`);
        return;
    }
    
    // Chiedi conferma all'utente
    if (!confirm(`ATTENZIONE: Stai per confermare le scommesse per tutta la giornata.\nImporto totale: ${totalStake} crediti\nUna volta confermata, non potrai più modificare le tue scelte.\n\nProcedere?`)) {
        console.log('Utente ha annullato la conferma');
        return;
    }
    
    const stakePerMatch = totalStake / requiredMatches;
    console.log('Puntata per partita:', stakePerMatch);

    try {
         console.log('Inizio salvataggio scommesse...');
         
         // Crea UNA SOLA scommessa per la giornata con tutte le predictions
         const predictions = [];
         let totalOdds = 1;
         
         openMatches.forEach(match => {
             const matchId = match.id;
             const prediction = currentPredictions[matchId];
             
             if (!prediction) {
                 console.warn('Previsione mancante per match:', matchId);
                 return;
             }
             
             const odds = match.odds[prediction];
             totalOdds *= odds; // Quota totale moltiplicativa
             
             predictions.push({
                 matchId: matchId,
                 homeTeam: match.homeTeam,
                 awayTeam: match.awayTeam,
                 prediction: prediction,
                 odds: odds,
                 date: match.date
             });
         });
         
         // Calcola vincita potenziale (puntata * quota totale)
         const potentialWinnings = totalStake * totalOdds;
         
         console.log('Dettagli scommessa:', {
             predictions: predictions.length,
             quotaTotale: totalOdds.toFixed(2),
             puntata: totalStake,
             vincitaPotenziale: potentialWinnings.toFixed(2)
         });
         
         // Salva UNA SOLA scommessa per la giornata
         const betDocRef = doc(getGiornataBetsCollectionRef(), `${userId}_giornata_${currentGiornata}`);
         
         const betData = {
            userId: userId,
            giornata: currentGiornata,
            predictions: predictions, // Array di tutte le predictions
            stake: totalStake, // Puntata totale
            quotaTotale: totalOdds, // Quota totale moltiplicativa
            potentialWinnings: potentialWinnings, // Vincita potenziale
            timestamp: new Date().toISOString(),
            settled: false // Flag per liquidazione
         };
         
         console.log('Salvataggio scommessa unica per giornata:', betData);
         await setDoc(betDocRef, betData);
         console.log('Scommessa salvata con successo su Firestore');

         // Sottrai i crediti e aggiorna Firestore
         console.log('Aggiornamento crediti...');
         await adjustCredits(-totalStake);
         console.log('Crediti aggiornati');

         // Reset dello stato locale dopo il successo
         clearCurrentPredictions();

         // Pulisci il campo di input
         if (stakeInput) stakeInput.value = '';

         messageBox(`Scommessa piazzata con successo per la Giornata ${currentGiornata}.\nPuntata totale: ${totalStake} crediti\nQuota totale: ${totalOdds.toFixed(2)}\nVincita potenziale: ${potentialWinnings.toFixed(2)} crediti`);
         
         // Ricarica la scommessa appena salvata e aggiorna le partite
         console.log('Ricarica scommessa dopo salvataggio...');
         const savedBetSnapshot = await getDoc(betDocRef);
         if (savedBetSnapshot.exists()) {
             const savedBet = savedBetSnapshot.data();
             console.log('Scommessa ricaricata:', savedBet);
             
             // Aggiorna openMatches con i dati della scommessa salvata
             const updatedMatches = openMatches.map(match => {
                 const prediction = savedBet.predictions?.find(p => p.matchId === match.id);
                 if (prediction) {
                     match.userBet = {
                         prediction: prediction.prediction,
                         stake: savedBet.stake,
                         odds: prediction.odds
                     };
                 }
                 return match;
             });
             setOpenMatches(updatedMatches);
         }
         
         // Aggiorna la vista per mostrare la scommessa confermata
         console.log('Aggiornamento vista dopo salvataggio...');
         renderOpenMatches(openMatches, nextGiornataNumber);

    } catch (error) {
        console.error("Errore piazzamento scommessa:", error);
        messageBox(`Errore nel piazzamento della scommessa: ${error.message || error}`);
    }
};

/**
 * Renderizza il countdown della deadline scommesse
 */
export const renderBetDeadlineCountdown = async (giornata) => {
    const countdownEl = document.getElementById('bet-deadline-countdown');
    if (!countdownEl) return;
    
    const isUserAdmin = getIsUserAdmin();
    
    try {
        const { deadline, confirmed, notes } = await getGiornataDeadline(giornata);
        const now = new Date();
        const isPast = now >= deadline;
        
        // Se la deadline è appena passata, controlla i bonus per l'admin
        if (isPast && !getDeadlineHasPassed() && isUserAdmin) {
            setDeadlineHasPassed(true);
            const notificationShown = localStorage.getItem('bonusNotificationShown');
            if (notificationShown !== giornata.toString()) {
                checkPendingBonusRequests();
            }
        }
        
        if (isPast) {
            countdownEl.innerHTML = `
                <div class="bg-red-900/30 border-l-4 border-red-500 p-4 rounded-lg">
                    <div class="flex items-center">
                        <svg class="w-6 h-6 text-red-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                        </svg>
                        <div>
                            <p class="text-red-300 font-bold text-lg">⏰ SCOMMESSE CHIUSE</p>
                            <p class="text-red-200 text-sm">La deadline per la Giornata ${giornata} è scaduta il ${deadline.toLocaleString('it-IT')}</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }
        
        // Calcola tempo rimanente
        const diff = deadline - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        // Colore e icona in base al tempo rimanente
        let bgColor, borderColor, textColor, iconColor, statusIcon;
        if (days > 2) {
            bgColor = 'bg-green-900/20';
            borderColor = 'border-green-500';
            textColor = 'text-green-300';
            iconColor = 'text-green-400';
            statusIcon = `<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>`;
        } else if (days > 0 || hours > 12) {
            bgColor = 'bg-yellow-900/20';
            borderColor = 'border-yellow-500';
            textColor = 'text-yellow-300';
            iconColor = 'text-yellow-400';
            statusIcon = `<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path>`;
        } else {
            bgColor = 'bg-red-900/20';
            borderColor = 'border-red-500';
            textColor = 'text-red-300';
            iconColor = 'text-red-400';
            statusIcon = `<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>`;
        }
        
        const confirmedBadge = confirmed 
            ? `<span class="ml-2 px-2 py-1 bg-green-600 text-white text-xs rounded-full">✓ Confermato</span>`
            : `<span class="ml-2 px-2 py-1 bg-orange-600 text-white text-xs rounded-full">⚠ Da confermare</span>`;
        
        // Aggiungi animazione se manca meno di 1 ora
        const urgentClass = (days === 0 && hours < 1) ? 'countdown-urgent' : '';
        
        countdownEl.innerHTML = `
            <div class="${bgColor} border-l-4 ${borderColor} p-4 rounded-lg ${urgentClass}">
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <svg class="w-6 h-6 ${iconColor} mr-3" fill="currentColor" viewBox="0 0 20 20">
                            ${statusIcon}
                        </svg>
                        <div>
                            <p class="${textColor} font-bold text-lg">
                                Chiusura scommesse Giornata ${giornata}
                                ${confirmedBadge}
                            </p>
                            <p class="text-gray-300 text-sm mt-1">
                                ${deadline.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} 
                                alle ${deadline.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-gray-400 text-xs mb-1">Tempo rimanente:</p>
                        <div class="flex space-x-2 text-center">
                            ${days > 0 ? `
                                <div class="bg-gray-800 px-3 py-2 rounded">
                                    <p class="${textColor} text-2xl font-bold">${days}</p>
                                    <p class="text-gray-400 text-xs">giorni</p>
                                </div>
                            ` : ''}
                            <div class="bg-gray-800 px-3 py-2 rounded">
                                <p class="${textColor} text-2xl font-bold">${hours}</p>
                                <p class="text-gray-400 text-xs">ore</p>
                            </div>
                            <div class="bg-gray-800 px-3 py-2 rounded">
                                <p class="${textColor} text-2xl font-bold">${minutes}</p>
                                <p class="text-gray-400 text-xs">min</p>
                            </div>
                            ${days === 0 && hours < 1 ? `
                                <div class="bg-gray-800 px-3 py-2 rounded">
                                    <p class="${textColor} text-2xl font-bold">${seconds}</p>
                                    <p class="text-gray-400 text-xs">sec</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Errore rendering countdown:', error);
        countdownEl.innerHTML = '';
    }
};

/**
 * Renderizza il countdown della deadline bonus
 */
export const renderBonusDeadlineCountdown = async (giornata) => {
    const countdownEl = document.getElementById('bonus-deadline-countdown');
    if (!countdownEl) return;
    
    try {
        const { deadline, confirmed, notes } = await getGiornataDeadline(giornata);
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
            document.querySelectorAll('#user-bonus-content input[type="checkbox"]').forEach(checkbox => {
                checkbox.disabled = true;
            });
            
            // Disabilita il pulsante salva
            const saveButtons = document.querySelectorAll('button[onclick="saveUserBonusData()"]');
            saveButtons.forEach(btn => {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            });
            
            return;
        }
        
        // Abilita le checkbox se non è scaduto
        document.querySelectorAll('#user-bonus-content input[type="checkbox"]').forEach(checkbox => {
            if (!checkbox.disabled) {
                checkbox.disabled = false;
            }
        });
        
        // Abilita il pulsante salva
        const saveButtons = document.querySelectorAll('button[onclick="saveUserBonusData()"]');
        saveButtons.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        });
        
        // Calcola tempo rimanente
        const diff = deadline - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        // Colore e icona in base al tempo rimanente
        let bgColor, borderColor, textColor, iconColor, statusIcon;
        if (days > 2) {
            bgColor = 'bg-green-900/20';
            borderColor = 'border-green-500';
            textColor = 'text-green-300';
            iconColor = 'text-green-400';
            statusIcon = `<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>`;
        } else if (days > 0 || hours > 12) {
            bgColor = 'bg-yellow-900/20';
            borderColor = 'border-yellow-500';
            textColor = 'text-yellow-300';
            iconColor = 'text-yellow-400';
            statusIcon = `<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path>`;
        } else {
            bgColor = 'bg-red-900/20';
            borderColor = 'border-red-500';
            textColor = 'text-red-300';
            iconColor = 'text-red-400';
            statusIcon = `<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>`;
        }
        
        const confirmedBadge = confirmed 
            ? `<span class="ml-2 px-2 py-1 bg-green-600 text-white text-xs rounded-full">✓ Confermato</span>`
            : `<span class="ml-2 px-2 py-1 bg-orange-600 text-white text-xs rounded-full">⚠ Da confermare</span>`;
        
        // Aggiungi animazione se manca meno di 1 ora
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

/**
 * Helper per renderizzare un'opzione di scommessa
 */
const renderBetOption = (match, prediction, userBet, hasConfirmedBets) => {
    const currentPredictions = getCurrentPredictions();
    const isSavedBet = userBet.prediction === prediction;
    const isLocalBet = currentPredictions[match.id] === prediction;
    const hasSavedBet = userBet.stake > 0;

    let betClass = '';
    let pointerEvents = '';
    let opacity = '';
    
    // Se ci sono scommesse confermate per la giornata, blocca tutti i click
    if (hasConfirmedBets) {
        if (isSavedBet) {
            betClass = 'saved-bet';
        } else {
            opacity = 'opacity-50';
        }
        pointerEvents = 'pointer-events-none';
    } else {
        if (isLocalBet) {
            betClass = 'local-selected';
        }
    }
    
    const clickHandler = hasConfirmedBets ? '' : `onclick="recordPrediction('${match.id}', '${prediction}')"`;
    
    return `
        <div ${clickHandler}
             data-match-id="${match.id}" 
             data-prediction="${prediction}"
             class="bet-option ${betClass} ${pointerEvents} ${opacity} p-3 text-center bg-gray-800 rounded-lg cursor-${hasConfirmedBets ? 'not-allowed' : 'pointer'}">
            <p class="text-lg font-semibold">${prediction}</p>
            <p class="text-xs text-gray-400">Quota: ${match.odds[prediction]}</p>
        </div>
    `;
};

/**
 * Renderizza le partite aperte per le scommesse
 */
export const renderOpenMatches = (matches, nextGiornata) => {
    console.log('renderOpenMatches chiamato con:', { 
        matches: matches?.map(m => ({
            id: m.id,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            giornata: m.giornata,
            status: m.status,
            result: m.result
        })),
        nextGiornata 
    });
    
    // Reset del flag quando si cambia giornata
    setDeadlineHasPassed(false);
    
    // Renderizza il countdown della deadline
    renderBetDeadlineCountdown(nextGiornata);
    
    // Avvia timer per aggiornare il countdown ogni secondo
    clearCountdownInterval();
    const interval = setInterval(() => {
        renderBetDeadlineCountdown(nextGiornata);
    }, 1000);
    setCountdownInterval(interval);
    
    const listContainer = document.getElementById('open-matches-list');
    const noMatchesMessage = document.getElementById('no-open-matches');
    const stakeButton = document.getElementById('place-giornata-bet-button');
    
    if (!listContainer || !noMatchesMessage || !stakeButton) {
        console.error('Elementi UI mancanti:', {
            listContainer: !!listContainer,
            noMatchesMessage: !!noMatchesMessage,
            stakeButton: !!stakeButton
        });
        return;
    }

    setNextGiornataNumber(nextGiornata);
    listContainer.innerHTML = '';
    
    // Verifica se ci sono già scommesse confermate
    const hasConfirmedBets = matches.some(m => m.userBet && m.userBet.stake > 0);
    console.log('Stato scommesse:', { hasConfirmedBets, matchesCount: matches?.length });
    
    // Se ci sono scommesse confermate, disabilita input e mostra messaggio
    const stakeInputEl = document.getElementById('bet-stake-input');
    if (stakeInputEl) {
        stakeInputEl.disabled = hasConfirmedBets;
        if (hasConfirmedBets) {
            stakeInputEl.value = '';
            stakeInputEl.placeholder = 'Scommessa già piazzata';
        }
    }
    
    // Se non ci sono scommesse confermate, resetta le predizioni locali
    if (!hasConfirmedBets) {
        clearCurrentPredictions();
    } else {
        // Se ci sono scommesse confermate, caricale nelle predizioni locali
        const predictions = matches.reduce((acc, match) => {
            if (match.userBet && match.userBet.prediction) {
                acc[match.id] = match.userBet.prediction;
            }
            return acc;
        }, {});
        setCurrentPredictions(predictions);
    }

    if (!matches || matches.length === 0) {
        noMatchesMessage.classList.remove('hidden');
        noMatchesMessage.textContent = 'Nessuna partita aperta per le scommesse al momento.';
        stakeButton.disabled = true;
        stakeButton.textContent = "Nessuna partita aperta";
        listContainer.innerHTML = ''; 
        return;
    }

    // Filtra solo le partite della prossima giornata
    const filteredMatches = matches.filter(m => {
        const matchGiornata = parseInt(m.giornata || '0', 10) || 0;
        console.log('Valutando partita:', m.homeTeam, 'vs', m.awayTeam, 
                  'Giornata:', matchGiornata, 
                  'Target:', nextGiornata,
                  'Match:', matchGiornata === nextGiornata);
        return matchGiornata === nextGiornata;
    });

    if (filteredMatches.length === 0) {
        noMatchesMessage.classList.remove('hidden');
        noMatchesMessage.textContent = `Nessuna partita aperta per la Giornata ${nextGiornata} (Prossima giornata di scommesse).`;
        stakeButton.disabled = true;
        stakeButton.textContent = "Nessuna partita aperta";
        listContainer.innerHTML = '';
        return;
    }

    noMatchesMessage.classList.add('hidden');

    // Costruzione DOM con fragment
    const frag = document.createDocumentFragment();
    
    // Aggiungi messaggio se le scommesse sono già state piazzate
    if (hasConfirmedBets) {
        let totalStakeSaved = 0;
        let potentialWinSaved = 0;
        
        filteredMatches.forEach(match => {
            const userBet = match.userBet || {};
            if (userBet.stake > 0 && userBet.prediction && userBet.odds) {
                totalStakeSaved += userBet.stake;
                potentialWinSaved += userBet.stake * parseFloat(userBet.odds);
            }
        });
        
        const profittoSaved = potentialWinSaved - totalStakeSaved;
        
        const alertDiv = document.createElement('div');
        alertDiv.className = 'bg-yellow-900 border-l-4 border-yellow-500 text-yellow-200 p-4 mb-4 rounded';
        alertDiv.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <svg class="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                    </svg>
                    <p class="font-semibold">Scommesse già piazzate per questa giornata</p>
                </div>
                <div class="text-right">
                    <p class="text-xs">Vincita Potenziale</p>
                    <p class="text-xl font-bold text-green-300">${potentialWinSaved.toFixed(2)} Cr</p>
                    <p class="text-xs">(Profitto: <span class="font-semibold ${profittoSaved >= 0 ? 'text-green-300' : 'text-red-300'}">${profittoSaved >= 0 ? '+' : ''}${profittoSaved.toFixed(2)} Cr</span>)</p>
                </div>
            </div>
        `;
        frag.appendChild(alertDiv);
    }
    
    const title = document.createElement('div');
    title.innerHTML = `<h3 class="text-xl font-bold text-yellow-500 mb-4">Scommetti su: Giornata ${nextGiornata} (${filteredMatches.length} Partite)</h3>`;
    frag.appendChild(title);

    filteredMatches.sort((a, b) => new Date(a.date) - new Date(b.date));

    const currentPredictions = getCurrentPredictions();
    
    filteredMatches.forEach(match => {
        const userBet = match.userBet || { prediction: null, stake: 0 };
        if (userBet.prediction) {
            currentPredictions[match.id] = userBet.prediction;
        }

        const matchCard = document.createElement('div');
        matchCard.id = `match-${match.id}`;
        matchCard.className = 'card p-4 mb-4';

        let stakeStatusText;
        if (userBet.stake > 0) {
            const potentialWinForMatch = userBet.stake * parseFloat(userBet.odds || 1);
            const profitForMatch = potentialWinForMatch - userBet.stake;
            stakeStatusText = `
                <span class="font-bold text-yellow-300">SALVATA: ${userBet.prediction} @ ${userBet.odds}</span>
                <span class="text-sm text-gray-400"> | Puntata: ${userBet.stake.toFixed(2)} Cr</span>
                <span class="text-sm text-green-400"> | Vincita potenziale: ${potentialWinForMatch.toFixed(2)} Cr (${profitForMatch >= 0 ? '+' : ''}${profitForMatch.toFixed(2)} Cr)</span>
            `;
        } else {
            stakeStatusText = `Nessuna`;
        }

        matchCard.innerHTML = `
            <div class="mb-4">
                <!-- Header con data -->
                <div class="flex justify-end mb-3">
                    <span class="text-xs sm:text-sm text-gray-400 bg-gray-700 px-3 py-1 rounded-full">${match.date}</span>
                </div>
                
                <!-- Squadre -->
                <div class="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-4 pb-4 border-b border-gray-700">
                    <!-- Squadra Casa -->
                    <div class="flex flex-col items-center text-center flex-1 w-full sm:w-auto">
                        <img src="${getTeamLogo(match.homeTeam)}" alt="${match.homeTeam}" class="w-16 h-16 sm:w-12 sm:h-12 object-contain rounded mb-2" onerror="this.style.display='none'">
                        <h3 class="text-lg sm:text-xl font-bold text-green-400 break-words">${match.homeTeam}</h3>
                    </div>
                    
                    <!-- VS -->
                    <div class="text-2xl sm:text-3xl font-bold text-gray-500 px-2">VS</div>
                    
                    <!-- Squadra Trasferta -->
                    <div class="flex flex-col items-center text-center flex-1 w-full sm:w-auto">
                        <img src="${getTeamLogo(match.awayTeam)}" alt="${match.awayTeam}" class="w-16 h-16 sm:w-12 sm:h-12 object-contain rounded mb-2" onerror="this.style.display='none'">
                        <h3 class="text-lg sm:text-xl font-bold text-blue-400 break-words">${match.awayTeam}</h3>
                    </div>
                </div>
            </div>
            
            <p class="mb-4 text-sm text-gray-400">
                <span class="font-semibold text-gray-300">Scommessa:</span> ${stakeStatusText}
            </p>
            
            <div class="grid grid-cols-3 gap-3">
                ${renderBetOption(match, '1', userBet, hasConfirmedBets)}
                ${renderBetOption(match, 'X', userBet, hasConfirmedBets)}
                ${renderBetOption(match, '2', userBet, hasConfirmedBets)}
            </div>
        `;
        frag.appendChild(matchCard);
    });

    setCurrentPredictions(currentPredictions);
    listContainer.appendChild(frag);
    updateGiornataBetButton();
};

/**
 * Renderizza le scommesse già piazzate dall'utente
 */
export const renderPlacedBets = (userBets) => {
    const listContainer = document.getElementById('user-placed-bets-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (!userBets || userBets.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-500 text-center">Non hai ancora piazzato nessuna scommessa per le prossime giornate.</p>';
        return;
    }

    // Raggruppa per giornata
    const betsByGiornata = userBets.reduce((acc, bet) => {
        const giornata = bet.giornata || 'Sconosciuta';
        if (!acc[giornata]) acc[giornata] = [];
        acc[giornata].push(bet);
        return acc;
    }, {});

    const sortedGiornate = Object.keys(betsByGiornata).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

    sortedGiornate.forEach(giornata => {
        const giornataHeader = document.createElement('h4');
        giornataHeader.className = 'text-xl font-bold text-yellow-500 mt-4 mb-3 border-b border-gray-700 pb-2';
        giornataHeader.textContent = `Giornata ${giornata}`;
        listContainer.appendChild(giornataHeader);

        betsByGiornata[giornata].forEach(bet => {
            const betCard = document.createElement('div');
            betCard.className = 'card p-4 mb-3 border-l-4 border-blue-500';
            
            let betHTML = `
                <div class="mb-3">
                    <div class="flex justify-between items-center">
                        <h5 class="font-semibold text-green-300 text-lg">Scommessa Giornata ${giornata}</h5>
                        <div class="text-right">
                            <div class="text-sm text-gray-400">
                                Puntata: <span class="font-bold text-blue-400">${bet.stake || 0}</span> crediti
                            </div>
                            <div class="text-sm text-gray-400">
                                Quota Totale: <span class="font-bold text-blue-400">${bet.quotaTotale ? bet.quotaTotale.toFixed(2) : '-'}</span>
                            </div>
                            <div class="text-sm text-gray-400">
                                Vincita Potenziale: <span class="font-bold text-green-400">${bet.potentialWinnings ? bet.potentialWinnings.toFixed(2) : '-'}</span> crediti
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Mostra i pronostici
            if (bet.predictions && bet.predictions.length > 0) {
                betHTML += '<div class="space-y-2">';
                bet.predictions.forEach(pred => {
                    betHTML += `
                        <div class="p-2 bg-gray-800 rounded-lg border border-gray-700">
                            <div class="flex justify-between items-center">
                                <div class="flex-1">
                                    <div class="font-semibold">${pred.homeTeam || '-'} vs ${pred.awayTeam || '-'}</div>
                                    <div class="text-sm text-gray-400">
                                        Pronostico: <span class="font-bold text-blue-400">${pred.prediction}</span> 
                                        (Quota: ${pred.odds ? parseFloat(pred.odds).toFixed(2) : '-'})
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                });
                betHTML += '</div>';
            }
            
            betCard.innerHTML = betHTML;
            listContainer.appendChild(betCard);
        });
    });
};

/**
 * Setup listener per le scommesse admin
 */
export const setupAdminBetsListener = (giornataNum, allUsers) => {
    // Disiscrivi il listener precedente se esiste
    const existingUnsubscribe = getAdminBetsUnsubscribe();
    if (existingUnsubscribe) {
        try { existingUnsubscribe(); } catch (e) { /* ignore */ }
        setAdminBetsUnsubscribe(null);
    }

    const adminBetsList = document.getElementById('admin-bets-list');
    const isUserAdmin = getIsUserAdmin();
    
    if (!isUserAdmin) {
        if (adminBetsList) adminBetsList.innerHTML = '<p class="text-gray-500">Accesso non autorizzato.</p>';
        return;
    }

    // Carica TUTTE le scommesse
    const unsubscribe = addUnsubscribe(
        onSnapshot(getGiornataBetsCollectionRef(), (snapshot) => {
            const allCurrentBets = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            console.log('Scommesse caricate per admin:', allCurrentBets.length);
            if (renderAdminBetsList) {
                renderAdminBetsList(allCurrentBets, allUsers || [], getCurrentBetsFilter());
            }
        }, (error) => console.error("Errore onSnapshot Bets (Admin):", error))
    );
    
    setAdminBetsUnsubscribe(unsubscribe);
};

// Esporta funzioni per uso globale (window)
export const setupGlobalBetsFunctions = () => {
    window.recordPrediction = recordPrediction;
    window.updateGiornataBetButton = updateGiornataBetButton;
    window.placeBetForGiornata = placeBetForGiornata;
};
