import { state, saveLocalState, getEntryCount, getEntryNotes, setEntry, deleteEntry } from './state.js';
import { isoOf, todayISO } from './utils.js';
import { renderCalendar } from './calendar.js';
import { renderTrendsChart } from './charts.js';

// Pre-fetched DOM elements (or fetched on demand to be safe)
const statusBox = document.getElementById("status-box");
const historyList = document.getElementById("history-list");
const dateInput = document.getElementById("date-input");
const drinksInput = document.getElementById("drinks-input");
const streakDisplay = document.getElementById('streak-display');
const weeklyTotal = document.getElementById('weekly-total');
const weeklyAvg = document.getElementById('weekly-avg');
const quoteText = document.getElementById('quote-text');
const quoteAuthor = document.getElementById('quote-author');

export function setStatus(type, title, body) {
    if (!statusBox) return;
    statusBox.className = "status " + type;
    const titleEl = statusBox.querySelector(".status-title");
    const bodyEl = statusBox.querySelector(".status-body");
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.textContent = body;
}

export function updateStreakUI() {
    const el = document.getElementById('streak-display');
    if (!el) return;
    const streak = calculateStreak();
    el.innerHTML = `<span class="material-symbols-rounded" style="color:#facc15;">local_fire_department</span> ${streak} day streak`;

    if (streak === 0) {
        el.style.opacity = '0.5';
        el.style.filter = 'grayscale(1)';
    } else {
        el.style.opacity = '1';
        el.style.filter = 'none';
        el.style.textShadow = '0 0 10px rgba(250, 204, 21, 0.5)';
    }
}

export function calculateStreak() {
    const goal = Number(state.goal) || 0;
    let streak = 0;

    const t = new Date();
    const todayStr = isoOf(t.getFullYear(), t.getMonth(), t.getDate());

    const todayVal = getEntryCount(todayStr);
    let checkDate = new Date();

    if (todayVal !== undefined && todayVal !== 0) {
        if (todayVal > goal) return 0;
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
    } else {
        checkDate.setDate(checkDate.getDate() - 1);
    }

    for (let i = 0; i < 365; i++) {
        const y = checkDate.getFullYear();
        const m = checkDate.getMonth();
        const d = checkDate.getDate();
        const iso = isoOf(y, m, d);
        const val = getEntryCount(iso);

        if (val !== undefined && val <= goal) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }
    return streak;
}

export function calculateZeroStreak(endDateStr) {
    let streak = 0;
    let checkDate;

    if (endDateStr) {
        const parts = endDateStr.split('-');
        checkDate = new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
        checkDate = new Date();
    }

    for (let i = 0; i < 365; i++) {
        const y = checkDate.getFullYear();
        const m = checkDate.getMonth();
        const d = checkDate.getDate();
        const iso = isoOf(y, m, d);
        const val = getEntryCount(iso);

        if (val === 0) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }
    return streak;
}

export function updateStatusForDate(dateStr) {
    const goal = Number(state.goal) || 0;
    const drinks = getEntryCount(dateStr);

    if (drinks === undefined || drinks === 0 && getEntryNotes(dateStr) === '') {
        setStatus(
            "empty",
            "No data for this date yet",
            "Add how many drinks you had to see how it compares to your goal."
        );
        return;
    }

    const diff = drinks - goal;

    if (goal === 0 && drinks === 0) {
        setStatus(
            "under",
            "On track",
            `You logged 0 drinks for ${dateStr}. Your goal is 0 — you're fully on track.`
        );
    } else if (diff < 0) {
        setStatus(
            "under",
            "Under your goal",
            `You had ${drinks} drink(s) on ${dateStr}. Your goal is ${goal}, so you are under by ${Math.abs(diff)}.`
        );
    } else if (diff === 0) {
        setStatus(
            "equal",
            "Exactly at your goal",
            `You had ${drinks} drink(s) on ${dateStr}, which matches your goal of ${goal}.`
        );
    } else {
        setStatus(
            "over",
            "Over your goal",
            `You had ${drinks} drink(s) on ${dateStr}. Your goal is ${goal}, so you're over by ${diff}.`
        );
    }

    updateStreakUI();
}

export function updateBadges() {
    const t = new Date();
    const todayStr = isoOf(t.getFullYear(), t.getMonth(), t.getDate());
    const streak = calculateZeroStreak(todayStr);

    const milestones = [1, 3, 7, 14, 30];
    milestones.forEach(m => {
        const el = document.getElementById(`badge-${m}`);
        if (el) {
            if (streak >= m) {
                el.classList.add('unlocked');
            } else {
                el.classList.remove('unlocked');
            }
        }
    });
}

