const fs = require('fs');
const path = require('path');

const potentialEnvPaths = [
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../../../.env'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '../.env'),
  '/home/robi/Documents/coding/hacktoberfest/week1/.env'
];

for (const envPath of potentialEnvPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    break;
  }
}
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const os = require('os');
const { exec } = require('child_process');
const ProcessTracker = require('./tracker');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3847;
const API_KEY = process.env.GOOGLE_AI_KEY || process.env.GEMINI_API_KEY;
// EXCLUSIVELY Google Gemma 4 Open-Weight Vision Model
const GEMMA_MODEL = 'gemma-4-26b-a4b-it';

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Application State
let appState = {
  isTrackingActive: false, // Default: paused! User has full control to start
  connectionMode: 'usb', // 'usb' (127.0.0.1 via ADB) or 'wifi' (Local LAN)
  isLocked: false,
  secondsElapsed: 0,
  targetDurationSeconds: 1500, // default 25 min
  selectedApps: [], // Empty by default: user chooses which apps to monitor
  customApps: [],
  currentActiveApps: [],
  isMobileAppConnected: false, // Explicit: whether mobile app is actually connected & communicating
  lastMobileSeen: null,
  mobileDeviceModel: null,
  lastUnlockPhoto: null,
  lastGemmaReview: null,
  grassStreak: 1,
  // Dual-Gated Unlock State
  mandatoryBreakSeconds: 300, // 5 minutes mandatory break
  breakSecondsRemaining: 0,
  isNatureVerified: false,
  frozenAppCount: 0
};

// Singleton ProcessTracker for application freezing/thawing
const processTracker = new ProcessTracker(appState.selectedApps);

// Cooldown interval reference
let breakInterval = null;

// Get Local Network IP for mobile phone pairing
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// Broadcast message to all connected clients (Desktop UI & Mobile)
function broadcast(type, payload) {
  const msg = JSON.stringify({ type, payload, timestamp: Date.now() });
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(msg);
    }
  });
}

// Send Android ADB Push Notification / broadcast to connected device
function triggerAdbNotification() {
  const cmd = `adb shell am broadcast -a com.grasslock.ALERT --es title "Time to Touch Grass!" --es message "Desktop is locked. Grab your phone and take a 5-minute break outside!"`;
  exec(cmd, (err) => {
    if (err) {
      console.log('ADB broadcast note (USB device not reacting or app not active):', err.message);
    } else {
      console.log('📡 ADB alert broadcast sent to connected Android device!');
    }
  });
}

// Trigger Lockout with Real Process Freezing & 5-Minute Cooldown
async function triggerLockout() {
  if (appState.isLocked) return;
  appState.isLocked = true;
  appState.isTrackingActive = false; // Freeze and halt tracking when locked
  appState.isNatureVerified = false;
  appState.breakSecondsRemaining = appState.mandatoryBreakSeconds; // 300s (5 minutes)

  // 1. Discover exact process PIDs of monitored coding apps
  processTracker.setTargetApps(appState.selectedApps);
  const targetPids = await processTracker.getTargetAppPids(appState.selectedApps);

  // 2. Real Process Freezing: Halt active coding apps via SIGSTOP
  const frozen = await processTracker.freezeProcesses(targetPids);
  appState.frozenAppCount = frozen.length;

  console.log(`🚨 Lockout Triggered: ${frozen.length} target processes frozen via SIGSTOP. Mandatory 5-minute rest period started.`);

  broadcast('LOCKOUT_TRIGGERED', {
    message: 'Time to Touch Grass! Take a mandatory 5-minute break and capture outdoor nature.',
    serverIp: getLocalIp(),
    port: PORT,
    breakSecondsRemaining: appState.breakSecondsRemaining,
    mandatoryBreakSeconds: appState.mandatoryBreakSeconds,
    isNatureVerified: appState.isNatureVerified,
    frozenAppCount: appState.frozenAppCount
  });
  triggerAdbNotification();

  // 3. Start 1-second interval to tick down the 5-minute cooldown
  if (breakInterval) clearInterval(breakInterval);
  breakInterval = setInterval(() => {
    if (!appState.isLocked) {
      clearInterval(breakInterval);
      breakInterval = null;
      return;
    }

    if (appState.breakSecondsRemaining > 0) {
      appState.breakSecondsRemaining -= 1;
      broadcast('BREAK_TICK', {
        breakSecondsRemaining: appState.breakSecondsRemaining,
        mandatoryBreakSeconds: appState.mandatoryBreakSeconds,
        isNatureVerified: appState.isNatureVerified
      });
    }

    // Dual-gated unlock check: If 5-minute cooldown is finished AND outdoor nature was verified
    if (appState.breakSecondsRemaining <= 0 && appState.isNatureVerified) {
      clearInterval(breakInterval);
      breakInterval = null;
      console.log('✨ Both conditions satisfied: 5-minute rest completed and Gemma verified outdoor nature! Thawing screen...');
      unlockDesktop(appState.lastGemmaReview || {
        naturalistComment: '5-minute outdoor rest completed and nature verified by Google Gemma AI!',
        gitExcuse: 'refactor(wellness): completed 5-min outdoor break, screen thawed'
      });
    }
  }, 1000);
}

