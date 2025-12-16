import { state, saveLocalState } from './state.js';
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

    const todayVal = state.entries[todayStr];
    let checkDate = new Date();

    if (todayVal !== undefined) {
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
        const val = state.entries[iso];

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
        const val = state.entries[iso];

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
    const drinks = state.entries[dateStr];

    if (drinks === undefined) {
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
        const li = document.createElement("li");
        li.className = "history-item";

        const left = document.createElement("div");
        left.className = "history-date";
        left.textContent = date;

        const right = document.createElement("div");
        right.className = "history-drinks";

        const textSpan = document.createElement("span");
        textSpan.textContent = `${drinks} drink(s)`;

        const pill = document.createElement("span");
        pill.className = "pill";
        let diff = drinks - goal;

        if (goal === 0 && drinks === 0) {
            pill.classList.add("under");
            pill.textContent = "on track";
        } else if (goal === 0 && drinks > 0) {
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

        li.appendChild(left);
        li.appendChild(right);

        li.addEventListener("click", () => {
            const dateIn = document.getElementById("date-input");
            const drinksIn = document.getElementById("drinks-input");
            if (dateIn) dateIn.value = date;
            if (drinksIn) drinksIn.value = drinks;
            updateStatusForDate(date);

            // We need to change calendar month if needed?
            // Calendar handling is in main usually, but here calling renderCalendar directly
            // might not update month index in calendar module.
            // This is a small issue. `calendarYear` is local to calendar module.
            // We can export helpers to set year/month or just let it render what it has?
            // Ideally we want to jump to that month. But calendar module doesn't expose setYear/Month.
            // For now, simpler is fine.

            renderCalendar();
        });

        list.appendChild(li);
    });
}

export function calculateWeeklyStats() {
    const today = new Date();
    let total = 0;
    let daysWithData = 0;

    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const iso = isoOf(d.getFullYear(), d.getMonth(), d.getDate());
        const val = state.entries[iso];
        if (val !== undefined) {
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
    const rows = [["Date", "Drinks", "Goal (At Time of Export)"]];
    const goal = state.goal || 0;

    Object.keys(state.entries).sort().forEach(date => {
        rows.push([date, state.entries[date], goal]);
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
