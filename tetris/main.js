const COLS = 10;
const ROWS = 20;
const SIZE = 30;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

// Optional: improve crispness on HiDPI screens
(function scaleForHiDPI() {
    const dpr = window.devicePixelRatio || 1;
    if (dpr !== 1) {
        canvas.style.width = canvas.width + 'px';
        canvas.style.height = canvas.height + 'px';
        canvas.width = Math.floor(canvas.width * dpr);
        canvas.height = Math.floor(canvas.height * dpr);
        ctx.scale(dpr, dpr);
    }
})();

// --- Playfield state (0 = empty; >0 = color index) ---
const board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

// Simple palette: indices 1..7 map to colors
const COLORS = [
    null,
    '#00f0f0', // 1 cyan
    '#0000f0', // 2 blue
    '#f0a000', // 3 orange
    '#f0f000', // 4 yellow
    '#00f000', // 5 green
    '#a000f0', // 6 purple
    '#f00000', // 7 red
];

// Draw one cell
function drawCell(x, y, color) {
    const px = x * SIZE;
    const py = y * SIZE;

    // base
    ctx.fillStyle = color;
    ctx.fillRect(px, py, SIZE, SIZE);

    // tiny bevel for a bit of depth
    ctx.strokeStyle = '#111';
    ctx.strokeRect(px + 0.5, py + 0.5, SIZE - 1, SIZE - 1);
}

// Full render: background, placed blocks, grid
function render() {
    // background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, COLS * SIZE, ROWS * SIZE);

    // draw placed cells
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const v = board[y][x];
            if (v) drawCell(x, y, COLORS[v]);
        }
    }

    // subtle grid lines
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * SIZE, 0);
        ctx.lineTo(x * SIZE, ROWS * SIZE);
        ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * SIZE);
        ctx.lineTo(COLS * SIZE, y * SIZE);
        ctx.stroke();
    }
}


// TEMP: paint a few cells so we can see something
board[19].fill(4);   // yellow bottom row
board[18][4] = 2;    // blue block
board[17][5] = 6;    // purple block
render();

