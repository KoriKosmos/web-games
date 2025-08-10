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

// --- Scoring ---
let score = 0;
let lines = 0;
let level = 0;

const $score = document.getElementById('score');
const $lines = document.getElementById('lines');
const $level = document.getElementById('level');

function updateHUD() {
    $score.textContent = score;
    $lines.textContent = lines;
    $level.textContent = level;
}

function addScore(cleared) {
    // classic-ish: 1=100, 2=300, 3=500, 4=800; scaled by (level+1)
    const table = [0, 100, 300, 500, 800];
    score += table[cleared] * (level + 1);
    lines += cleared;

    // level up every 10 lines
    const target = (level + 1) * 10;
    if (lines >= target) {
        level++;
        // speed up a bit each level, min 100ms
        dropInterval = Math.max(100, dropInterval - 80);
    }
    updateHUD();
}


// --- Playfield state (0 = empty; >0 = color index) ---
const board = Array.from({length: ROWS}, () => Array(COLS).fill(0));

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

// --- Gravity timing ---
let lastTime = 0;
let dropCounter = 0;
let dropInterval = 800; // ms per row at start (we can speed up later)


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

// --- Tetromino definitions (cell values match color indices) ---
const SHAPES = {
    I: [[1, 1, 1, 1]],
    J: [[2, 0, 0], [2, 2, 2]],
    L: [[0, 0, 3], [3, 3, 3]],
    O: [[4, 4], [4, 4]],
    S: [[0, 5, 5], [5, 5, 0]],
    T: [[0, 6, 0], [6, 6, 6]],
    Z: [[7, 7, 0], [0, 7, 7]],
};

// Rotate a matrix CW (dir=1) or CCW (dir=-1)
function rotate(mat, dir = 1) {
    const h = mat.length, w = mat[0].length;
    const res = Array.from({length: w}, () => Array(h).fill(0));
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (dir === 1) res[x][h - 1 - y] = mat[y][x];
            else res[w - 1 - x][y] = mat[y][x];
        }
    }
    return res;
}

// Active piece state
let piece = null;

// Draw any matrix onto the canvas at (offX, offY)
function drawMatrix(mat, offX, offY) {
    for (let y = 0; y < mat.length; y++) {
        for (let x = 0; x < mat[y].length; x++) {
            const v = mat[y][x];
            if (!v) continue;
            const gx = offX + x;
            const gy = offY + y;
            if (gy >= 0) { // allow spawning slightly above visible area
                drawCell(gx, gy, COLORS[v]);
            }
        }
    }
}

// Spawn a random tetromino centered at the top
function spawn() {
    const types = Object.keys(SHAPES);
    const t = types[Math.floor(Math.random() * types.length)];
    const mat = SHAPES[t].map(row => row.slice()); // shallow clone
    piece = {
        matrix: mat,
        x: Math.floor((COLS - mat[0].length) / 2),
        y: -1, // start just above the board so tall pieces slide in
    };
}

// Check if matrix at (offX, offY) is a valid position (no collisions)
function isValidPosition(mat, offX, offY) {
    for (let y = 0; y < mat.length; y++) {
        for (let x = 0; x < mat[y].length; x++) {
            const v = mat[y][x];
            if (!v) continue;

            const gx = offX + x;
            const gy = offY + y;

            // outside left/right/bottom
            if (gx < 0 || gx >= COLS || gy >= ROWS) return false;

            // above top is allowed (spawn region)
            if (gy < 0) continue;

            // hit an occupied cell
            if (board[gy][gx]) return false;
        }
    }
    return true;
}

// Merge the active piece into the board (lock it)
function mergePiece() {
    const {matrix, x: offX, y: offY} = piece;
    for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[y].length; x++) {
            const v = matrix[y][x];
            if (!v) continue;
            const gx = offX + x;
            const gy = offY + y;
            if (gy >= 0) board[gy][gx] = v;
        }
    }
}

