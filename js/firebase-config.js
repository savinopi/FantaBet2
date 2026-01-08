/**
 * FANTABet - Configurazione Firebase
 * 
 * Questo modulo gestisce l'inizializzazione e la configurazione di Firebase
 * inclusi Firestore e Authentication.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.11/firebase-app.js";
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    addDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.6.11/firebase-auth.js";

// ===================================
// CONFIGURAZIONE FIREBASE
// ===================================

const firebaseConfig = {
    apiKey: "AIzaSyD9FAyUKCHkP9v_gEWnh4kLDFjyKMKWw74",
    authDomain: "fantabet-op.firebaseapp.com",
    projectId: "fantabet-op",
    storageBucket: "fantabet-op.firebasestorage.app",
    messagingSenderId: "1042496289193",
    appId: "1:1042496289193:web:9e62956ef2da506b80ecb8"
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ===================================
// RIFERIMENTI ALLE COLLEZIONI
// ===================================

// Funzioni helper per ottenere i riferimenti alle collezioni
// Nomi collezioni corrispondono al file originale FANTABet.html
const getTeamsCollectionRef = () => collection(db, 'fantabet_teams');
const getResultsCollectionRef = () => collection(db, 'fantabet_results');
const getMatchesCollectionRef = () => collection(db, 'fantabet_matches');
const getUsersCollectionRef = () => collection(db, 'fantabet_users');
const getGiornataBetsCollectionRef = () => collection(db, 'fantabet_giornata_bets');
const getScheduleCollectionRef = () => collection(db, 'giornate_schedule');
const getBonusCollectionRef = () => collection(db, 'fantabet_bonus');
const getSquadsCollectionRef = () => collection(db, 'fantabet_squads');
const getPlayersCollectionRef = () => collection(db, 'fantabet_players');
const getPlayerStatsCollectionRef = () => collection(db, 'fantabet_player_stats');
const getFormationsCollectionRef = () => collection(db, 'fantabet_formations');
const getSquadBonusesCollectionRef = () => collection(db, 'fantabet_squad_bonuses');

// ===================================
// ESPORTAZIONI
// ===================================

export {
    // Firebase core
    db,
    auth,
    app,
    
    // Firebase init functions (re-export)
    initializeApp,
    getFirestore,
    getAuth,
    
    // Firestore functions
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    addDoc,
    writeBatch,
    
    // Auth functions
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    
    // Collection references
    getTeamsCollectionRef,
    getResultsCollectionRef,
    getMatchesCollectionRef,
    getUsersCollectionRef,
    getGiornataBetsCollectionRef,
    getScheduleCollectionRef,
    getBonusCollectionRef,
    getSquadsCollectionRef,
    getPlayersCollectionRef,
    getPlayerStatsCollectionRef,
    getFormationsCollectionRef,
    getSquadBonusesCollectionRef
};
