// Utility functions

export function todayISO() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function isoOf(year, monthIndexZeroBased, day) {
    const m = String(monthIndexZeroBased + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
}

// Ripple Effect
export function createRipple(event) {
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

export function attachRipple() {
    const buttons = document.querySelectorAll("button, .day-circle, .history-item");
    buttons.forEach(btn => {
        btn.removeEventListener("click", createRipple); // avoid duplicates if called multiple times
        btn.addEventListener("click", createRipple);
    });
}
