// ============================================================
// TWITCH OAUTH AUTHENTICATION (CLIENT-SIDE ONLY)
// ============================================================
// IMPORTANT: Insert your Twitch Client ID below
// Get one from: https://dev.twitch.tv/console/apps

const TWITCH_CLIENT_ID = '7pld11bhx8g1mo9bu0zgvz692i3lgk'; // ← INSERT YOUR CLIENT ID HERE

// OAuth Configuration
const REDIRECT_URI = window.location.origin + window.location.pathname;
const SCOPES = 'chat:read chat:edit'; // Permissions needed

// Auth State Management
const AuthManager = {
    accessToken: null,
    username: null,
    
    // Initialize authentication
    init() {
        console.log('[Auth] Initializing authentication...');
        
        // Check if returning from OAuth
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        
        if (params.has('access_token')) {
            this.handleCallback(params);
        } else {
            console.log('[Auth] No token found, showing login screen');
        }
    },
    
    // Handle OAuth callback
    async handleCallback(params) {
        this.accessToken = params.get('access_token');
        console.log('[Auth] Access token received');
        
        // Clear hash from URL
        window.location.hash = '';
        
        try {
            // Validate token and get user info
            const userInfo = await this.validateToken();
            
            if (userInfo) {
                this.username = userInfo.login;
                console.log('[Auth] Logged in as:', this.username);
                
                // Store token temporarily
                sessionStorage.setItem('twitch_token', this.accessToken);
                sessionStorage.setItem('twitch_username', this.username);
                
                // Trigger login success event
                window.dispatchEvent(new CustomEvent('auth:success', {
                    detail: {
                        username: this.username,
                        token: this.accessToken
                    }
                }));
            } else {
                throw new Error('فشل التحقق من الرمز');
            }
        } catch (error) {
            console.error('[Auth] Validation error:', error);
            alert('حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.');
            this.logout();
        }
    },
    
    // Validate token with Twitch
    async validateToken() {
        try {
            const response = await fetch('https://id.twitch.tv/oauth2/validate', {
                headers: {
                    'Authorization': `OAuth ${this.accessToken}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Invalid token');
            }
            
            return await response.json();
        } catch (error) {
            console.error('[Auth] Token validation failed:', error);
            return null;
        }
    },
    
    // Start OAuth flow
    login() {
        if (!TWITCH_CLIENT_ID || TWITCH_CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
            alert('خطأ: لم يتم تعيين معرف التطبيق (Client ID)\n\nالرجاء إضافة معرف التطبيق في ملف auth.js');
            return;
        }
        
        console.log('[Auth] Starting OAuth flow...');
        
        // Build OAuth URL
        const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
        authUrl.searchParams.set('client_id', TWITCH_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
        authUrl.searchParams.set('response_type', 'token');
        authUrl.searchParams.set('scope', SCOPES);
        
        // Redirect to Twitch
        window.location.href = authUrl.toString();
    },
    
    // Logout
    logout() {
        console.log('[Auth] Logging out...');
        
        this.accessToken = null;
        this.username = null;
        
        sessionStorage.removeItem('twitch_token');
        sessionStorage.removeItem('twitch_username');
        
        // Trigger logout event
        window.dispatchEvent(new Event('auth:logout'));
        
        // Reload page
        window.location.reload();
    },
    
    // Check if logged in
    isAuthenticated() {
        return this.accessToken !== null && this.username !== null;
    },
    
    // Try to restore session
    restoreSession() {
        const token = sessionStorage.getItem('twitch_token');
        const username = sessionStorage.getItem('twitch_username');
        
        if (token && username) {
            console.log('[Auth] Restoring session for:', username);
            this.accessToken = token;
            this.username = username;
            
            // Validate token is still valid
            this.validateToken().then(userInfo => {
                if (!userInfo) {
                    console.log('[Auth] Session expired, logging out');
                    this.logout();
                } else {
                    // Trigger login success event
                    window.dispatchEvent(new CustomEvent('auth:success', {
                        detail: {
                            username: this.username,
                            token: this.accessToken
                        }
                    }));
                }
            });
            
            return true;
        }
        
        return false;
    },
    
    // Get current token
    getToken() {
        return this.accessToken;
    },
    
    // Get current username
    getUsername() {
        return this.username;
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Try to restore existing session first
    if (!AuthManager.restoreSession()) {
        // Otherwise, check for OAuth callback
        AuthManager.init();
    }
});

// Export for use in main.js
window.AuthManager = AuthManager;
