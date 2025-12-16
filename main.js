const STORAGE_KEY = "consumptionTrackerDataV1";

// ---- Firebase init ----
if (!window.firebaseConfig) {
  console.error("firebaseConfig is not defined. Make sure config.js is loaded.");
}

firebase.initializeApp(window.firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ---- Local state & helpers ----

function loadLocalState() {
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

function saveLocalState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const state = loadLocalState();

let currentUser = null;
let remoteSyncInProgress = false;

// DOM elements
const goalInput = document.getElementById("goal-input");
const dateInput = document.getElementById("date-input");
const drinksInput = document.getElementById("drinks-input");
const saveBtn = document.getElementById("save-btn");
const statusBox = document.getElementById("status-box");
const historyList = document.getElementById("history-list");
const calendarContainer = document.getElementById("calendar");

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

const today = new Date();
let calendarYear = today.getFullYear();
let calendarMonthIndex = today.getMonth();

function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoOf(year, monthIndexZeroBased, day) {
  const m = String(monthIndexZeroBased + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function setStatus(type, title, body) {
  statusBox.className = "status " + type;
  const titleEl = statusBox.querySelector(".status-title");
  const bodyEl = statusBox.querySelector(".status-body");
  titleEl.textContent = title;
  bodyEl.textContent = body;
}

function updateStatusForDate(dateStr) {
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

function calculateStreak() {
  const goal = Number(state.goal) || 0;
  let streak = 0;

  // Start from today; if today has no data, check yesterday (grace period)
  // If today HAS data and is > goal, streak is 0.
  // If today HAS data and is <= goal, streak starts at 1, check backward.

  const t = new Date();
  const todayStr = isoOf(t.getFullYear(), t.getMonth(), t.getDate());

  // Check today
  const todayVal = state.entries[todayStr];
  let checkDate = new Date();

  if (todayVal !== undefined) {
    if (todayVal > goal) return 0; // broken today
    streak++;
    checkDate.setDate(checkDate.getDate() - 1); // move to yesterday
  } else {
    // today empty, check yesterday. If yesterday broken/empty, streak 0.
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Loop backwards
  for (let i = 0; i < 365; i++) { // max lookback 1 year
    const y = checkDate.getFullYear();
    const m = checkDate.getMonth(); // 0-based
    const d = checkDate.getDate();
    const iso = isoOf(y, m, d);
    const val = state.entries[iso];

    if (val !== undefined && val <= goal) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break; // streak broken or no data
    }
  }
  return streak;
}

function calculateZeroStreak(endDateStr) {
  let streak = 0;
  let checkDate = new Date(endDateStr);
  // Correct timezone issue: Date(string) is UTC-based usually, but here we just want YMD navigation.
  // Better to parse the YMD manually or stick to the existing date parts if endDateStr is YYYY-MM-DD.
  // Actually, new Date("2025-12-15") is treated as UTC in some browsers, but "2025-12-15T00:00:00" is local.
  // To be safe and consistent with existing code, let's parse:
  const parts = endDateStr.split('-');
  checkDate = new Date(parts[0], parts[1] - 1, parts[2]);

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

function updateStreakUI() {
  const el = document.getElementById('streak-display');
  if (!el) return;
  const streak = calculateStreak();
  el.innerHTML = `<span class="material-symbols-rounded" style="color:#facc15;">local_fire_department</span> ${streak} day streak`;

  // Optional: Hide if 0
  if (streak === 0) {
    el.style.opacity = '0.5';
    el.style.filter = 'grayscale(1)';
  } else {
    el.style.opacity = '1';
    el.style.filter = 'none';
    // Add glow
    el.style.textShadow = '0 0 10px rgba(250, 204, 21, 0.5)';
  }
}

function exportData() {
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
  document.body.appendChild(link); // Required for FF
  link.click();
  document.body.removeChild(link);
}





function updateBadges() {
  // Current zero streak from today
  // Logic: calculate streak ending today. If count > 0 today, streak is 0. 
  // Except we usually allow today to be "pending".
  // Let's use the calculateStreak logic but specifically for zeros.

  // We want the HIGHEST milestone achieved based on current streak.
  const t = new Date();
  const todayStr = isoOf(t.getFullYear(), t.getMonth(), t.getDate());
  const streak = calculateZeroStreak(todayStr); // This calculates strictly back from date

  // Check milestones
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

function renderQuote() {
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  const tEl = document.getElementById('quote-text');
  const aEl = document.getElementById('quote-author');
  if (tEl) tEl.innerText = `"${q.text}"`;
  if (aEl) aEl.innerText = `- ${q.author}`;
}

function calculateWeeklyStats() {
  // Last 7 days total & avg
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

  const totalEl = document.getElementById('weekly-total');
  const avgEl = document.getElementById('weekly-avg');

  if (totalEl) totalEl.innerText = total;
  if (avgEl) avgEl.innerText = avg;
}

function fireConfetti() {
  // Canvas-confetti library call
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#4ade80', '#facc15', '#60a5fa', '#f472b6', '#D0BCFF'],
    disableForReducedMotion: true
  });
}

function buildHistoryList() {
  const items = Object.entries(state.entries)
    .map(([date, drinks]) => ({ date, drinks }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 30);

  historyList.innerHTML = "";

  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "history-item";
    li.textContent = "No history yet. Your first log will show up here.";
    historyList.appendChild(li);
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
      dateInput.value = date;
      drinksInput.value = drinks;
      updateStatusForDate(date);
      const d = new Date(date);
      calendarYear = d.getFullYear();
      calendarMonthIndex = d.getMonth();
      renderCalendar();
    });

    historyList.appendChild(li);
  });
}

function changeMonth(delta) {
  calendarMonthIndex += delta;
  if (calendarMonthIndex < 0) {
    calendarMonthIndex = 11;
    calendarYear -= 1;
  } else if (calendarMonthIndex > 11) {
    calendarMonthIndex = 0;
    calendarYear += 1;
  }
  renderCalendar();
}

function renderCalendar() {
  const goal = Number(state.goal) || 0;
  const todayIso = todayISO();

  calendarContainer.innerHTML = "";

  const firstDay = new Date(calendarYear, calendarMonthIndex, 1);
  const monthName = firstDay.toLocaleString(undefined, { month: "long" });
  const startingWeekday = firstDay.getDay();
  const daysInMonth = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();

  const header = document.createElement("div");
  header.className = "calendar-header";

  const prevBtn = document.createElement("button");
  prevBtn.className = "calendar-nav-btn";
  prevBtn.innerHTML = '<span class="material-symbols-rounded">chevron_left</span>';
  prevBtn.addEventListener("click", () => changeMonth(-1));

  const label = document.createElement("div");
  label.className = "calendar-month-label";
  label.textContent = `${monthName} ${calendarYear}`;

  const nextBtn = document.createElement("button");
  nextBtn.className = "calendar-nav-btn";
  nextBtn.innerHTML = '<span class="material-symbols-rounded">chevron_right</span>';
  nextBtn.addEventListener("click", () => changeMonth(1));

  header.appendChild(prevBtn);
  header.appendChild(label);
  header.appendChild(nextBtn);
  calendarContainer.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "calendar-grid";

  const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];
  weekdayLabels.forEach(labelText => {
    const wd = document.createElement("div");
    wd.className = "calendar-weekday";
    wd.textContent = labelText;
    grid.appendChild(wd);
  });

  for (let i = 0; i < startingWeekday; i++) {
    const cell = document.createElement("div");
    cell.className = "calendar-day";
    grid.appendChild(cell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.className = "calendar-day";

    const circle = document.createElement("div");
    circle.className = "day-circle";

    const isoDate = isoOf(calendarYear, calendarMonthIndex, day);
    const drinks = state.entries[isoDate];

    if (drinks === undefined) {
      circle.classList.add("no-data");
    } else {
      const diff = drinks - goal;
      if (goal === 0 && drinks === 0) {
        circle.classList.add("under");
      } else if (goal === 0 && drinks > 0) {
        circle.classList.add("over");
      } else if (diff < 0) {
        circle.classList.add("under");
      } else if (diff === 0) {
        circle.classList.add("equal");
      } else {
        circle.classList.add("over");
      }
    }

    if (isoDate === todayIso) {
      circle.classList.add("today");
    }

    circle.textContent = String(day);

    circle.addEventListener("click", () => {
      dateInput.value = isoDate;
      drinksInput.value = drinks !== undefined ? drinks : "";
      updateStatusForDate(isoDate);
      renderCalendar();
    });

    cell.appendChild(circle);
    grid.appendChild(cell);
  }

  calendarContainer.appendChild(grid);
}

// ---- Cloud sync helpers ----

async function saveRemoteState() {
  if (!currentUser) return;
  const docRef = db.collection("sobrietyStates").doc(currentUser.uid);
  try {
    const payload = {
      goal: Number(state.goal) || 0,
      entries: state.entries || {},
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await docRef.set(payload, { merge: true });
  } catch (err) {
    console.error("Error saving remote state:", err);
    authErrorLoggedIn.textContent = "Could not sync to cloud (you might be offline). Local data is still safe.";
  }
}

async function syncFromCloud(user) {
  const docRef = db.collection("sobrietyStates").doc(user.uid);
  remoteSyncInProgress = true;
  authError.textContent = "";
  authErrorLoggedIn.textContent = "";
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
    authErrorLoggedIn.textContent = "Could not load cloud data; using local data.";
  } finally {
    remoteSyncInProgress = false;
    goalInput.value = state.goal || 0;
    dateInput.value = todayISO();
    drinksInput.value = state.entries[todayISO()] ?? "";
    updateStatusForDate(dateInput.value);
    buildHistoryList();
    renderCalendar();
    renderTrendsChart();
  }
}

// ---- Auth UI helpers ----

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

// ---- Auth event handlers ----

authTriggerBtn.addEventListener("click", () => {
  openAuthOverlay();
});

authCloseBtn.addEventListener("click", () => {
  closeAuthOverlay();
});

authOverlay.addEventListener("click", (e) => {
  if (e.target === authOverlay) {
    closeAuthOverlay();
  }
});

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

auth.onAuthStateChanged(async (user) => {
  currentUser = user || null;
  updateAuthUI();
  if (currentUser) {
    await syncFromCloud(currentUser);
  }
});

// ---- Form bindings ----

goalInput.value = state.goal || 0;
dateInput.value = todayISO();
drinksInput.value = state.entries[todayISO()] ?? "";

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
  await saveRemoteState();
});

