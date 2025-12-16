import { state, saveLocalState, getEntryCount, getEntryNotes, setEntry } from './state.js';
import { todayISO, attachRipple } from './utils.js';
import { initAuth } from './auth.js';
import { saveRemoteState } from './db.js';
import { updateStatusForDate, buildHistoryList, calculateWeeklyStats, updateBadges, renderQuote, fireConfetti, calculateZeroStreak, exportData } from './ui.js';
import { renderCalendar } from './calendar.js';
import { renderTrendsChart } from './charts.js';

// Init Firebase
if (!window.firebaseConfig) {
    console.error("firebaseConfig is not defined. Make sure config.js is loaded.");
} else {
    firebase.initializeApp(window.firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Bind init
document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const goalInput = document.getElementById("goal-input");
    const dateInput = document.getElementById("date-input");
    const drinksInput = document.getElementById("drinks-input");
    const notesInput = document.getElementById("notes-input");
    const notesCharCount = document.getElementById("notes-char-count");
    const saveBtn = document.getElementById("save-btn");
    const exportBtn = document.getElementById('export-btn');
    const quickAddBtn = document.getElementById('quick-add-btn');

    // Initialize Modules
    initAuth(auth, db);

    // Set initial inputs
    if (goalInput) goalInput.value = state.goal || 0;
    if (dateInput) dateInput.value = todayISO();
    if (drinksInput && dateInput) {
        const count = getEntryCount(todayISO());
        drinksInput.value = count || "";
    }
    if (notesInput && dateInput) {
        const notes = getEntryNotes(todayISO());
        notesInput.value = notes;
        if (notesCharCount) notesCharCount.textContent = notes.length;
    }

    // Initial Renders
    if (dateInput) updateStatusForDate(dateInput.value);
    buildHistoryList();
    renderCalendar();
    renderTrendsChart();
    calculateWeeklyStats();
    updateBadges();
    renderQuote();
    attachRipple();

    // Listeners
    if (goalInput) {
        goalInput.addEventListener("change", async () => {
            const value = Number(goalInput.value);
            if (Number.isNaN(value) || value < 0) {
                goalInput.value = state.goal || 0;
                return;
            }
            state.goal = value;
            saveLocalState(state);
            updateStatusForDate(dateInput.value);
            buildHistoryList();
            renderCalendar();
            renderTrendsChart();
            await saveRemoteState(db);
        });
    }

    if (dateInput) {
        dateInput.addEventListener("change", () => {
            const date = dateInput.value;
            if (drinksInput) {
                const count = getEntryCount(date);
                drinksInput.value = count || "";
            }
            if (notesInput) {
                const notes = getEntryNotes(date);
                notesInput.value = notes;
                if (notesCharCount) notesCharCount.textContent = notes.length;
            }
            updateStatusForDate(date);
            renderCalendar();
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const date = dateInput.value;
            const drinks = Number(drinksInput.value);
            const notes = notesInput ? notesInput.value.trim() : '';

            if (!date) {
                alert("Please select a date.");
                return;
            }
            if (Number.isNaN(drinks) || drinks < 0) {
                alert("Please enter a valid number of drinks (0 or more).");
                return;
            }

            // Use new setEntry helper
            setEntry(date, drinks, notes);
            saveLocalState(state);

            // Confetti Logic
            if (drinks === 0) {
                const zStreak = calculateZeroStreak(date);
                const milestones = [1, 3, 7, 14, 21, 30, 60, 90, 100, 365];
                if (milestones.includes(zStreak)) {
                    fireConfetti();
                }
            }

            updateStatusForDate(date);
            buildHistoryList();
            renderCalendar();
            renderTrendsChart();
            await saveRemoteState(db);
        });
    }

    if (exportBtn) {
        exportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            exportData();
        });
    }

    if (quickAddBtn && drinksInput) {
        quickAddBtn.addEventListener('click', () => {
            const current = parseInt(drinksInput.value) || 0;
            drinksInput.value = current + 1;
        });
    }

    // Character counter for notes
    if (notesInput && notesCharCount) {
        notesInput.addEventListener('input', () => {
            notesCharCount.textContent = notesInput.value.length;
        });
    }

    // Observer
    const observer = new MutationObserver((mutations) => {
        attachRipple();
    });
    const config = { childList: true, subtree: true };
    if (document.getElementById("calendar")) observer.observe(document.getElementById("calendar"), config);
    if (document.getElementById("history-list")) observer.observe(document.getElementById("history-list"), config);
});


// PWA Support
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("sw.js")
            .catch(err => console.error("Service worker registration failed:", err));
    });
}
