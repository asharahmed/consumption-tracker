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
  prevBtn.textContent = "‹";
  prevBtn.addEventListener("click", () => changeMonth(-1));

  const label = document.createElement("div");
  label.className = "calendar-month-label";
  label.textContent = `${monthName} ${calendarYear}`;

  const nextBtn = document.createElement("button");
  nextBtn.className = "calendar-nav-btn";
  nextBtn.textContent = "›";
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
updateStatusForDate(dateInput.value);
buildHistoryList();
renderCalendar();
renderTrendsChart();
updateAuthUI();

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
  const ctx = document.getElementById("trends-chart").getContext("2d");
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
    // if undefined, we can push null or 0. Let's push 0 for visual continuity in a bar chart, 
    // but maybe distinquish "0 drinks" from "no data"? 
    // For simplicity, if no data, let's treat as 0 but maybe style it? 
    // Actually, let's just show what is there.
    
    let renderVal = 0;
    if (value !== undefined) {
      renderVal = value;
    }
    
    dataPoints.push(renderVal);
    
    // Color logic
    if (value === undefined) {
      // No data -> greyish
      bgColors.push("rgba(148, 163, 184, 0.2)");
      borderColors.push("rgba(148, 163, 184, 0.4)");
    } else {
      const diff = value - goal;
      if (goal === 0 && value === 0) {
        // perfect (green)
        bgColors.push("rgba(34, 197, 94, 0.3)");
        borderColors.push("rgba(34, 197, 94, 0.8)");
      } else if (goal === 0 && value > 0) {
        // over (red)
        bgColors.push("rgba(239, 68, 68, 0.3)");
        borderColors.push("rgba(239, 68, 68, 0.8)");
      } else if (diff < 0) {
        // under (green)
        bgColors.push("rgba(34, 197, 94, 0.3)");
        borderColors.push("rgba(34, 197, 94, 0.8)");
      } else if (diff === 0) {
        // equal (yellow)
        bgColors.push("rgba(234, 179, 8, 0.3)");
        borderColors.push("rgba(234, 179, 8, 0.8)");
      } else {
        // over (red)
        bgColors.push("rgba(239, 68, 68, 0.3)");
        borderColors.push("rgba(239, 68, 68, 0.8)");
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
    Chart.defaults.color = "#9ca3af";
    Chart.defaults.font.family = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    
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
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: '#e5e7eb',
            bodyColor: '#e5e7eb',
            borderColor: 'rgba(148, 163, 184, 0.2)',
            borderWidth: 1,
            callbacks: {
                label: function(context) {
                    if (context.parsed.y === 0 && !state.entries[isoOf(today.getFullYear(), today.getMonth(), Number(context.label))]) {
                        // This logic is tricky because we just have 'day' as label. 
                        // Simplified: just show value.
                    }
                    return context.parsed.y + " drinks";
                }
            }
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: "rgba(148, 163, 184, 0.1)",
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
            duration: 400
        }
      },
    });
  }
}

