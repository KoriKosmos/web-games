
// Score persistence using localStorage
const SCORE_KEY = 'rps_scores';

function loadScores() {
	const data = localStorage.getItem(SCORE_KEY);
	if (data) {
		try {
			const obj = JSON.parse(data);
			return {
				playerWins: obj.playerWins || 0,
				cpuWins: obj.cpuWins || 0,
				ties: obj.ties || 0
			};
		} catch {
			// ignore parse errors
		}
	}
	return { playerWins: 0, cpuWins: 0, ties: 0 };
}

function saveScores(scores) {
	localStorage.setItem(SCORE_KEY, JSON.stringify(scores));
}

function randomThrow() {
	const throws = ['rock', 'paper', 'scissors'];
	return throws[Math.floor(Math.random() * throws.length)];
}

function normalizeThrow(throwStr) {
	const t = throwStr.trim().toLowerCase();
	if (["rock", "r"].includes(t)) return "rock";
	if (["paper", "p"].includes(t)) return "paper";
	if (["scissors", "s"].includes(t)) return "scissors";
	return null;
}

function rpsLogic(playerThrow, cpuThrow) {
	const t1 = normalizeThrow(playerThrow);
	const t2 = normalizeThrow(cpuThrow);
	if (!t1 || !t2) return "Invalid input! Please choose rock, paper, or scissors.";
	if (t1 === t2) return "It's a tie!";
	if (t1 === "rock") {
		if (t2 === "scissors") return "Rock crushes scissors! Player wins!";
		if (t2 === "paper") return "Paper covers rock! CPU wins!";
	}
	if (t1 === "paper") {
		if (t2 === "rock") return "Paper covers rock! Player wins!";
		if (t2 === "scissors") return "Scissors cut paper! CPU wins!";
	}
	if (t1 === "scissors") {
		if (t2 === "paper") return "Scissors cut paper! Player wins!";
		if (t2 === "rock") return "Rock crushes scissors! CPU wins!";
	}
	return "Invalid input! Please choose rock, paper, or scissors.";
}

// UI logic
let scores = loadScores();

function updateScoreDisplay() {
	document.getElementById('playerWins').textContent = scores.playerWins;
	document.getElementById('cpuWins').textContent = scores.cpuWins;
	document.getElementById('ties').textContent = scores.ties;
}

function handleThrow(playerThrow) {
	const cpuThrow = randomThrow();
	document.getElementById('computerChoice').textContent = `Computer chose: ${cpuThrow}`;
	const result = rpsLogic(playerThrow, cpuThrow);
	document.getElementById('result').textContent = result;
	// Update scores
	const t1 = normalizeThrow(playerThrow);
	const t2 = normalizeThrow(cpuThrow);
	if (!t1) return;
	if (t1 === t2) {
		scores.ties += 1;
	} else if (
		(t1 === "rock" && t2 === "scissors") ||
		(t1 === "paper" && t2 === "rock") ||
		(t1 === "scissors" && t2 === "paper")
	) {
		scores.playerWins += 1;
	} else {
		scores.cpuWins += 1;
	}
	updateScoreDisplay();
	saveScores(scores);
}

document.addEventListener('DOMContentLoaded', () => {
	updateScoreDisplay();
	document.querySelectorAll('.throw').forEach(btn => {
		btn.addEventListener('click', () => {
			handleThrow(btn.dataset.throw);
		});
	});
	document.getElementById('resetScores').addEventListener('click', () => {
		scores = { playerWins: 0, cpuWins: 0, ties: 0 };
		updateScoreDisplay();
		saveScores(scores);
		document.getElementById('result').textContent = '';
		document.getElementById('computerChoice').textContent = '';
	});
});