export function buildHistoryList() {
    const list = document.getElementById("history-list");
    if (!list) return;

    const items = Object.entries(state.entries)
        .map(([date, drinks]) => ({ date, drinks }))
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 30);

    list.innerHTML = "";

    if (items.length === 0) {
        const li = document.createElement("li");
        li.className = "history-item";
        li.textContent = "No history yet. Your first log will show up here.";
        list.appendChild(li);
        return;
    }

    const goal = Number(state.goal) || 0;

    items.forEach(({ date, drinks }) => {
        const count = typeof drinks === 'number' ? drinks : drinks.count || 0;
        const notes = typeof drinks === 'object' ? drinks.notes || '' : '';

        const li = document.createElement("li");
        li.className = "history-item";

        const contentDiv = document.createElement("div");
        contentDiv.className = "history-content";

        const left = document.createElement("div");
        left.className = "history-date";
        left.textContent = date;

        const right = document.createElement("div");
        right.className = "history-drinks";

        const textSpan = document.createElement("span");
        textSpan.textContent = `${count} drink(s)`;

        const pill = document.createElement("span");
        pill.className = "pill";
        let diff = count - goal;

        if (goal === 0 && count === 0) {
            pill.classList.add("under");
            pill.textContent = "on track";
        } else if (goal === 0 && count > 0) {
            pill.classList.add("over");
            pill.textContent = "over";
        } else if (diff < 0) {
            pill.classList.add("under");
            pill.textContent = "under";
        } else if (diff === 0) {
            pill.classList.add("equal");
            pill.textContent = "at goal";
        } else {
            pill.classList.add("over");
            pill.textContent = "over";
        }

        right.appendChild(textSpan);
        right.appendChild(pill);

        contentDiv.appendChild(left);
        contentDiv.appendChild(right);

        // Add notes if present
        if (notes) {
            const notesDiv = document.createElement("div");
            notesDiv.className = "history-notes";
            notesDiv.textContent = notes.length > 60 ? notes.substring(0, 60) + '...' : notes;
            contentDiv.appendChild(notesDiv);
        }

        // Add action buttons
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "history-actions";

        const editBtn = document.createElement("button");
        editBtn.className = "icon-btn edit-btn";
        editBtn.innerHTML = '<span class="material-symbols-rounded">edit</span>';
        editBtn.title = "Edit entry";
        editBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            handleEdit(date);
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "icon-btn delete-btn";
        deleteBtn.innerHTML = '<span class="material-symbols-rounded">delete</span>';
        deleteBtn.title = "Delete entry";
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            handleDelete(date);
        });

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);

        li.appendChild(contentDiv);
        li.appendChild(actionsDiv);

        list.appendChild(li);
    });
}

// Handle edit action
function handleEdit(date) {
    const dateInput = document.getElementById("date-input");
    const drinksInput = document.getElementById("drinks-input");
    const notesInput = document.getElementById("notes-input");
    const notesCharCount = document.getElementById("notes-char-count");

    const count = getEntryCount(date);
    const notes = getEntryNotes(date);

    if (dateInput) dateInput.value = date;
    if (drinksInput) drinksInput.value = count;
    if (notesInput) {
        notesInput.value = notes;
        if (notesCharCount) notesCharCount.textContent = notes.length;
    }

    updateStatusForDate(date);
    renderCalendar();

    // Scroll to form
    const card = document.querySelector('.card');
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (drinksInput) {
            setTimeout(() => drinksInput.focus(), 300);
        }
    }
}

// Handle delete action
function handleDelete(date) {
    if (confirm(`Delete entry for ${date}?\n\nThis action cannot be undone.`)) {
        deleteEntry(date);
        saveLocalState(state);

        // Update all UI
        buildHistoryList();
        renderCalendar();
        renderTrendsChart();
        updateBadges();

        const dateInput = document.getElementById("date-input");
        if (dateInput && dateInput.value === date) {
            updateStatusForDate(date);
        }

        // Sync to cloud
        import('./db.js').then(module => {
            const db = firebase.firestore();
            module.saveRemoteState(db);
        });
    }
}

export function calculateWeeklyStats() {
    const today = new Date();
    let total = 0;
    let daysWithData = 0;

    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const iso = isoOf(d.getFullYear(), d.getMonth(), d.getDate());
        const val = getEntryCount(iso);
        if (val !== undefined && val !== 0) {
            total += val;
            daysWithData++;
        }
    }

    const avg = daysWithData > 0 ? (total / daysWithData).toFixed(1) : "0.0";

    const tEl = document.getElementById('weekly-total');
    const aEl = document.getElementById('weekly-avg');
    if (tEl) tEl.innerText = total;
    if (aEl) aEl.innerText = avg;
}

export function fireConfetti() {
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#4ade80', '#facc15', '#60a5fa', '#f472b6', '#D0BCFF'],
            disableForReducedMotion: true
        });
    }
}

export function exportData() {
    const rows = [["Date", "Drinks", "Notes", "Goal (At Time of Export)"]];
    const goal = state.goal || 0;

    Object.keys(state.entries).sort().forEach(date => {
        const count = getEntryCount(date);
        const notes = getEntryNotes(date);
        rows.push([date, count, notes.replace(/,/g, ';'), goal]);
    });

    let csvContent = "data:text/csv;charset=utf-8,"
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `consumption_history_${todayISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

const QUOTES = [
    { text: "The journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { text: "Everything you need is already inside you.", author: "Unknown" },
    { text: "Small steps every day add up to big results.", author: "Unknown" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Your future is created by what you do today, not tomorrow.", author: "Unknown" },
    { text: "It always seems impossible until it's done.", author: "Nelson Mandela" }
];

export function renderQuote() {
    const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    const tEl = document.getElementById('quote-text');
    const aEl = document.getElementById('quote-author');
    if (tEl) tEl.innerText = `"${q.text}"`;
    if (aEl) aEl.innerText = `- ${q.author}`;
}
