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

function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // black background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, COLS * SIZE, ROWS * SIZE);

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

drawGrid();
