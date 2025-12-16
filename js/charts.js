import { state, getEntryCount } from './state.js';

let trendsChart = null;

export function renderTrendsChart() {
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

        // Short label for X axis (e.g. "15")
        labels.push(day);

        const count = getEntryCount(isoDate);

        let renderVal = 0;
        if (count !== undefined) {
            renderVal = count;
        }

        dataPoints.push(renderVal);

        // Color logic
        if (count === undefined || count === 0 && renderVal === 0) {
            bgColors.push("rgba(147, 143, 153, 0.2)");
            borderColors.push("#938F99");
        } else {
            const diff = count - goal;
            if (goal === 0 && count === 0) {
                bgColors.push("rgba(129, 201, 149, 0.7)");
                borderColors.push("#81c995");
            } else if (goal === 0 && count > 0) {
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
        // Assuming Chart global exists
        if (typeof Chart !== 'undefined') {
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
}
