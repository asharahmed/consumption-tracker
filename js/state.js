const STORAGE_KEY = "consumptionTrackerDataV1";

export function loadLocalState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { goal: 0, entries: {} };
        }
        const parsed = JSON.parse(raw);
        if (!parsed.goal && parsed.goal !== 0) parsed.goal = 0;
        if (!parsed.entries) parsed.entries = {};
        return parsed;
    } catch (e) {
        console.error("Failed to load local state", e);
        return { goal: 0, entries: {} };
    }
}

export function saveLocalState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Singleton state object shared across the app
export const state = loadLocalState();
