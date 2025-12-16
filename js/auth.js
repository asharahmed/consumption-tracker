import { syncFromCloud } from './db.js';

let currentUser = null;

export function getCurrentUser() {
    return currentUser;
}

export function setAuthErrorLoggedIn(msg) {
    const el = document.getElementById("auth-error-loggedin");
    if (el) el.textContent = msg;
}

export function initAuth(auth, db) {
    const authTriggerBtn = document.getElementById("auth-trigger-btn");
    const authOverlay = document.getElementById("auth-overlay");
    const authCloseBtn = document.getElementById("auth-close-btn");
    const authModalTitle = document.getElementById("auth-modal-title");
    const authModalSubtitle = document.getElementById("auth-modal-subtitle");
    const authModalLoggedOut = document.getElementById("auth-modal-logged-out");
    const authModalLoggedIn = document.getElementById("auth-modal-logged-in");
    const authUserEmail = document.getElementById("auth-user-email");
    const authError = document.getElementById("auth-error");
    const authErrorLoggedIn = document.getElementById("auth-error-loggedin");
    const authEmailInput = document.getElementById("auth-email");
    const authPasswordInput = document.getElementById("auth-password");
    const authSignInBtn = document.getElementById("auth-signin-btn");
    const authSignUpBtn = document.getElementById("auth-signup-btn");
    const authSignOutBtn = document.getElementById("auth-signout-btn");
    const authForgotBtn = document.getElementById("auth-forgot-btn");

    function updateAuthUI() {
        if (currentUser) {
            const email = currentUser.email || "?";
            const initial = email.trim()[0]?.toUpperCase() || "?";
            authTriggerBtn.classList.add("avatar");
            authTriggerBtn.textContent = initial;

            authModalTitle.textContent = "Account";
            authModalSubtitle.textContent = "You’re signed in. Your data syncs across devices.";
            authModalLoggedOut.style.display = "none";
            authModalLoggedIn.style.display = "block";
            authUserEmail.textContent = email;
        } else {
            authTriggerBtn.classList.remove("avatar");
            authTriggerBtn.textContent = "Sign in";

            authModalTitle.textContent = "Sign in";
            authModalSubtitle.textContent = "Use email and password to sync your data across devices.";
            authModalLoggedOut.style.display = "block";
            authModalLoggedIn.style.display = "none";
        }
    }

    function openAuthOverlay() {
        updateAuthUI();
        authError.textContent = "";
        authErrorLoggedIn.textContent = "";
        authOverlay.classList.add("open");
    }

    function closeAuthOverlay() {
        authOverlay.classList.remove("open");
    }

    // Event Listeners
    if (authTriggerBtn) authTriggerBtn.addEventListener("click", openAuthOverlay);
    if (authCloseBtn) authCloseBtn.addEventListener("click", closeAuthOverlay);

    if (authOverlay) {
        authOverlay.addEventListener("click", (e) => {
            if (e.target === authOverlay) {
                closeAuthOverlay();
            }
        });
    }

    if (authSignInBtn) {
        authSignInBtn.addEventListener("click", async () => {
            authError.textContent = "";
            const email = authEmailInput.value.trim();
            const password = authPasswordInput.value;
            if (!email || !password) {
                authError.textContent = "Please enter both email and password.";
                return;
            }
            try {
                await auth.signInWithEmailAndPassword(email, password);
                closeAuthOverlay();
            } catch (err) {
                console.error(err);
                authError.textContent = err.message || "Sign-in failed.";
            }
        });
    }

    if (authSignUpBtn) {
        authSignUpBtn.addEventListener("click", async () => {
            authError.textContent = "";
            const email = authEmailInput.value.trim();
            const password = authPasswordInput.value;
            if (!email || !password) {
                authError.textContent = "Please enter both email and password.";
                return;
            }
            try {
                await auth.createUserWithEmailAndPassword(email, password);
                closeAuthOverlay();
            } catch (err) {
                console.error(err);
                authError.textContent = err.message || "Sign-up failed.";
            }
        });
    }

    if (authSignOutBtn) {
        authSignOutBtn.addEventListener("click", async () => {
            authErrorLoggedIn.textContent = "";
            try {
                await auth.signOut();
                closeAuthOverlay();
            } catch (err) {
                console.error(err);
                authErrorLoggedIn.textContent = "Sign out failed. Try again.";
            }
        });
    }

    if (authForgotBtn) {
        authForgotBtn.addEventListener("click", async () => {
            authError.textContent = "";
            const email = authEmailInput.value.trim();
            if (!email) {
                authError.textContent = "Enter your email above, then tap “Forgot your password?”.";
                authEmailInput.focus();
                return;
            }
            try {
                await auth.sendPasswordResetEmail(email);
                authError.style.color = "#bbf7d0"; // soft green
                authError.textContent = "Password reset email sent. Check your inbox.";
            } catch (err) {
                console.error(err);
                authError.style.color = "#fecaca";
                authError.textContent = err.message || "Could not send reset email.";
            }
        });
    }

    // Auth State Listener
    auth.onAuthStateChanged(async (user) => {
        currentUser = user || null;
        updateAuthUI();
        if (currentUser) {
            await syncFromCloud(db, currentUser);
        }
    });

    // Initial UI check
    updateAuthUI();
}
