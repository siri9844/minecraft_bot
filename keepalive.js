/**
 * Render 24/7 Keep-Alive Script
 *
 * Keeps your Render Web Service awake 24/7 by pinging it every 3 minutes
 * (Render free tier spins down after 15 minutes of inactivity).
 *
 * Usage:
 *   node keepalive.js https://your-service-name.onrender.com
 *   OR set "render-url" inside settings.json
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

// 1. Resolve Target URL
let targetUrl = process.argv[2] || process.env.RENDER_URL || process.env.RENDER_EXTERNAL_URL;

if (!targetUrl) {
  try {
    const configPath = path.join(__dirname, "settings.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      targetUrl = config["render-url"];
    }
  } catch (e) {}
}

if (!targetUrl || targetUrl.trim() === "") {
  console.error("============================================================");
  console.error("❌ ERROR: No Render URL specified!");
  console.error("------------------------------------------------------------");
  console.error("Please provide your Render URL in one of these ways:");
  console.error("  1. In settings.json: \"render-url\": \"https://your-app.onrender.com\"");
  console.error("  2. Command line:     node keepalive.js https://your-app.onrender.com");
  console.error("  3. Environment:      export RENDER_URL=https://your-app.onrender.com");
  console.error("============================================================");
  process.exit(1);
}

targetUrl = targetUrl.trim().replace(/\/$/, "");
if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
  targetUrl = "https://" + targetUrl;
}

const PING_INTERVAL = 3 * 60 * 1000; // 3 minutes
const pingEndpoints = ["/ping", "/health"];
let currentEndpointIndex = 0;
let pingCount = 0;

function ping() {
  const endpoint = pingEndpoints[currentEndpointIndex];
  currentEndpointIndex = (currentEndpointIndex + 1) % pingEndpoints.length;
  const fullUrl = `${targetUrl}${endpoint}`;
  const startTime = Date.now();
  const protocol = fullUrl.startsWith("https") ? https : http;

  const req = protocol.get(fullUrl, { timeout: 10000 }, (res) => {
    const duration = Date.now() - startTime;
    pingCount++;
    const time = new Date().toLocaleTimeString();

    if (res.statusCode >= 200 && res.statusCode < 400) {
      console.log(`[${time}] ✅ [Ping #${pingCount}] Awake! ${fullUrl} -> ${res.statusCode} (${duration}ms)`);
    } else {
      console.warn(`[${time}] ⚠️ [Ping #${pingCount}] Unexpected status: ${res.statusCode} from ${fullUrl}`);
    }

    res.resume(); // Consume response data to free memory
  });

  req.on("timeout", () => {
    req.destroy();
    const time = new Date().toLocaleTimeString();
    console.error(`[${time}] ⏳ [Ping #${pingCount}] Request timed out after 10s (Service might be waking up...)`);
  });

  req.on("error", (err) => {
    const time = new Date().toLocaleTimeString();
    console.error(`[${time}] ❌ [Ping #${pingCount}] Ping error: ${err.message}`);
  });
}

console.log("============================================================");
console.log("🚀 Render 24/7 Keep-Alive Started");
console.log(`🎯 Target:   ${targetUrl}`);
console.log(`⏱️  Interval: Every 3 minutes`);
console.log("============================================================");

// Run initial ping immediately
ping();

// Run every 3 minutes
setInterval(ping, PING_INTERVAL);
