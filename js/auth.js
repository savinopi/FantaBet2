/**
 * FANTABet - Modulo Autenticazione
 * 
 * Gestisce login, registrazione, logout e stato utente.
 */

import { 
    auth, 
    db,
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut, 
    onAuthStateChanged,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    getUsersCollectionRef
} from './firebase-config.js';
import { ADMIN_USER_IDS } from './config.js';
import { messageBox } from './utils.js';

// ===================================
// VARIABILI DI STATO UTENTE
// ===================================

export let userId = null;
export let userCredits = 100;
export let isUserAdmin = false;
export let currentUserProfile = null;

// Array per tenere traccia di tutti i listener attivi
let activeUnsubscribes = [];

// ===================================
// GESTIONE LISTENER
// ===================================

/**
 * Aggiunge un unsubscribe alla lista dei listener attivi
 * @param {Function} unsubscribe - Funzione di cleanup
 */
export const addUnsubscribe = (unsubscribe) => {
    if (typeof unsubscribe === 'function') {
        activeUnsubscribes.push(unsubscribe);
    }
};

/**
 * Rimuove tutti i listener attivi
 */
export const removeAllListeners = () => {
    console.log('Removing all listeners:', activeUnsubscribes.length);
    while (activeUnsubscribes.length > 0) {
        const unsubscribe = activeUnsubscribes.pop();
        try {
            unsubscribe();
        } catch (e) {
            console.error('Error unsubscribing:', e);
        }
    }
};

// ===================================
// LOGIN / REGISTRAZIONE
// ===================================

/**
 * Gestisce login e registrazione utente
 * @param {boolean} isLogin - true per login, false per registrazione
 */
export const handleLoginRegister = async (isLogin) => {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    if (!email || !password) {
        messageBox("Inserisci email e password.");
        return;
    }
    
    // Validazione client-side per registrazione
    if (!isLogin) {
        if (password.length < 6) {
            messageBox("❌ Password troppo corta!\n\nLa password deve contenere almeno 6 caratteri.\n\nRiprova con una password più lunga.");
            return;
        }
    }

    try {
        let userCredential;
        if (isLogin) {
            userCredential = await signInWithEmailAndPassword(auth, email, password);
        } else {
            userCredential = await createUserWithEmailAndPassword(auth, email, password);
        }
        
        const user = userCredential.user;
        console.log("User authenticated:", user.uid);
        
        // Crea o aggiorna sempre il documento utente
        const userDocRef = doc(getUsersCollectionRef(), user.uid);
        
        try {
            // Prima verifica se è un admin predefinito
            const isDefaultAdmin = ADMIN_USER_IDS.includes(user.uid);
            console.log("Is default admin:", isDefaultAdmin);
            
            // Ottieni il documento esistente se presente
            const userDoc = await getDoc(userDocRef);
            const existingData = userDoc.exists() ? userDoc.data() : {};
            
            // Prepara i dati da salvare
            const userData = {
                ...existingData,
                email: user.email,
                displayName: existingData.displayName || user.email.split('@')[0],
                credits: existingData.credits !== undefined ? existingData.credits : 100,
                isAdmin: existingData.isAdmin !== undefined ? existingData.isAdmin : isDefaultAdmin,
                lastLogin: new Date().toISOString(),
                ...((!userDoc.exists()) && { createdAt: new Date().toISOString() })
            };
            
            // Salva o aggiorna il documento
            await setDoc(userDocRef, userData);
            console.log("User document saved:", userData);
            
            messageBox(isLogin ? 
                "Accesso riuscito!" : 
                "Registrazione completata! Profilo utente creato.");
                
        } catch (dbError) {
            console.error("Errore salvataggio documento utente:", dbError);
            messageBox("Errore nel salvataggio del profilo. Contatta l'admin.");
        }
    } catch (error) {
        console.error("Errore Autenticazione:", error);
        let errorMessage = "Errore di autenticazione.";

        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = "Credenziali non valide. Controlla email e password. Hai provato prima a **Registrarti**?";
        } else if (error.code === 'auth/email-already-in-use') {
            errorMessage = "Questa email è già registrata. Prova ad accedere.";
        } else if (error.code === 'auth/weak-password') {
            errorMessage = "La password deve essere di almeno 6 caratteri.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Formato email non valido.";
        }
        
        messageBox(errorMessage);
    }
};