dateInput.addEventListener("change", () => {
  const date = dateInput.value;
  drinksInput.value = state.entries[date] ?? "";
  updateStatusForDate(date);
  if (date) {
    const d = new Date(date);
    calendarYear = d.getFullYear();
    calendarMonthIndex = d.getMonth();
  }
  renderCalendar();
});

saveBtn.addEventListener("click", async () => {
  const date = dateInput.value;
  const drinks = Number(drinksInput.value);

  if (!date) {
    alert("Please select a date.");
    return;
  }
  if (Number.isNaN(drinks) || drinks < 0) {
    alert("Please enter a valid number of drinks (0 or more).");
    return;
  }

  state.entries[date] = drinks;
  saveLocalState(state);

  // Confetti Logic: Zero-use milestones
  if (drinks === 0) {
    const zStreak = calculateZeroStreak(date);
    const milestones = [1, 3, 7, 14, 21, 30, 60, 90, 100, 365];
    // Fire if we hit a milestone
    if (milestones.includes(zStreak)) {
      fireConfetti();
    }
  }

  updateStatusForDate(date);
  buildHistoryList();

  const d = new Date(date);
  calendarYear = d.getFullYear();
  calendarMonthIndex = d.getMonth();
  renderCalendar();
  renderTrendsChart();

  await saveRemoteState();
});