// Remote Unlock with Real Process Thawing
function unlockDesktop(reviewData) {
  if (breakInterval) {
    clearInterval(breakInterval);
    breakInterval = null;
  }

  // Real Process Thawing: Resume all frozen processes via SIGCONT
  processTracker.resumeProcesses();

  appState.isLocked = false;
  appState.isTrackingActive = false; // CRITICAL: Pause timer so it does NOT immediately resume running!
  appState.secondsElapsed = 0;
  appState.breakSecondsRemaining = 0;
  appState.isNatureVerified = false;
  appState.frozenAppCount = 0;
  appState.lastGemmaReview = reviewData;
  appState.grassStreak += 1;

  console.log('✨ Desktop UNLOCKED & THAWED: All processes resumed via SIGCONT! Session reset to 00:00 standby.');
  broadcast('DESKTOP_UNLOCKED', {
    ...reviewData,
    appState
  });
  broadcast('SESSION_STATE', appState);
}

// Robust JSON extractor for Gemma output (handles thoughts, markdown, and code fences)
function extractJsonObject(text) {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

  // 1. Try direct parse
  try {
    const direct = JSON.parse(cleaned);
    if (direct && typeof direct.verified !== 'undefined') return direct;
  } catch (_) {}

  // 2. Search backwards from last '}' to find balanced '{...}'
  const lastClose = cleaned.lastIndexOf('}');
  if (lastClose !== -1) {
    let depth = 0;
    for (let i = lastClose; i >= 0; i--) {
      if (cleaned[i] === '}') depth++;
      else if (cleaned[i] === '{') {
        depth--;
        if (depth === 0) {
          try {
            const candidate = JSON.parse(cleaned.substring(i, lastClose + 1));
            if (candidate && typeof candidate.verified !== 'undefined') {
              return candidate;
            }
          } catch (_) {}
        }
      }
    }
  }

  // 3. Regex match any object containing "verified"
  const matches = [...cleaned.matchAll(/\{[^{}]*"verified"[^{}]*\}/g)];
  for (const m of matches) {
    try {
      const obj = JSON.parse(m[0]);
      if (typeof obj.verified !== 'undefined') return obj;
    } catch (_) {}
  }

  return null;
}

