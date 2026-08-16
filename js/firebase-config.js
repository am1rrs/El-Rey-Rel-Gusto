// Firebase Configuration
// Replace these values with your Firebase project credentials
const firebaseConfig = {
  apiKey: "AIzaSyBKqdUG-BZTVltCVHD6-Tn70HbO7hf09DY",
  authDomain: "el-rey-del-gusto.firebaseapp.com",
  projectId: "el-rey-del-gusto",
  storageBucket: "el-rey-del-gusto.firebasestorage.app",
  messagingSenderId: "585819298129",
  appId: "1:585819298129:web:c721eb36150b2eefa4db70",
  measurementId: "G-54RPFMJRGJ",
  // Dev mode: set to false when Firebase Auth is working
  SKIP_AUTH: false,
  // Production Mode: never fall back to localStorage — all reads/writes go to Firebase
  FORCE_FIREBASE: true
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
    // Idempotent: never initialize an already-initialized app (a second 
    // initializeApp throws and would silently downgrade us to localStorage).
    if (firebase.apps.length === 0) {
      firebase.initializeApp(firebaseConfig);
    }
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