// Admin Authentication
// Real Firebase Auth (email/password) via the already-loaded compat SDK.
// The whole file is an IIFE so no top-level binding can collide with the
// globals in js/order-service.js / js/firebase-config.js (the classic-script
// global-collision class of bug that broke the dashboard before).
(function () {
    'use strict';

    // CONFIG POINT (DISPLAY ONLY): shown on the login screen as a hint.
    // This grants nothing — a user is an admin only if their Firebase UID has
    // a document in the Firestore `admins/{uid}` collection (see firestore.rules).
    var ADMIN_EMAIL_DISPLAY = 'admin@elrey.com';

    var initialized = false;
    var authReady = false;       // true once onAuthStateChanged has fired at least once
    var currentUser = null;      // last-known Firebase user (or null)
    var pendingHandlers = [];    // onAuthChange callbacks registered before auth resolved

    // Ensure the Firebase app + auth are initialized (idempotent), set LOCAL
    // persistence once (the default, but explicit is safer), and register the
    // single onAuthStateChanged that is the source of truth for login/logout.
    function init() {
        if (initialized) return;
        initialized = true;

        // Dev mode: skip Firebase Auth entirely
        if (window.firebaseConfig && window.firebaseConfig.SKIP_AUTH) {
            console.warn('[auth] Dev mode: skipping Firebase Auth');
            authReady = true;
            currentUser = { uid: 'dev-admin', email: 'admin@elrey.com' };
            // Trigger pending handlers
            var handlers = pendingHandlers.slice();
            pendingHandlers = [];
            handlers.forEach(function (fn) {
                try { fn(currentUser); } catch (error) { console.error('[auth] handler error:', error); }
            });
            return;
        }

        if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function') {
            console.error('[auth] Firebase Auth SDK not loaded.');
            return;
        }

        try {
            if (typeof window.initFirebase === 'function') {
                window.initFirebase();
            }
        } catch (error) {
            console.error('[auth] initFirebase error:', error);
        }

        var auth = firebase.auth();

        // Local persistence is the default; guard the promise so a failure here
        // (e.g. called too late) is never fatal.
        if (auth.setPersistence && firebase.auth.Auth && firebase.auth.Auth.Persistence) {
            auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {});
        }

        auth.onAuthStateChanged(function (user) {
            authReady = true;
            currentUser = user;
            var handlers = pendingHandlers.slice();
            pendingHandlers = [];
            handlers.forEach(function (fn) {
                try { fn(user); } catch (error) { console.error('[auth] handler error:', error); }
            });
        });
    }

    function login(email, password) {
        init();
        // Dev mode: always succeed
        if (window.firebaseConfig && window.firebaseConfig.SKIP_AUTH) {
            return Promise.resolve();
        }
        return firebase.auth().signInWithEmailAndPassword(email, password);
    }

    function logout() {
        init();
        // Dev mode: clear user and trigger handlers
        if (window.firebaseConfig && window.firebaseConfig.SKIP_AUTH) {
            currentUser = null;
            var handlers = pendingHandlers.slice();
            pendingHandlers = [];
            handlers.forEach(function (fn) {
                try { fn(null); } catch (error) { console.error('[auth] handler error:', error); }
            });
            return Promise.resolve();
        }
        return firebase.auth().signOut();
    }

    // Register a handler for auth-state changes. If auth state has already
    // resolved, the handler is invoked immediately with the current user so the
    // caller never misses an event between script load and DOMContentLoaded.
    // Returns an unsubscribe function.
    function onAuthChange(fn) {
        if (authReady) {
            try { fn(currentUser); } catch (error) { console.error('[auth] handler error:', error); }
        } else {
            pendingHandlers.push(fn);
        }
        return function () {
            var i = pendingHandlers.indexOf(fn);
            if (i >= 0) pendingHandlers.splice(i, 1);
        };
    }

    function getCurrentUser() {
        return currentUser;
    }

    function isAuthenticated() {
        return !!currentUser;
    }

    // Map Firebase auth errors to i18n dictionary keys. Covers the credentials
    // failures (wrong email/password), network/timeout cases, AND the console
    // configuration errors that otherwise surface as a baffling "Login failed":
    // provider disabled, unauthorized domain, restricted/invalid API key, or a
    // misconfigured authDomain. Anything unmapped still falls back to
    // login.error.generic, and dashboard.js appends the raw error code so the
    // cause is never hidden.
    function loginErrorKey(error) {
        if (!error) return 'login.error.generic';
        var code = error.code || '';

        // The compat SDK surfaces the server message in the code itself, e.g.
        // "auth/api-key-not-valid.-please-pass-a-valid-api-key.". Match by
        // prefix so both spellings resolve to the same actionable message.
        if (code.indexOf('auth/api-key-not-valid') === 0) {
            return 'login.error.invalidApiKey';
        }

        switch (code) {
            case 'auth/invalid-credential':
            case 'auth/invalid-login-credentials': // newer SDK spelling
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                return 'login.error.invalid';
            case 'auth/network-request-failed':
                return 'login.error.network';
            case 'auth/too-many-requests':
                return 'login.error.tooMany';
            case 'auth/operation-not-allowed':
                // Email/password sign-in is disabled in the Firebase project.
                return 'login.error.operationNotAllowed';
            case 'auth/unauthorized-domain':
            case 'auth/app-not-authorized':
                // The page's domain isn't in the project's authorized domains.
                return 'login.error.unauthorizedDomain';
            case 'auth/invalid-api-key':
                return 'login.error.invalidApiKey';
            case 'auth/configuration-not-found':
                return 'login.error.configurationNotFound';
            default:
                return 'login.error.generic';
        }
    }

    window.adminAuth = {
        ADMIN_EMAIL_DISPLAY: ADMIN_EMAIL_DISPLAY,
        init: init,
        login: login,
        logout: logout,
        onAuthChange: onAuthChange,
        getCurrentUser: getCurrentUser,
        isAuthenticated: isAuthenticated,
        loginErrorKey: loginErrorKey
    };

    init();
})();