// Verify Photo with Google Gemma 4 Open Model (Hacktoberfest Week 1 Core AI)
async function verifyPhotoWithGemma(imageDataBase64, userNotes = '') {
  if (!API_KEY) {
    throw new Error('GOOGLE_AI_KEY missing in .env');
  }

  const promptText = `You are the GrassLock Field AI Judge for Hacktoberfest Week 1 'Touch Grass'.
A developer's computer was locked because they worked for too long.
They took this photo with their smartphone camera to prove they stepped away from their computer desk and went outside.
Analyze this photo carefully.
Does this photo show the outside world (such as outdoor nature, trees, plants, foliage, grass, sky, sunlight, garden, flowers, outdoor street, neighborhood, buildings seen from outside, patio, balcony)?
Or is this an indoor computer desk setup, monitor screen, laptop, keyboard, dark blur, wall, or indoor room?

Verification Guidelines:
- verified: true if the photo shows an authentic outdoor scene, outdoor sunlight, sky, street, nature, vegetation, or outdoor neighborhood, proving the developer stepped away from their workstation.
- verified: false ONLY if the photo clearly shows an indoor computer desk, monitor, laptop, keyboard, dark blurry indoor shot, or ceiling.

CRITICAL INSTRUCTION:
Return ONLY a valid JSON object. Do not output markdown code blocks, preamble, or analysis.
{
  "verified": true or false,
  "confidence": "High" or "Medium" or "Low",
  "detectedElements": ["List of detected elements"],
  "naturalistComment": "Short 1-2 sentence Indonesian observation",
  "gitExcuse": "If verified: a developer-themed Git commit message. If not verified: null",
  "grassPointsAwarded": 25 or 0
}`;

  // EXCLUSIVELY Google Gemma 4 (gemma-4-26b-a4b-it)
  const model = GEMMA_MODEL;
  let lastErr = null;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
    
    const parts = [{ text: promptText }];
    if (imageDataBase64) {
      // clean data url prefix if present
      const base64Data = imageDataBase64.replace(/^data:image\/\w+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data
        }
      });
    }

    const controller = new AbortController();
    // 32-second timeout to comfortably accommodate Gemma 4 multimodal reasoning
    const fetchTimeout = setTimeout(() => controller.abort(), 32000);

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048
          }
        })
      });
    } finally {
      clearTimeout(fetchTimeout);
    }

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Google Gemma AI API Error (${response.status}): ${errBody}`);
    }

    const resJson = await response.json();
    const allParts = resJson.candidates?.[0]?.content?.parts || [];
    
    let parsedData = null;
    let nonThoughtText = '';
    
    for (const part of allParts) {
      const text = part.text || '';
      if (!part.thought && !nonThoughtText) {
        nonThoughtText = text;
      }
      const candidate = extractJsonObject(text);
      if (candidate && typeof candidate.verified !== 'undefined') {
        parsedData = candidate;
        break;
      }
    }

    const rawText = nonThoughtText || allParts[allParts.length - 1]?.text || '';

    // RESCUE LOGIC: If JSON was cut off or malformed, but explicitly contains "verified": true
    if (!parsedData) {
      const hasExplicitTrue = /"verified"\s*:\s*true/i.test(rawText) || /verified\s*:\s*true/i.test(rawText);
      const hasExplicitFalse = /"verified"\s*:\s*false/i.test(rawText) || /verified\s*:\s*false/i.test(rawText);

      if (hasExplicitTrue) {
        console.log('💡 Rescued Gemma verification: Model returned "verified": true despite partial formatting.');
        parsedData = {
          verified: true,
          confidence: "High",
          detectedElements: ["Outdoor nature / sky / sunlight"],
          naturalistComment: "Bukti alam luar ruangan dan suasana luar berhasil diverifikasi oleh Google Gemma AI!",
          gitExcuse: "refactor(nature): stepped outside, touched grass, screen thawed",
          grassPointsAwarded: 25
        };
      } else if (hasExplicitFalse) {
        parsedData = {
          verified: false,
          confidence: "High",
          detectedElements: ["Not outdoor nature"],
          naturalistComment: "Photo was not identified as authentic outdoor nature by Google Gemma AI. Please point your camera at outdoor plants, trees, foliage, or open sky.",
          gitExcuse: null,
          grassPointsAwarded: 0
        };
      } else {
        // Fallback keyword inference
        const textLower = rawText.toLowerCase();
        const hasNatureKeyword = textLower.includes('grass') || textLower.includes('tree') || textLower.includes('plant') || textLower.includes('foliage') || textLower.includes('leaf') || textLower.includes('outdoor') || textLower.includes('sky');
        const hasIndoorKeyword = textLower.includes('indoor') || textLower.includes('desk') || textLower.includes('screen') || textLower.includes('keyboard') || textLower.includes('room');
        const inferredVerified = hasNatureKeyword && !hasIndoorKeyword;

        parsedData = {
          verified: inferredVerified,
          confidence: inferredVerified ? "Medium" : "Low",
          detectedElements: inferredVerified ? ["Outdoor scene / nature"] : ["Indoor scene / Unconfirmed object"],
          naturalistComment: inferredVerified 
            ? "Authentic outdoor nature verified by Google Gemma AI." 
            : "Photo could not be confirmed as outdoor nature. Please capture live outdoor plants, trees, or sky.",
          gitExcuse: null,
          grassPointsAwarded: inferredVerified ? 25 : 0
        };
      }
    }

    // CRITICAL SANITIZATION: Never let raw JSON or code leak into naturalistComment!
    if (parsedData && parsedData.naturalistComment) {
      const comment = String(parsedData.naturalistComment).trim();
      if (comment.startsWith('{') || comment.startsWith('```') || comment.includes('"verified"') || comment.length < 5) {
        parsedData.naturalistComment = parsedData.verified
          ? "Authentic outdoor nature verified by Google Gemma AI."
          : "Photo did not meet outdoor nature criteria. Please point your camera at outdoor plants, foliage, or open sky.";
      }
    }

    return {
      data: parsedData,
      modelUsed: model
    };
  } catch (err) {
    console.warn(`Gemma AI verification attempt failed:`, err.message);
    lastErr = err;
  }

  // Fallback response if API is unreachable (MUST BE FALSE: never falsely unlock)
  return {
    data: {
      verified: false,
      confidence: "Low",
      detectedElements: ["AI Verification Interrupted"],
      naturalistComment: "Failed to verify photo through Google Gemma AI (" + (lastErr?.message || "Connection timeout") + "). Ensure internet connectivity is active and capture outdoor greenery.",
      gitExcuse: null,
      grassPointsAwarded: 0
    },
    modelUsed: 'Gemma (Offline)'
  };
}

