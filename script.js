const config = {
      apiKey: "AIzaSyAJhx7zJPHT-otg-MwbYwzW0nZ4Qdp8IPg",
      authDomain: "ping-pong-6206f.firebaseapp.com",
      databaseURL: "https://ping-pong-6206f-default-rtdb.firebaseio.com",
      projectId: "ping-pong-6206f",
      storageBucket: "ping-pong-6206f.appspot.com",
      messagingSenderId: "602425829782",
      appId: "1:602425829782:web:126f9c9a415a0d8d5e15b7"
    };
    firebase.initializeApp(config);
    const db = firebase.database();

    let playerSide = "";
    let room = "";
    let playerName = "";

    const paddles = {
      bottom: document.getElementById("paddle-bottom"),
      top: document.getElementById("paddle-top"),
      left: document.getElementById("paddle-left"),
      right: document.getElementById("paddle-right")
    };
    const ball = document.getElementById("ball");
    const scoreDisplay = document.getElementById("scoreDisplay");
    const leaderboardList = document.getElementById("leaderboard-list");

    function joinRoom() {
      playerName = document.getElementById("playerName").value.trim();
      room = document.getElementById("roomCode").value.trim();

      if (!playerName || !room) return alert("Please enter name and room code!");

      const ref = db.ref(`rooms/${room}/players`);
      ref.once("value").then(snapshot => {
        const data = snapshot.val() || {};
        const sides = ["bottom", "top", "left", "right"];
        const takenSides = Object.keys(data);
        const freeSide = sides.find(s => !takenSides.includes(s));

        if (!freeSide) return alert("Room full!");

        playerSide = freeSide;
        const playerRef = ref.child(playerSide);
        playerRef.set({ name: playerName, alive: true, x: 50, y: 50, score: 0 });
        playerRef.onDisconnect().remove(); // auto cleanup

        if (playerSide === "bottom") startBall();
        startInputListener();
        startGameListeners();
      });
    }

    function startInputListener() {
      const gameBox = document.getElementById("game").getBoundingClientRect();
      const game = document.getElementById("game");

      game.addEventListener("touchmove", e => {
        e.preventDefault();
        const touch = e.touches[0];
        const x = touch.clientX - gameBox.left;
        const y = touch.clientY - gameBox.top;
        const ref = db.ref(`rooms/${room}/players/${playerSide}`);
        if (playerSide === "top" || playerSide === "bottom") {
          ref.update({ x: Math.max(0, Math.min(220, x)) });
        } else {
          ref.update({ y: Math.max(0, Math.min(220, y)) });
        }
      }, { passive: false });
    }

    function startBall() {
      let x = 140, y = 140;
      let vx = 2.5, vy = 2.2;

      setInterval(() => {
        x += vx;
        y += vy;
        if (x < 0 || x > 276) vx *= -1;
        if (y < 0 || y > 276) vy *= -1;

        db.ref(`rooms/${room}/players`).once("value").then(snapshot => {
          const players = snapshot.val() || {};
          for (let side in players) {
            const p = players[side];
            if (!p.alive) continue;
            const hit =
              (side === "bottom" && vy > 0 && y + 24 >= 290 && x >= p.x && x <= p.x + 80) ||
              (side === "top" && vy < 0 && y <= 10 && x >= p.x && x <= p.x + 80) ||
              (side === "left" && vx < 0 && x <= 10 && y >= p.y && y <= p.y + 80) ||
              (side === "right" && vx > 0 && x + 24 >= 290 && y >= p.y && y <= p.y + 80);
            if (hit) {
              if (side === "top" || side === "bottom") vy *= -1;
              else vx *= -1;
              db.ref(`rooms/${room}/players/${side}/score`).transaction(score => (score || 0) + 1);
            } else if (
              (side === "bottom" && y > 300) ||
              (side === "top" && y < -10) ||
              (side === "left" && x < -10) ||
              (side === "right" && x > 300)
            ) {
              db.ref(`rooms/${room}/players/${side}`).update({ alive: false, outAt: Date.now() });
              checkGameOver();
            }
          }
        });

        db.ref(`rooms/${room}/ball`).set({ x, y });
      }, 30);
    }

    function startGameListeners() {
      db.ref(`rooms/${room}/ball`).on("value", snap => {
        const pos = snap.val();
        if (pos) {
          ball.style.left = pos.x + "px";
          ball.style.top = pos.y + "px";
        }
      });

      db.ref(`rooms/${room}/players`).on("value", snap => {
        const players = snap.val() || {};
        Object.keys(paddles).forEach(side => {
          const p = players[side];
          if (!p) return paddles[side].style.display = "none";
          paddles[side].style.display = "block";
          paddles[side].classList.toggle("inactive", !p.alive);
          if (side === "bottom" || side === "top") {
            paddles[side].style.left = (p.x || 0) + "px";
          } else {
            paddles[side].style.top = (p.y || 0) + "px";
          }
        });

        const leaderboardData = Object.entries(players).sort((a, b) => {
          if (a[1].alive && !b[1].alive) return -1;
          if (!a[1].alive && b[1].alive) return 1;
          return (a[1].outAt || 0) - (b[1].outAt || 0);
        });

        leaderboardList.innerHTML = leaderboardData.map(([side, p], i) =>
          `<li>${i + 1}. ${p.name} - Score: ${p.score || 0} ${!p.alive ? '❌' : ''}</li>`
        ).join('');

        if (players[playerSide]) {
          scoreDisplay.textContent = `Your Score: ${players[playerSide].score || 0}`;
        }
      });
    }

    function checkGameOver() {
      db.ref(`rooms/${room}/players`).once("value").then(snap => {
        const players = snap.val() || {};
        const alive = Object.values(players).filter(p => p.alive);
        if (alive.length === 1) {
          alert(`${alive[0].name} wins the game!`);
        }
      });
    }