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

// Advanced Enterprise Bot Tracking Dashboard
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${config.name} — Enterprise Command Center</title>
  <meta name="description" content="Enterprise-grade live telemetry and command dashboard for Minecraft AFK Sentinel">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <style>
    :root {
      --bg-base: #06080e;
      --bg-subtle: #0a0e17;
      --bg-card: rgba(14, 20, 32, 0.78);
      --bg-card-hover: rgba(20, 29, 47, 0.88);
      --bg-elevated: #131a29;
      --bg-input: #0b101b;

      --border-subtle: rgba(255, 255, 255, 0.07);
      --border-medium: rgba(255, 255, 255, 0.12);
      --border-accent: rgba(99, 102, 241, 0.35);

      --primary: #6366f1;
      --primary-light: #818cf8;
      --primary-glow: rgba(99, 102, 241, 0.25);
      
      --emerald: #10b981;
      --emerald-glow: rgba(16, 185, 129, 0.22);
      --emerald-border: rgba(16, 185, 129, 0.35);

      --amber: #f59e0b;
      --amber-glow: rgba(245, 158, 11, 0.22);

      --rose: #f43f5e;
      --rose-glow: rgba(244, 63, 94, 0.22);

      --cyan: #06b6d4;
      --cyan-glow: rgba(6, 182, 212, 0.22);

      --purple: #a855f7;
      --purple-glow: rgba(168, 85, 247, 0.22);

      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --text-highlight: #ffffff;

      --sidebar-w: 260px;
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 16px;
      --radius-xl: 20px;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-base);
      color: var(--text-main);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      overflow-x: hidden;
      font-size: 14px;
      line-height: 1.5;
      background-image: 
        radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.15), transparent),
        radial-gradient(ellipse 60% 40% at 90% 80%, rgba(6, 182, 212, 0.08), transparent);
      background-attachment: fixed;
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: var(--bg-base); }
    ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #334155; }

    /* Layout structure */
    .app-sidebar {
      width: var(--sidebar-w);
      background: var(--bg-subtle);
      border-right: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      min-height: 100vh;
      position: sticky;
      top: 0;
      z-index: 50;
      padding: 24px 16px;
      gap: 28px;
    }

    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 8px;
    }

    .brand-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, var(--primary), #4338ca);
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 18px;
      box-shadow: 0 0 16px var(--primary-glow);
    }

    .brand-meta {
      display: flex;
      flex-direction: column;
    }

    .brand-title {
      font-weight: 800;
      font-size: 15px;
      letter-spacing: 0.5px;
      color: var(--text-highlight);
      text-transform: uppercase;
    }

    .brand-subtitle {
      font-size: 11px;
      color: var(--primary-light);
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .sidebar-section-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: var(--text-dim);
      font-weight: 700;
      padding: 0 10px;
      margin-bottom: 8px;
    }

    .nav-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .nav-item a {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .nav-item a:hover {
      color: var(--text-highlight);
      background: rgba(255, 255, 255, 0.04);
    }

    .nav-item.active a {
      color: #fff;
      background: linear-gradient(90deg, rgba(99, 102, 241, 0.2), rgba(99, 102, 241, 0.05));
      border-left: 3px solid var(--primary);
      font-weight: 600;
    }

    .nav-item a i {
      font-size: 14px;
      width: 18px;
      text-align: center;
      color: var(--text-dim);
      transition: color 0.2s;
    }

    .nav-item.active a i, .nav-item a:hover i {
      color: var(--primary-light);
    }

    .sidebar-foot {
      margin-top: auto;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .server-label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-dim);
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .server-ip-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: var(--text-main);
      word-break: break-all;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Main Area */
    .app-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    /* Enterprise Header */
    .top-header {
      height: 64px;
      background: rgba(10, 14, 23, 0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
      position: sticky;
      top: 0;
      z-index: 40;
    }

    .breadcrumb-trail {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-muted);
    }

    .breadcrumb-trail .crumb-active {
      color: var(--text-highlight);
      font-weight: 600;
    }

    .top-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .clock-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 6px 12px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .header-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 14px;
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-weight: 600;
      border: 1px solid var(--border-subtle);
      background: rgba(255, 255, 255, 0.04);
      color: var(--text-main);
      cursor: pointer;
      transition: all 0.2s;
    }

    .header-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: var(--border-medium);
      transform: translateY(-1px);
    }

    .header-btn.btn-primary {
      background: var(--primary);
      border-color: var(--primary);
      color: #fff;
      box-shadow: 0 0 14px var(--primary-glow);
    }

    .header-btn.btn-primary:hover {
      background: var(--primary-light);
    }

    .header-btn.btn-danger {
      border-color: rgba(244, 63, 94, 0.3);
      color: #fca5a5;
    }

    .header-btn.btn-danger:hover {
      background: rgba(244, 63, 94, 0.15);
      border-color: var(--rose);
      color: #fff;
    }

    /* Content body */
    .dashboard-content {
      padding: 28px 32px 48px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      max-width: 1600px;
      margin: 0 auto;
      width: 100%;
    }

    /* Enterprise Hero Banner */
    .hero-banner {
      background: linear-gradient(135deg, rgba(14, 20, 35, 0.95), rgba(19, 28, 48, 0.9));
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 24px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
      box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(16px);
      transition: all 0.3s ease;
    }

    .hero-banner::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, var(--primary), var(--cyan), var(--emerald));
    }

    .hero-banner.is-online::before {
      background: linear-gradient(90deg, var(--emerald), var(--cyan));
    }

    .hero-banner.is-sleeping::before {
      background: linear-gradient(90deg, var(--primary), var(--purple));
    }

    .hero-banner.is-offline::before {
      background: linear-gradient(90deg, var(--rose), var(--amber));
    }

    .hero-left {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .hero-radar-badge {
      width: 58px;
      height: 58px;
      border-radius: var(--radius-md);
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid var(--emerald-border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      color: var(--emerald);
      position: relative;
      flex-shrink: 0;
      transition: all 0.3s;
    }

    .hero-radar-badge.sleeping {
      background: rgba(99, 102, 241, 0.12);
      border-color: rgba(99, 102, 241, 0.4);
      color: var(--primary-light);
    }

    .hero-radar-badge.offline {
      background: rgba(244, 63, 94, 0.1);
      border-color: rgba(244, 63, 94, 0.35);
      color: var(--rose);
    }

    .hero-meta-title-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 6px;
    }

    .hero-title {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.3px;
      color: #fff;
    }

    .status-pill {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 3px 10px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .status-pill.online {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .status-pill.sleeping {
      background: rgba(99, 102, 241, 0.15);
      color: #a5b4fc;
      border: 1px solid rgba(99, 102, 241, 0.3);
    }

    .status-pill.offline {
      background: rgba(244, 63, 94, 0.15);
      color: #fda4af;
      border: 1px solid rgba(244, 63, 94, 0.3);
    }

    .pulse-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 8px currentColor;
      animation: statusPulse 2s infinite ease-in-out;
    }

    @keyframes statusPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    .hero-subtext {
      color: var(--text-muted);
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .hero-tags {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .chip-tag {
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .chip-tag.ghost {
      background: rgba(168, 85, 247, 0.12);
      border-color: rgba(168, 85, 247, 0.3);
      color: #d8b4fe;
    }

    .chip-tag.bed {
      background: rgba(99, 102, 241, 0.12);
      border-color: rgba(99, 102, 241, 0.3);
      color: #c7d2fe;
    }

    .chip-tag.world {
      background: rgba(6, 182, 212, 0.12);
      border-color: rgba(6, 182, 212, 0.3);
      color: #67e8f9;
    }

    .hero-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
    }

    .server-target-pill {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-sm);
      padding: 6px 12px;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .server-target-pill:hover {
      border-color: var(--primary-light);
      background: #1c273c;
    }

    .server-target-pill i {
      color: var(--cyan);
    }

    .hero-synced {
      font-size: 11px;
      color: var(--text-dim);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* KPI Metric Cards Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .kpi-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      position: relative;
      overflow: hidden;
      backdrop-filter: blur(12px);
      transition: all 0.25s ease;
    }

    .kpi-card:hover {
      background: var(--bg-card-hover);
      border-color: var(--border-accent);
      transform: translateY(-2px);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }

    .kpi-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .kpi-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-dim);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .kpi-icon-bubble {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-sm);
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      color: var(--text-muted);
    }

    .kpi-icon-bubble.emerald { color: var(--emerald); background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.25); }
    .kpi-icon-bubble.amber   { color: var(--amber);   background: rgba(245, 158, 11, 0.1);  border-color: rgba(245, 158, 11, 0.25); }
    .kpi-icon-bubble.cyan    { color: var(--cyan);    background: rgba(6, 182, 212, 0.1);   border-color: rgba(6, 182, 212, 0.25); }
    .kpi-icon-bubble.primary { color: var(--primary-light); background: rgba(99, 102, 241, 0.1); border-color: rgba(99, 102, 241, 0.25); }

    .kpi-main-val {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }

    .kpi-big-num {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #fff;
      font-family: 'JetBrains Mono', monospace;
    }

    .kpi-denom {
      font-size: 13px;
      color: var(--text-dim);
      font-family: 'JetBrains Mono', monospace;
    }

    .kpi-sub-meta {
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* Segmented meter */
    .meter-bar {
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      overflow: hidden;
      position: relative;
    }

    .meter-fill {
      height: 100%;
      border-radius: 999px;
      transition: width 0.4s ease;
    }

    .fill-emerald { background: linear-gradient(90deg, #059669, #10b981); box-shadow: 0 0 10px var(--emerald-glow); }
    .fill-amber   { background: linear-gradient(90deg, #d97706, #f59e0b); box-shadow: 0 0 10px var(--amber-glow); }
    .fill-cyan    { background: linear-gradient(90deg, #0284c7, #06b6d4); box-shadow: 0 0 10px var(--cyan-glow); }
    .fill-primary { background: linear-gradient(90deg, #4f46e5, #6366f1); box-shadow: 0 0 10px var(--primary-glow); }

    /* Coordinate pills */
    .coords-cluster {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .coord-chip {
      flex: 1;
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .coord-axis {
      font-size: 9px;
      font-weight: 800;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .coord-axis.x { color: #f43f5e; }
    .coord-axis.y { color: #10b981; }
    .coord-axis.z { color: #38bdf8; }

    .coord-val {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 14px;
      color: #fff;
    }

    /* Core grid */
    .core-grid {
      display: grid;
      grid-template-columns: 1.3fr 1fr;
      gap: 20px;
    }

    .panel-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      backdrop-filter: blur(12px);
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 14px;
    }

    .panel-title-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .panel-title-icon {
      font-size: 16px;
      color: var(--primary-light);
    }

    .panel-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-highlight);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .panel-badge {
      font-size: 11px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-subtle);
      border-radius: 999px;
      padding: 2px 10px;
      color: var(--text-muted);
      font-weight: 600;
    }

    /* Time slider */
    .timeline-wrap {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .timeline-labels {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--text-dim);
      font-weight: 600;
    }

    .timeline-track {
      height: 14px;
      background: linear-gradient(90deg, 
        #0f172a 0%, 
        #ea580c 25%, 
        #38bdf8 45%, 
        #f59e0b 70%, 
        #312e81 85%, 
        #090d16 100%
      );
      border-radius: 999px;
      position: relative;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .timeline-cursor {
      position: absolute;
      top: -4px;
      width: 22px;
      height: 22px;
      background: #ffffff;
      border: 2px solid var(--primary);
      border-radius: 50%;
      transform: translateX(-50%);
      box-shadow: 0 0 12px rgba(255, 255, 255, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: var(--bg-base);
      transition: left 0.4s ease;
    }

    /* Stealth matrix */
    .subsystem-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .subsystem-card {
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: border-color 0.2s;
    }

    .subsystem-card:hover {
      border-color: var(--border-medium);
    }

    .subsystem-icon {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-sm);
      background: rgba(99, 102, 241, 0.1);
      border: 1px solid rgba(99, 102, 241, 0.2);
      color: var(--primary-light);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
    }

    .subsystem-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .subsystem-name {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .subsystem-state {
      font-size: 11px;
      font-weight: 600;
      color: var(--emerald);
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* Command Console Panel */
    .terminal-container {
      background: #05080f;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .terminal-screen {
      height: 140px;
      padding: 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #38bdf8;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: rgba(0, 0, 0, 0.5);
    }

    .term-line {
      display: flex;
      gap: 8px;
      word-break: break-all;
    }

    .term-prompt {
      color: var(--emerald);
      user-select: none;
      flex-shrink: 0;
    }

    .term-resp {
      color: #94a3b8;
    }

    .terminal-input-bar {
      display: flex;
      align-items: center;
      background: var(--bg-input);
      border-top: 1px solid var(--border-subtle);
      padding: 8px 12px;
      gap: 10px;
    }

    .term-input-prompt {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      color: var(--emerald);
      font-weight: 700;
    }

    .term-input-field {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #fff;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
    }

    .term-send-btn {
      background: var(--primary);
      border: none;
      border-radius: var(--radius-sm);
      color: #fff;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s;
    }

    .term-send-btn:hover {
      background: var(--primary-light);
    }

    .quick-chips-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .chip-btn {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 5px 10px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }

    .chip-btn:hover {
      background: rgba(99, 102, 241, 0.15);
      border-color: var(--primary);
      color: #fff;
    }

    /* Player radar list */
    .player-roster {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 240px;
      overflow-y: auto;
    }

    .player-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 10px 14px;
      transition: all 0.2s;
    }

    .player-row:hover {
      border-color: var(--border-medium);
      background: rgba(30, 41, 59, 0.5);
    }

    .player-meta {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .player-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: #fff;
      font-size: 13px;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }

    .player-name {
      font-weight: 600;
      font-size: 13px;
      color: var(--text-main);
    }

    .player-status-tag {
      font-size: 11px;
      color: var(--emerald);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .empty-state {
      padding: 24px;
      text-align: center;
      color: var(--text-dim);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }

    .empty-state i {
      font-size: 24px;
      color: var(--text-dim);
      margin-bottom: 4px;
    }

    /* Live Telemetry Stream */
    .stream-feed {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 220px;
      overflow-y: auto;
    }

    .stream-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 12px;
      padding: 8px 12px;
      background: var(--bg-elevated);
      border-radius: var(--radius-sm);
      border-left: 3px solid var(--primary);
    }

    .stream-item.sys { border-left-color: var(--cyan); }
    .stream-item.ghost { border-left-color: var(--purple); }
    .stream-item.bed { border-left-color: var(--primary); }
    .stream-item.warn { border-left-color: var(--amber); }

    .stream-time {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: var(--text-dim);
      flex-shrink: 0;
      margin-top: 1px;
    }

    .stream-msg {
      color: var(--text-muted);
      word-break: break-word;
    }

    /* Responsive */
    @media (max-width: 1200px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .core-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 900px) {
      .app-sidebar { display: none; }
      .top-header { padding: 0 16px; }
      .dashboard-content { padding: 16px; }
      .kpi-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

  <!-- Enterprise Sidebar Navigation -->
  <aside class="app-sidebar">
    <div class="brand-wrap">
      <div class="brand-icon">
        <i class="fa-solid fa-cube"></i>
      </div>
      <div class="brand-meta">
        <span class="brand-title">${config.name}</span>
        <span class="brand-subtitle">AEGIS OPS</span>
      </div>
    </div>

    <div>
      <div class="sidebar-section-title">Telemetry & Status</div>
      <ul class="nav-list">
        <li class="nav-item active"><a href="/"><i class="fa-solid fa-gauge-high"></i> Overview</a></li>
        <li class="nav-item"><a href="/tutorial"><i class="fa-solid fa-book-bookmark"></i> Setup Guide</a></li>
        <li class="nav-item"><a href="/logs"><i class="fa-solid fa-list-check"></i> System Logs</a></li>
      </ul>
    </div>

    <div>
      <div class="sidebar-section-title">Operations</div>
      <ul class="nav-list">
        <li class="nav-item"><a onclick="doSleep()"><i class="fa-solid fa-bed"></i> Trigger Sleep</a></li>
        <li class="nav-item"><a onclick="doStart()"><i class="fa-solid fa-play"></i> Start Bot</a></li>
        <li class="nav-item"><a onclick="doStop()"><i class="fa-solid fa-power-off"></i> Disconnect</a></li>
      </ul>
    </div>

    <div class="sidebar-foot">
      <div class="server-label-row">
        <span>Target Server</span>
        <i class="fa-solid fa-signal" style="color: var(--emerald);"></i>
      </div>
      <div class="server-ip-val">
        <i class="fa-solid fa-server" style="color: var(--primary-light);"></i>
        <span>${config.server.ip}:${config.server.port}</span>
      </div>
      <div class="server-label-row" style="margin-top: 4px;">
        <span>Bot Identity</span>
        <span style="color: var(--text-muted);">${config["bot-account"].username}</span>
      </div>
    </div>
  </aside>

  <!-- Main Content Wrapper -->
  <main class="app-main">
    
    <!-- Top Enterprise Header -->
    <header class="top-header">
      <div class="breadcrumb-trail">
        <span><i class="fa-solid fa-network-wired"></i> Infrastructure</span>
        <span>/</span>
        <span class="crumb-active">${config["bot-account"].username}</span>
        <span class="status-pill online" id="top-pill"><span class="pulse-dot"></span> LIVE</span>
      </div>

      <div class="top-actions">
        <div class="clock-badge">
          <i class="fa-regular fa-clock"></i>
          <span id="sys-clock">--:--:-- UTC</span>
        </div>
        <button class="header-btn" onclick="refresh()" title="Manual Refresh">
          <i class="fa-solid fa-arrows-rotate"></i> Sync
        </button>
        <button class="header-btn btn-primary" onclick="doSleep()">
          <i class="fa-solid fa-bed"></i> Force Sleep
        </button>
        <button class="header-btn btn-danger" onclick="doStop()">
          <i class="fa-solid fa-power-off"></i> Stop
        </button>
      </div>
    </header>

    <!-- Dashboard Body -->
    <div class="dashboard-content">

      <!-- Enterprise Hero Status Banner -->
      <section class="hero-banner is-online" id="hero-banner">
        <div class="hero-left">
          <div class="hero-radar-badge" id="hero-radar-badge">
            <i class="fa-solid fa-shield-halved" id="hero-status-icon"></i>
          </div>
          <div>
            <div class="hero-meta-title-row">
              <h1 class="hero-title" id="hero-title">Bot Operational</h1>
              <span class="status-pill online" id="hero-badge"><span class="pulse-dot"></span> CONNECTED</span>
            </div>
            <div class="hero-subtext">
              <span id="hero-subtitle">Connected to ${config.server.ip}:${config.server.port}</span>
            </div>
            <div class="hero-tags" id="hero-tags" style="margin-top: 10px;">
              <span class="chip-tag ghost"><i class="fa-solid fa-ghost"></i> Ghost Mode Active</span>
              <span class="chip-tag bed"><i class="fa-solid fa-bed"></i> Sleep Sentinel Armed</span>
              <span class="chip-tag world"><i class="fa-solid fa-globe"></i> Overworld</span>
            </div>
          </div>
        </div>

        <div class="hero-right">
          <div class="server-target-pill" onclick="copyIp()" title="Click to copy IP">
            <i class="fa-solid fa-terminal"></i>
            <span id="server-address-display">${config.server.ip}:${config.server.port}</span>
            <i class="fa-regular fa-copy" id="copy-icon"></i>
          </div>
          <div class="hero-synced">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 10px; color: var(--primary);"></i>
            <span id="last-sync-time">Polling every 3 seconds</span>
          </div>
        </div>
      </section>

      <!-- 4 KPI Metrics Cards -->
      <section class="kpi-grid">
        
        <!-- Card 1: Vital Signs (Health & Food) -->
        <div class="kpi-card">
          <div class="kpi-head">
            <span class="kpi-title"><i class="fa-solid fa-heart-pulse"></i> Vital Signs</span>
            <div class="kpi-icon-bubble emerald">
              <i class="fa-solid fa-heart"></i>
            </div>
          </div>
          <div class="kpi-main-val">
            <span class="kpi-big-num" id="val-health">20</span>
            <span class="kpi-denom">/ 20 HP</span>
          </div>
          <div class="meter-bar">
            <div class="meter-fill fill-emerald" id="meter-health" style="width: 100%;"></div>
          </div>
          <div class="kpi-sub-meta">
            <span id="status-health">Condition: Prime</span>
            <span id="val-food-sub"><i class="fa-solid fa-utensils"></i> 20 Food</span>
          </div>
        </div>

        <!-- Card 2: Spatial Telemetry / GPS -->
        <div class="kpi-card">
          <div class="kpi-head">
            <span class="kpi-title"><i class="fa-solid fa-compass"></i> Spatial GPS</span>
            <div class="kpi-icon-bubble cyan">
              <i class="fa-solid fa-location-dot"></i>
            </div>
          </div>
          <div class="coords-cluster">
            <div class="coord-chip">
              <span class="coord-axis x">X</span>
              <span class="coord-val" id="val-x">--</span>
            </div>
            <div class="coord-chip">
              <span class="coord-axis y">Y</span>
              <span class="coord-val" id="val-y">--</span>
            </div>
            <div class="coord-chip">
              <span class="coord-axis z">Z</span>
              <span class="coord-val" id="val-z">--</span>
            </div>
          </div>
          <div class="kpi-sub-meta">
            <span id="val-dimension"><i class="fa-solid fa-earth-americas"></i> Overworld</span>
            <span id="val-elevation"><i class="fa-solid fa-mountain"></i> Ground</span>
          </div>
        </div>

        <!-- Card 3: Celestial Chronometer -->
        <div class="kpi-card">
          <div class="kpi-head">
            <span class="kpi-title"><i class="fa-solid fa-sun"></i> Celestial Time</span>
            <div class="kpi-icon-bubble amber">
              <i class="fa-solid fa-clock"></i>
            </div>
          </div>
          <div class="kpi-main-val">
            <span class="kpi-big-num" id="val-game-time">12:00</span>
            <span class="kpi-denom" id="val-celestial-phase">Noon</span>
          </div>
          <div class="meter-bar">
            <div class="meter-fill fill-amber" id="meter-time" style="width: 50%;"></div>
          </div>
          <div class="kpi-sub-meta">
            <span id="val-ticks">Ticks: 6,000</span>
            <span id="val-sleep-eligibility"><i class="fa-solid fa-bed"></i> Daytime</span>
          </div>
        </div>

        <!-- Card 4: System Telemetry & Cluster Node -->
        <div class="kpi-card">
          <div class="kpi-head">
            <span class="kpi-title"><i class="fa-solid fa-microchip"></i> System Node</span>
            <div class="kpi-icon-bubble primary">
              <i class="fa-solid fa-server"></i>
            </div>
          </div>
          <div class="kpi-main-val">
            <span class="kpi-big-num" id="val-memory">--</span>
            <span class="kpi-denom">MB RAM</span>
          </div>
          <div class="meter-bar">
            <div class="meter-fill fill-primary" id="meter-memory" style="width: 20%;"></div>
          </div>
          <div class="kpi-sub-meta">
            <span id="val-uptime"><i class="fa-solid fa-stopwatch"></i> Uptime: --</span>
            <span id="val-reconnects"><i class="fa-solid fa-rotate"></i> 0 Drops</span>
          </div>
        </div>

      </section>

      <!-- Core Operations & Intelligence Grid -->
      <section class="core-grid">

        <!-- Left Column: Command Center & Subsystems -->
        <div style="display: flex; flex-direction: column; gap: 20px;">

          <!-- Panel: Interactive Command Console -->
          <div class="panel-card">
            <div class="panel-header">
              <div class="panel-title-wrap">
                <i class="fa-solid fa-terminal panel-title-icon"></i>
                <h2 class="panel-title">Operator Command Terminal</h2>
              </div>
              <span class="panel-badge"><i class="fa-solid fa-shield"></i> Authorized</span>
            </div>

            <div class="terminal-container">
              <div class="terminal-screen" id="term-screen">
                <div class="term-line">
                  <span class="term-prompt">aegis-ghost@system:~$</span>
                  <span class="term-resp">Aegis Ghost Command Interface online. Ready for in-game execution.</span>
                </div>
              </div>
              <form class="terminal-input-bar" id="term-form" onsubmit="handleCommandSubmit(event)">
                <span class="term-input-prompt">&gt;</span>
                <input type="text" class="term-input-field" id="cmd-input" placeholder="Type Minecraft command (e.g. /sleep, /time query daytime, /list)..." autocomplete="off" />
                <button type="submit" class="term-send-btn">
                  <i class="fa-solid fa-paper-plane"></i> Execute
                </button>
              </form>
            </div>

            <div class="quick-chips-row">
              <span style="font-size: 11px; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">Fast Presets:</span>
              <button class="chip-btn" onclick="sendQuickCommand('/sleep')"><i class="fa-solid fa-bed"></i> /sleep</button>
              <button class="chip-btn" onclick="sendQuickCommand('/time query daytime')"><i class="fa-solid fa-clock"></i> Query Time</button>
              <button class="chip-btn" onclick="sendQuickCommand('/list')"><i class="fa-solid fa-users"></i> /list</button>
              <button class="chip-btn" onclick="sendQuickCommand('/help')"><i class="fa-solid fa-circle-question"></i> /help</button>
            </div>
          </div>

          <!-- Panel: In-Game Day/Night Matrix -->
          <div class="panel-card">
            <div class="panel-header">
              <div class="panel-title-wrap">
                <i class="fa-solid fa-cloud-sun panel-title-icon"></i>
                <h2 class="panel-title">Celestial World Timeline</h2>
              </div>
              <span class="panel-badge" id="timeline-phase-badge">Phase: Daytime</span>
            </div>

            <div class="timeline-wrap">
              <div class="timeline-labels">
                <span><i class="fa-solid fa-sun" style="color: #f59e0b;"></i> Sunrise</span>
                <span><i class="fa-solid fa-sun" style="color: #38bdf8;"></i> Noon</span>
                <span><i class="fa-solid fa-cloud-sun" style="color: #ea580c;"></i> Sunset</span>
                <span><i class="fa-solid fa-moon" style="color: #818cf8;"></i> Midnight</span>
              </div>
              <div class="timeline-track">
                <div class="timeline-cursor" id="timeline-cursor" style="left: 25%;">
                  <i class="fa-solid fa-location-pin" style="font-size: 9px; color: var(--primary);"></i>
                </div>
              </div>
            </div>

            <!-- Subsystem grid -->
            <div class="subsystem-grid">
              <div class="subsystem-card">
                <div class="subsystem-icon">
                  <i class="fa-solid fa-user-secret"></i>
                </div>
                <div class="subsystem-info">
                  <span class="subsystem-name">Ghost Cloak Protocol</span>
                  <span class="subsystem-state" id="subsys-ghost"><i class="fa-solid fa-circle-check"></i> Armed & Active</span>
                </div>
              </div>

              <div class="subsystem-card">
                <div class="subsystem-icon">
                  <i class="fa-solid fa-bed"></i>
                </div>
                <div class="subsystem-info">
                  <span class="subsystem-name">Smart Bed Navigator</span>
                  <span class="subsystem-state" id="subsys-bed"><i class="fa-solid fa-circle-check"></i> Ready</span>
                </div>
              </div>

              <div class="subsystem-card">
                <div class="subsystem-icon">
                  <i class="fa-solid fa-person-running"></i>
                </div>
                <div class="subsystem-info">
                  <span class="subsystem-name">Anti-Mob Pathfinder</span>
                  <span class="subsystem-state"><i class="fa-solid fa-circle-check"></i> Vigilant</span>
                </div>
              </div>

              <div class="subsystem-card">
                <div class="subsystem-icon">
                  <i class="fa-solid fa-utensils"></i>
                </div>
                <div class="subsystem-info">
                  <span class="subsystem-name">Silent Auto-Satiate</span>
                  <span class="subsystem-state" id="subsys-food"><i class="fa-solid fa-circle-check"></i> Monitored</span>
                </div>
              </div>
            </div>

          </div>

        </div>

        <!-- Right Column: Player Surveillance & Live Telemetry Stream -->
        <div style="display: flex; flex-direction: column; gap: 20px;">

          <!-- Panel: Player Radar -->
          <div class="panel-card">
            <div class="panel-header">
              <div class="panel-title-wrap">
                <i class="fa-solid fa-users-viewfinder panel-title-icon"></i>
                <h2 class="panel-title">Active Server Players</h2>
              </div>
              <span class="panel-badge" id="player-count-badge">0 Online</span>
            </div>

            <div class="player-roster" id="player-roster">
              <div class="empty-state">
                <i class="fa-solid fa-user-astronaut"></i>
                <span>No other players currently detected in realm</span>
              </div>
            </div>
          </div>

          <!-- Panel: Live Telemetry Event Stream -->
          <div class="panel-card">
            <div class="panel-header">
              <div class="panel-title-wrap">
                <i class="fa-solid fa-wave-square panel-title-icon"></i>
                <h2 class="panel-title">Live Telemetry Audit Stream</h2>
              </div>
              <span class="panel-badge"><i class="fa-solid fa-satellite-dish"></i> Real-time</span>
            </div>

            <div class="stream-feed" id="stream-feed">
              <div class="stream-item sys">
                <span class="stream-time">INIT</span>
                <span class="stream-msg">Aegis Ghost Telemetry Engine initialized. Stream synchronized.</span>
              </div>
            </div>
          </div>

          <!-- Panel: Node Runtime Specifications -->
          <div class="panel-card">
            <div class="panel-header">
              <div class="panel-title-wrap">
                <i class="fa-solid fa-sliders panel-title-icon"></i>
                <h2 class="panel-title">Cluster Parameters</h2>
              </div>
              <span class="panel-badge">Config v3.0</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12px;">
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">
                <span style="color: var(--text-muted);"><i class="fa-solid fa-gamepad"></i> MC Protocol Version</span>
                <span style="font-family: 'JetBrains Mono', monospace; font-weight: 600;" id="cfg-version">Auto-detect</span>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">
                <span style="color: var(--text-muted);"><i class="fa-solid fa-circle-nodes"></i> Max Reconnect Timeout</span>
                <span style="font-family: 'JetBrains Mono', monospace; font-weight: 600;">120s</span>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">
                <span style="color: var(--text-muted);"><i class="fa-solid fa-shield"></i> Stealth Reapplication</span>
                <span style="color: var(--emerald); font-weight: 600;">Every 60s</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);"><i class="fa-solid fa-user-lock"></i> Auto-Auth Mode</span>
                <span style="color: var(--emerald); font-weight: 600;">Enabled (Encrypted)</span>
              </div>
            </div>

          </div>

        </div>

      </section>

    </div>
  </main>

  <!-- Interactive JavaScript Engine -->
  <script>
    let lastState = null;
    let eventLog = [];

    function updateClock() {
      const d = new Date();
      const el = document.getElementById('sys-clock');
      if (el) el.textContent = d.toTimeString().split(' ')[0] + ' Local';
    }
    setInterval(updateClock, 1000);
    updateClock();

    function fmtUptime(sec) {
      if (!sec || sec < 0) return '0s';
      const d = Math.floor(sec / 86400);
      const h = Math.floor((sec % 86400) / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      if (d > 0) return d + 'd ' + h + 'h';
      if (h > 0) return h + 'h ' + m + 'm';
      if (m > 0) return m + 'm ' + s + 's';
      return s + 's';
    }

    function fmtGameTime(ticks) {
      if (ticks === null || ticks === undefined) return '--:--';
      const norm = ((ticks % 24000) + 24000) % 24000;
      const totalHours = (norm / 1000 + 6) % 24;
      const hours = Math.floor(totalHours);
      const minutes = Math.floor((totalHours - hours) * 60);
      return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
    }

    function getCelestialPhase(ticks) {
      if (ticks === null || ticks === undefined) return 'Unknown';
      const t = ((ticks % 24000) + 24000) % 24000;
      if (t < 1000)  return 'Dawn';
      if (t < 6000)  return 'Morning';
      if (t < 11500) return 'Noon';
      if (t < 13000) return 'Sunset';
      if (t < 18000) return 'Dusk / Night';
      if (t < 23000) return 'Midnight';
      return 'Pre-Dawn';
    }

    function addAuditLog(category, msg) {
      const timeStr = new Date().toTimeString().split(' ')[0];
      const feed = document.getElementById('stream-feed');
      if (!feed) return;
      const item = document.createElement('div');
      item.className = 'stream-item ' + category;
      item.innerHTML = '<span class="stream-time">' + timeStr + '</span><span class="stream-msg">' + msg + '</span>';
      feed.insertBefore(item, feed.firstChild);
      while (feed.children.length > 25) {
        feed.removeChild(feed.lastChild);
      }
    }

    function addTerminalLine(prompt, resp, isErr) {
      const screen = document.getElementById('term-screen');
      if (!screen) return;
      const row = document.createElement('div');
      row.className = 'term-line';
      row.innerHTML = '<span class="term-prompt">' + prompt + '</span><span class="term-resp" style="' + (isErr ? 'color: var(--rose);' : '') + '">' + resp + '</span>';
      screen.appendChild(row);
      screen.scrollTop = screen.scrollHeight;
    }

    async function sendQuickCommand(cmd) {
      const input = document.getElementById('cmd-input');
      if (input) input.value = cmd;
      await executeCommand(cmd);
    }

    async function handleCommandSubmit(e) {
      e.preventDefault();
      const input = document.getElementById('cmd-input');
      if (!input || !input.value.trim()) return;
      const cmd = input.value.trim();
      input.value = '';
      await executeCommand(cmd);
    }

    async function executeCommand(cmd) {
      addTerminalLine('aegis-ghost@cmd:~$ ' + cmd, 'Executing in-game...');
      try {
        const r = await fetch('/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cmd })
        });
        const d = await r.json();
        addTerminalLine('&lt;bot&gt;', d.msg || 'Command dispatched successfully', !d.success);
        addAuditLog('sys', 'Command executed: ' + cmd);
        refresh();
      } catch (err) {
        addTerminalLine('&lt;error&gt;', 'Network communication failed', true);
      }
    }

    function copyIp() {
      const text = document.getElementById('server-address-display').innerText;
      navigator.clipboard.writeText(text).then(() => {
        const icon = document.getElementById('copy-icon');
        if (icon) {
          icon.className = 'fa-solid fa-check';
          setTimeout(() => { icon.className = 'fa-regular fa-copy'; }, 2000);
        }
      });
    }

    async function refresh() {
      try {
        const r = await fetch('/health');
        const d = await r.json();
        const online = d.status === 'connected';
        const sleeping = Boolean(d.isSleeping);
        const goingToBed = Boolean(d.isGoingToBed);

        // Track changes for audit stream
        if (lastState && lastState.online !== online) {
          addAuditLog(online ? 'sys' : 'warn', online ? 'Connection established with server realm.' : 'Connection severed. Reconnection algorithm activated.');
        }
        if (lastState && lastState.sleeping !== sleeping) {
          addAuditLog('bed', sleeping ? 'Bot entered sanctuary bed. Resting peacefully.' : 'Bot awakened from bed.');
        }
        if (lastState && lastState.playersOnline !== d.playersOnline) {
          addAuditLog('ghost', 'Player count updated: ' + d.playersOnline + ' present.');
        }
        lastState = { online: online, sleeping: sleeping, playersOnline: d.playersOnline };

        // Hero Banner Styling
        const heroBanner = document.getElementById('hero-banner');
        const heroBadge  = document.getElementById('hero-badge');
        const heroTitle  = document.getElementById('hero-title');
        const heroSub    = document.getElementById('hero-subtitle');
        const heroRadar  = document.getElementById('hero-radar-badge');
        const heroIcon   = document.getElementById('hero-status-icon');
        const topPill    = document.getElementById('top-pill');

        if (sleeping) {
          heroBanner.className = 'hero-banner is-sleeping';
          heroRadar.className = 'hero-radar-badge sleeping';
          heroIcon.className = 'fa-solid fa-bed';
          heroBadge.className = 'status-pill sleeping';
          heroBadge.innerHTML = '<span class="pulse-dot"></span> SLEEPING';
          heroTitle.textContent = 'Resting in Bed';
          heroSub.textContent = 'Skip-night sentinel protocol active in sanctuary';
          topPill.className = 'status-pill sleeping';
          topPill.innerHTML = '<span class="pulse-dot"></span> SLEEP';
        } else if (goingToBed) {
          heroBanner.className = 'hero-banner is-sleeping';
          heroRadar.className = 'hero-radar-badge sleeping';
          heroIcon.className = 'fa-solid fa-person-walking-arrow-right';
          heroBadge.className = 'status-pill sleeping';
          heroBadge.innerHTML = '<span class="pulse-dot"></span> MOVING TO BED';
          heroTitle.textContent = 'Navigating to Bed...';
          heroSub.textContent = 'Night skip detected — seeking nearest registered mattress';
          topPill.className = 'status-pill sleeping';
          topPill.innerHTML = '<span class="pulse-dot"></span> NAVIGATING';
        } else if (online) {
          heroBanner.className = 'hero-banner is-online';
          heroRadar.className = 'hero-radar-badge';
          heroIcon.className = 'fa-solid fa-shield-halved';
          heroBadge.className = 'status-pill online';
          heroBadge.innerHTML = '<span class="pulse-dot"></span> OPERATIONAL';
          heroTitle.textContent = (d.username || 'GhostAegis') + ' Operational';
          heroSub.textContent = 'Connected to ' + d.serverIp + (d.version ? ' (' + d.version + ')' : '');
          topPill.className = 'status-pill online';
          topPill.innerHTML = '<span class="pulse-dot"></span> ONLINE';
        } else {
          heroBanner.className = 'hero-banner is-offline';
          heroRadar.className = 'hero-radar-badge offline';
          heroIcon.className = 'fa-solid fa-triangle-exclamation';
          heroBadge.className = 'status-pill offline';
          heroBadge.innerHTML = '<span class="pulse-dot"></span> DISCONNECTED';
          heroTitle.textContent = 'Standby / Reconnecting';
          heroSub.textContent = 'Attempt #' + (d.reconnectAttempts || 0) + ' — Awaiting server availability';
          topPill.className = 'status-pill offline';
          topPill.innerHTML = '<span class="pulse-dot"></span> OFFLINE';
        }

        // Tags
        const tagsWrap = document.getElementById('hero-tags');
        if (tagsWrap) {
          const tags = [];
          if (online && d.stealth) tags.push('<span class="chip-tag ghost"><i class="fa-solid fa-ghost"></i> Ghost Cloak Active</span>');
          if (sleeping) tags.push('<span class="chip-tag bed"><i class="fa-solid fa-bed"></i> Resting in Bed</span>');
          if (online && !sleeping) tags.push('<span class="chip-tag" style="color: var(--emerald); border-color: rgba(16,185,129,0.3);"><i class="fa-solid fa-circle-check"></i> AFK Loop Healthy</span>');
          if (!online) tags.push('<span class="chip-tag" style="color: var(--rose); border-color: rgba(244,63,94,0.3);"><i class="fa-solid fa-rotate"></i> Auto-Reconnect Armed</span>');
          if (d.dimension) tags.push('<span class="chip-tag world"><i class="fa-solid fa-earth-americas"></i> ' + d.dimension + '</span>');
          tagsWrap.innerHTML = tags.join('');
        }

        // Vitals
        const hp = Math.round(d.health || 0);
        document.getElementById('val-health').textContent = hp;
        const hpPct = Math.max(0, Math.min(100, (hp / 20) * 100));
        document.getElementById('meter-health').style.width = hpPct + '%';
        const hpLabel = document.getElementById('status-health');
        if (hp <= 6) {
          hpLabel.textContent = 'Critical Status';
          hpLabel.style.color = 'var(--rose)';
        } else if (hp <= 12) {
          hpLabel.textContent = 'Degraded Condition';
          hpLabel.style.color = 'var(--amber)';
        } else {
          hpLabel.textContent = 'Condition: Prime';
          hpLabel.style.color = 'var(--emerald)';
        }

        const food = Math.round(d.food || 0);
        document.getElementById('val-food-sub').innerHTML = '<i class="fa-solid fa-utensils"></i> ' + food + ' Food';

        // Coordinates
        if (d.coords) {
          document.getElementById('val-x').textContent = Math.floor(d.coords.x);
          document.getElementById('val-y').textContent = Math.floor(d.coords.y);
          document.getElementById('val-z').textContent = Math.floor(d.coords.z);
        } else {
          document.getElementById('val-x').textContent = '--';
          document.getElementById('val-y').textContent = '--';
          document.getElementById('val-z').textContent = '--';
        }
        document.getElementById('val-dimension').innerHTML = '<i class="fa-solid fa-earth-americas"></i> ' + (d.dimension || 'Overworld');
        if (d.coords && d.coords.y !== undefined) {
          document.getElementById('val-elevation').innerHTML = '<i class="fa-solid fa-mountain"></i> Y=' + Math.floor(d.coords.y);
        }

        // Celestial Time
        const gt = d.gameTime !== undefined && d.gameTime !== null ? d.gameTime : 6000;
        document.getElementById('val-game-time').textContent = fmtGameTime(gt);
        const phase = getCelestialPhase(gt);
        document.getElementById('val-celestial-phase').textContent = phase;
        document.getElementById('timeline-phase-badge').textContent = 'Phase: ' + phase;

        const timeProgress = ((gt % 24000) / 24000) * 100;
        document.getElementById('meter-time').style.width = timeProgress + '%';
        document.getElementById('timeline-cursor').style.left = Math.min(98, Math.max(2, timeProgress)) + '%';
        document.getElementById('val-ticks').textContent = 'Ticks: ' + (gt % 24000).toLocaleString();

        const canSleep = (gt % 24000) >= 12541 && (gt % 24000) <= 23458;
        const sleepBadge = document.getElementById('val-sleep-eligibility');
        if (sleepBadge) {
          sleepBadge.innerHTML = canSleep 
            ? '<i class="fa-solid fa-bed" style="color: var(--primary-light);"></i> Sleep Window Open'
            : '<i class="fa-solid fa-sun" style="color: var(--amber);"></i> Daytime';
        }

        // Memory & Uptime
        document.getElementById('val-memory').textContent = d.memoryUsage || '--';
        const memPct = Math.min(100, ((d.memoryUsage || 0) / 256) * 100);
        document.getElementById('meter-memory').style.width = memPct + '%';
        document.getElementById('val-uptime').innerHTML = '<i class="fa-solid fa-stopwatch"></i> Uptime: ' + fmtUptime(d.uptime);
        document.getElementById('val-reconnects').innerHTML = '<i class="fa-solid fa-rotate"></i> ' + (d.reconnectAttempts || 0) + ' Drops';

        // Players roster
        const pBadge = document.getElementById('player-count-badge');
        pBadge.textContent = (d.playersOnline || 0) + ' Online';
        const roster = document.getElementById('player-roster');
        if (d.players && d.players.length > 0) {
          roster.innerHTML = d.players.map(p => {
            const initial = (p || '?')[0].toUpperCase();
            return '<div class="player-row">' +
              '<div class="player-meta">' +
                '<div class="player-avatar">' + initial + '</div>' +
                '<span class="player-name">' + p + '</span>' +
              '</div>' +
              '<span class="player-status-tag"><i class="fa-solid fa-circle-dot"></i> In Vicinity</span>' +
            '</div>';
          }).join('');
        } else {
          roster.innerHTML = '<div class="empty-state"><i class="fa-solid fa-user-astronaut"></i><span>No other players currently detected in realm</span></div>';
        }

        // Subsystems
        document.getElementById('subsys-ghost').innerHTML = d.stealth 
          ? '<i class="fa-solid fa-circle-check"></i> Armed & Active' 
          : '<i class="fa-solid fa-circle-pause" style="color: var(--amber);"></i> Standby';

        document.getElementById('subsys-bed').innerHTML = sleeping 
          ? '<i class="fa-solid fa-bed" style="color: var(--primary-light);"></i> Resting' 
          : '<i class="fa-solid fa-circle-check"></i> Vigilant';

        if (d.version) {
          document.getElementById('cfg-version').textContent = d.version;
        }

        document.getElementById('last-sync-time').textContent = 'Synced: ' + new Date().toLocaleTimeString();

      } catch (err) {
        document.getElementById('hero-title').textContent = 'Dashboard Disconnected';
      }
    }

    async function doStart() {
      try {
        const r = await fetch('/start', { method: 'POST' });
        const d = await r.json();
        addTerminalLine('&lt;system&gt;', d.msg || 'Start sequence invoked');
        refresh();
      } catch (e) {
        alert('Failed to send start signal');
      }
    }

    async function doStop() {
      if (!confirm('Are you sure you want to stop/disconnect the AFK bot?')) return;
      try {
        const r = await fetch('/stop', { method: 'POST' });
        const d = await r.json();
        addTerminalLine('&lt;system&gt;', d.msg || 'Disconnection invoked');
        refresh();
      } catch (e) {
        alert('Failed to send stop signal');
      }
    }

    async function doSleep() {
      await executeCommand('/sleep');
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