// Check if request originates from the Mobile Companion App
function checkMobileHeartbeat(req) {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const isMobile = ua.includes('dalvik') || 
                   ua.includes('okhttp') || 
                   ua.includes('android') || 
                   req.headers['x-companion-app'] === 'grasslock' ||
                   req.query.source === 'mobile';
  
  if (isMobile) {
    const wasConnected = appState.isMobileAppConnected;
    appState.isMobileAppConnected = true;
    appState.lastMobileSeen = Date.now();
    appState.mobileDeviceModel = 'Android Companion';
    
    if (!wasConnected) {
      console.log('📱 Mobile Android App CONNECTED & SYNCED to Desktop Sentinel!');
      broadcast('COMPANION_STATUS', {
        isMobileAppConnected: true,
        lastMobileSeen: appState.lastMobileSeen,
        mobileDeviceModel: appState.mobileDeviceModel
      });
    }
  }
}

// REST API Endpoints
app.get('/api/status', (req, res) => {
  checkMobileHeartbeat(req);
  res.json({
    ...appState,
    localIp: getLocalIp(),
    port: PORT,
    hasKey: Boolean(API_KEY),
    model: GEMMA_MODEL
  });
});

app.get('/download-apk', (req, res) => {
  const apkPath = path.join(__dirname, '../android/app/build/outputs/apk/debug/app-debug.apk');
  if (fs.existsSync(apkPath)) {
    res.download(apkPath, 'grasslock-companion.apk');
  } else {
    res.status(404).send('APK belum dikompilasi.');
  }
});

