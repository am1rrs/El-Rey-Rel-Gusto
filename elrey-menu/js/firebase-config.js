// Firebase Configuration
// Replace these values with your Firebase project credentials

const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "elrey-gusto.firebaseapp.com",
    projectId: "elrey-gusto",
    storageBucket: "elrey-gusto.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID_HERE"
};

// Initialize Firebase (when ready)
let db = null;
let auth = null;

function initFirebase() {
    if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK not loaded. Using localStorage fallback.');
        return false;
    }

    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        console.log('Firebase initialized successfully');
        return true;
    } catch (error) {
        console.error('Firebase initialization error:', error);
        return false;
    }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.firebaseConfig = firebaseConfig;
    window.initFirebase = initFirebase;
    window.getFirestore = () => db;
    window.getAuth = () => auth;
}
