/**
 * debug-formations.js - Script di debug per analizzare i dati delle formazioni
 * Esamina quante giornate e quali squadre hanno dati caricati
 */

import {
    getDocs,
    query,
    where,
    getFormationsCollectionRef
} from './firebase-config.js';

/**
 * Analizza una squadra specifica
 */
export const analyzeSquadra = async (squadraNome) => {
    try {
        console.log(`🔍 Analisi dettagliata di ${squadraNome}...`);
        
        const q = query(
            getFormationsCollectionRef(),
            where('squadra', '==', squadraNome)
        );
        
        const snapshot = await getDocs(q);
        const formations = snapshot.docs.map(doc => doc.data());
        
        if (formations.length === 0) {
            console.log(`❌ Nessuna formazione trovata per ${squadraNome}`);
            return;
        }
        
        console.log(`✓ Total formations for ${squadraNome}: ${formations.length}`);
        
        // Raggruppa per giornata
        const byGiornata = {};
        formations.forEach(f => {
            const g = parseInt(f.giornata);
            if (!byGiornata[g]) byGiornata[g] = [];
            byGiornata[g].push(f);
        });
        
        const giornate = Object.keys(byGiornata).map(g => parseInt(g)).sort((a, b) => a - b);
        
        console.log(`\n📅 Giornate caricate: ${giornate.join(', ')}`);
        console.log(`\n📊 Dettagli per giornata:`);
        
        giornate.forEach(g => {
            const players = byGiornata[g];
            const titolari = players.filter(p => p.sezione === 'TITOLARE').length;
            const panchina = players.filter(p => p.sezione === 'PANCHINA').length;
            console.log(`  Giornata ${g}: ${players.length} giocatori (${titolari} titolari, ${panchina} panchina)`);
        });
        
        // Verifica giornate mancanti dal 1 al 21
        const giornatemancanti = [];
        for (let g = 1; g <= 21; g++) {
            if (!byGiornata[g]) {
                giornatemancanti.push(g);
            }
        }
        
        if (giornatemancanti.length > 0) {
            console.log(`\n⚠️ Giornate mancanti (1-21): ${giornatemancanti.join(', ')}`);
        } else {
            console.log(`\n✅ Tutte le giornate (1-21) sono caricate`);
        }
        
        return {
            squadra: squadraNome,
            totalFormations: formations.length,
            giornate,
            giornatemancanti
        };
        
    } catch (error) {
        console.error('❌ Errore durante l\'analisi:', error);
        throw error;
    }
};

/**
 * Analizza quali giornate e squadre hanno dati nel database
 */
export const analyzeFormationsData = async () => {
    try {
        console.log('🔍 Inizio analisi dati formazioni...');
        
        const snapshot = await getDocs(getFormationsCollectionRef());
        const formations = snapshot.docs.map(doc => doc.data());
        
        console.log(`📊 Total formations found: ${formations.length}`);
        
        // Raggruppa per giornata e squadra
        const byGiornataSquadra = {};
        const giornateSet = new Set();
        const squadreSet = new Set();
        
        formations.forEach(f => {
            const key = `${f.giornata}_${f.squadra}`;
            if (!byGiornataSquadra[key]) {
                byGiornataSquadra[key] = [];
            }
            byGiornataSquadra[key].push(f);
            giornateSet.add(parseInt(f.giornata));
            squadreSet.add(f.squadra);
        });
        
        const giornate = Array.from(giornateSet).sort((a, b) => a - b);
        const squadre = Array.from(squadreSet).sort();
        
        console.log(`\n📅 Giornate caricate: ${giornate.length}`);
        console.log(`Giornate: ${giornate.join(', ')}`);
        
        console.log(`\n🏟️ Squadre caricate: ${squadre.length}`);
        console.log(`Squadre:\n${squadre.map(s => `  - ${s}`).join('\n')}`);
        
        // Crea una matrice giornata x squadra
        console.log(`\n📋 MATRICE GIORNATA x SQUADRA:`);
        console.log(`\nGiornata | ${squadre.map(s => s.padEnd(30)).join(' | ')}`);
        console.log('-'.repeat(30 + squadre.length * 32));
        
        giornate.forEach(g => {
            const row = [g.toString().padEnd(8)];
            squadre.forEach(s => {
                const key = `${g}_${s}`;
                const hasData = byGiornataSquadra[key] ? '✓' : '✗';
                const playerCount = byGiornataSquadra[key] ? byGiornataSquadra[key].length : 0;
                const cellDisplay = `${hasData} (${playerCount})`.padEnd(30);
                row.push(cellDisplay);
            });
            console.log(row.join(' | '));
        });
        
        // Analisi per squadra
        console.log(`\n\n🎯 ANALISI PER SQUADRA:`);
        squadre.forEach(s => {
            const giornateConDati = [];
            giornate.forEach(g => {
                const key = `${g}_${s}`;
                if (byGiornataSquadra[key]) {
                    giornateConDati.push(g);
                }
            });
            const percentuale = ((giornateConDati.length / giornate.length) * 100).toFixed(1);
            console.log(`${s}: ${giornateConDati.length}/${giornate.length} giornate (${percentuale}%) - Giornate: ${giornateConDati.join(', ')}`);
        });
        
        // Analisi per giornata
        console.log(`\n\n📅 ANALISI PER GIORNATA:`);
        giornate.forEach(g => {
            const squadreConDati = [];
            squadre.forEach(s => {
                const key = `${g}_${s}`;
                if (byGiornataSquadra[key]) {
                    squadreConDati.push(s);
                }
            });
            const percentuale = ((squadreConDati.length / squadre.length) * 100).toFixed(1);
            console.log(`Giornata ${g}: ${squadreConDati.length}/${squadre.length} squadre (${percentuale}%)`);
        });
        
        // Giornate mancanti per ogni squadra
        console.log(`\n\n⚠️ GIORNATE MANCANTI PER SQUADRA:`);
        squadre.forEach(s => {
            const giornateConDati = new Set();
            giornate.forEach(g => {
                const key = `${g}_${s}`;
                if (byGiornataSquadra[key]) {
                    giornateConDati.add(g);
                }
            });
            const giornatemancanti = giornate.filter(g => !giornateConDati.has(g));
            if (giornatemancanti.length > 0) {
                console.log(`${s}: Mancano giornate ${giornatemancanti.join(', ')}`);
            } else {
                console.log(`${s}: ✓ Completo`);
            }
        });
        
        // Riepilogo
        console.log(`\n\n📈 RIEPILOGO:`);
        const totalCombinazioni = giornate.length * squadre.length;
        const combinazioniCaricate = Object.keys(byGiornataSquadra).length;
        console.log(`Combinazioni giornata-squadra caricate: ${combinazioniCaricate}/${totalCombinazioni} (${((combinazioniCaricate/totalCombinazioni)*100).toFixed(1)}%)`);
        
        return {
            giornate,
            squadre,
            byGiornataSquadra,
            totalFormations: formations.length,
            totalCombinazioni: combinazioniCaricate,
            totalPossibili: totalCombinazioni
        };
        
    } catch (error) {
        console.error('❌ Errore durante l\'analisi:', error);
        throw error;
    }
};

// Esponi globalmente per accesso dalla console
window.analyzeFormationsData = analyzeFormationsData;
window.analyzeSquadra = analyzeSquadra;