app.post('/api/companion/ping', (req, res) => {
  appState.isMobileAppConnected = true;
  appState.lastMobileSeen = Date.now();
  if (req.body?.deviceModel) appState.mobileDeviceModel = req.body.deviceModel;
  broadcast('COMPANION_STATUS', {
    isMobileAppConnected: true,
    lastMobileSeen: appState.lastMobileSeen,
    mobileDeviceModel: appState.mobileDeviceModel
  });
  res.json({ success: true, appState });
});

// Periodic Mobile Companion Liveness Check (Generous 35s window for camera/photo sessions)
setInterval(() => {
  if (appState.isMobileAppConnected) {
    if (!appState.lastMobileSeen || (Date.now() - appState.lastMobileSeen > 35000)) {
      appState.isMobileAppConnected = false;
      console.log('📱 Mobile Android App DISCONNECTED (Heartbeat timeout >35s).');
      broadcast('COMPANION_STATUS', {
        isMobileAppConnected: false,
        lastMobileSeen: appState.lastMobileSeen
      });
    }
  }
}, 3500);

app.post('/api/companion/disconnect', (req, res) => {
  appState.isMobileAppConnected = false;
  appState.lastMobileSeen = null;
  console.log('📱 Mobile Companion explicitly disconnected by user.');
  broadcast('COMPANION_STATUS', {
    isMobileAppConnected: false,
    lastMobileSeen: null
  });
  res.json({ success: true });
});

app.post('/api/config', (req, res) => {
  const { selectedApps, targetDurationSeconds, connectionMode, customApps } = req.body;
  if (Array.isArray(selectedApps)) appState.selectedApps = selectedApps;
  if (typeof targetDurationSeconds === 'number') appState.targetDurationSeconds = targetDurationSeconds;
  if (connectionMode) appState.connectionMode = connectionMode;
  if (Array.isArray(customApps)) appState.customApps = customApps;
  broadcast('CONFIG_UPDATED', appState);
  res.json({ success: true, appState });
});

app.post('/api/session/start', (req, res) => {
  appState.isTrackingActive = true;
  console.log('▶ Sentinel Session STARTED by user.');
  broadcast('SESSION_STATE', appState);
  res.json({ success: true, appState });
});

app.post('/api/session/pause', (req, res) => {
  appState.isTrackingActive = false;
  console.log('⏸ Sentinel Session PAUSED by user.');
  broadcast('SESSION_STATE', appState);
  res.json({ success: true, appState });
});

app.post('/api/session/reset', (req, res) => {
  appState.isTrackingActive = false;
  appState.secondsElapsed = 0;
  console.log('⏹ Sentinel Session RESET by user.');
  broadcast('SESSION_STATE', appState);
  res.json({ success: true, appState });
});

app.post('/api/connection-mode', (req, res) => {
  const { mode } = req.body;
  if (mode === 'usb' || mode === 'wifi') {
    appState.connectionMode = mode;
    console.log(`🔌 Connection mode set to: ${mode}`);
    broadcast('CONNECTION_MODE_CHANGED', appState);
  }
  res.json({ success: true, appState });
});

app.post('/api/trigger-lock', (req, res) => {
  triggerLockout();
  res.json({ success: true, locked: true });
});

