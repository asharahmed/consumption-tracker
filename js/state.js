const STORAGE_KEY = "consumptionTrackerDataV1";

export function loadLocalState() {
    const stored = localStorage.getItem(STORAGE_KEY); // Use STORAGE_KEY
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            // Migrate entries to new format if needed
            if (parsed.entries) {
                parsed.entries = migrateEntries(parsed.entries);
            }
            // Ensure goal and entries are present after migration/parsing
            if (!parsed.goal && parsed.goal !== 0) parsed.goal = 0;
            if (!parsed.entries) parsed.entries = {};
            return parsed;
        } catch (e) {
            console.error("Error parsing state:", e);
        }
    }
    return { goal: 0, entries: {} };
}

// Migrate entries from old format (number) to new format ({count, notes})
export function migrateEntries(entries) {
    const migrated = {};
    for (const [date, value] of Object.entries(entries)) {
        if (typeof value === 'number') {
            // Old format: just a number
            migrated[date] = { count: value, notes: '' };
        } else if (value && typeof value === 'object' && 'count' in value) {
            // New format: already migrated
            migrated[date] = {
                count: value.count || 0,
                notes: value.notes || ''
            };
        } else {
            // Invalid format, skip
            console.warn(`Invalid entry format for date ${date}:`, value);
        }
    }
    return migrated;
}

// Helper function to get entry count (backward compatible)
export function getEntryCount(date) {
    const entry = state.entries[date];
    if (!entry) return 0;
    if (typeof entry === 'number') return entry;
    if (typeof entry === 'object' && 'count' in entry) return entry.count || 0;
    return 0;
}

// Helper function to get entry notes
export function getEntryNotes(date) {
    const entry = state.entries[date];
    if (!entry) return '';
    if (typeof entry === 'object' && 'notes' in entry) return entry.notes || '';
    return '';
}

// Helper function to set entry
export function setEntry(date, count, notes = '') {
    state.entries[date] = {
        count: Number(count) || 0,
        notes: String(notes || '').trim()
    };
}

// Helper function to delete entry
export function deleteEntry(date) {
    delete state.entries[date];
}

export function saveLocalState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Singleton state object shared across the app
export const state = loadLocalState();