// Initial render from local
// Initial render from local
document.addEventListener("DOMContentLoaded", () => {
  updateStatusForDate(dateInput.value);
  buildHistoryList();
  renderCalendar();
  renderTrendsChart();
  updateAuthUI();
  updateStreakUI();
  renderTrendsChart();
  updateAuthUI();
  updateStreakUI();
  calculateWeeklyStats();
  updateBadges();
  renderQuote();

  // Bind export button if exists (dynamic binding)
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', (e) => {
      e.preventDefault();
      exportData();
    });
  }

  // Quick Add
  const quickAddBtn = document.getElementById('quick-add-btn');
  const countInput = document.getElementById('drinks-input');
  if (quickAddBtn && countInput) {
    quickAddBtn.addEventListener('click', () => {
      const current = parseInt(countInput.value) || 0;
      countInput.value = current + 1;
    });
  }
});

// PWA service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .catch(err => console.error("Service worker registration failed:", err));
  });
}


// ---- Trends Chart ----

let trendsChart = null;

function renderTrendsChart() {
  const canvas = document.getElementById("trends-chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const goal = Number(state.goal) || 0;

  // 1. Calculate last 14 days
  const labels = [];
  const dataPoints = [];
  const bgColors = [];
  const borderColors = [];

  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);

    // Format YYYY-MM-DD manually to avoid timezone weirdness
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const isoDate = `${year}-${month}-${day}`;

    // Short label for X axis (e.g. "15", "16")
    labels.push(day); // just the day number

    const value = state.entries[isoDate];

    let renderVal = 0;
    if (value !== undefined) {
      renderVal = value;
    }

    dataPoints.push(renderVal);

    // Color logic matching CSS variables
    // Success: #81c995, Warning: #fdd663, Danger: #f28b82
    if (value === undefined) {
      bgColors.push("rgba(147, 143, 153, 0.2)"); // Outline variant like color
      borderColors.push("#938F99");
    } else {
      const diff = value - goal;
      if (goal === 0 && value === 0) {
        bgColors.push("rgba(129, 201, 149, 0.7)");
        borderColors.push("#81c995");
      } else if (goal === 0 && value > 0) {
        bgColors.push("rgba(242, 139, 130, 0.7)");
        borderColors.push("#f28b82");
      } else if (diff < 0) {
        bgColors.push("rgba(129, 201, 149, 0.7)");
        borderColors.push("#81c995");
      } else if (diff === 0) {
        bgColors.push("rgba(253, 214, 99, 0.7)");
        borderColors.push("#fdd663");
      } else {
        bgColors.push("rgba(242, 139, 130, 0.7)");
        borderColors.push("#f28b82");
      }
    }
  }

  if (trendsChart) {
    trendsChart.data.labels = labels;
    trendsChart.data.datasets[0].data = dataPoints;
    trendsChart.data.datasets[0].backgroundColor = bgColors;
    trendsChart.data.datasets[0].borderColor = borderColors;
    trendsChart.update();
  } else {
    Chart.defaults.color = "#CAC4D0"; // Text muted
    Chart.defaults.font.family = "'Google Sans', 'Roboto', sans-serif";

    trendsChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Drinks",
            data: dataPoints,
            backgroundColor: bgColors,
            borderColor: borderColors,
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: '#2B2930',
            titleColor: '#E6E1E5',
            bodyColor: '#E6E1E5',
            borderColor: '#49454F',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: function (context) {
                return context.parsed.y + " drinks";
              }
            }
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: "#49454F", // Outline variant
              drawBorder: false,
            },
            ticks: {
              stepSize: 1
            }
          },
          x: {
            grid: {
              display: false,
            },
          },
        },
        animation: {
          duration: 600,
          easing: 'easeOutQuart'
        }
      },
    });
  }
}

