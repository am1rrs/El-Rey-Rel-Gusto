// Admin Authentication
// Simple auth system with demo credentials

class AdminAuth {
    constructor() {
        this.isAuthenticated = false;
        this.demoCredentials = {
            email: 'admin@elrey.com',
            password: 'admin123'
        };
        this.checkSession();
    }

    checkSession() {
        const session = localStorage.getItem('adminSession');
        if (session) {
            try {
                const data = JSON.parse(session);
                if (data.expires > Date.now()) {
                    this.isAuthenticated = true;
                    return true;
                }
            } catch (e) {
                console.error('Session error:', e);
            }
        }
        return false;
    }

    login(email, password) {
        // Demo authentication
        if (email === this.demoCredentials.email && password === this.demoCredentials.password) {
            this.isAuthenticated = true;

            // Create session (24 hours)
            const session = {
                email: email,
                expires: Date.now() + (24 * 60 * 60 * 1000)
            };
            localStorage.setItem('adminSession', JSON.stringify(session));

            return { success: true };
        }

        return { success: false, error: 'Identifiants incorrects' };
    }

    logout() {
        this.isAuthenticated = false;
        localStorage.removeItem('adminSession');
    }
}

// Initialize auth
const adminAuth = new AdminAuth();

// Export
if (typeof window !== 'undefined') {
    window.adminAuth = adminAuth;
}
