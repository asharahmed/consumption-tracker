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

function getDrinkStatus(drinks, goal) {
  const diff = drinks - goal;
  if (goal === 0 && drinks === 0) return { className: "under", text: "on track" };
  if (goal === 0 && drinks > 0) return { className: "over", text: "over" };
  if (diff < 0) return { className: "under", text: "under" };
  if (diff === 0) return { className: "equal", text: "at goal" };
  return { className: "over", text: "over" };
}

function updatePill(pill, drinks, goal) {
  const status = getDrinkStatus(drinks, goal);
  const newClassName = `pill ${status.className}`;
  if (pill.className !== newClassName) {
    pill.className = newClassName;
  }
  if (pill.textContent !== status.text) {
    pill.textContent = status.text;
  }
}

function createHistoryItem({ date, drinks }, goal) {
  const li = document.createElement("li");
  li.className = "history-item";
  li.dataset.date = date;

  const left = document.createElement("div");
  left.className = "history-date";
  left.textContent = date;

  const right = document.createElement("div");
  right.className = "history-drinks";

  const textSpan = document.createElement("span");
  textSpan.textContent = `${drinks} drink(s)`;

  const pill = document.createElement("span");
  updatePill(pill, drinks, goal);

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

  return li;
}

function buildHistoryList() {
  // Performance optimization: Instead of clearing and rebuilding the entire list,
  // this function reuses existing DOM elements. It updates their content and
  // reorders them if necessary. This significantly reduces DOM manipulation,
  // leading to a faster and smoother UI, especially when the goal value changes
  // or a single entry is updated.
  const items = Object.entries(state.entries)
    .map(([date, drinks]) => ({ date, drinks }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 30);

  // Handle the empty state
  if (items.length === 0) {
    historyList.innerHTML = `<li class="history-item">No history yet. Your first log will show up here.</li>`;
    return;
  }

  const goal = Number(state.goal) || 0;
  const nodesToRender = [];
  const existingNodesByDate = new Map();
  historyList.querySelectorAll(".history-item[data-date]").forEach(node => {
    existingNodesByDate.set(node.dataset.date, node);
  });

  const datesInNewItems = new Set();

  // Create or update nodes for each item
  items.forEach(item => {
    datesInNewItems.add(item.date);
    let node = existingNodesByDate.get(item.date);
    if (node) {
      // Update existing node
      const drinksText = `${item.drinks} drink(s)`;
      const currentDrinksEl = node.querySelector(".history-drinks span:first-child");
      if (currentDrinksEl.textContent !== drinksText) {
        currentDrinksEl.textContent = drinksText;
      }
      const pillEl = node.querySelector(".pill");
      updatePill(pillEl, item.drinks, goal);
    } else {
      // Create new node
      node = createHistoryItem(item, goal);
    }
    nodesToRender.push(node);
  });

  // Remove old nodes that are no longer needed
  existingNodesByDate.forEach((node, date) => {
    if (!datesInNewItems.has(date) && node) {
      node.remove();
    }
  });

  // Re-append all nodes in the correct order. This is faster than trying
  // to surgically move them. The nodes themselves are preserved.
  const fragment = document.createDocumentFragment();
  nodesToRender.forEach(node => fragment.appendChild(node));

  historyList.innerHTML = ''; // Clear content
  historyList.appendChild(fragment);
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

  const existingYear = calendarContainer.dataset.year;
  const existingMonth = calendarContainer.dataset.month;

  if (String(calendarYear) === existingYear && String(calendarMonthIndex) === existingMonth) {
    // Performance Optimization: If the calendar is for the same month and year,
    // we don't need to rebuild the entire DOM. Instead, we just update the
    // classes for each day circle. This makes selecting different dates
    // within the same month feel instantaneous.
    const dayCircles = calendarContainer.querySelectorAll('.day-circle');
    dayCircles.forEach(circle => {
      const day = Number(circle.textContent);
      if (!day) return;
      const isoDate = isoOf(calendarYear, calendarMonthIndex, day);
      const drinks = state.entries[isoDate];

      const newClasses = ["day-circle"];
      if (drinks === undefined) {
        newClasses.push("no-data");
      } else {
        const status = getDrinkStatus(drinks, goal);
        newClasses.push(status.className);
      }

      if (isoDate === todayIso) {
        newClasses.push("today");
      }
      const newClassName = newClasses.join(" ");
      if (circle.className !== newClassName) {
        circle.className = newClassName;
      }
    });
    return;
  }

  calendarContainer.innerHTML = "";
  calendarContainer.dataset.year = calendarYear;
  calendarContainer.dataset.month = calendarMonthIndex;

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

  await saveRemoteState();
});

// Initial render from local
updateStatusForDate(dateInput.value);
buildHistoryList();
renderCalendar();
updateAuthUI();

// PWA service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .catch(err => console.error("Service worker registration failed:", err));
  });
}