function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
        if (board[y].every(v => v !== 0)) {
            board.splice(y, 1);                 // remove the full row
            board.unshift(Array(COLS).fill(0)); // add empty row at top
            cleared++;
            y++; // re-check same y index (since rows shifted down)
        }
    }
    return cleared; // 0..4
}


function tryMove(dx, dy) {
    const nx = piece.x + dx;
    const ny = piece.y + dy;
    if (isValidPosition(piece.matrix, nx, ny)) {
        piece.x = nx;
        piece.y = ny;
        return true;
    }
    return false;
}

function tryRotate(dir = 1) {
    const rotated = rotate(piece.matrix, dir);

    // test center + a few side offsets
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
        const nx = piece.x + k;
        const ny = piece.y; // no vertical kick in this simple version
        if (isValidPosition(rotated, nx, ny)) {
            piece.matrix = rotated;
            piece.x = nx;
            piece.y = ny;
            return true;
        }
    }
    return false;
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

    // draw active piece on top
    if (piece) {
        drawMatrix(piece.matrix, piece.x, piece.y);
    }

}

function drop() {
    if (!tryMove(0, 1)) {
        // Can't go down: lock and spawn next
        mergePiece();
        const cleared = clearLines();
        if (cleared) addScore(cleared);
        spawn();

        // If new piece is invalid immediately, it's game over (temp handling)
        if (!isValidPosition(piece.matrix, piece.x, piece.y)) {
            // simple reset for now
            for (let y = 0; y < ROWS; y++) board[y].fill(0);
            spawn();
        }
        render();
    }
    dropCounter = 0;
}


function update(time = 0) {
    const dt = time - lastTime;
    lastTime = time;

    // Gravity
    dropCounter += dt;
    if (dropCounter >= dropInterval) {
        drop();
    }

    // Horizontal movement with DAS/ARR
    if (horiz !== 0) {
        if (dasTimer < DAS) {
            dasTimer += dt;               // wait initial delay
        } else {
            arrTimer += dt;               // then repeat at ARR
            if (arrTimer >= ARR) {
                tryMove(horiz, 0);
                arrTimer = 0;
            }
        }
    }

    // Soft drop (throttled)
    if (keys.down) {
        softTimer += dt;
        if (softTimer >= SOFT) {
            drop();
            softTimer = 0;
        }
    } else {
        softTimer = 0;
    }

    render();
    requestAnimationFrame(update);
}


const keys = { left: false, right: false, down: false };
let horiz = 0;               // -1 left, 0 none, 1 right
let dasTimer = 0;
let arrTimer = 0;
const DAS = 170;             // ms before auto-repeat starts
const ARR = 50;              // ms between repeats after DAS
let softTimer = 0;
const SOFT = 40;             // ms between soft drops

function setHoriz(dir) {
    if (horiz !== dir) {
        horiz = dir;
        dasTimer = 0;
        arrTimer = 0;
        if (dir !== 0) {
            // immediate move on press or when switching directions
            tryMove(dir, 0);
        }
    }
}


window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
        if (!keys.left) { keys.left = true; setHoriz(-1); }
        e.preventDefault();
    } else if (e.key === 'ArrowRight') {
        if (!keys.right) { keys.right = true; setHoriz(1); }
        e.preventDefault();
    } else if (e.key === 'ArrowDown') {
        keys.down = true; e.preventDefault();
    } else if (e.key === 'x' || e.key === 'X') {
        tryRotate(1); e.preventDefault();
    } else if (e.key === 'z' || e.key === 'Z') {
        tryRotate(-1); e.preventDefault();
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') {
        keys.left = false;                     // unset first
        setHoriz(keys.right ? 1 : 0);          // then decide continuation
    } else if (e.key === 'ArrowRight') {
        keys.right = false;                    // unset first
        setHoriz(keys.left ? -1 : 0);          // then decide continuation
    } else if (e.key === 'ArrowDown') {
        keys.down = false;
        softTimer = 0;
    }
});




spawn();
updateHUD();
requestAnimationFrame(update);