// Mobile App calls this endpoint when developer snaps a photo outside
app.post('/api/verify-grass', async (req, res) => {
  checkMobileHeartbeat(req);
  try {
    const { imageBase64, notes } = req.body;
    console.log('📸 Received outdoor photo from mobile app! Verifying with Gemma...');

    const result = await verifyPhotoWithGemma(imageBase64, notes);
    const isVerified = Boolean(result.data?.verified);
    const reviewData = {
      ...result.data,
      verified: isVerified,
      modelUsed: result.modelUsed,
      unlockedAt: isVerified ? new Date().toLocaleTimeString() : null,
      photoPreview: imageBase64 ? imageBase64.slice(0, 500) + '...' : null
    };

    if (isVerified) {
      appState.isNatureVerified = true;
      appState.lastGemmaReview = reviewData;

      if (appState.breakSecondsRemaining <= 0) {
        unlockDesktop(reviewData);
        res.json({ 
          success: true, 
          verified: true, 
          unlocked: true,
          breakSecondsRemaining: 0,
          result: reviewData 
        });
      } else {
        console.log(`🌿 Outdoor nature verified by Google Gemma AI! Break cooldown active: ${appState.breakSecondsRemaining}s remaining before screen thaws.`);
        broadcast('NATURE_VERIFIED_WAITING_COOLDOWN', {
          ...reviewData,
          breakSecondsRemaining: appState.breakSecondsRemaining,
          mandatoryBreakSeconds: appState.mandatoryBreakSeconds
        });
        res.json({ 
          success: true, 
          verified: true, 
          unlocked: false,
          breakSecondsRemaining: appState.breakSecondsRemaining,
          result: reviewData 
        });
      }
    } else {
      console.log('❌ Outdoor photo rejected by Google Gemma AI. Desktop screen remains locked.');
      broadcast('VERIFICATION_FAILED', {
        ...reviewData,
        message: reviewData.naturalistComment || 'Photo does not meet outdoor nature criteria.'
      });
      res.json({ success: true, verified: false, unlocked: false, result: reviewData });
    }
  } catch (err) {
    console.error('Photo verification error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'INIT', payload: appState, localIp: getLocalIp() }));
  
  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.type === 'START_SESSION') {
        appState.isTrackingActive = true;
        broadcast('SESSION_STATE', appState);
      } else if (parsed.type === 'PAUSE_SESSION') {
        appState.isTrackingActive = false;
        broadcast('SESSION_STATE', appState);
      } else if (parsed.type === 'RESET_SESSION') {
        appState.isTrackingActive = false;
        appState.secondsElapsed = 0;
        broadcast('SESSION_STATE', appState);
      } else if (parsed.type === 'SET_CONNECTION_MODE') {
        if (parsed.mode === 'usb' || parsed.mode === 'wifi') {
          appState.connectionMode = parsed.mode;
          broadcast('CONNECTION_MODE_CHANGED', appState);
        }
      } else if (parsed.type === 'UPDATE_CONFIG') {
        if (Array.isArray(parsed.selectedApps)) appState.selectedApps = parsed.selectedApps;
        if (typeof parsed.targetDurationSeconds === 'number') appState.targetDurationSeconds = parsed.targetDurationSeconds;
        if (Array.isArray(parsed.customApps)) appState.customApps = parsed.customApps;
        broadcast('CONFIG_UPDATED', appState);
      } else if (parsed.type === 'TRIGGER_LOCK') {
        triggerLockout();
      } else if (parsed.type === 'MANUAL_UNLOCK') {
        unlockDesktop({ naturalistComment: 'Manually unlocked by user.' });
      }
    } catch (e) {
      console.warn('WS error', e);
    }
  });
});

function startServer() {
  return new Promise((resolve) => {
    server.once('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        console.log(`🌿 Port ${PORT} already active, connected to existing bridge.`);
        resolve({ server, port: PORT, localIp: getLocalIp() });
      }
    });
    server.listen(PORT, () => {
      console.log(`🌿 GrassLock Local Bridge running on http://${getLocalIp()}:${PORT}`);
      resolve({ server, port: PORT, localIp: getLocalIp() });
    });
  });
}

// Safety Safeguard: Guarantee frozen processes are always thawed if GrassLock exits
function safetyCleanExit() {
  if (processTracker) {
    processTracker.resumeProcesses();
  }
}
process.on('SIGINT', safetyCleanExit);
process.on('SIGTERM', safetyCleanExit);
process.on('exit', safetyCleanExit);

module.exports = {
  startServer,
  appState,
  triggerLockout,
  unlockDesktop,
  broadcast,
  processTracker
};

if (require.main === module) {
  startServer();
}
