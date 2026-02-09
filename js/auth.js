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
    sendPasswordResetEmail,
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
    while (activeUnsubscribes.length > 0) {
        const unsubscribe = activeUnsubscribes.pop();
        try {
            unsubscribe();
        } catch (e) {
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
    // Seleziona gli IDs corretti in base alla modalità
    const emailId = isLogin ? 'auth-email' : 'signup-email';
    const passwordId = isLogin ? 'auth-password' : 'signup-password';
    const passwordConfirmId = 'signup-password-confirm';
    
    const email = document.getElementById(emailId).value;
    const password = document.getElementById(passwordId).value;
    
    if (!email || !password) {
        messageBox("Inserisci email e password.");
        return;
    }
    
    // Validazione client-side per registrazione
    if (!isLogin) {
        const passwordConfirm = document.getElementById(passwordConfirmId).value;
        
        // Validazione criteri password stringenti
        const hasLength = password.length >= 8;
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        
        if (!hasLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
            messageBox("❌ Password non valida!\n\nLa password deve contenere:\n✓ Almeno 8 caratteri\n✓ Almeno una lettera maiuscola\n✓ Almeno una lettera minuscola\n✓ Almeno un numero\n✓ Almeno un carattere speciale (!@#$%^&*(),.?\":{}|<>)");
            return;
        }
        
        if (password !== passwordConfirm) {
            messageBox("❌ Le password non coincidono!\n\nAssicurati che le due password siano identiche.");
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
        
        // Crea o aggiorna sempre il documento utente
        const userDocRef = doc(getUsersCollectionRef(), user.uid);
        
        try {
            // Prima verifica se è un admin predefinito
            const isDefaultAdmin = ADMIN_USER_IDS.includes(user.uid);
            
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
            
            messageBox(isLogin ? 
                "Accesso riuscito!" : 
                "Registrazione completata! Profilo utente creato.");
            
            // Carica i dati dell'app dopo l'autenticazione riuscita
            if (window.loadAppData) {
                await window.loadAppData();
            }
                
        } catch (dbError) {
            messageBox("Errore nel salvataggio del profilo. Contatta l'admin.");
        }
    } catch (error) {
        let errorMessage = "Errore di autenticazione.";;

        if (isLogin) {
            // Errori specifici per il LOGIN
            if (error.code === 'auth/invalid-login-credentials' || error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                errorMessage = "❌ Email o password non corrente!\n\nVerifica di aver inserito correttamente:\n✓ L'indirizzo email\n✓ La password (maiuscole/minuscole importano)\n\nNon hai un account? Clicca su 'Crea Account'.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "❌ Formato email non valido!\n\nInserisci un indirizzo email corretto (es: user@example.com)";
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = "❌ Troppi tentativi di accesso!\n\nPer motivi di sicurezza, riprova tra qualche minuto.";
            }
            
            // Mostra errore nel form
            if (window.showLoginError) {
                window.showLoginError(errorMessage);
            } else {
                messageBox(errorMessage);
            }
        } else {
            // Errori specifici per la REGISTRAZIONE
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "❌ Questa email è già registrata!\n\nSe è il tuo account, clicca su 'Accedi'.\nAltrimenti usa un'altra email.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "❌ Formato email non valido!\n\nInserisci un indirizzo email corretto (es: user@example.com)";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "❌ La password non rispetta i criteri di sicurezza!\n\nLa password deve contenere:\n✓ Almeno 8 caratteri\n✓ Almeno una lettera maiuscola\n✓ Almeno una lettera minuscola\n✓ Almeno un numero\n✓ Almeno un carattere speciale (!@#$%^&*(),.?\":{}|<>)";
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = "❌ Troppi tentativi!\n\nPer motivi di sicurezza, riprova tra qualche minuto.";
            }
            
            // Mostra errore nel form
            if (window.showSignupError) {
                window.showSignupError(errorMessage);
            } else {
                messageBox(errorMessage);
            }
        }
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
    } catch (error) {
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
        updateUserInfoDisplay();
        return;
    }
    
    // Poi controlla il flag nel database
    try {
        const userDocRef = doc(getUsersCollectionRef(), userId);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.isAdmin) {
                isUserAdmin = true;
                updateAdminUI(true);
            } else {
                isUserAdmin = false;
                updateAdminUI(false);
            }
        } else {
            isUserAdmin = false;
            updateAdminUI(false);
        }
        updateUserInfoDisplay();
    } catch (error) {
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
            el.classList.remove('admin-hidden');
        } else {
            el.classList.add('admin-hidden');
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
    const userDisplayNameElement = document.getElementById('user-display-name');
    const profileEmailElement = document.getElementById('profile-email');
    const userIdElement = document.getElementById('user-id-display');
    const userRoleElement = document.getElementById('user-role-display');
    const authStatusElement = document.getElementById('auth-status');

    // Nome profilo (input editabile)
    if (userDisplayNameElement && currentUserProfile) { 
        const displayText = currentUserProfile.displayName || currentUserProfile.email || 'Utente';
        userDisplayNameElement.value = displayText;
    }

    // Email (readonly)
    if (profileEmailElement && currentUserProfile) {
        profileEmailElement.value = currentUserProfile.email || '';
    }

    // ID Utente (readonly)
    if (userIdElement && userId) {
        userIdElement.value = userId;
    }

    // Ruolo (readonly)
    if (userRoleElement) {
        userRoleElement.value = isUserAdmin ? 'Admin' : 'Utente';
    }

    // Stato autenticazione
    if (authStatusElement) {
        authStatusElement.textContent = 'Autenticato';
        authStatusElement.className = 'text-center text-sm text-green-400 font-semibold mb-6';
    }

    // Aggiungi listener per tracciare modifiche al Nome Profilo
    if (userDisplayNameElement) {
        // Salva il valore originale in una variabile globale per ripristinarlo dopo
        window.originalDisplayName = userDisplayNameElement.value;
        userDisplayNameElement.addEventListener('change', () => {
            if (userDisplayNameElement.value !== window.originalDisplayName) {
                window.profileHasUnsavedChanges = true;
            } else {
                window.profileHasUnsavedChanges = false;
            }
        });
        userDisplayNameElement.addEventListener('input', () => {
            if (userDisplayNameElement.value !== window.originalDisplayName) {
                window.profileHasUnsavedChanges = true;
            } else {
                window.profileHasUnsavedChanges = false;
            }
        });
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
        } catch (error) {
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
    const newDisplayName = document.getElementById('user-display-name').value.trim();
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
        
        // Reset flag di modifiche non salvate
        window.profileHasUnsavedChanges = false;
        
        // Aggiorna il profilo locale
        currentUserProfile.displayName = newDisplayName;
    } catch (error) {
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
            if (authStatus) {
                authStatus.textContent = 'Autenticato';
                authStatus.classList.add('hidden');
            }

            if (loginContainer) loginContainer.classList.add('hidden');
            
            // Callback per operazioni post-login
            if (callbacks.onLogin) {
                await callbacks.onLogin(user);
            }

            // Mostra l'app
            setTimeout(() => {
                if (mainAppContainer) mainAppContainer.classList.remove('hidden');
                if (logoutButton) logoutButton.classList.remove('hidden');
                if (loadingOverlay) loadingOverlay.classList.add('hidden');
            }, 500);

        } else {
            userId = null;
            if (authStatus) {
                authStatus.textContent = 'Non autenticato';
                authStatus.classList.remove('hidden');
            }

            const userDisplayNameElement = document.getElementById('user-display-name');
            if (userDisplayNameElement) userDisplayNameElement.textContent = '';

            if (logoutButton) logoutButton.classList.add('hidden');
            if (loginContainer) loginContainer.classList.remove('hidden');
            if (mainAppContainer) mainAppContainer.classList.add('hidden');
            
            // Callback per operazioni post-logout
            if (callbacks.onLogout) {
                callbacks.onLogout();
            }
        }
    });
};

// ===================================
// RESET PASSWORD
// ===================================

/**
 * Invia email per reset password
 * @param {string} email - Email dell'utente
 */
export const resetPassword = async (email) => {
    if (!email || typeof email !== 'string') {
        throw new Error('Email non valida');
    }
    
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true };
    } catch (error) {
        throw error;
    }
};

// ===================================
// EXPORT PER COMPATIBILITÀ WINDOW
// ===================================

// Esponi funzioni globalmente per onclick inline nell'HTML
window.handleLoginRegister = handleLoginRegister;
window.handleLogout = handleLogout;
window.saveUserProfile = saveUserProfile;
window.showMatchStatsModal = showMatchStatsModal;
window.resetPassword = resetPassword;
