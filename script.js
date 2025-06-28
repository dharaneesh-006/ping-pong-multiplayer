const firebaseConfig = {
  apiKey: "AIzaSyAtq_HnXCxNwAOr0Rn5FUJp6H_zj6z_3wQ",
  authDomain: "ping-pong-multi.firebaseapp.com",
  databaseURL: "https://ping-pong-multi-default-rtdb.firebaseio.com",
  projectId: "ping-pong-multi",
  storageBucket: "ping-pong-multi.firebasestorage.app",
  messagingSenderId: "639547822812",
  appId: "1:639547822812:web:5e4329a64bfb4199509a19",
  measurementId: "G-JY28DDH6KM"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let playerSide = "", room = "", playerName = "";
const paddles = {
  bottom: document.getElementById("paddle-bottom"),
  top: document.getElementById("paddle-top"),
  left: document.getElementById("paddle-left"),
  right: document.getElementById("paddle-right")
};
const ball = document.getElementById("ball");
const leaderboardList = document.getElementById("leaderboard-list");
const scoreDisplay = document.getElementById("scoreDisplay");
const statusDisplay = document.getElementById("gameStatus");

function joinRoom() {
  playerName = document.getElementById("playerName").value.trim();
  room = document.getElementById("roomCode").value.trim();
  if (!playerName || !room) return alert("Please fill all fields");

  const ref = db.ref(`rooms/${room}/players`);
  ref.once("value").then(snapshot => {
    const data = snapshot.val() || {};
    const sides = ["bottom", "top", "left", "right"];
    const taken = Object.keys(data);
    const free = sides.find(s => !taken.includes(s));
    if (!free) return alert("Room full");

    playerSide = free;
    ref.child(playerSide).set({ name: playerName, alive: true, x: 150, y: 150, score: 0, ready: false });
    ref.child(playerSide).onDisconnect().remove();

    document.getElementById("startBtnWrapper").style.display = "block";
    setupListeners();
    setupMovement();
  });
}

function playerReady() {
  db.ref(`rooms/${room}/players/${playerSide}`).update({ ready: true });
}

function setupListeners() {
  db.ref(`rooms/${room}/players`).on("value", snap => {
    const players = snap.val() || {};

    Object.keys(paddles).forEach(side => {
      const p = players[side];
      if (!p || !p.alive) {
        paddles[side].style.display = "none";
      } else {
        paddles[side].style.display = "block";
        if (side === "top" || side === "bottom")
          paddles[side].style.left = `${p.x}px`;
        else
          paddles[side].style.top = `${p.y}px`;
      }
    });

    const sorted = Object.entries(players).sort((a, b) => {
      if (a[1].alive && !b[1].alive) return -1;
      if (!a[1].alive && b[1].alive) return 1;
      return (a[1].outAt || 0) - (b[1].outAt || 0);
    });

    leaderboardList.innerHTML = sorted.map(([side, p], i) =>
      `<li>${i + 1}. ${p.name} - Score: ${p.score || 0} ${!p.alive ? '❌' : ''}</li>`
    ).join('');

    if (players[playerSide]) {
      scoreDisplay.textContent = `Your Score: ${players[playerSide].score || 0}`;
    }

    // Check if all ready
    if (Object.keys(players).length === 4 && Object.values(players).every(p => p.ready)) {
      if (playerSide === "bottom") startBall();
    }

    // Check for winner
    const alivePlayers = Object.entries(players).filter(([_, p]) => p.alive);
    if (alivePlayers.length === 1) {
      const [winnerSide, winner] = alivePlayers[0];
      statusDisplay.textContent = (winnerSide === playerSide)
        ? "🎉 You Win!"
        : "😢 You Lose!";
    }
  });

  db.ref(`rooms/${room}/ball`).on("value", snap => {
    const pos = snap.val();
    if (pos) {
      ball.style.left = `${pos.x}px`;
      ball.style.top = `${pos.y}px`;
    }
  });
}

function setupMovement() {
  const game = document.getElementById("game");

  function movePaddle(x, y) {
    const rect = game.getBoundingClientRect();
    const ref = db.ref(`rooms/${room}/players/${playerSide}`);
    if (playerSide === "top" || playerSide === "bottom") {
      const maxX = rect.width - rect.width * 0.25;
      ref.update({ x: Math.max(0, Math.min(x, maxX)) });
    } else {
      const maxY = rect.height - rect.height * 0.25;
      ref.update({ y: Math.max(0, Math.min(y, maxY)) });
    }
  }

  game.addEventListener("mousemove", (e) => {
    const rect = game.getBoundingClientRect();
    movePaddle(e.clientX - rect.left, e.clientY - rect.top);
  });

  game.addEventListener("touchmove", (e) => {
    const touch = e.touches[0];
    const rect = game.getBoundingClientRect();
    movePaddle(touch.clientX - rect.left, touch.clientY - rect.top);
  }, { passive: false });
}

function startBall() {
  let x = 150, y = 150, vx = 2.5, vy = 2.5;
  const gameSize = 300;
  const interval = setInterval(() => {
    x += vx;
    y += vy;

    if (x <= 0 || x >= gameSize - 24) vx *= -1;
    if (y <= 0 || y >= gameSize - 24) vy *= -1;

    db.ref(`rooms/${room}/players`).once("value").then(snapshot => {
      const players = snapshot.val();
      for (let side in players) {
        const p = players[side];
        if (!p.alive) continue;

        let hit = false;
        if (side === "bottom" && vy > 0 && y + 24 >= 276 && x >= p.x && x <= p.x + 100) hit = true;
        if (side === "top" && vy < 0 && y <= 0 && x >= p.x && x <= p.x + 100) hit = true;
        if (side === "left" && vx < 0 && x <= 0 && y >= p.y && y <= p.y + 100) hit = true;
        if (side === "right" && vx > 0 && x + 24 >= 276 && y >= p.y && y <= p.y + 100) hit = true;

        if (hit) {
          if (side === "top" || side === "bottom") vy *= -1;
          else vx *= -1;
          db.ref(`rooms/${room}/players/${side}/score`).transaction(s => (s || 0) + 1);
        } else if (
          (side === "bottom" && y > gameSize) ||
          (side === "top" && y < -10) ||
          (side === "left" && x < -10) ||
          (side === "right" && x > gameSize)
        ) {
          db.ref(`rooms/${room}/players/${side}`).update({ alive: false, outAt: Date.now() });
        }
      }
    });

    db.ref(`rooms/${room}/ball`).set({ x, y });
  }, 30);
}