// ===================================
// LOGOUT
// ===================================

/**
 * Esegue il logout dell'utente
 */
export const handleLogout = async () => {
    try {
        // Prima rimuovi tutti i listener
        removeAllListeners();
        // Poi esegui il logout
        await signOut(auth);
        console.log('Logout completato e listener rimossi');
    } catch (error) {
        console.error("Errore Logout:", error);
        messageBox("Errore durante il logout.");
    }
};

// ===================================
// VERIFICA ADMIN
// ===================================

/**
 * Verifica se l'utente corrente è admin
 */
export const checkAdminStatus = async () => {
    if (!userId) {
        isUserAdmin = false;
        return;
    }
    
    // Prima controlla se è nella lista admin hardcoded
    if (ADMIN_USER_IDS.includes(userId)) {
        isUserAdmin = true;
        updateAdminUI(true);
        return;
    }
    
    // Poi controlla il flag nel database
    try {
        const userDocRef = doc(getUsersCollectionRef(), userId);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().isAdmin) {
            isUserAdmin = true;
            updateAdminUI(true);
        } else {
            isUserAdmin = false;
            updateAdminUI(false);
        }
    } catch (error) {
        console.error('Errore verifica admin:', error);
        isUserAdmin = false;
        updateAdminUI(false);
    }
};

/**
 * Aggiorna l'UI in base allo stato admin
 * @param {boolean} isAdmin - Se l'utente è admin
 */
const updateAdminUI = (isAdmin) => {
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
        if (isAdmin) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
};

// ===================================
// GESTIONE CREDITI
// ===================================

/**
 * Aggiorna la visualizzazione delle info utente
 */
export const updateUserInfoDisplay = () => {
    const userCreditsElement = document.getElementById('user-credits-display'); 
    const userDisplayNameElement = document.getElementById('user-display-name');
    const userRoleElement = document.getElementById('user-role-display');
    const userIdElement = document.getElementById('user-id-display');

    if (userCreditsElement) userCreditsElement.textContent = `Crediti Bonus: ${userCredits}`;
    if (userDisplayNameElement && currentUserProfile) { 
        userDisplayNameElement.textContent = currentUserProfile.displayName || currentUserProfile.email;
    }
    if (userRoleElement) {
        userRoleElement.textContent = isUserAdmin ? 'Admin' : 'Utente';
    }
    if (userIdElement && userId) {
        userIdElement.textContent = `ID: ${userId}`;
    }
};

/**
 * Aggiusta i crediti dell'utente
 * @param {number} amount - Quantità da aggiungere (positiva o negativa)
 */
export const adjustCredits = async (amount) => {
    userCredits += amount;
    updateUserInfoDisplay();
    
    // Aggiorna anche su Firestore
    if (userId) {
        try {
            const userRef = doc(getUsersCollectionRef(), userId);
            await updateDoc(userRef, {
                credits: userCredits
            });
            console.log('Crediti aggiornati su Firestore:', userCredits);
        } catch (error) {
            console.error('Errore aggiornamento crediti su Firestore:', error);
        }
    }
};

/**
 * Imposta i crediti utente
 * @param {number} credits - Nuovo valore crediti
 */
export const setUserCredits = (credits) => {
    userCredits = credits;
};

/**
 * Imposta il profilo utente corrente
 * @param {Object} profile - Dati profilo
 */
export const setCurrentUserProfile = (profile) => {
    currentUserProfile = profile;
};

