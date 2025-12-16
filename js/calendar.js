import { state } from './state.js';
import { isoOf, todayISO } from './utils.js';
import { updateStatusForDate } from './ui.js';

let calendarYear = new Date().getFullYear();
let calendarMonthIndex = new Date().getMonth();

export function changeMonth(delta) {
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

export function renderCalendar() {
    const calendarContainer = document.getElementById("calendar");
    if (!calendarContainer) return;

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
            const dateInput = document.getElementById("date-input");
            const drinksInput = document.getElementById("drinks-input");

            if (dateInput) dateInput.value = isoDate;
            if (drinksInput) drinksInput.value = drinks !== undefined ? drinks : "";

            updateStatusForDate(isoDate);
            renderCalendar();
        });

        cell.appendChild(circle);
        grid.appendChild(cell);
    }

    calendarContainer.appendChild(grid);
}
