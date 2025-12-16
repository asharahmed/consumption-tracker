import { state, saveLocalState } from './state.js';
import { todayISO } from './utils.js';
import { renderTrendsChart } from './charts.js';
import { updateStatusForDate, buildHistoryList } from './ui.js';
import { renderCalendar } from './calendar.js';

// We assume firebase is available globally 
// But we need to forward declare variables that will be initialized in app.js or auth.js
// Actually, let's keep firebase init in app.js and export the instances?
// Or just access global `firebase` object.

// We need a way to reference currentUser. It's managed in auth.js.
// Since modules are evaluated, we can export a currentUser holder or getters.
import { getCurrentUser, setAuthErrorLoggedIn } from './auth.js';

let remoteSyncInProgress = false;

// DOM Elements needed for update (passed or queried? UI updates should be in UI module or callbacks)
// `syncFromCloud` does a lot of UI updates.
// We should probably inject the UI update functions or import them.

// To avoid circular dependencies (DB -> UI -> DB?), we need to be careful.
// UI uses DB (saveRemoteState). DB uses UI (updateStatusForDate).
// Solution: DB module exports functions. UI module exports functions.
// App.js connects them? Or circular imports are allowed in ESM if handled carefully.
// Let's try importing UI functions.

export async function saveRemoteState(db) {
    const user = getCurrentUser();
    if (!user) return;
    const docRef = db.collection("sobrietyStates").doc(user.uid);
    try {
        const payload = {
            goal: Number(state.goal) || 0,
            entries: state.entries || {},
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await docRef.set(payload, { merge: true });
    } catch (err) {
        console.error("Error saving remote state:", err);
        setAuthErrorLoggedIn("Could not sync to cloud (you might be offline). Local data is still safe.");
    }
}

export async function syncFromCloud(db, user) {
    const docRef = db.collection("sobrietyStates").doc(user.uid);
    remoteSyncInProgress = true;
    // Clear auth errors - moved to auth module logic or UI?
    // We'll rely on auth module to clear errors or do it here if we imported setters.

    try {
        const snapshot = await docRef.get();
        if (snapshot.exists) {
            const remote = snapshot.data() || {};
            if (typeof remote.goal === "number") {
                state.goal = remote.goal;
            }
            if (remote.entries && typeof remote.entries === "object") {
                state.entries = remote.entries;
            }
            saveLocalState(state);
        } else {
            await docRef.set({
                goal: Number(state.goal) || 0,
                entries: state.entries || {},
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (err) {
        console.error("Error loading remote state:", err);
        setAuthErrorLoggedIn("Could not load cloud data; using local data.");
    } finally {
        remoteSyncInProgress = false;

        // Update UI
        const goalInput = document.getElementById("goal-input");
        const dateInput = document.getElementById("date-input");
        const drinksInput = document.getElementById("drinks-input");

        if (goalInput) goalInput.value = state.goal || 0;
        if (dateInput) dateInput.value = todayISO();
        if (drinksInput && dateInput) drinksInput.value = state.entries[todayISO()] ?? "";

        if (dateInput) updateStatusForDate(dateInput.value);
        buildHistoryList();
        renderCalendar();
        renderTrendsChart();
    }
}