/**
 * Imposta l'ID utente
 * @param {string} id - User ID
 */
export const setUserId = (id) => {
    userId = id;
};

/**
 * Imposta lo stato admin
 * @param {boolean} admin - Se admin
 */
export const setIsUserAdmin = (admin) => {
    isUserAdmin = admin;
};

// ===================================
// GETTER FUNCTIONS
// ===================================

export const getUserId = () => userId;
export const getUserCredits = () => userCredits;
export const getIsUserAdmin = () => isUserAdmin;
export const getCurrentUserProfile = () => currentUserProfile;

// ===================================
// SALVATAGGIO PROFILO
// ===================================

/**
 * Salva le modifiche al profilo utente
 */
export const saveUserProfile = async () => {
    const newDisplayName = document.getElementById('profile-display-name').value.trim();
    if (!newDisplayName) {
        messageBox("Il nome visualizzato non può essere vuoto.");
        return;
    }
    
    if (!userId) {
        messageBox("Devi essere autenticato per modificare il profilo.");
        return;
    }
    
    try {
        await updateDoc(doc(getUsersCollectionRef(), userId), { displayName: newDisplayName });
        messageBox("Profilo aggiornato con successo!");
    } catch (error) {
        console.error("Errore salvataggio profilo:", error);
        messageBox("Errore durante il salvataggio del profilo: " + error.message);
    }
};

/**
 * Mostra il modal delle statistiche di una partita
 */
export const showMatchStatsModal = async (homeTeam, awayTeam) => {
    // Semplicemente apri le stats della squadra casa
    // L'utente può poi chiudere e aprire l'altra se vuole
    if (window.showTeamStats) {
        await window.showTeamStats(homeTeam);
    }
};

// ===================================
// SETUP AUTH STATE LISTENER
// ===================================

/**
 * Setup del listener per lo stato di autenticazione
 * @param {Object} callbacks - Oggetto con callback onLogin e onLogout
 */
export const setupAuthStateListener = (callbacks) => {
    onAuthStateChanged(auth, async (user) => {
        const loginContainer = document.getElementById('login-container');
        const mainAppContainer = document.getElementById('main-app-container');
        const logoutButton = document.getElementById('logout-button');
        const authStatus = document.getElementById('auth-status');
        const loadingOverlay = document.getElementById('loading-overlay');

        if (user) {
            // Mostra loading overlay
            if (loadingOverlay) loadingOverlay.classList.remove('hidden');
            
            userId = user.uid;
            authStatus.textContent = 'Autenticato';
            authStatus.classList.add('hidden');

            loginContainer.classList.add('hidden');
            
            // Callback per operazioni post-login
            if (callbacks.onLogin) {
                await callbacks.onLogin(user);
            }

            // Mostra l'app
            setTimeout(() => {
                mainAppContainer.classList.remove('hidden');
                logoutButton.classList.remove('hidden');
                if (loadingOverlay) loadingOverlay.classList.add('hidden');
            }, 500);

        } else {
            userId = null;
            authStatus.textContent = 'Non autenticato';
            authStatus.classList.remove('hidden');

            const userDisplayNameElement = document.getElementById('user-display-name');
            if (userDisplayNameElement) userDisplayNameElement.textContent = '';

            logoutButton.classList.add('hidden');
            loginContainer.classList.remove('hidden');
            mainAppContainer.classList.add('hidden');
            
            // Callback per operazioni post-logout
            if (callbacks.onLogout) {
                callbacks.onLogout();
            }
        }
    });
};

// ===================================
// EXPORT PER COMPATIBILITÀ WINDOW
// ===================================

// Esponi funzioni globalmente per onclick inline nell'HTML
window.handleLoginRegister = handleLoginRegister;
window.handleLogout = handleLogout;
window.saveUserProfile = saveUserProfile;
window.showMatchStatsModal = showMatchStatsModal;
