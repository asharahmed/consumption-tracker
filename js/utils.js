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

// Debounce function for performance optimization
export function debounce(func, wait = 100) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function for scroll/resize events
export function throttle(func, limit = 100) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
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

// WeakSet to track elements with ripple attached (prevents memory leaks)
const rippleAttached = new WeakSet();

export function attachRipple() {
    const buttons = document.querySelectorAll("button, .day-circle, .history-item");
    buttons.forEach(btn => {
        if (!rippleAttached.has(btn)) {
            btn.addEventListener("click", createRipple);
            rippleAttached.add(btn);
        }
    });
}

// Lazy load images when they come into view
export function lazyLoadImages() {
    if ('IntersectionObserver' in window) {
        const images = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });
        images.forEach(img => imageObserver.observe(img));
    }
}

// RequestAnimationFrame wrapper for smooth animations
export function raf(callback) {
    return window.requestAnimationFrame ?
        window.requestAnimationFrame(callback) :
        setTimeout(callback, 16);
}