// ---- Ripple Effect ----

function createRipple(event) {
  const button = event.currentTarget;
  const circle = document.createElement("span");
  const diameter = Math.max(button.clientWidth, button.clientHeight);
  const radius = diameter / 2;

  const rect = button.getBoundingClientRect();

  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${event.clientX - rect.left - radius}px`;
  circle.style.top = `${event.clientY - rect.top - radius}px`;
  circle.classList.add("ripple-surface");

  // Remove ripple after animation
  const ripple = button.getElementsByClassName("ripple-surface")[0];
  if (ripple) {
    ripple.remove();
  }

  button.appendChild(circle);
}

// Add ripple to buttons
function attachRipple() {
  const buttons = document.querySelectorAll("button, .day-circle, .history-item");
  buttons.forEach(btn => {
    btn.removeEventListener("click", createRipple); // avoid duplicates if called multiple times
    btn.addEventListener("click", createRipple);
  });
}

// Attach on load and observing mutations for dynamic content
document.addEventListener("DOMContentLoaded", () => {
  attachRipple();

  // Observer for dynamic content (calendar, history)
  const observer = new MutationObserver((mutations) => {
    attachRipple();
  });

  const config = { childList: true, subtree: true };
  if (document.getElementById("calendar")) observer.observe(document.getElementById("calendar"), config);
  if (document.getElementById("history-list")) observer.observe(document.getElementById("history-list"), config);
});


