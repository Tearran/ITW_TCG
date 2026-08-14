<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Into the Wild - Prototype</title>
<style>
  :root { color-scheme: dark; --bg:#122018; --panel:#1b2c22; --panel2:#22362a; --line:#395642; --text:#edf7ef; --muted:#b9c8bc; --accent:#7fd38a; --danger:#e79b8f; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:system-ui,sans-serif; background:var(--bg); color:var(--text); }
  .app { display:grid; gap:16px; padding:16px; max-width:640px; margin:0 auto; }
  h1 { margin:0; font-size:1.4rem; }
  .panel { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:16px; }
  .panel h2 { margin-top:0; font-size:1rem; }
  ul { margin:8px 0; padding-left:20px; color:var(--muted); }
  label { display:block; margin-bottom:6px; color:var(--muted); font-size:0.9rem; }
  input, button { font:inherit; border-radius:10px; border:1px solid var(--line); padding:8px 10px; }
  input { background:#0f1813; color:var(--text); width:100%; }
  button { background:var(--accent); color:#102014; font-weight:700; cursor:pointer; margin-top:8px; }
  button:disabled { opacity:.5; cursor:not-allowed; }
  .row { display:flex; gap:8px; align-items:flex-end; }
  .row > div { flex:1; }
  #message { min-height:1.2em; font-size:0.9rem; }
  #message.error { color:var(--danger); }
  #message.info { color:var(--accent); }
</style>
</head>
<body>
<div class="app">
  <div class="panel">
    <h1>Into the Wild - Multiplayer Prototype</h1>
    <p>This is a playable two-player prototype of the online room system, using the Tonto deck and existing card artwork.</p>
    <h2>Current limitations</h2>
    <ul>
      <li>Rooms are stored as plain JSON files, not a database.</li>
      <li>There are no player accounts; a temporary token identifies you for this room only.</li>
      <li>Each room deals both players an independently shuffled 52-card Tonto deck and plays the basic game loop: mulligan, phases, playing cards, and Challenges.</li>
      <li>Room chat uses short HTTP polling; there is no SSE or WebSocket connection.</li>
      <li>Event cards and free-form card effect text are not implemented yet.</li>
    </ul>
  </div>

  <div class="panel">
    <h2>Create a game</h2>
    <button id="createBtn" type="button">Create game</button>
  </div>

  <div class="panel">
    <h2>Join a game</h2>
    <div class="row">
      <div>
        <label for="roomCodeInput">Room code</label>
        <input id="roomCodeInput" maxlength="6" placeholder="ABC123" autocomplete="off">
      </div>
      <button id="joinBtn" type="button">Join game</button>
    </div>
  </div>

  <div class="panel">
    <div id="message"></div>
  </div>
</div>

<script>
(() => {
  const createBtn = document.getElementById('createBtn');
  const joinBtn = document.getElementById('joinBtn');
  const roomCodeInput = document.getElementById('roomCodeInput');
  const message = document.getElementById('message');

  function setMessage(text, kind) {
    message.textContent = text || '';
    message.className = kind || '';
  }

  function setBusy(busy) {
    createBtn.disabled = busy;
    joinBtn.disabled = busy;
  }

  async function callApi(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    let data = null;
    try {
      data = await res.json();
    } catch (err) {
      data = null;
    }
    if (!res.ok) {
      const errorMessage = data && data.error && data.error.message
        ? data.error.message
        : 'Something went wrong. Please try again.';
      throw new Error(errorMessage);
    }
    return data;
  }

  function goToGame(roomCode) {
    window.location.href = 'index.html?room=' + encodeURIComponent(roomCode);
  }

  createBtn.addEventListener('click', async () => {
    setBusy(true);
    setMessage('Creating room...', 'info');
    try {
      const data = await callApi('../api/rooms.php');
      sessionStorage.setItem('roomCode', data.roomCode);
      sessionStorage.setItem('playerToken', data.playerToken);
      setMessage('Room created: ' + data.roomCode + '. Redirecting...', 'info');
      goToGame(data.roomCode);
    } catch (err) {
      setMessage(err.message, 'error');
      setBusy(false);
    }
  });

  joinBtn.addEventListener('click', async () => {
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (!roomCode) {
      setMessage('Enter a room code to join.', 'error');
      return;
    }
    setBusy(true);
    setMessage('Joining room...', 'info');
    try {
      const data = await callApi('../api/join.php', { roomCode: roomCode });
      sessionStorage.setItem('roomCode', data.roomCode);
      sessionStorage.setItem('playerToken', data.playerToken);
      setMessage('Joined room: ' + data.roomCode + '. Redirecting...', 'info');
      goToGame(data.roomCode);
    } catch (err) {
      setMessage(err.message, 'error');
      setBusy(false);
    }
  });
})();
</script>
</body>
</html>
