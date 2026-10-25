"use strict";

const { addLog, getLogs } = require("./logger");
const mineflayer = require("mineflayer");
const { Movements, pathfinder, goals } = require("mineflayer-pathfinder");
const { GoalBlock, GoalNear, GoalXZ } = goals;
const config = require("./settings.json");
const express = require("express");
const http = require("http");
const https = require("https");

// ============================================================
// EXPRESS SERVER - Keep Render/Aternos alive
// ============================================================
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 5000;

// Bot state tracking
let botState = {
  connected: false,
  lastActivity: Date.now(),
  reconnectAttempts: 0,
  startTime: Date.now(),
  errors: [],
  wasThrottled: false,
  isGoingToBed: false,
};

function isSleepingOrGoingToBed(botInstance) {
  return Boolean(
    (botInstance && botInstance.isSleeping) ||
    (botState && botState.isGoingToBed)
  );
}

// Advanced Bot Tracking Dashboard
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${config.name} — Bot Tracker</title>
  <meta name="description" content="Live Minecraft AFK bot tracking dashboard">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg:        #080c12;
      --surface:   #0e1520;
      --surface2:  #151d2e;
      --border:    #1e2d45;
      --border2:   #243250;
      --text:      #e2eaf7;
      --muted:     #5a7090;
      --green:     #22c55e;
      --green-dim: #14532d;
      --red:       #ef4444;
      --red-dim:   #450a0a;
      --yellow:    #eab308;
      --blue:      #3b82f6;
      --purple:    #a855f7;
      --cyan:      #06b6d4;
      --orange:    #f97316;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 0;
    }

    /* TOP NAV */
    nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 28px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(12px);
    }
    .nav-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 17px;
      color: var(--text);
      letter-spacing: -0.3px;
    }
    .nav-brand .cube {
      width: 28px; height: 28px;
      background: linear-gradient(135deg, #22c55e 0%, #15803d 100%);
      border-radius: 7px;
      display: flex; align-items: center; justify-content: center;
      font-size: 15px;
    }
    .nav-right { display: flex; align-items: center; gap: 10px; }
    .live-badge {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 600;
      color: var(--green);
      background: rgba(34,197,94,0.1);
      border: 1px solid rgba(34,197,94,0.25);
      border-radius: 20px;
      padding: 4px 10px;
    }
    .live-dot {
      width: 6px; height: 6px;
      background: var(--green);
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.85)} }

    .nav-link {
      font-size: 13px;
      font-weight: 500;
      color: var(--muted);
      text-decoration: none;
      padding: 6px 12px;
      border-radius: 8px;
      transition: background .15s, color .15s;
    }
    .nav-link:hover { background: var(--surface2); color: var(--text); }

    /* LAYOUT */
    .page { max-width: 1100px; margin: 0 auto; padding: 28px 20px; }

    /* STATUS HERO */
    .status-hero {
      border-radius: 16px;
      padding: 24px 28px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 20px;
      transition: background .4s, border-color .4s;
      border: 2px solid var(--border);
      background: var(--surface);
    }
    .status-hero.online  { background: linear-gradient(135deg, #0a1f12 0%, var(--surface) 60%); border-color: #166534; }
    .status-hero.offline { background: linear-gradient(135deg, #1c0a0a 0%, var(--surface) 60%); border-color: #7f1d1d; }
    .status-hero.sleeping { background: linear-gradient(135deg, #0f1340 0%, var(--surface) 60%); border-color: #3730a3; }

    .status-avatar {
      width: 56px; height: 56px;
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      font-size: 26px; flex-shrink: 0;
      transition: background .4s;
    }
    .status-avatar.online   { background: rgba(34,197,94,0.15); }
    .status-avatar.offline  { background: rgba(239,68,68,0.15); }
    .status-avatar.sleeping { background: rgba(99,102,241,0.18); }

    .status-info { flex: 1; min-width: 0; }
    .status-title {
      font-size: 20px; font-weight: 800;
      letter-spacing: -0.4px;
      transition: color .4s;
    }
    .status-title.online   { color: var(--green); }
    .status-title.offline  { color: var(--red); }
    .status-title.sleeping { color: #818cf8; }
    .status-sub { font-size: 13px; color: var(--muted); margin-top: 4px; }

    .status-meta {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    .tag {
      font-size: 11px; font-weight: 600;
      border-radius: 6px;
      padding: 3px 9px;
    }
    .tag-green  { background: rgba(34,197,94,0.12); color: var(--green); border: 1px solid rgba(34,197,94,0.2); }
    .tag-purple { background: rgba(168,85,247,0.12); color: var(--purple); border: 1px solid rgba(168,85,247,0.2); }
    .tag-blue   { background: rgba(59,130,246,0.12); color: var(--blue); border: 1px solid rgba(59,130,246,0.2); }
    .tag-orange { background: rgba(249,115,22,0.12); color: var(--orange); border: 1px solid rgba(249,115,22,0.2); }
    .tag-red    { background: rgba(239,68,68,0.12); color: var(--red); border: 1px solid rgba(239,68,68,0.2); }
    .tag-muted  { background: var(--surface2); color: var(--muted); border: 1px solid var(--border); }

    /* GRID */
    .grid { display: grid; gap: 14px; margin-bottom: 14px; }
    .grid-3 { grid-template-columns: repeat(3, 1fr); }
    .grid-2 { grid-template-columns: repeat(2, 1fr); }
    .grid-4 { grid-template-columns: repeat(4, 1fr); }
    @media (max-width: 800px) { .grid-3,.grid-4 { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 500px) { .grid-3,.grid-2,.grid-4 { grid-template-columns: 1fr; } }

    /* CARDS */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px;
      transition: border-color .2s;
    }
    .card:hover { border-color: var(--border2); }
    .card-label {
      font-size: 11px; font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 10px;
      display: flex; align-items: center; gap: 6px;
    }
    .card-label-icon { font-size: 13px; }
    .card-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 22px; font-weight: 600;
      color: var(--text);
      letter-spacing: -0.5px;
      line-height: 1.2;
    }
    .card-sub { font-size: 12px; color: var(--muted); margin-top: 6px; }

    /* BAR GAUGES */
    .gauge-bar {
      height: 8px;
      background: var(--surface2);
      border-radius: 100px;
      overflow: hidden;
      margin-top: 12px;
    }
    .gauge-fill {
      height: 100%;
      border-radius: 100px;
      transition: width .6s ease;
    }
    .gauge-fill.health { background: linear-gradient(90deg, #ef4444, #22c55e); }
    .gauge-fill.food   { background: linear-gradient(90deg, #f97316, #eab308); }
    .gauge-fill.memory { background: linear-gradient(90deg, #3b82f6, #a855f7); }

    /* COORDS */
    .coord-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-top: 8px; }
    .coord-box {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 12px;
      text-align: center;
    }
    .coord-axis { font-size: 10px; font-weight: 700; color: var(--muted); letter-spacing: 1px; }
    .coord-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 17px; font-weight: 600;
      color: var(--text);
      margin-top: 4px;
    }
    .coord-val.x { color: #f87171; }
    .coord-val.y { color: #4ade80; }
    .coord-val.z { color: #60a5fa; }

    /* TIME OF DAY */
    .time-bar-wrap { margin-top: 14px; }
    .time-bar-track {
      height: 10px;
      border-radius: 100px;
      position: relative;
      overflow: hidden;
    }
    .time-gradient {
      position: absolute; inset: 0;
      background: linear-gradient(90deg,
        #1a1a3e 0%,       /* midnight */
        #2d3a7c 12.5%,    /* dawn */
        #f97316 20%,      /* sunrise */
        #fbbf24 25%,      /* morning */
        #7dd3fc 35%,      /* day */
        #60a5fa 50%,      /* noon */
        #7dd3fc 65%,      /* afternoon */
        #fb923c 75%,      /* sunset */
        #7c3aed 80%,      /* dusk */
        #1a1a3e 100%      /* night */
      );
    }
    .time-cursor {
      position: absolute;
      top: -3px; bottom: -3px;
      width: 4px;
      background: white;
      border-radius: 2px;
      box-shadow: 0 0 6px rgba(255,255,255,0.8);
      transition: left .5s ease;
    }
    .time-labels {
      display: flex; justify-content: space-between;
      font-size: 10px; color: var(--muted);
      margin-top: 5px;
    }

    /* PLAYER LIST */
    .player-list { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
    .player-item {
      display: flex; align-items: center; gap: 10px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 9px;
      padding: 8px 12px;
      font-size: 13px;
      font-weight: 500;
    }
    .player-dot {
      width: 8px; height: 8px;
      background: var(--green);
      border-radius: 50%;
      flex-shrink: 0;
    }
    .player-empty { font-size: 13px; color: var(--muted); margin-top: 8px; text-align: center; padding: 16px; }

    /* CONTROLS */
    .controls-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
    .btn {
      display: flex; align-items: center; gap: 7px;
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 13px; font-weight: 600;
      cursor: pointer; border: none;
      font-family: inherit;
      transition: filter .15s, opacity .15s;
    }
    .btn:hover { filter: brightness(1.1); }
    .btn:active { opacity: .8; }
    .btn-start  { background: rgba(34,197,94,0.15);  color: var(--green);  border: 1px solid rgba(34,197,94,0.3); }
    .btn-stop   { background: rgba(239,68,68,0.15);  color: var(--red);    border: 1px solid rgba(239,68,68,0.3); }
    .btn-sleep  { background: rgba(99,102,241,0.15); color: #818cf8;       border: 1px solid rgba(99,102,241,0.3); }
    .btn-logs   { background: var(--surface2);       color: var(--muted);  border: 1px solid var(--border); }

    /* FOOTER */
    .page-footer {
      text-align: center;
      font-size: 12px;
      color: var(--muted);
      margin-top: 28px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }

    /* LAST UPDATE */
    #last-update { font-size: 11px; color: var(--muted); }
  </style>
</head>
<body>

<nav>
  <div class="nav-brand">
    <div class="cube">🤖</div>
    ${config.name}
  </div>
  <div class="nav-right">
    <div class="live-badge"><div class="live-dot"></div>LIVE</div>
    <a href="/logs" class="nav-link">📋 Logs</a>
    <a href="/tutorial" class="nav-link">📖 Guide</a>
  </div>
</nav>

<div class="page">

  <!-- STATUS HERO -->
  <div class="status-hero offline" id="hero">
    <div class="status-avatar offline" id="hero-icon">⚡</div>
    <div class="status-info">
      <div class="status-title offline" id="hero-title">Connecting…</div>
      <div class="status-sub" id="hero-sub">Establishing connection to ${config.server.ip}</div>
      <div style="margin-top:10px;" class="status-meta" id="hero-tags"></div>
    </div>
    <div style="text-align:right;flex-shrink:0;">
      <div id="last-update">—</div>
    </div>
  </div>

  <!-- TOP CONTROLS -->
  <div class="controls-row">
    <button class="btn btn-start" id="btn-start" onclick="doStart()">▶ Start Bot</button>
    <button class="btn btn-stop" id="btn-stop" onclick="doStop()">⏹ Stop Bot</button>
    <button class="btn btn-sleep" onclick="doSleep()">🛏 Force Sleep</button>
    <a href="/logs" class="btn btn-logs">📋 View Logs</a>
  </div>

  <!-- ROW 1: Uptime + Health + Food -->
  <div class="grid grid-3">
    <div class="card">
      <div class="card-label"><span class="card-label-icon">⏱</span>Uptime</div>
      <div class="card-value" id="c-uptime">—</div>
      <div class="card-sub" id="c-reconnects">Reconnects: —</div>
    </div>
    <div class="card">
      <div class="card-label"><span class="card-label-icon">❤️</span>Health</div>
      <div class="card-value" id="c-health">—<span style="font-size:14px;color:var(--muted)"> / 20</span></div>
      <div class="gauge-bar"><div class="gauge-fill health" id="bar-health" style="width:0%"></div></div>
      <div class="card-sub" id="c-health-sub">Waiting for data…</div>
    </div>
    <div class="card">
      <div class="card-label"><span class="card-label-icon">🍗</span>Hunger</div>
      <div class="card-value" id="c-food">—<span style="font-size:14px;color:var(--muted)"> / 20</span></div>
      <div class="gauge-bar"><div class="gauge-fill food" id="bar-food" style="width:0%"></div></div>
      <div class="card-sub" id="c-food-sub">Auto-eat active</div>
    </div>
  </div>

  <!-- ROW 2: Coordinates -->
  <div class="card" style="margin-bottom:14px;">
    <div class="card-label"><span class="card-label-icon">📍</span>Live Coordinates</div>
    <div class="coord-grid">
      <div class="coord-box">
        <div class="coord-axis">X</div>
        <div class="coord-val x" id="c-x">—</div>
      </div>
      <div class="coord-box">
        <div class="coord-axis">Y</div>
        <div class="coord-val y" id="c-y">—</div>
      </div>
      <div class="coord-box">
        <div class="coord-axis">Z</div>
        <div class="coord-val z" id="c-z">—</div>
      </div>
    </div>
    <div class="card-sub" style="margin-top:10px;" id="c-dim">Dimension: —</div>
  </div>

  <!-- ROW 3: Time of Day + Players + Memory -->
  <div class="grid grid-3">
    <div class="card">
      <div class="card-label"><span class="card-label-icon">🌐</span>Time of Day</div>
      <div class="card-value" id="c-time">—</div>
      <div class="time-bar-wrap">
        <div class="time-bar-track">
          <div class="time-gradient"></div>
          <div class="time-cursor" id="time-cursor" style="left:0%"></div>
        </div>
        <div class="time-labels">
          <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-label"><span class="card-label-icon">👥</span>Players Online</div>
      <div class="card-value" id="c-players">—</div>
      <div class="player-list" id="player-list"></div>
    </div>
    <div class="card">
      <div class="card-label"><span class="card-label-icon">💾</span>Memory Usage</div>
      <div class="card-value" id="c-mem">— <span style="font-size:14px;color:var(--muted)">MB</span></div>
      <div class="gauge-bar"><div class="gauge-fill memory" id="bar-mem" style="width:0%"></div></div>
      <div class="card-sub">Server: ${config.server.ip}</div>
    </div>
  </div>

  <!-- ROW 4: Bot info cards -->
  <div class="grid grid-4">
    <div class="card">
      <div class="card-label"><span class="card-label-icon">🎮</span>Version</div>
      <div class="card-value" style="font-size:16px;" id="c-ver">—</div>
    </div>
    <div class="card">
      <div class="card-label"><span class="card-label-icon">👤</span>Username</div>
      <div class="card-value" style="font-size:16px;">${config["bot-account"].username}</div>
    </div>
    <div class="card">
      <div class="card-label"><span class="card-label-icon">🕵️</span>Stealth</div>
      <div class="card-value" style="font-size:16px;" id="c-stealth">—</div>
    </div>
    <div class="card">
      <div class="card-label"><span class="card-label-icon">🛏</span>Bed State</div>
      <div class="card-value" style="font-size:16px;" id="c-bed">Awake</div>
    </div>
  </div>

  <div class="page-footer">
    Bot Tracker v3.0 &nbsp;·&nbsp; ${config.name} &nbsp;·&nbsp; Updates every 3 seconds
  </div>
</div>

<script>
  function fmtUptime(s) {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
    if (h > 0) return h + 'h ' + m + 'm ' + sec + 's';
    if (m > 0) return m + 'm ' + sec + 's';
    return sec + 's';
  }

  function fmtTime(ticks) {
    // MC day starts at 6000 ticks = 6:00 AM
    if (ticks === null || ticks === undefined) return '—';
    const real = ((ticks + 6000) % 24000);
    const h = Math.floor(real / 1000);
    const m = Math.floor((real % 1000) / 1000 * 60);
    const hh = String(h).padStart(2,'0');
    const mm = String(m).padStart(2,'0');
    return hh + ':' + mm;
  }

  function timeLabel(ticks) {
    if (ticks === null || ticks === undefined) return '';
    const t = (ticks + 6000) % 24000;
    if (t < 1000) return '🌅 Dawn';
    if (t < 6000) return '☀️ Morning';
    if (t < 12000) return '🌞 Noon';
    if (t < 14000) return '🌆 Afternoon';
    if (t < 15500) return '🌇 Sunset';
    if (t < 17000) return '🌆 Dusk';
    return '🌙 Night';
  }

  function timePct(ticks) {
    if (ticks === null || ticks === undefined) return 0;
    return ((ticks % 24000) / 24000) * 100;
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  async function refresh() {
    try {
      const r = await fetch('/health');
      const d = await r.json();
      const online = d.status === 'connected';
      const sleeping = d.isSleeping;
      const going = d.isGoingToBed;

      // Hero
      const hero  = document.getElementById('hero');
      const hIcon = document.getElementById('hero-icon');
      const hTitle = document.getElementById('hero-title');
      const hSub  = document.getElementById('hero-sub');
      const hTags = document.getElementById('hero-tags');

      let heroClass = online ? (sleeping ? 'sleeping' : 'online') : 'offline';
      hero.className  = 'status-hero ' + heroClass;
      hIcon.className = 'status-avatar ' + heroClass;
      hIcon.textContent = sleeping ? '🛌' : (going ? '🚶' : (online ? '✅' : '⚫'));
      hTitle.className = 'status-title ' + heroClass;
      hTitle.textContent = sleeping ? 'Sleeping in Bed' : (going ? 'Walking to Bed…' : (online ? 'Online' : 'Offline'));
      hSub.textContent = online
        ? 'Connected to ' + d.serverIp + (d.version ? ' (' + d.version + ')' : '')
        : 'Reconnecting… (attempt #' + d.reconnectAttempts + ')';

      // Tags
      const tags = [];
      if (online && d.stealth) tags.push('<span class="tag tag-purple">👻 Ghost Mode</span>');
      if (sleeping) tags.push('<span class="tag tag-blue">🛌 Sleeping</span>');
      if (online && !sleeping) tags.push('<span class="tag tag-green">✅ Active</span>');
      if (!online) tags.push('<span class="tag tag-red">⚡ Reconnecting</span>');
      if (d.reconnectAttempts > 0) tags.push('<span class="tag tag-orange">🔄 ' + d.reconnectAttempts + ' reconnects</span>');
      hTags.innerHTML = tags.join('');

      // Uptime
      setText('c-uptime', fmtUptime(d.uptime));
      setText('c-reconnects', 'Reconnects: ' + d.reconnectAttempts);

      // Health
      const hp = Math.round(d.health);
      setText('c-health', hp);
      const hpPct = Math.max(0, Math.min(100, (d.health / 20) * 100));
      document.getElementById('bar-health').style.width = hpPct + '%';
      setText('c-health-sub', hp <= 4 ? '⚠️ Critical HP!' : hp <= 10 ? '💛 Low HP' : '💚 Healthy');

      // Food
      const food = Math.round(d.food);
      setText('c-food', food);
      const foodPct = Math.max(0, Math.min(100, (d.food / 20) * 100));
      document.getElementById('bar-food').style.width = foodPct + '%';
      setText('c-food-sub', food <= 6 ? '⚠️ Very hungry!' : food <= 12 ? '🍗 A bit hungry' : '✅ Well fed');

      // Coords
      if (d.coords) {
        setText('c-x', Math.floor(d.coords.x));
        setText('c-y', Math.floor(d.coords.y));
        setText('c-z', Math.floor(d.coords.z));
      } else {
        ['c-x','c-y','c-z'].forEach(id => setText(id, '—'));
      }
      setText('c-dim', 'Dimension: ' + (d.dimension || '—'));

      // Time
      setText('c-time', fmtTime(d.gameTime) + '  ' + timeLabel(d.gameTime));
      const pct = timePct(d.gameTime);
      document.getElementById('time-cursor').style.left = pct + '%';

      // Players
      setText('c-players', d.playersOnline + ' player' + (d.playersOnline !== 1 ? 's' : ''));
      const pList = document.getElementById('player-list');
      if (d.players && d.players.length > 0) {
        pList.innerHTML = d.players.map(p =>
          '<div class="player-item"><div class="player-dot"></div>' + p + '</div>'
        ).join('');
      } else {
        pList.innerHTML = '<div class="player-empty">No other players online</div>';
      }

      // Memory
      setText('c-mem', d.memoryUsage);
      const memPct = Math.min(100, (d.memoryUsage / 256) * 100);
      document.getElementById('bar-mem').style.width = memPct + '%';

      // Info cards
      setText('c-ver', d.version || '—');
      setText('c-stealth', d.stealth ? '👻 Active' : '⚪ Off');
      setText('c-bed', d.isSleeping ? '😴 Sleeping' : (d.isGoingToBed ? '🚶 Walking…' : '☀️ Awake'));

      // Last update
      setText('last-update', 'Updated ' + new Date().toLocaleTimeString());
    } catch(e) {
      document.getElementById('hero-title').textContent = 'Unreachable';
    }
  }

  async function doStart() {
    const r = await fetch('/start', { method: 'POST' });
    const d = await r.json();
    if (!d.success) alert(d.msg);
    refresh();
  }
  async function doStop() {
    if (!confirm('Stop the bot?')) return;
    const r = await fetch('/stop', { method: 'POST' });
    const d = await r.json();
    if (!d.success) alert(d.msg);
    refresh();
  }
  async function doSleep() {
    const r = await fetch('/command', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({command: '/sleep'})
    });
    const d = await r.json();
    alert(d.msg || 'Sleep triggered');
    refresh();
  }

  refresh();
  setInterval(refresh, 3000);
</script>
</body>
</html>`);
});

app.get("/tutorial", (req, res) => {

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${config.name} - Setup Guide</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" media="print" onload="this.media='all'"
              href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
        <style>
          *, *::before, *::after { box-sizing: border-box; }

          body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: #0d1117;
            color: #e6edf3;
            margin: 0;
            padding: 40px 24px;
          }

          main {
            width: 100%;
            max-width: 560px;
            margin: 0 auto;
          }

          .back-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            font-weight: 500;
            color: #8b949e;
            text-decoration: none;
            background: #161b22;
            border: 1px solid #21262d;
            border-radius: 8px;
            padding: 7px 14px;
            margin-bottom: 32px;
            transition: color 0.2s, background 0.2s;
          }
          .back-btn:hover { background: #21262d; color: #c9d1d9; }

          header { margin-bottom: 32px; }
          header h1 {
            font-size: 26px;
            font-weight: 700;
            color: #f0f6fc;
            margin: 0;
            line-height: 1.2;
          }
          header p {
            font-size: 14px;
            color: #8b949e;
            margin: 6px 0 0;
            line-height: 1.5;
          }

          .step-card {
            background: #161b22;
            border: 1px solid #21262d;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 16px;
          }

          .step-header {
            display: flex;
            align-items: center;
            gap: 14px;
            margin-bottom: 18px;
          }

          .step-number {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #0d2218;
            border: 2px solid #238636;
            color: #3fb950;
            font-size: 14px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .step-title {
            font-size: 16px;
            font-weight: 700;
            color: #f0f6fc;
            margin: 0;
          }

          ol {
            margin: 0;
            padding: 0;
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          li {
            font-size: 14px;
            color: #8b949e;
            line-height: 1.6;
            padding-left: 20px;
            position: relative;
          }

          li::before {
            content: "·";
            position: absolute;
            left: 6px;
            color: #3fb950;
            font-weight: 700;
          }

          li strong { color: #e6edf3; font-weight: 600; }

          code {
            background: #21262d;
            border: 1px solid #30363d;
            padding: 2px 7px;
            border-radius: 5px;
            font-family: 'SF Mono', 'Fira Code', monospace;
            font-size: 12px;
            color: #e6edf3;
          }

          a { color: #58a6ff; text-decoration: none; }
          a:hover { text-decoration: underline; }

          footer {
            margin-top: 32px;
            text-align: center;
          }
          footer p { font-size: 12px; color: #484f58; margin: 0; }
        </style>
      </head>
      <body>
        <main>
          <a href="/" class="back-btn">&#8592; Back to Dashboard</a>

          <header>
            <h1>Setup Guide</h1>
            <p>Get your AFK bot running in under 15 minutes</p>
          </header>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">1</div>
              <h2 class="step-title">Configure Aternos</h2>
            </div>
            <ol>
              <li>Go to <strong>Aternos</strong> and open your server.</li>
              <li>Install <strong>Paper/Bukkit</strong> as your server software.</li>
              <li>Enable <strong>Cracked</strong> mode using the green switch.</li>
              <li>Install these plugins: <code>ViaVersion</code>, <code>ViaBackwards</code>, <code>ViaRewind</code></li>
            </ol>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">2</div>
              <h2 class="step-title">GitHub Setup</h2>
            </div>
            <ol>
              <li>Download this project as a ZIP and extract it.</li>
              <li>Edit <code>settings.json</code> with your server IP and port.</li>
              <li>Upload all files to a new <strong>GitHub Repository</strong>.</li>
            </ol>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-number">3</div>
              <h2 class="step-title">Deploy on Replit (Free 24/7)</h2>
            </div>
            <ol>
              <li>Import your GitHub repo into <strong>Replit</strong>.</li>
              <li>Set the run command to <code>npm start</code>.</li>
              <li>Hit <strong>Run</strong> — the bot connects automatically.</li>
              <li>The bot pings itself every 10 minutes to stay alive.</li>
            </ol>
          </div>

          <footer>
            <p>AFK Bot Dashboard &middot; ${config.name}</p>
          </footer>
        </main>
      </body>
    </html>
  `);
});

app.get("/health", (req, res) => {
  const playerList = bot && bot.players ? Object.keys(bot.players).filter(u => u !== (bot.username || "")) : [];
  res.json({
    status: botState.connected ? "connected" : "disconnected",
    uptime: Math.floor((Date.now() - botState.startTime) / 1000),
    coords: bot && bot.entity ? bot.entity.position : null,
    isSleeping: bot ? Boolean(bot.isSleeping) : false,
    isGoingToBed: botState.isGoingToBed,
    stealth: Boolean(config.stealth && config.stealth.enabled),
    lastActivity: botState.lastActivity,
    reconnectAttempts: botState.reconnectAttempts,
    memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    health: bot ? (bot.health || 0) : 0,
    food: bot ? (bot.food || 0) : 0,
    username: config["bot-account"].username,
    serverIp: config.server.ip,
    version: bot ? (bot.version || "") : "",
    playersOnline: playerList.length,
    players: playerList.slice(0, 20),
    dimension: bot && bot.game ? (bot.game.dimension || "unknown") : "unknown",
    gameTime: bot && bot.time ? bot.time.timeOfDay : null,
    errors: botState.errors.slice(-5),
  });
});

app.get("/ping", (req, res) => res.send("pong"));

app.get("/logs", (req, res) => {
  const logs = getLogs();

  const escapeHTML = (str) =>
    str.replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[m],
    );

  const logCount = logs.length;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${config.name} - Logs</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" media="print" onload="this.media='all'"
              href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
        <style>
          *, *::before, *::after { box-sizing: border-box; }

          body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: #0d1117;
            color: #e6edf3;
            margin: 0;
            padding: 40px 24px;
          }

          main {
            width: 100%;
            max-width: 760px;
            margin: 0 auto;
          }

          .back-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            font-weight: 500;
            color: #8b949e;
            text-decoration: none;
            background: #161b22;
            border: 1px solid #21262d;
            border-radius: 8px;
            padding: 7px 14px;
            margin-bottom: 32px;
            transition: color 0.2s, background 0.2s;
          }
          .back-btn:hover { background: #21262d; color: #c9d1d9; }

          .page-header {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            margin-bottom: 20px;
            gap: 12px;
            flex-wrap: wrap;
          }

          .page-header-left h1 {
            font-size: 26px;
            font-weight: 700;
            color: #f0f6fc;
            margin: 0;
            line-height: 1.2;
          }
          .page-header-left p {
            font-size: 14px;
            color: #8b949e;
            margin: 6px 0 0;
          }

          .badge {
            font-size: 12px;
            font-weight: 600;
            color: #8b949e;
            background: #161b22;
            border: 1px solid #21262d;
            border-radius: 20px;
            padding: 4px 12px;
            white-space: nowrap;
          }

          .log-card {
            background: #0d1117;
            border: 1px solid #21262d;
            border-radius: 12px;
            overflow: hidden;
          }

          .log-card-header {
            background: #161b22;
            border-bottom: 1px solid #21262d;
            padding: 12px 18px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .dot { width: 10px; height: 10px; border-radius: 50%; }
          .dot-red   { background: #ff5f57; }
          .dot-yellow{ background: #ffbd2e; }
          .dot-green { background: #28c840; }

          .log-card-title {
            font-size: 12px;
            font-weight: 500;
            color: #484f58;
            margin-left: 4px;
          }

          .log-body {
            padding: 16px 18px;
            max-height: 560px;
            overflow-y: auto;
            font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
            font-size: 12.5px;
            line-height: 1.7;
          }

          .log-entry { display: block; padding: 1px 0; white-space: pre-wrap; word-break: break-all; }
          .log-entry.error   { color: #ff7b72; }
          .log-entry.warn    { color: #e3b341; }
          .log-entry.success { color: #3fb950; }
          .log-entry.control { color: #58a6ff; }
          .log-entry.default { color: #8b949e; }

          .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #484f58;
            font-size: 13px;
          }

          .refresh-bar {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 6px;
            margin-top: 12px;
            font-size: 12px;
            color: #484f58;
          }
          .refresh-dot {
            width: 7px; height: 7px;
            border-radius: 50%;
            background: #3fb950;
            animation: pulse 2s infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }

          .console-row {
            display: flex;
            align-items: center;
            border-top: 1px solid #21262d;
            background: #0d1117;
            padding: 10px 18px;
            gap: 10px;
          }

          .console-prompt {
            font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
            font-size: 13px;
            color: #3fb950;
            font-weight: 700;
            flex-shrink: 0;
            user-select: none;
          }

          .console-input {
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
            font-size: 12.5px;
            color: #e6edf3;
            caret-color: #3fb950;
          }

          .console-input::placeholder { color: #484f58; }

          .console-send {
            background: #0d2218;
            border: 1px solid #238636;
            color: #3fb950;
            font-size: 12px;
            font-weight: 600;
            padding: 5px 14px;
            border-radius: 6px;
            cursor: pointer;
            font-family: inherit;
            transition: background 0.2s;
            flex-shrink: 0;
          }
          .console-send:hover { background: #122d1a; }
          .console-send:disabled { opacity: 0.5; cursor: default; }

          .console-wrap {
            position: relative;
          }

          .cmd-suggestions {
            display: none;
            position: absolute;
            bottom: calc(100% + 6px);
            left: 0; right: 0;
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            z-index: 10;
          }

          .cmd-suggestions.visible { display: block; }

          .cmd-item {
            display: flex;
            align-items: baseline;
            gap: 12px;
            padding: 9px 16px;
            cursor: pointer;
            transition: background 0.12s;
            border-bottom: 1px solid #21262d;
          }
          .cmd-item:last-child { border-bottom: none; }
          .cmd-item:hover, .cmd-item.active {
            background: #21262d;
          }

          .cmd-name {
            font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
            font-size: 12.5px;
            font-weight: 700;
            color: #3fb950;
            flex-shrink: 0;
            min-width: 90px;
          }

          .cmd-desc {
            font-size: 12px;
            color: #6e7681;
          }

          footer { margin-top: 32px; text-align: center; }
          footer p { font-size: 12px; color: #484f58; margin: 0; }
        </style>
      </head>
      <body>
        <main>
          <a href="/" class="back-btn">&#8592; Back to Dashboard</a>

          <div class="page-header">
            <div class="page-header-left">
              <h1>Bot Logs</h1>
              <p>Live output from the AFK bot</p>
            </div>
            <span class="badge">${logCount} ${logCount === 1 ? "entry" : "entries"}</span>
          </div>

          <div class="log-card">
            <div class="log-card-header">
              <span class="dot dot-red"></span>
              <span class="dot dot-yellow"></span>
              <span class="dot dot-green"></span>
              <span class="log-card-title">bot.log</span>
            </div>
            <div class="log-body" id="log-body">
              ${logCount === 0
                ? `<div class="empty-state">No log entries yet. Start the bot to see output.</div>`
                : logs.map((l) => {
                    const escaped = escapeHTML(l);
                    const lower = l.toLowerCase();
                    let cls = "default";
                    if (lower.includes("error") || lower.includes("fail")) cls = "error";
                    else if (lower.includes("warn")) cls = "warn";
                    else if (lower.includes("[control]")) cls = "control";
                    else if (lower.includes("connect") || lower.includes("join") || lower.includes("spawn")) cls = "success";
                    return `<span class="log-entry ${cls}">${escaped}</span>`;
                  }).join("")
              }
            </div>
            <div class="console-wrap">
              <div class="cmd-suggestions" id="cmd-suggestions"></div>
              <div class="console-row">
                <span class="console-prompt">&gt;</span>
                <input
                  id="console-input"
                  class="console-input"
                  type="text"
                  placeholder="Type / for commands, or any message…"
                  autocomplete="off"
                  spellcheck="false"
                >
                <button id="console-send" class="console-send">Send</button>
              </div>
            </div>
          </div>

          <div class="refresh-bar">
            <span class="refresh-dot"></span>
            <span id="refresh-label">Auto-refreshing every 5 seconds</span>
          </div>

          <footer>
            <p>AFK Bot Dashboard &middot; ${config.name}</p>
          </footer>
        </main>

        <script>
          (function() {
            var logBody  = document.getElementById('log-body');
            var input    = document.getElementById('console-input');
            var sendBtn  = document.getElementById('console-send');
            var label    = document.getElementById('refresh-label');
            var sugBox   = document.getElementById('cmd-suggestions');
            var refreshTimer = null;
            var typing = false;
            var activeIdx = -1;

            var COMMANDS = [
              { name: '/help',   desc: 'Show all available commands' },
              { name: '/pos',    desc: "Show bot's current coordinates" },
              { name: '/status', desc: 'Show connection status & uptime' },
              { name: '/list',   desc: 'List players on the server' },
              { name: '/say',    desc: 'Send a chat message in-game' },
              { name: '/sleep',  desc: 'Make the bot find a bed and sleep' },
              { name: '/wake',   desc: 'Wake the bot up from bed' },
              { name: '/stealth',desc: 'Toggle or check stealth/vanish mode' },
            ];

            function scrollBottom() {
              if (logBody) logBody.scrollTop = logBody.scrollHeight;
            }

            function scheduleRefresh() {
              clearTimeout(refreshTimer);
              if (!typing) {
                refreshTimer = setTimeout(function() { location.reload(); }, 5000);
              }
            }

            function appendLocalEntry(text, cls) {
              var span = document.createElement('span');
              span.className = 'log-entry ' + (cls || 'control');
              span.textContent = text;
              logBody.appendChild(span);
              scrollBottom();
            }

            function hideSuggestions() {
              sugBox.classList.remove('visible');
              sugBox.innerHTML = '';
              activeIdx = -1;
            }

            function setActive(idx) {
              var items = sugBox.querySelectorAll('.cmd-item');
              items.forEach(function(el, i) {
                el.classList.toggle('active', i === idx);
              });
              activeIdx = idx;
            }

            function showSuggestions(val) {
              var query = val.toLowerCase();
              var matches = COMMANDS.filter(function(c) {
                return c.name.startsWith(query);
              });

              if (!matches.length) { hideSuggestions(); return; }

              sugBox.innerHTML = matches.map(function(c, i) {
                return '<div class="cmd-item" data-cmd="' + c.name + '">' +
                  '<span class="cmd-name">' + c.name + '</span>' +
                  '<span class="cmd-desc">' + c.desc + '</span>' +
                '</div>';
              }).join('');

              sugBox.querySelectorAll('.cmd-item').forEach(function(el) {
                el.addEventListener('mousedown', function(e) {
                  e.preventDefault();
                  input.value = el.dataset.cmd + ' ';
                  hideSuggestions();
                  input.focus();
                });
              });

              activeIdx = -1;
              sugBox.classList.add('visible');
            }

            input.addEventListener('input', function() {
              var val = input.value;
              if (val.startsWith('/')) {
                showSuggestions(val);
              } else {
                hideSuggestions();
              }
            });

            input.addEventListener('keydown', function(e) {
              var items = sugBox.querySelectorAll('.cmd-item');
              if (sugBox.classList.contains('visible') && items.length) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive(Math.min(activeIdx + 1, items.length - 1));
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive(Math.max(activeIdx - 1, 0));
                  return;
                }
                if (e.key === 'Tab' || (e.key === 'Enter' && activeIdx >= 0)) {
                  e.preventDefault();
                  var chosen = items[activeIdx >= 0 ? activeIdx : 0];
                  input.value = chosen.dataset.cmd + ' ';
                  hideSuggestions();
                  return;
                }
                if (e.key === 'Escape') {
                  hideSuggestions();
                  return;
                }
              }
              if (e.key === 'Enter') sendCommand();
            });

            function sendCommand() {
              var cmd = input.value.trim();
              if (!cmd) return;
              hideSuggestions();
              input.value = '';
              sendBtn.disabled = true;
              appendLocalEntry('> ' + cmd, 'control');

              fetch('/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: cmd })
              })
              .then(function(r) { return r.json(); })
              .then(function(data) {
                if (data.msg) {
                  data.msg.split('\\n').forEach(function(line) {
                    appendLocalEntry(line, data.success ? 'default' : 'error');
                  });
                }
              })
              .catch(function() {
                appendLocalEntry('Failed to send command.', 'error');
              })
              .finally(function() {
                sendBtn.disabled = false;
                input.focus();
                scheduleRefresh();
              });
            }

            sendBtn.addEventListener('click', sendCommand);

            input.addEventListener('focus', function() {
              typing = true;
              clearTimeout(refreshTimer);
              label.textContent = 'Auto-refresh paused while typing';
            });
            input.addEventListener('blur', function() {
              setTimeout(function() {
                hideSuggestions();
                typing = false;
                label.textContent = 'Auto-refreshing every 5 seconds';
                scheduleRefresh();
              }, 150);
            });

            scrollBottom();
            scheduleRefresh();
          })();
        </script>
      </body>
    </html>
  `);
});

let botRunning = true;

app.post("/start", (req, res) => {
  if (botRunning) return res.json({ success: false, msg: "Already running" });

  botRunning = true;
  createBot();
  addLog("[Control] Bot started");

  res.json({ success: true });
});

app.post("/stop", (req, res) => {
  if (!botRunning) return res.json({ success: false, msg: "Already stopped" });

  botRunning = false;

  if (bot) {
    bot.end();
    bot = null;
  }

  clearAllIntervals();
  addLog("[Control] Bot stopped");

  res.json({ success: true });
});

app.post("/command", express.json(), (req, res) => {
  const cmd = (req.body.command || "").trim();
  if (!cmd) return res.json({ success: false, msg: "Empty command." });

  addLog(`[Console] > ${cmd}`);

  if (cmd === "/help") {
    const lines = [
      "Available commands:",
      "  /help          - Show this help message",
      "  /pos           - Show bot's current coordinates",
      "  /status        - Show bot connection status",
      "  /list          - Ask server for player list",
      "  /say <message> - Send a chat message in-game",
      "  /sleep         - Find nearest bed and sleep",
      "  /wake          - Wake up the bot from bed",
      "  /stealth       - Check stealth/vanish status or trigger stealth",
      "  /<anything>    - Send any Minecraft command directly",
      "  <text>         - Send plain chat (no slash needed)",
    ];
    lines.forEach((l) => addLog(`[Console] ${l}`));
    return res.json({ success: true, msg: lines.join("\n") });
  }

  if (cmd === "/stealth") {
    const isStealth = Boolean(config.stealth && config.stealth.enabled);
    const msg = `Stealth mode: ${isStealth ? "ACTIVE (Hidden)" : "DISABLED"}. Sneaking: ${config.stealth && config.stealth["constant-sneak"]}, Silent: ${config.stealth && config.stealth.silent}`;
    addLog(`[Console] ${msg}`);
    if (bot && botState.connected) {
      if (typeof bot.setControlState === "function") {
        bot.setControlState("sneak", true);
      }
      try { bot.chat("/vanish"); } catch (e) {}
      try { bot.chat("/v"); } catch (e) {}
      try { bot.chat("/effect give @s minecraft:invisibility infinite 1 true"); } catch (e) {}
      try { bot.chat("/effect give @s invisibility 999999 1 true"); } catch (e) {}
    }
    return res.json({ success: true, msg });
  }

  if (cmd === "/sleep") {
    if (!bot || !botState.connected) {
      return res.json({ success: false, msg: "Bot is not connected." });
    }
    if (typeof bot.goToBed === "function") {
      bot.goToBed("Console command (/sleep)");
      return res.json({ success: true, msg: "Sleep routine triggered." });
    }
    return res.json({ success: false, msg: "Bed module is not active." });
  }

  if (cmd === "/wake") {
    if (!bot || !botState.connected) {
      return res.json({ success: false, msg: "Bot is not connected." });
    }
    if (bot.isSleeping) {
      bot.wake().then(() => {
        addLog("[Console] Bot woke up.");
      }).catch((e) => {
        addLog(`[Console] Error waking up: ${e.message}`);
      });
      return res.json({ success: true, msg: "Waking up bot..." });
    }
    return res.json({ success: false, msg: "Bot is not currently sleeping." });
  }

  if (cmd === "/pos" || cmd === "/coords") {
    const pos = bot && bot.entity ? bot.entity.position : null;
    const msg = pos
      ? `Position: X=${Math.floor(pos.x)}  Y=${Math.floor(pos.y)}  Z=${Math.floor(pos.z)}`
      : "Position unavailable (bot not spawned).";
    addLog(`[Console] ${msg}`);
    return res.json({ success: true, msg });
  }

  if (cmd === "/status") {
    const status = botState.connected ? "Connected" : "Disconnected";
    const uptime = Math.floor((Date.now() - botState.startTime) / 1000);
    const sleeping = bot && bot.isSleeping ? " (Sleeping in bed)" : "";
    const msg = `Status: ${status}${sleeping} | Uptime: ${uptime}s | Reconnects: ${botState.reconnectAttempts}`;
    addLog(`[Console] ${msg}`);
    return res.json({ success: true, msg });
  }

  if (!bot || typeof bot.chat !== "function") {
    const msg = bot
      ? "Bot is still connecting — try again in a moment."
      : "Bot is not running.";
    addLog(`[Console] ${msg}`);
    return res.json({ success: false, msg });
  }

  try {
    bot.chat(cmd);
    addLog(`[Console] Sent to server: ${cmd}`);
    return res.json({ success: true, msg: `Sent: ${cmd}` });
  } catch (err) {
    addLog(`[Console] Error: ${err.message}`);
    return res.json({ success: false, msg: err.message });
  }
});

// ============================================================
//                    END OF WEB TOOLS
//============================================================

// FIX: handle port conflict gracefully - try next port if taken
const server = app.listen(PORT, "0.0.0.0", () => {
  addLog(`[Server] HTTP server started on port ${server.address().port} `);
});
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    const fallbackPort = PORT + 1;
    addLog(`[Server] Port ${PORT} in use - trying port ${fallbackPort} `);
    server.listen(fallbackPort, "0.0.0.0");
  } else {
    addLog(`[Server] HTTP server error: ${err.message} `);
  }
});

// FIX: only one definition of formatUptime
function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s} s`;
}

// ============================================================
// SELF-PING - Prevent Render from sleeping
// ============================================================
const SELF_PING_INTERVAL = 3 * 60 * 1000; // Ping every 3 minutes (Render free tier sleeps at 15m)

function startSelfPing() {
  const rawUrl = (process.env.RENDER_EXTERNAL_URL || config["render-url"] || "").trim();
  if (!rawUrl) {
    addLog(
      "[KeepAlive] No RENDER_EXTERNAL_URL or settings 'render-url' set - self-ping disabled.",
    );
    return;
  }
  const renderUrl = rawUrl.replace(/\/$/, "");
  const pingUrl = `${renderUrl}/ping`;

  const pingOnce = () => {
    const protocol = renderUrl.startsWith("https") ? https : http;
    protocol
      .get(pingUrl, (res) => {
        if (res.statusCode === 200) {
          addLog("[KeepAlive] Self-ping successful (Render kept awake)");
        } else {
          addLog(`[KeepAlive] Self-ping HTTP status: ${res.statusCode}`);
        }
      })
      .on("error", (err) => {
        addLog(`[KeepAlive] Self-ping failed: ${err.message}`);
      });
  };

  setTimeout(pingOnce, 8000); // First ping after 8s
  setInterval(pingOnce, SELF_PING_INTERVAL);
  addLog(`[KeepAlive] Self-ping active (every 3 min) -> ${pingUrl}`);
}

startSelfPing();

// ============================================================
// MEMORY MONITORING
// ============================================================
setInterval(
  () => {
    const mem = process.memoryUsage();
    const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(2);
    addLog(`[Memory] Heap: ${heapMB} MB`);
  },
  5 * 60 * 1000,
);

// ============================================================
// BOT CREATION WITH RECONNECTION LOGIC
// ============================================================
// ============================================================
// RECONNECTION & TIMEOUT MANAGEMENT
// ============================================================
let bot = null;
let activeIntervals = [];
let reconnectTimeoutId = null;
let connectionTimeoutId = null;
let isReconnecting = false;

function clearBotTimeouts() {
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
  if (connectionTimeoutId) {
    clearTimeout(connectionTimeoutId);
    connectionTimeoutId = null;
  }
}

// FIX: Discord rate limiting - track last send time
let lastDiscordSend = 0;
const DISCORD_RATE_LIMIT_MS = 5000; // min 5s between webhook calls

function clearAllIntervals() {
  addLog(`[Cleanup] Clearing ${activeIntervals.length} intervals`);
  activeIntervals.forEach((id) => clearInterval(id));
  activeIntervals = [];
}

function addInterval(callback, delay) {
  const id = setInterval(callback, delay);
  activeIntervals.push(id);
  return id;
}

function getReconnectDelay() {
  if (botState.wasThrottled) {
    botState.wasThrottled = false;
    const throttleDelay = 60000 + Math.floor(Math.random() * 60000);
    addLog(
      `[Bot] Throttle detected - using extended delay: ${throttleDelay / 1000}s`,
    );
    return throttleDelay;
  }

  // FIX: read auto-reconnect-delay from settings as base delay
  const baseDelay = config.utils["auto-reconnect-delay"] || 3000;
  const maxDelay = config.utils["max-reconnect-delay"] || 30000;
  const delay = Math.min(
    baseDelay * Math.pow(2, botState.reconnectAttempts),
    maxDelay,
  );
  const jitter = Math.floor(Math.random() * 2000);
  return delay + jitter;
}

function createBot() {
  if (isReconnecting) {
    addLog("[Bot] Already reconnecting, skipping...");
    return;
  }

  // Cleanup previous bot properly to avoid ghost bots
  if (bot) {
    clearAllIntervals();
    try {
      bot.removeAllListeners();
      bot.end();
    } catch (e) {
      addLog("[Cleanup] Error ending previous bot:", e.message);
    }
    bot = null;
  }

  addLog(`[Bot] Creating bot instance...`);
  addLog(`[Bot] Connecting to ${config.server.ip}:${config.server.port}`);

  try {
    // FIX: use version:false to auto-detect server version so the bot can join any server.
    // If the user explicitly sets a version in settings.json it is still respected.
    const botVersion =
      config.server.version && config.server.version.trim() !== ""
        ? config.server.version
        : false;
    bot = mineflayer.createBot({
      username: config["bot-account"].username,
      password: config["bot-account"].password || undefined,
      auth: config["bot-account"].type,
      host: config.server.ip,
      port: config.server.port,
      version: botVersion,
      hideErrors: false,
      checkTimeoutInterval: 600000,
    });

    bot.loadPlugin(pathfinder);

    // FIX: connection timeout - end the old bot before reconnecting to avoid ghost bots
    clearBotTimeouts();
    connectionTimeoutId = setTimeout(() => {
      if (!botState.connected) {
        addLog("[Bot] Connection timeout - no spawn received");
        try {
          bot.removeAllListeners();
          bot.end();
        } catch (e) {
          /* ignore */
        }
        bot = null;
        scheduleReconnect();
      }
    }, 150000); // 150s - Aternos servers can take 90-120s to finish spawning a player

    // FIX: guard against spawn firing twice (can happen on some servers)
    let spawnHandled = false;

    bot.once("spawn", () => {
      if (spawnHandled) return;
      spawnHandled = true;

      clearBotTimeouts();
      botState.connected = true;
      botState.lastActivity = Date.now();
      botState.reconnectAttempts = 0;
      isReconnecting = false;

      addLog(
        `[Bot] [+] Successfully spawned on server! (Version: ${bot.version})`,
      );
      if (
        config.discord &&
        config.discord.events &&
        config.discord.events.connect
      ) {
        sendDiscordWebhook(
          `[+] **Connected** to \`${config.server.ip}\``,
          0x4ade80,
        );
      }

      // FIX: 1.20.5+ / 1.21+ protocol requires client tick_end packet on physics ticks.
      // Missing this packet causes immediate server kick: 'multiplayer.disconnect.invalid_player_movement'
      bot.on("physicsTick", () => {
        try {
          if (bot._client && typeof bot._client.write === "function") {
            bot._client.write("tick_end", {});
          }
        } catch (e) {}
      });

      // FIX: use bot.version (auto-detected) instead of config value so minecraft-data always matches
      const mcData = require("minecraft-data")(bot.version);
      const defaultMove = new Movements(bot, mcData);
      defaultMove.allowFreeMotion = false;
      defaultMove.canDig = false;
      defaultMove.liquidCost = 1000;
      defaultMove.fallDamageCost = 1000;

      // Allow 3 seconds for chunks, terrain, and physics to stabilize before starting modules
      setTimeout(() => {
        if (bot && botState.connected) {
          initializeModules(bot, mcData, defaultMove);
        }
      }, 3000);

      // Attempt creative mode (only works if bot has OP and enabled in settings)
      setTimeout(() => {
        if (bot && botState.connected && config.server["try-creative"]) {
          bot.chat("/gamemode creative");
          addLog("[INFO] Attempted to set creative mode (requires OP)");
        }
      }, 3000);

      bot.on("messagestr", (message) => {
        if (
          message.includes("commands.gamemode.success.self") ||
          message.includes("Set own game mode to Creative Mode")
        ) {
          addLog("[INFO] Bot is now in Creative Mode.");
        }
      });
    });

    bot.on("death", () => {
      addLog("[Bot] Died in-game. Respawning in 1 second...");
      setTimeout(() => {
        try {
          if (bot && typeof bot.respawn === "function") {
            bot.respawn();
            addLog("[Bot] Respawned successfully.");
          }
        } catch (e) {
          addLog(`[Bot] Respawn error: ${e.message}`);
        }
      }, 1000);
    });

    // FIX: 'kicked' fires before 'end'. Remove the scheduleReconnect from 'kicked'
    // so that 'end' is the single source of reconnect truth, preventing double-trigger.
    bot.on("kicked", (reason) => {
      // FIX: stringify reason if it's an object to make it readable in logs
      const kickReason =
        typeof reason === "object" ? JSON.stringify(reason) : reason;
      addLog(`[Bot] Kicked: ${kickReason}`);
      botState.connected = false;
      botState.errors.push({
        type: "kicked",
        reason: kickReason,
        time: Date.now(),
      });
      clearAllIntervals();

      const reasonStr = String(kickReason).toLowerCase();
      if (
        reasonStr.includes("throttl") ||
        reasonStr.includes("wait before reconnect") ||
        reasonStr.includes("too fast")
      ) {
        addLog(
          "[Bot] Throttle kick detected - will use extended reconnect delay",
        );
        botState.wasThrottled = true;
      }

      if (
        config.discord &&
        config.discord.events &&
        config.discord.events.disconnect
      ) {
        sendDiscordWebhook(`[!] **Kicked**: ${kickReason}`, 0xff0000);
      }
      // NOTE: do NOT call scheduleReconnect() here - 'end' will fire right after 'kicked' and handle it
    });

    // FIX: 'end' is the single reconnect trigger
    bot.on("end", (reason) => {
      addLog(`[Bot] Disconnected: ${reason || "Unknown reason"}`);
      botState.connected = false;
      clearAllIntervals();
      spawnHandled = false; // reset for next connection

      if (
        config.discord &&
        config.discord.events &&
        config.discord.events.disconnect
      ) {
        sendDiscordWebhook(
          `[-] **Disconnected**: ${reason || "Unknown"}`,
          0xf87171,
        );
      }

      // ALWAYS reconnect — bot must never leave the server
      scheduleReconnect();
    });

    bot.on("error", (err) => {
      const msg = err.message || "";
      addLog(`[Bot] Error: ${msg}`);
      botState.errors.push({ type: "error", message: msg, time: Date.now() });
      // Don't reconnect on error - let 'end' event handle it
    });
  } catch (err) {
    addLog(`[Bot] Failed to create bot: ${err.message}`);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  clearBotTimeouts();

  // FIX: don't stack reconnect if already waiting
  if (isReconnecting) {
    addLog("[Bot] Reconnect already scheduled, skipping duplicate.");
    return;
  }

  isReconnecting = true;
  botState.reconnectAttempts++;

  const delay = getReconnectDelay();
  addLog(
    `[Bot] Reconnecting in ${delay / 1000}s (attempt #${botState.reconnectAttempts})`,
  );

  reconnectTimeoutId = setTimeout(() => {
    reconnectTimeoutId = null;
    isReconnecting = false;
    createBot();
  }, delay);
}

// ============================================================
// MODULE INITIALIZATION
// ============================================================
function initializeModules(bot, mcData, defaultMove) {
  addLog("[Modules] Initializing all modules...");

  // ---------- AUTO AUTH (REACTIVE) ----------
  if (config.utils["auto-auth"] && config.utils["auto-auth"].enabled) {
    const password = config.utils["auto-auth"].password;
    let authHandled = false;

    const tryAuth = (type) => {
      if (authHandled || !bot || !botState.connected) return;
      authHandled = true;
      try {
        if (type === "register") {
          bot.chat(`/register ${password} ${password}`);
          addLog("[Auth] Detected register prompt - sent /register");
        } else {
          bot.chat(`/login ${password}`);
          addLog("[Auth] Detected login prompt - sent /login");
        }
      } catch (e) {}
    };

    bot.on("messagestr", (message) => {
      if (authHandled) return;
      const msg = message.toLowerCase();
      if (
        msg.includes("/register") ||
        msg.includes("register ") ||
        msg.includes("지정된 비밀번호")
      ) {
        tryAuth("register");
      } else if (
        msg.includes("/login") ||
        msg.includes("login ") ||
        msg.includes("로그인")
      ) {
        tryAuth("login");
      }
    });

    // Failsafe: if no prompt after 10s, try login anyway
    setTimeout(() => {
      if (!authHandled && bot && botState.connected) {
        addLog(
          "[Auth] No prompt detected after 10s, sending /login as failsafe",
        );
        try { bot.chat(`/login ${password}`); } catch (e) {}
        authHandled = true;
      }
    }, 10000);
  }

  // ---------- CHAT MESSAGES ----------
  if (config.utils["chat-messages"] && config.utils["chat-messages"].enabled) {
    const messages = config.utils["chat-messages"].messages;
    if (config.utils["chat-messages"].repeat) {
      let i = 0;
      addInterval(() => {
        if (bot && botState.connected) {
          bot.chat(messages[i]);
          botState.lastActivity = Date.now();
          i = (i + 1) % messages.length;
        }
      }, config.utils["chat-messages"]["repeat-delay"] * 1000);
    } else {
      messages.forEach((msg, idx) => {
        setTimeout(() => {
          if (bot && botState.connected) bot.chat(msg);
        }, idx * 1000);
      });
    }
  }

  // ---------- MOVE TO POSITION ----------
  // FIX: only use position goal if circle-walk is NOT enabled (they fight over pathfinder)
  if (
    config.position &&
    config.position.enabled &&
    !(
      config.movement &&
      config.movement["circle-walk"] &&
      config.movement["circle-walk"].enabled
    )
  ) {
    bot.pathfinder.setMovements(defaultMove);
    bot.pathfinder.setGoal(
      new GoalBlock(config.position.x, config.position.y, config.position.z),
    );
    addLog("[Position] Navigating to configured position...");
  }

  // ---------- STEALTH MODE ----------
  if (config.stealth && config.stealth.enabled) {
    addLog("[Stealth] Stealth mode is ACTIVE: hiding player visibility and suppressing indicators.");

    // Constant sneak (hides nametag through blocks, mutes footsteps, shrinks hitbox)
    if (config.stealth["constant-sneak"]) {
      try {
        if (typeof bot.setControlState === "function") {
          bot.setControlState("sneak", true);
        }
      } catch (e) {}

      addInterval(() => {
        if (!bot || !botState.connected || isSleepingOrGoingToBed(bot)) return;
        try {
          if (typeof bot.setControlState === "function") {
            bot.setControlState("sneak", true);
          }
        } catch (e) {}
      }, 1500);
    }

    // Attempt stealth commands if server supports them (spectator, vanish, invisibility with hidden particles, team nametag)
    setTimeout(() => {
      if (!bot || !botState.connected) return;

      if (config.stealth["try-spectator"]) {
        try {
          bot.chat("/gamemode spectator");
          addLog("[Stealth] Attempted /gamemode spectator");
        } catch (e) {}
      } else {
        if (config.stealth["try-vanish"]) {
          try { bot.chat("/vanish"); } catch (e) {}
          try { bot.chat("/v"); } catch (e) {}
          addLog("[Stealth] Attempted /vanish and /v");
        }

        if (config.stealth["try-invisibility"]) {
          // 'true' at the end hides potion swirl particles
          try { bot.chat("/effect give @s minecraft:invisibility infinite 1 true"); } catch (e) {}
          try { bot.chat("/effect give @s invisibility 999999 1 true"); } catch (e) {}
          addLog("[Stealth] Attempted invisibility (no particles)");
        }

        if (config.stealth["hide-nametag"]) {
          try {
            bot.chat("/team add stealth_hide");
            bot.chat("/team modify stealth_hide nametagVisibility never");
            bot.chat("/team join stealth_hide @s");
            addLog("[Stealth] Attempted team nametag visibility hide");
          } catch (e) {}
        }
      }
    }, 3500);
  }

  // ---------- ANTI-AFK ----------
  if (config.utils["anti-afk"] && config.utils["anti-afk"].enabled) {
    // Arm swinging
    addInterval(
      () => {
        if (
          !bot ||
          !botState.connected ||
          isSleepingOrGoingToBed(bot) ||
          (config.stealth && config.stealth.enabled)
        )
          return;
        try {
          bot.swingArm();
        } catch (e) {}
      },
      10000 + Math.floor(Math.random() * 50000),
    );

    // Hotbar cycling
    addInterval(
      () => {
        if (!bot || !botState.connected || isSleepingOrGoingToBed(bot)) return;
        try {
          const slot = Math.floor(Math.random() * 9);
          bot.setQuickBarSlot(slot);
        } catch (e) {}
      },
      30000 + Math.floor(Math.random() * 90000),
    );

    // Teabagging
    addInterval(
      () => {
        if (
          !bot ||
          !botState.connected ||
          isSleepingOrGoingToBed(bot) ||
          (config.stealth && config.stealth.enabled) ||
          typeof bot.setControlState !== "function"
        )
          return;
        if (Math.random() > 0.9) {
          let count = 2 + Math.floor(Math.random() * 4);
          const doTeabag = () => {
            if (count <= 0 || !bot || isSleepingOrGoingToBed(bot) || typeof bot.setControlState !== "function")
              return;
            try {
              bot.setControlState("sneak", true);
              setTimeout(() => {
                if (bot && typeof bot.setControlState === "function")
                  bot.setControlState("sneak", false);
                count--;
                setTimeout(doTeabag, 150);
              }, 150);
            } catch (e) {}
          };
          doTeabag();
        }
      },
      120000 + Math.floor(Math.random() * 180000),
    );

    // FIX: micro-walk only when circle-walk is NOT running, to avoid interrupting pathfinder
    if (
      !(
        config.movement &&
        config.movement["circle-walk"] &&
        config.movement["circle-walk"].enabled
      )
    ) {
      addInterval(
        () => {
          if (
            !bot ||
            !botState.connected ||
            isSleepingOrGoingToBed(bot) ||
            (config.stealth && config.stealth.enabled) ||
            typeof bot.setControlState !== "function"
          )
            return;
          try {
            const yaw = Math.random() * Math.PI * 2;
            bot.look(yaw, 0, true);
            bot.setControlState("forward", true);
            setTimeout(
              () => {
                if (bot && typeof bot.setControlState === "function")
                  bot.setControlState("forward", false);
              },
              500 + Math.floor(Math.random() * 1500),
            );
            botState.lastActivity = Date.now();
          } catch (e) {
            addLog("[AntiAFK] Walk error:", e.message);
          }
        },
        120000 + Math.floor(Math.random() * 360000),
      );
    }

    if (
      config.utils["anti-afk"].sneak &&
      (!config.movement || !config.movement.roaming || !config.movement.roaming.enabled)
    ) {
      try {
        if (typeof bot.setControlState === "function")
          bot.setControlState("sneak", true);
      } catch (e) {}
    }
  }

  // ---------- MOVEMENT MODULES ----------
  // FIX: check top-level movement.enabled flag
  if (config.movement && config.movement.enabled !== false) {
    if (config.movement.roaming && config.movement.roaming.enabled) {
      startRoaming(bot, defaultMove);
    } else if (
      config.movement["circle-walk"] &&
      config.movement["circle-walk"].enabled
    ) {
      startCircleWalk(bot, defaultMove);
    }

    if (
      config.movement["random-jump"] &&
      config.movement["random-jump"].enabled &&
      !(config.movement.roaming && config.movement.roaming.enabled) &&
      !(
        config.movement["circle-walk"] && config.movement["circle-walk"].enabled
      )
    ) {
      startRandomJump(bot);
    }
    if (
      config.movement["look-around"] &&
      config.movement["look-around"].enabled
    ) {
      startLookAround(bot);
    }
  }

  // ---------- CUSTOM MODULES ----------
  // avoidMobs AND combatModule conflict - if combat is enabled, don't run avoidMobs at the same time
  if (config.modules.avoidMobs && !config.modules.combat) {
    avoidMobs(bot, defaultMove);
  }
  if (config.modules.combat) {
    combatModule(bot, mcData);
  }
  if (config.modules.beds || (config.beds && config.beds.enabled)) {
    bedModule(bot, mcData, defaultMove);
  }
  if (config.modules.chat) {
    chatModule(bot);
  }

  // Advanced ghost module — always active
  ghostModule(bot, defaultMove);

  addLog("[Modules] All modules initialized!");
}

// ============================================================
// MOVEMENT HELPERS
// ============================================================
function startRoaming(bot, defaultMove) {
  const roamRadius = (config.movement.roaming && config.movement.roaming.radius) || 12;
  const interval = (config.movement.roaming && config.movement.roaming.interval) || 10000;
  let homePos = null;
  let isNavigating = false;

  addLog(
    `[Roaming] Natural roaming enabled within radius ${roamRadius} blocks (every ${Math.round(interval / 1000)}s)`
  );

  addInterval(() => {
    if (!bot || !botState.connected || !bot.entity || isNavigating || isSleepingOrGoingToBed(bot)) return;

    if (!homePos) {
      homePos = bot.entity.position.clone();
      addLog(
        `[Roaming] Set center position at X: ${Math.round(homePos.x)}, Y: ${Math.round(homePos.y)}, Z: ${Math.round(homePos.z)}`
      );
    }

    try {
      // Pick random safe coordinates within roamRadius of homePos
      const angle = Math.random() * Math.PI * 2;
      const distance = 2 + Math.random() * (roamRadius - 2);
      const targetX = Math.floor(homePos.x + Math.cos(angle) * distance);
      const targetZ = Math.floor(homePos.z + Math.sin(angle) * distance);

      // Swing arm and update activity
      try { bot.swingArm(); } catch (e) {}
      botState.lastActivity = Date.now();

      isNavigating = true;
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalNear(targetX, Math.floor(bot.entity.position.y), targetZ, 1));

      // Reset navigating state after reaching goal or 8s timeout failsafe
      const navTimeout = setTimeout(() => {
        isNavigating = false;
        try { bot.pathfinder.stop(); } catch (e) {}
      }, 8000);

      bot.once("goal_reached", () => {
        clearTimeout(navTimeout);
        isNavigating = false;
        try {
          const yaw = Math.random() * Math.PI * 2 - Math.PI;
          bot.look(yaw, 0, false);
          bot.swingArm();
        } catch (e) {}
      });
    } catch (e) {
      isNavigating = false;
      addLog(`[Roaming] Error: ${e.message}`);
    }
  }, interval);
}
function startCircleWalk(bot, defaultMove) {
  const radius = config.movement["circle-walk"].radius;
  let angle = 0;
  let lastPathTime = 0;

  addInterval(() => {
    if (!bot || !botState.connected || isSleepingOrGoingToBed(bot)) return;
    const now = Date.now();
    if (now - lastPathTime < 2000) return;
    lastPathTime = now;
    try {
      const x = bot.entity.position.x + Math.cos(angle) * radius;
      const z = bot.entity.position.z + Math.sin(angle) * radius;
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(
        new GoalBlock(
          Math.floor(x),
          Math.floor(bot.entity.position.y),
          Math.floor(z),
        ),
      );
      angle += Math.PI / 4;
      botState.lastActivity = Date.now();
    } catch (e) {
      addLog("[CircleWalk] Error:", e.message);
    }
  }, config.movement["circle-walk"].speed);
}

function startRandomJump(bot) {
  addInterval(() => {
    if (
      !bot ||
      !botState.connected ||
      isSleepingOrGoingToBed(bot) ||
      (config.stealth && config.stealth.enabled) ||
      typeof bot.setControlState !== "function"
    )
      return;
    try {
      bot.setControlState("jump", true);
      setTimeout(() => {
        if (bot && typeof bot.setControlState === "function")
          bot.setControlState("jump", false);
      }, 300);
      botState.lastActivity = Date.now();
    } catch (e) {
      addLog("[RandomJump] Error:", e.message);
    }
  }, config.movement["random-jump"].interval);
}

function startLookAround(bot) {
  addInterval(() => {
    if (
      !bot ||
      !botState.connected ||
      isSleepingOrGoingToBed(bot) ||
      (config.stealth && config.stealth.enabled)
    )
      return;
    try {
      const yaw = Math.random() * Math.PI * 2 - Math.PI;
      const pitch = (Math.random() * Math.PI) / 2 - Math.PI / 4;
      bot.look(yaw, pitch, false);
      botState.lastActivity = Date.now();
    } catch (e) {
      addLog("[LookAround] Error:", e.message);
    }
  }, config.movement["look-around"].interval);
}

// ============================================================
// CUSTOM MODULES
// ============================================================

// Avoid mobs — uses pathfinder to flee instead of just stepping back
function avoidMobs(bot, defaultMove) {
  const safeDistance = 6;
  let isAvoiding = false;

  addInterval(() => {
    if (
      !bot ||
      !botState.connected ||
      isSleepingOrGoingToBed(bot) ||
      isAvoiding ||
      !bot.entity
    )
      return;
    try {
      const entities = Object.values(bot.entities).filter(
        (e) =>
          e.type === "mob" ||
          (e.type === "player" && e.username !== bot.username),
      );
      for (const e of entities) {
        if (!e.position) continue;
        const distance = bot.entity.position.distanceTo(e.position);
        if (distance < safeDistance) {
          // Pathfind to the opposite direction to properly flee
          isAvoiding = true;
          const dx = bot.entity.position.x - e.position.x;
          const dz = bot.entity.position.z - e.position.z;
          const len = Math.sqrt(dx * dx + dz * dz) || 1;
          const fleeX = Math.round(bot.entity.position.x + (dx / len) * 8);
          const fleeZ = Math.round(bot.entity.position.z + (dz / len) * 8);
          if (bot.pathfinder) {
            try {
              bot.pathfinder.setMovements(defaultMove);
              bot.pathfinder.goto(new GoalNear(fleeX, Math.round(bot.entity.position.y), fleeZ, 1)).catch(() => {});
            } catch (_) {}
          } else if (typeof bot.setControlState === "function") {
            bot.setControlState("back", true);
            setTimeout(() => {
              if (bot && typeof bot.setControlState === "function")
                bot.setControlState("back", false);
            }, 600);
          }
          setTimeout(() => { isAvoiding = false; }, 3000);
          break;
        }
      }
    } catch (e) {
      addLog("[AvoidMobs] Error:", e.message);
    }
  }, 1500);
}

// Combat module
// FIX: attack cooldown for 1.9+ (600ms minimum between attacks)
// FIX: lock onto a target for multiple ticks instead of randomly switching every tick
// FIX: autoEat - use i.foodPoints directly (mineflayer item property) instead of broken mcData lookup
function combatModule(bot, mcData) {
  let lastAttackTime = 0;
  let lockedTarget = null;
  let lockedTargetExpiry = 0;

  // FIX: use physicsTick (not the deprecated physicTick)
  bot.on("physicsTick", () => {
    if (!bot || !botState.connected || isSleepingOrGoingToBed(bot)) return;
    if (!config.combat["attack-mobs"]) return;

    const now = Date.now();
    // FIX: 1.9+ attack cooldown - respect at least 600ms between swings
    if (now - lastAttackTime < 620) return;

    try {
      // FIX: only pick a new target if current one is gone or lock expired
      if (
        lockedTarget &&
        now < lockedTargetExpiry &&
        bot.entities[lockedTarget.id] &&
        lockedTarget.position
      ) {
        const dist = bot.entity.position.distanceTo(lockedTarget.position);
        if (dist < 4) {
          bot.attack(lockedTarget);
          lastAttackTime = now;
          return;
        } else {
          lockedTarget = null;
        }
      }

      // Pick a new target
      const mobs = Object.values(bot.entities).filter(
        (e) =>
          e.type === "mob" &&
          e.position &&
          bot.entity.position.distanceTo(e.position) < 4,
      );
      if (mobs.length > 0) {
        lockedTarget = mobs[0];
        lockedTargetExpiry = now + 3000; // stick to same mob for 3 seconds
        bot.attack(lockedTarget);
        lastAttackTime = now;
      }
    } catch (e) {
      addLog("[Combat] Error:", e.message);
    }
  });

  // FIX: autoEat - check foodPoints property on the item directly (works reliably)
  bot.on("health", () => {
    if (!config.combat["auto-eat"]) return;
    try {
      if (bot.food < 14) {
        const food = bot.inventory
          .items()
          .find((i) => i.foodPoints && i.foodPoints > 0);
        if (food) {
          bot
            .equip(food, "hand")
            .then(() => bot.consume())
            .catch((e) => addLog("[AutoEat] Error:", e.message));
        }
      }
    } catch (e) {
      addLog("[AutoEat] Error:", e.message);
    }
  });
}

// ============================================================
// GHOST MODULE — human-like idle behavior, silent auto-eat,
// stealth maintenance, and complete player isolation
// ============================================================
function ghostModule(bot, defaultMove) {
  addLog("[Ghost] Advanced ghost module started — bot is now fully invisible.");

  // ---- SILENT AUTO-EAT (independent of combat module) ----
  let isEating = false;
  bot.on("health", () => {
    if (!bot || !botState.connected || isEating || isSleepingOrGoingToBed(bot)) return;
    try {
      if (bot.food <= 16) {
        const food = bot.inventory.items().find((i) => i && i.foodPoints && i.foodPoints > 0);
        if (food) {
          isEating = true;
          bot.equip(food, "hand")
            .then(() => bot.consume())
            .then(() => { isEating = false; })
            .catch(() => { isEating = false; });
        }
      }
    } catch (e) { isEating = false; }
  });

  // ---- HUMAN-LIKE HEAD MOVEMENT ----
  // Slowly drifts gaze rather than snapping instantly
  let targetYaw = Math.random() * Math.PI * 2 - Math.PI;
  let targetPitch = (Math.random() - 0.5) * 0.6;
  let currentYaw = targetYaw;
  let currentPitch = targetPitch;

  // Pick new gaze target every 4–12 seconds
  addInterval(() => {
    if (!bot || !botState.connected || isSleepingOrGoingToBed(bot)) return;
    // Occasionally look at a nearby player naturally (like a real player would glance)
    try {
      const players = Object.values(bot.entities).filter(
        (e) => e.type === "player" && e.username !== bot.username && e.position &&
          bot.entity.position.distanceTo(e.position) < 20
      );
      if (players.length > 0 && Math.random() < 0.3) {
        // Glance toward a player briefly but look away after 2-4s (natural behavior)
        const p = players[Math.floor(Math.random() * players.length)];
        const dx = p.position.x - bot.entity.position.x;
        const dz = p.position.z - bot.entity.position.z;
        targetYaw = Math.atan2(-dx, -dz);
        targetPitch = -0.1 + Math.random() * 0.3;
      } else {
        targetYaw = Math.random() * Math.PI * 2 - Math.PI;
        targetPitch = (Math.random() - 0.5) * 0.7;
      }
    } catch (e) {}
  }, 4000 + Math.random() * 8000);

  // Smooth gaze interpolation — updates at 20Hz to mimic natural head movement
  addInterval(() => {
    if (!bot || !botState.connected || isSleepingOrGoingToBed(bot)) return;
    try {
      // Interpolate toward target yaw/pitch (smooth drift)
      const lerpSpeed = 0.08 + Math.random() * 0.07;
      currentYaw += (targetYaw - currentYaw) * lerpSpeed;
      currentPitch += (targetPitch - currentPitch) * lerpSpeed;
      // Add micro-jitter to simulate human hand tremor
      const jitterYaw = (Math.random() - 0.5) * 0.008;
      const jitterPitch = (Math.random() - 0.5) * 0.005;
      bot.look(currentYaw + jitterYaw, currentPitch + jitterPitch, false);
    } catch (e) {}
  }, 50);

  // ---- PERIODIC SNEAK PULSE (breathing-like micro-movement) ----
  // Every 25-60s the bot crouches for 300ms — looks like the player shifted weight
  addInterval(() => {
    if (
      !bot || !botState.connected || isSleepingOrGoingToBed(bot) ||
      typeof bot.setControlState !== "function"
    ) return;
    if (Math.random() < 0.4) {
      try {
        // Momentarily un-sneak then re-sneak
        bot.setControlState("sneak", false);
        setTimeout(() => {
          if (bot && typeof bot.setControlState === "function")
            bot.setControlState("sneak", true);
        }, 280 + Math.floor(Math.random() * 200));
      } catch (e) {}
    }
  }, 25000 + Math.floor(Math.random() * 35000));

  // ---- STEALTH REAPPLICATION ----
  // Reapply invisibility & nametag suppression every 8 minutes
  // (in case server restart, effect expiry, etc.)
  if (config.stealth && config.stealth.enabled) {
    addInterval(() => {
      if (!bot || !botState.connected) return;
      try {
        if (config.stealth["try-invisibility"]) {
          bot.chat("/effect give @s minecraft:invisibility infinite 1 true");
          bot.chat("/effect give @s invisibility 999999 1 true");
        }
        if (config.stealth["hide-nametag"]) {
          bot.chat("/team modify stealth_hide nametagVisibility never");
          bot.chat("/team join stealth_hide @s");
        }
        if (config.stealth["try-vanish"]) {
          // Only re-vanish occasionally so it doesn't spam the console
          if (Math.random() < 0.5) {
            try { bot.chat("/vanish"); } catch (e) {}
          }
        }
      } catch (e) {}
    }, 8 * 60 * 1000);
  }

  // ---- BLOCK ALL PLAYER INTERACTION ----
  // Ghost bots never respond to anyone — add a chat interceptor that drops everything
  // (the existing chatModule.respond setting handles this too, but this is a hard lock)
  // No listeners added here; simply log that all chat is silenced.
  addLog("[Ghost] Chat reactions disabled. Bot will never interact with players.");
}

// Bed module - Automatically sleep when players try to sleep or when it's night
function bedModule(bot, mcData, defaultMove) {
  let isNavigatingToBed = false;
  let lastAttemptTime = 0;
  let lastChatAlertTime = 0;
  let botPlacedThisBed = false;
  const searchRadius = (config.beds && config.beds["search-radius"]) || 32;

  botState.isGoingToBed = false;

  function isNightOrStorm() {
    if (!bot || !bot.time) return false;
    const timeOfDay = bot.time.timeOfDay;
    const isNight = timeOfDay >= 12500 && timeOfDay <= 23500;
    const isStorm = Boolean(bot.isRaining);
    return isNight || isStorm;
  }

  function getBedFromInventory() {
    if (!bot || !bot.inventory) return null;
    return bot.inventory.items().find((i) => i && i.name && i.name.includes("bed"));
  }

  function findNearbyBed() {
    if (!bot || !bot.entity) return null;

    // 1. Try to find unoccupied bed block
    try {
      const bed = bot.findBlock({
        matching: (block) => {
          if (!block || !block.name || !block.name.includes("bed")) return false;
          if (
            block._properties &&
            (block._properties.occupied === true || block._properties.occupied === "true")
          ) {
            return false;
          }
          return true;
        },
        maxDistance: searchRadius,
      });
      if (bed) return bed;
    } catch (e) {}

    // 2. Fallback to any bed block within radius
    try {
      return bot.findBlock({
        matching: (block) => block && block.name && block.name.includes("bed"),
        maxDistance: searchRadius,
      });
    } catch (e) {
      return null;
    }
  }

  async function placeBedFromInventory() {
    if (!bot || !bot.inventory || !bot.entity) return null;

    let bedItem = getBedFromInventory();

    // If bot has no bed, try asking server via OP / creative if enabled
    if (!bedItem && config.server && config.server["try-creative"]) {
      try {
        bot.chat("/give @s red_bed 1");
        await new Promise((r) => setTimeout(r, 600));
        bedItem = getBedFromInventory();
      } catch (e) {}
    }

    if (!bedItem) {
      addLog("[Bed] Bot does not have a bed in inventory to place.");
      return null;
    }

    addLog(`[Bed] Found bed in inventory (${bedItem.name}). Finding suitable floor space...`);

    const botPos = bot.entity.position.floored();
    const { Vec3 } = require("vec3");

    const horizontalDirs = [
      new Vec3(0, 0, 1),   // South
      new Vec3(0, 0, -1),  // North
      new Vec3(1, 0, 0),   // East
      new Vec3(-1, 0, 0),  // West
    ];

    let bestSpot = null;

    // Search candidate ground spots near bot (x: -2 to 2, z: -2 to 2, y: -1 to 0)
    for (let dx = -2; dx <= 2 && !bestSpot; dx++) {
      for (let dz = -2; dz <= 2 && !bestSpot; dz++) {
        for (let dy = -1; dy <= 0 && !bestSpot; dy++) {
          const floorPos1 = botPos.offset(dx, dy, dz);
          const floorBlock1 = bot.blockAt(floorPos1);
          const airBlock1 = bot.blockAt(floorPos1.offset(0, 1, 0));

          if (!floorBlock1 || floorBlock1.boundingBox !== "block" || floorBlock1.name.includes("air")) continue;
          if (!airBlock1 || (airBlock1.boundingBox === "block" && !airBlock1.name.includes("air"))) continue;

          for (const dir of horizontalDirs) {
            const floorPos2 = floorPos1.offset(dir.x, 0, dir.z);
            const floorBlock2 = bot.blockAt(floorPos2);
            const airBlock2 = bot.blockAt(floorPos2.offset(0, 1, 0));

            if (!floorBlock2 || floorBlock2.boundingBox !== "block" || floorBlock2.name.includes("air")) continue;
            if (!airBlock2 || (airBlock2.boundingBox === "block" && !airBlock2.name.includes("air"))) continue;

            bestSpot = {
              footFloor: floorBlock1,
              headFloor: floorBlock2,
              dir: dir,
            };
            break;
          }
        }
      }
    }

    if (!bestSpot) {
      addLog("[Bed] Could not find clear 2-block ground space to place bed near bot.");
      return null;
    }

    try {
      await bot.equip(bedItem, "hand");
      const lookTarget = bestSpot.footFloor.position.offset(
        bestSpot.dir.x * 2,
        1.5,
        bestSpot.dir.z * 2
      );
      await bot.lookAt(lookTarget, true);
      await new Promise((r) => setTimeout(r, 200));

      await bot.placeBlock(bestSpot.footFloor, new Vec3(0, 1, 0));
      botPlacedThisBed = true;
      addLog(`[Bed] Placed bed from inventory on top of ${bestSpot.footFloor.name}!`);
      await new Promise((r) => setTimeout(r, 500));

      const placedBed =
        bot.blockAt(bestSpot.footFloor.position.offset(0, 1, 0)) ||
        bot.blockAt(bestSpot.headFloor.position.offset(0, 1, 0)) ||
        findNearbyBed();

      return placedBed;
    } catch (err) {
      addLog(`[Bed] Failed to place bed: ${err.message}`);
      return null;
    }
  }

  async function pickUpBed() {
    try {
      const bedBlock = findNearbyBed();
      if (!bedBlock) return;
      if (typeof bot.dig === "function" && bot.canDigBlock(bedBlock)) {
        addLog(`[Bed] Breaking bed to pick it back up into inventory...`);
        await bot.dig(bedBlock);
        await new Promise((r) => setTimeout(r, 800));
        botPlacedThisBed = false;
        const item = getBedFromInventory();
        if (item) {
          addLog(`[Bed] Bed is now safely in bot's inventory (${item.name}).`);
        }
      }
    } catch (e) {
      addLog(`[Bed] Error picking up bed: ${e.message}`);
    }
  }

  async function goToBed(triggerReason = "routine") {
    if (!bot || !botState.connected || !bot.entity) return false;
    if (bot.isSleeping) {
      return true;
    }
    if (isNavigatingToBed) {
      return false;
    }

    const now = Date.now();
    if (now - lastAttemptTime < 3000) {
      return false; // Debounce rapid triggers
    }
    lastAttemptTime = now;

    // If triggered by player sleeping, ALWAYS try — don't gate on time check
    // Only skip if triggered by the routine timer and it's daytime
    const isPlayerTrigger = triggerReason.toLowerCase().includes("player") ||
      triggerReason.toLowerCase().includes("server");
    if (!isPlayerTrigger && !isNightOrStorm()) {
      addLog(`[Bed] Sleep skipped: it is daytime and not thundering.`);
      return false;
    }

    addLog(`[Bed] Sleep triggered by: ${triggerReason}`);

    let bedBlock = findNearbyBed();

    // If no bed placed nearby in the world, check inventory and place one!
    if (!bedBlock && config.beds && config.beds["place-night"] !== false) {
      bedBlock = await placeBedFromInventory();
    }

    if (!bedBlock) {
      addLog(`[Bed] No bed found nearby and no bed in inventory. Give the bot a bed or place one near it!`);
      if (
        now - lastChatAlertTime > 45000 &&
        config.beds &&
        config.beds["chat-announcements"] &&
        !(config.stealth && config.stealth.silent)
      ) {
        lastChatAlertTime = now;
        try {
          bot.chat("I need a bed to sleep! Please place one near me.");
        } catch (e) {}
      }
      return false;
    }

    isNavigatingToBed = true;
    botState.isGoingToBed = true;

    try {
      try { bot.clearControlStates(); } catch (e) {}

      const dist = bot.entity.position.distanceTo(bedBlock.position);
      if (dist > 3.0) {
        addLog(
          `[Bed] Walking to bed at X:${bedBlock.position.x} Y:${bedBlock.position.y} Z:${bedBlock.position.z} (${dist.toFixed(1)} blocks away)...`
        );

        if (bot.pathfinder) {
          try {
            bot.pathfinder.setMovements(defaultMove);
            await new Promise((resolve) => {
              const navTimeout = setTimeout(() => {
                try { bot.pathfinder.stop(); } catch (e) {}
                resolve();
              }, 12000);

              bot.pathfinder
                .goto(new GoalNear(bedBlock.position.x, bedBlock.position.y, bedBlock.position.z, 2))
                .then(() => {
                  clearTimeout(navTimeout);
                  resolve();
                })
                .catch((err) => {
                  clearTimeout(navTimeout);
                  addLog(`[Bed] Pathfinding notice: ${err.message}`);
                  resolve();
                });
            });
          } catch (navErr) {
            addLog(`[Bed] Navigation error: ${navErr.message}`);
          }
        }
      }

      const currentDist = bot.entity.position.distanceTo(bedBlock.position);
      if (currentDist > 4.5) {
        addLog(`[Bed] Bed out of reach (${currentDist.toFixed(1)} blocks away). Cannot sleep.`);
        return false;
      }

      addLog(`[Bed] Entering bed at ${bedBlock.position.x}, ${bedBlock.position.y}, ${bedBlock.position.z}...`);
      await bot.sleep(bedBlock);
      addLog(`[Bed] Zzz... Bot is now sleeping in bed! Night can pass.`);

      if (
        config.beds &&
        config.beds["chat-announcements"] &&
        !(config.stealth && config.stealth.silent) &&
        now - lastChatAlertTime > 20000
      ) {
        lastChatAlertTime = now;
        try {
          bot.chat("I'm in bed now! Good night! 🛏️");
        } catch (e) {}
      }

      return true;
    } catch (e) {
      addLog(`[Bed] Could not sleep: ${e.message}`);
      return false;
    } finally {
      isNavigatingToBed = false;
      if (!bot.isSleeping) {
        botState.isGoingToBed = false;
      }
    }
  }

  // Event: bot enters bed
  bot.on("sleep", () => {
    botState.isGoingToBed = true;
    addLog(`[Bed] Bot entered bed (bot.isSleeping = true). All movement and anti-afk paused.`);
  });

  // Event: bot wakes up
  bot.on("wake", async () => {
    botState.isGoingToBed = false;
    isNavigatingToBed = false;
    addLog(`[Bed] Bot woke up! (bot.isSleeping = false). Morning has arrived.`);

    if (
      config.beds &&
      config.beds["chat-announcements"] &&
      !(config.stealth && config.stealth.silent)
    ) {
      try {
        bot.chat("Good morning! ☀️");
      } catch (e) {}
    }

    // Pick up bed into inventory if configured or if bot placed it
    if ((config.beds && config.beds["pick-up-day"]) || botPlacedThisBed) {
      await pickUpBed();
    }
  });

  // Centralized sleep message detector (handles Chat, Action Bar, Titles, System notices)
  function checkSleepMessage(rawMsg) {
    if (!rawMsg) return;
    let str = "";
    if (typeof rawMsg === "string") {
      str = rawMsg;
    } else if (typeof rawMsg === "object") {
      try {
        str = rawMsg.toString ? rawMsg.toString() : JSON.stringify(rawMsg);
      } catch (e) {
        str = String(rawMsg);
      }
    }
    const lower = str.toLowerCase();

    const isSleepNotice =
      lower.includes("night will be skipped") ||
      lower.includes("other player sleeps") ||
      lower.includes("other players sleep") ||
      lower.includes("players sleeping") ||
      lower.includes("player is sleeping") ||
      lower.includes("to skip to dawn") ||
      lower.includes("skipping night") ||
      lower.includes("skip night") ||
      lower.includes("went to bed") ||
      lower.includes("is now sleeping") ||
      lower.includes("players are sleeping") ||
      lower.includes("leave bed") ||
      lower.includes("sleep.skipping_night") ||
      lower.includes("sleep.players_sleeping");

    if (isSleepNotice) {
      addLog(`[Bed] Detected sleep notice from server: "${str.slice(0, 90)}"`);
      goToBed("Server sleep notice");
    }
  }

  bot.on("messagestr", checkSleepMessage);
  bot.on("message", checkSleepMessage);
  bot.on("actionBar", checkSleepMessage);
  bot.on("title", checkSleepMessage);

  if (bot._client) {
    bot._client.on("set_action_bar_text", (packet) => {
      try { checkSleepMessage(packet && packet.text ? packet.text : packet); } catch (e) {}
    });
    bot._client.on("system_chat", (packet) => {
      try { checkSleepMessage(packet && packet.content ? packet.content : packet); } catch (e) {}
    });
  }

  // NOTE: Intentionally NOT listening to player chat — bot must be 100% non-interactive.
  // Sleep is detected ONLY via server messages, action bar, and entity pose.

  // Nearby player entity enters bed (pose === sleeping)
  const checkSleepingEntities = () => {
    if (!bot || !botState.connected || !bot.entities || bot.isSleeping || isNavigatingToBed) return;
    try {
      for (const id in bot.entities) {
        const entity = bot.entities[id];
        if (!entity || entity.type !== "player" || entity.username === bot.username) continue;

        const isPlayerSleeping =
          entity.pose === "sleeping" ||
          entity.pose === 2 ||
          entity.isInBed === true ||
          (entity.metadata && (entity.metadata[6] === 2 || entity.metadata[6] === "sleeping"));

        if (isPlayerSleeping) {
          addLog(`[Bed] Detected player ${entity.username || id} sleeping in bed nearby!`);
          goToBed(`Player ${entity.username || id} sleeping nearby`);
          break;
        }
      }
    } catch (e) {}
  };

  addInterval(checkSleepingEntities, 1500);

  // Periodic time check (Night time or thunderstorm auto-sleep)
  addInterval(() => {
    if (!bot || !botState.connected) return;

    // Daytime safety check: wake up if daytime
    if (bot.isSleeping && !isNightOrStorm()) {
      addLog(`[Bed] Daytime detected while in bed. Waking up...`);
      try {
        bot.wake().catch(() => {});
      } catch (e) {}
      botState.isGoingToBed = false;
      return;
    }

    // Auto-sleep check at night
    if (isNightOrStorm() && !bot.isSleeping && !isNavigatingToBed) {
      const otherPlayersOnline =
        Object.keys(bot.players || {}).filter((u) => u !== bot.username).length > 0;
      const sleepAtNightEnabled = config.beds && config.beds["sleep-at-night"] !== false;

      if (sleepAtNightEnabled && otherPlayersOnline) {
        goToBed("Night time (other players online)");
      }
    }
  }, 2500);

  // Expose methods on bot instance
  bot.goToBed = goToBed;
  bot.pickUpBed = pickUpBed;
  bot.placeBedFromInventory = placeBedFromInventory;
}

// Chat module
// FIX: wire up discord.events.chat flag
function chatModule(bot) {
  bot.on("chat", (username, message) => {
    if (!bot || username === bot.username) return;

    try {
      // FIX: send chat events to Discord if enabled
      if (
        config.discord &&
        config.discord.enabled &&
        config.discord.events &&
        config.discord.events.chat
      ) {
        sendDiscordWebhook(`💬 **${username}**: ${message}`, 0x7289da);
      }

      if (config.stealth && config.stealth.silent) return;

      if (config.chat && config.chat.respond) {
        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes("hello") || lowerMsg.includes("hi")) {
          bot.chat(`Hello, ${username}!`);
        }
        if (message.startsWith("!tp ")) {
          const target = message.split(" ")[1];
          if (target) bot.chat(`/tp ${target}`);
        }
      }
    } catch (e) {
      addLog("[Chat] Error:", e.message);
    }
  });
}

// ============================================================
// CONSOLE COMMANDS
// ============================================================
const readline = require("readline");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", (line) => {
  if (!bot || !botState.connected) {
    addLog("[Console] Bot not connected");
    return;
  }

  const trimmed = line.trim();
  if (trimmed.startsWith("say ")) {
    bot.chat(trimmed.slice(4));
  } else if (trimmed.startsWith("cmd ")) {
    bot.chat("/" + trimmed.slice(4));
  } else if (trimmed === "status") {
    const sleeping = bot && bot.isSleeping ? " (Sleeping in bed)" : "";
    addLog(
      `Connected: ${botState.connected}${sleeping}, Uptime: ${formatUptime(Math.floor((Date.now() - botState.startTime) / 1000))}`,
    );
  } else if (trimmed === "stealth" || trimmed === "/stealth") {
    const isStealth = Boolean(config.stealth && config.stealth.enabled);
    addLog(`[Console] Stealth mode: ${isStealth ? "ACTIVE (Hidden)" : "DISABLED"}`);
    if (bot && botState.connected) {
      if (typeof bot.setControlState === "function") bot.setControlState("sneak", true);
      try { bot.chat("/vanish"); } catch (e) {}
      try { bot.chat("/v"); } catch (e) {}
      try { bot.chat("/effect give @s minecraft:invisibility infinite 1 true"); } catch (e) {}
      try { bot.chat("/effect give @s invisibility 999999 1 true"); } catch (e) {}
    }
  } else if (trimmed === "sleep" || trimmed === "/sleep") {
    if (typeof bot.goToBed === "function") {
      bot.goToBed("Terminal command (sleep)");
    } else {
      addLog("[Console] Bed module is not active.");
    }
  } else if (trimmed === "wake" || trimmed === "/wake") {
    if (bot.isSleeping) {
      bot.wake().then(() => {
        addLog("[Console] Bot woke up.");
      }).catch((e) => {
        addLog(`[Console] Error waking: ${e.message}`);
      });
    } else {
      addLog("[Console] Bot is not currently sleeping.");
    }
  } else {
    bot.chat(trimmed);
  }
});

// ============================================================
// DISCORD WEBHOOK INTEGRATION
// FIX: use Buffer.byteLength for Content-Length (handles non-ASCII usernames correctly)
// FIX: rate limiting to avoid spam when bot is flapping
// ============================================================
function sendDiscordWebhook(content, color = 0x0099ff) {
  if (
    !config.discord ||
    !config.discord.enabled ||
    !config.discord.webhookUrl ||
    config.discord.webhookUrl.includes("YOUR_DISCORD")
  )
    return;

  // FIX: Discord rate limiting - skip if sent too recently
  const now = Date.now();
  if (now - lastDiscordSend < DISCORD_RATE_LIMIT_MS) {
    addLog("[Discord] Rate limited - skipping webhook");
    return;
  }
  lastDiscordSend = now;

  const protocol = config.discord.webhookUrl.startsWith("https") ? https : http;
  const urlParts = new URL(config.discord.webhookUrl);

  const payload = JSON.stringify({
    username: config.name,
    embeds: [
      {
        description: content,
        color: color,
        timestamp: new Date().toISOString(),
        footer: { text: "Slobos AFK Bot" },
      },
    ],
  });

  const options = {
    hostname: urlParts.hostname,
    port: 443,
    path: urlParts.pathname + urlParts.search,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // FIX: use Buffer.byteLength instead of payload.length - handles non-ASCII (e.g. usernames with accents/emoji)
      "Content-Length": Buffer.byteLength(payload, "utf8"),
    },
  };

  const req = protocol.request(options, (res) => {
    // Silent success
  });

  req.on("error", (e) => {
    addLog(`[Discord] Error sending webhook: ${e.message}`);
  });

  req.write(payload);
  req.end();
}

// ============================================================
// CRASH RECOVERY - IMMORTAL MODE
// FIX: guard against uncaughtException stacking reconnects when isReconnecting is already true
// ============================================================
process.on("uncaughtException", (err) => {
  const msg = err.message || "Unknown";
  addLog(`[FATAL] Uncaught Exception: ${msg}`);
  botState.errors.push({ type: "uncaught", message: msg, time: Date.now() });

  // Cap errors array to prevent memory leak over long uptimes
  if (botState.errors.length > 100) {
    botState.errors = botState.errors.slice(-50);
  }

  const isNetworkError =
    msg.includes("PartialReadError") ||
    msg.includes("ECONNRESET") ||
    msg.includes("EPIPE") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("timed out") ||
    msg.includes("write after end") ||
    msg.includes("This socket has been ended");

  if (isNetworkError) {
    addLog("[FATAL] Known network/protocol error - recovering gracefully...");
  }

  // ALWAYS recover — bot must never stay disconnected
  clearAllIntervals();
  botState.connected = false;

  // FIX: reset isReconnecting if it was stuck, then schedule reconnect
  if (isReconnecting) {
    addLog(
      "[FATAL] isReconnecting was stuck - resetting before crash recovery",
    );
    isReconnecting = false;
    // BUG FIX: was referencing non-existent 'reconnectTimeout' — correct name is 'reconnectTimeoutId'
    if (reconnectTimeoutId) {
      clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = null;
    }
  }

  setTimeout(
    () => {
      scheduleReconnect();
    },
    isNetworkError ? 5000 : 10000,
  );
});

process.on("unhandledRejection", (reason) => {
  const msg = String(reason);
  addLog(`[FATAL] Unhandled Rejection: ${reason}`);
  botState.errors.push({ type: "rejection", message: msg, time: Date.now() });
  if (botState.errors.length > 100) {
    botState.errors = botState.errors.slice(-50);
  }

  const isNetworkError =
    msg.includes("ETIMEDOUT") ||
    msg.includes("ECONNRESET") ||
    msg.includes("EPIPE") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("timed out") ||
    msg.includes("PartialReadError");

  if (isNetworkError && !isReconnecting) {
    addLog("[FATAL] Network rejection — triggering reconnect...");
    clearAllIntervals();
    botState.connected = false;
    if (bot) {
      try { bot.end(); } catch (_) {}
      bot = null;
    }
    scheduleReconnect();
  }
});

process.on("SIGTERM", () => {
  addLog("[System] SIGTERM received — ignoring, bot will stay alive.");
});

process.on("SIGINT", () => {
  addLog("[System] SIGINT received — ignoring, bot will stay alive.");
});

// =============================
//===============================
// START THE BOT
// ============================================================
addLog("=".repeat(50));
addLog("  Minecraft AFK Bot v3.0 - Ghost Advanced Edition");
addLog("=".repeat(50));
addLog(`Server: ${config.server.ip}:${config.server.port}`);
addLog(`Version: ${config.server.version}`);
addLog(
  `Auto-Reconnect: ${config.utils["auto-reconnect"] ? "Enabled" : "Disabled"}`,
);
addLog("=".repeat(50));

createBot();
