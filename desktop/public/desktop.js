// GrassLock Sentinel Desktop Client
// Hacktoberfest 2026 - Week 1: Touch Grass
// Complete User Freedom & Taste Skill UI Engine (Lucide Icons, Zero Emojis)

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  let ws = null;
  let isTrackingActive = false;
  let connectionMode = 'usb'; // 'usb' or 'wifi'
  let localIp = '127.0.0.1';
  const port = 3847;
  let targetDurationSeconds = 1500;
  let secondsElapsed = 0;
  let selectedApps = []; // UNCHECKED BY DEFAULT: full user freedom
  let customApps = [];
  let breaksCount = 0;
  let currentUnit = 'min';
  let isMobileAppConnected = false;
  let lastMobileSeen = null;
  let breakSecondsRemaining = 300;
  let isNatureVerified = false;

  // DOM Elements - Header & Endpoint
  const connEndpointText = document.getElementById('connEndpointText');
  const btnCopyEndpoint = document.getElementById('btnCopyEndpoint');
  const connDot = document.getElementById('connDot');
  const companionHeaderBadge = document.getElementById('companionHeaderBadge');
  const companionHeaderDot = document.getElementById('companionHeaderDot');
  const companionHeaderText = document.getElementById('companionHeaderText');
  const toastNotification = document.getElementById('toastNotification');
  const toastMessage = document.getElementById('toastMessage');

  // DOM Elements - Companion Live Sync Panel (Column 2)
  const companionSyncPanel = document.getElementById('companionSyncPanel');
  const syncWaveBridge = document.getElementById('syncWaveBridge');
  const syncStateChip = document.getElementById('syncStateChip');
  const syncStatusHeadline = document.getElementById('syncStatusHeadline');
  const syncStatusDetail = document.getElementById('syncStatusDetail');
  const syncLastPingTime = document.getElementById('syncLastPingTime');

  // DOM Elements - Lockout Companion Status
  const lockoutCompanionBox = document.getElementById('lockoutCompanionBox');
  const lockoutCompanionDot = document.getElementById('lockoutCompanionDot');
  const lockoutCompanionText = document.getElementById('lockoutCompanionText');

  // DOM Elements - Monitor
  const sessionStatusTag = document.getElementById('sessionStatusTag');
  const timerDigits = document.getElementById('timerDigits');
  const targetDigits = document.getElementById('targetDigits');
  const progressBar = document.getElementById('progressBar');
  const detectedAppsContainer = document.getElementById('detectedAppsContainer');
  const btnToggleSession = document.getElementById('btnToggleSession');
  const btnToggleSessionText = document.getElementById('btnToggleSessionText');
  const btnResetSession = document.getElementById('btnResetSession');
  const statGrassStreak = document.getElementById('statGrassStreak');

  // DOM Elements - Connection Mode
  const connCardUsb = document.getElementById('connCardUsb');
  const connCardWifi = document.getElementById('connCardWifi');
  const usbEndpointDisplay = document.getElementById('usbEndpointDisplay');
  const wifiEndpointDisplay = document.getElementById('wifiEndpointDisplay');
  const connHelperText = document.getElementById('connHelperText');
  const connRadios = document.querySelectorAll('input[name="connectionMode"]');

  // DOM Elements - Duration
  const presetPillsGroup = document.getElementById('presetPillsGroup');
  const pillButtons = document.querySelectorAll('.pill-btn');
  const customDurationInput = document.getElementById('customDurationInput');
  const unitBtnMin = document.getElementById('unitBtnMin');
  const unitBtnSec = document.getElementById('unitBtnSec');
  const btnApplyCustomDuration = document.getElementById('btnApplyCustomDuration');
  const durationFeedback = document.getElementById('durationFeedback');

  // DOM Elements - App Selection
  const btnSelectAllApps = document.getElementById('btnSelectAllApps');
  const btnDeselectAllApps = document.getElementById('btnDeselectAllApps');
  const appCheckboxes = document.querySelectorAll('.app-checkbox');
  const customProcessForm = document.getElementById('customProcessForm');
  const customProcessInput = document.getElementById('customProcessInput');
  const customChipsContainer = document.getElementById('customChipsContainer');
  const selectedAppsCount = document.getElementById('selectedAppsCount');
  const timerConfigToolbar = document.getElementById('timerConfigToolbar');
  const appsLockedBadge = document.getElementById('appsLockedBadge');
  const connLockedBadge = document.getElementById('connLockedBadge');

  // DOM Elements - Lockout & Dual-Gate Cooldown
  const lockoutScreen = document.getElementById('lockoutScreen');
  const lockoutEndpointNote = document.getElementById('lockoutEndpointNote');
  const btnEmergencyOverride = document.getElementById('btnEmergencyOverride');
  const lastBreakCard = document.getElementById('lastBreakCard');
  const breakCommentary = document.getElementById('breakCommentary');
  const breakCooldownCard = document.getElementById('breakCooldownCard');
  const cooldownDigits = document.getElementById('cooldownDigits');
  const cooldownStatusTag = document.getElementById('cooldownStatusTag');
  const cooldownCaption = document.getElementById('cooldownCaption');
  const gateNaturePill = document.getElementById('gateNaturePill');
  const gateNatureIcon = document.getElementById('gateNatureIcon');
  const gateNatureText = document.getElementById('gateNatureText');
  const gateTimerPill = document.getElementById('gateTimerPill');
  const gateTimerIcon = document.getElementById('gateTimerIcon');
  const gateTimerText = document.getElementById('gateTimerText');
  const lockoutWaitingText = document.getElementById('lockoutWaitingText');

  // Helper to re-render Lucide icons dynamically
  function renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  // Format total seconds into MM:SS
  function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Toast Helper
  let toastTimeout = null;
  function showToast(message, durationMs = 3500) {
    if (toastTimeout) clearTimeout(toastTimeout);
    toastMessage.textContent = message;
    toastNotification.classList.remove('hidden');
    renderIcons();
    toastTimeout = setTimeout(() => {
      toastNotification.classList.add('hidden');
    }, durationMs);
  }

  // Copy Endpoint
  btnCopyEndpoint?.addEventListener('click', () => {
    const textToCopy = connEndpointText.textContent.trim();
    navigator.clipboard.writeText(textToCopy).then(() => {
      btnCopyEndpoint.innerHTML = '<i data-lucide="check" class="icon-sm"></i>';
      renderIcons();
      setTimeout(() => {
        btnCopyEndpoint.innerHTML = '<i data-lucide="copy" class="icon-sm"></i>';
        renderIcons();
      }, 2000);
      showToast(`Endpoint address copied to clipboard: ${textToCopy}`);
    }).catch(() => {
      showToast(`Endpoint address: ${textToCopy}`);
    });
  });

  // ==========================================
  // WEBSOCKET & STATE SYNC
  // ==========================================
  function connectWebSocket() {
    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:${port}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      connDot.style.background = 'var(--accent-emerald)';
      console.log('Connected to GrassLock WebSocket Bridge');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleSocketMessage(msg);
      } catch (err) {
        console.warn('Socket message parse error:', err);
      }
    };

    ws.onclose = () => {
      connDot.style.background = 'var(--text-muted)';
      console.log('WebSocket closed. Reconnecting in 2s...');
      setTimeout(connectWebSocket, 2000);
    };
  }

  function handleSocketMessage(msg) {
    const { type, payload, localIp: serverIp } = msg;

    if (type === 'INIT') {
      if (serverIp) localIp = serverIp;
      if (payload) {
        isTrackingActive = Boolean(payload.isTrackingActive);
        if (payload.connectionMode) connectionMode = payload.connectionMode;
        if (payload.targetDurationSeconds) targetDurationSeconds = payload.targetDurationSeconds;
        if (payload.secondsElapsed !== undefined) secondsElapsed = payload.secondsElapsed;
        if (Array.isArray(payload.selectedApps)) selectedApps = payload.selectedApps;
        if (Array.isArray(payload.customApps)) customApps = payload.customApps;
        if (payload.grassStreak !== undefined) statGrassStreak.textContent = payload.grassStreak;
        if (payload.isMobileAppConnected !== undefined) isMobileAppConnected = Boolean(payload.isMobileAppConnected);
        if (payload.lastMobileSeen) lastMobileSeen = payload.lastMobileSeen;
        if (payload.breakSecondsRemaining !== undefined) breakSecondsRemaining = payload.breakSecondsRemaining;
        if (payload.isNatureVerified !== undefined) isNatureVerified = payload.isNatureVerified;
        if (payload.isLocked) showLockout(payload);
      }
      renderAll();
    }

    if (type === 'SESSION_STATE') {
      if (payload) {
        isTrackingActive = Boolean(payload.isTrackingActive);
        if (payload.secondsElapsed !== undefined) secondsElapsed = payload.secondsElapsed;
        if (payload.targetDurationSeconds) targetDurationSeconds = payload.targetDurationSeconds;
      }
      updateSessionControlsUI();
      updateTimerDisplay();
    }

    if (type === 'TICK') {
      const { secondsElapsed: sec, targetDurationSeconds: targetSec, activeApps } = payload;
      secondsElapsed = sec;
      if (targetSec) targetDurationSeconds = targetSec;
      isTrackingActive = true;

      updateTimerDisplay();
      updateActiveAppBadges(activeApps || []);
      updateControlsLockState();
      sessionStatusTag.innerHTML = '<i data-lucide="activity" class="icon-xs"></i> MONITORING ACTIVE PROCESS';
      sessionStatusTag.className = 'live-tag active';
      renderIcons();
    }

    if (type === 'IDLE_TICK') {
      const { secondsElapsed: sec, targetDurationSeconds: targetSec, activeApps, isTrackingActive: trackingState } = payload;
      if (sec !== undefined) secondsElapsed = sec;
      if (targetSec) targetDurationSeconds = targetSec;
      if (trackingState !== undefined) isTrackingActive = trackingState;

      updateTimerDisplay();
      updateActiveAppBadges(activeApps || []);
      updateControlsLockState();

      if (isTrackingActive) {
        sessionStatusTag.innerHTML = '<i data-lucide="clock" class="icon-xs"></i> STANDBY (WAITING FOR TARGET APPS)';
        sessionStatusTag.className = 'live-tag paused';
      } else {
        sessionStatusTag.innerHTML = '<i data-lucide="circle" class="icon-xs"></i> SESSION NOT STARTED';
        sessionStatusTag.className = 'live-tag idle';
      }
      renderIcons();
    }

    if (type === 'CONFIG_UPDATED') {
      if (payload) {
        if (Array.isArray(payload.selectedApps)) selectedApps = payload.selectedApps;
        if (Array.isArray(payload.customApps)) customApps = payload.customApps;
        if (payload.targetDurationSeconds) targetDurationSeconds = payload.targetDurationSeconds;
        if (payload.connectionMode) connectionMode = payload.connectionMode;
      }
      syncCheckboxes();
      renderCustomAppChips();
      updateDurationUI();
      updateConnectionModeUI();
    }

    if (type === 'CONNECTION_MODE_CHANGED') {
      if (payload && payload.connectionMode) {
        connectionMode = payload.connectionMode;
      }
      updateConnectionModeUI();
    }

    if (type === 'LOCKOUT_TRIGGERED') {
      showLockout(payload);
    }

    if (type === 'BREAK_TICK') {
      if (payload) {
        if (payload.breakSecondsRemaining !== undefined) breakSecondsRemaining = payload.breakSecondsRemaining;
        if (payload.isNatureVerified !== undefined) isNatureVerified = payload.isNatureVerified;
        updateCooldownUI();
      }
    }

    if (type === 'NATURE_VERIFIED_WAITING_COOLDOWN') {
      isNatureVerified = true;
      if (payload?.breakSecondsRemaining !== undefined) {
        breakSecondsRemaining = payload.breakSecondsRemaining;
      }
      updateCooldownUI();
      if (payload?.naturalistComment && breakCommentary) {
        breakCommentary.textContent = `"${payload.naturalistComment}"`;
      }
      showToast('Outdoor photo verified by Gemma 4. Complete the remaining pause.');
    }

    if (type === 'DESKTOP_UNLOCKED') {
      hideLockout();
      breaksCount++;
      isTrackingActive = false; // Timer remains paused at 00:00! Does NOT auto-run
      secondsElapsed = 0;
      updateSessionControlsUI();
      updateTimerDisplay();
      updateControlsLockState();
      sessionStatusTag.innerHTML = '<i data-lucide="check-circle-2" class="icon-xs"></i> SESSION COMPLETED (STANDBY 00:00)';
      sessionStatusTag.className = 'live-tag idle';
      renderIcons();

      if (payload) {
        lastBreakCard.classList.remove('hidden');
        if (payload.naturalistComment && breakCommentary) {
          breakCommentary.textContent = `"${payload.naturalistComment}"`;
        }
        if (payload.grassStreak !== undefined) {
          statGrassStreak.textContent = payload.grassStreak;
        }
      }
      showToast('Workstation unlocked and target applications thawed. Ready for a new session.');
    }

    if (type === 'VERIFICATION_FAILED') {
      showLockout(payload);
      isTrackingActive = false;
      showToast('Photo rejected by Gemma AI: Not authentic outdoor nature.');
      if (gateNaturePill && gateNatureText) {
        gateNaturePill.className = 'gate-pill rejected';
        gateNatureText.textContent = 'Outdoor Photo: Verification Rejected';
        if (gateNatureIcon) {
          gateNatureIcon.innerHTML = '<i data-lucide="x" class="icon-xs"></i>';
          renderIcons();
        }
      }
      if (lockoutCompanionText) {
        let reason = payload?.naturalistComment || payload?.message || 'Photo did not meet outdoor nature criteria.';
        if (typeof reason === 'string' && (reason.startsWith('{') || reason.startsWith('```') || reason.includes('"verified"'))) {
          reason = 'Photo did not satisfy outdoor foliage or sky criteria. Please point your camera at outdoor plants or trees.';
        }
        lockoutCompanionText.innerHTML = `<span style="color:#ef4444; font-weight:700;">Verification Rejected:</span> ${reason}`;
      }
      if (lockoutCompanionDot) {
        lockoutCompanionDot.style.background = '#ef4444';
        lockoutCompanionDot.style.boxShadow = '0 0 10px #ef4444';
      }
    }

    if (type === 'COMPANION_STATUS') {
      if (payload) {
        const wasConnected = isMobileAppConnected;
        isMobileAppConnected = Boolean(payload.isMobileAppConnected);
        if (payload.lastMobileSeen) lastMobileSeen = payload.lastMobileSeen;
        updateCompanionUI();

        if (!wasConnected && isMobileAppConnected) {
          showToast('Android GrassLock Companion App Connected and Synchronized.');
        } else if (wasConnected && !isMobileAppConnected) {
          showToast('Android companion signal disconnected.');
        }
      }
    }
  }

  function renderAll() {
    updateConnectionModeUI();
    updateCompanionUI();
    updateDurationUI();
    syncCheckboxes();
    renderCustomAppChips();
    updateSessionControlsUI();
    updateTimerDisplay();
    updateSelectedCount();
    updateCooldownUI();
    renderIcons();
  }

  // ==========================================
  // COMPANION APP STATUS
  // ==========================================
  function updateCompanionUI() {
    if (isMobileAppConnected) {
      if (companionHeaderBadge) {
        companionHeaderBadge.className = 'companion-status-badge connected';
      }
      if (companionHeaderDot) {
        companionHeaderDot.className = 'companion-indicator-dot online';
      }
      if (companionHeaderText) {
        companionHeaderText.innerHTML = 'Android Companion: <strong>Connected & Synchronized</strong>';
      }

      if (companionSyncPanel) {
        companionSyncPanel.className = 'companion-sync-panel connected';
      }
      if (syncWaveBridge) {
        syncWaveBridge.innerHTML = '··· <i data-lucide="zap" class="icon-xs"></i> ···';
      }
      if (syncStateChip) {
        syncStateChip.className = 'sync-state-chip connected';
        syncStateChip.innerHTML = '<i data-lucide="wifi" class="icon-xs"></i> CONNECTED & SYNCHRONIZED';
      }
      if (syncStatusHeadline) {
        syncStatusHeadline.textContent = 'Android Companion Connected and Synchronized';
      }
      if (syncStatusDetail) {
        syncStatusDetail.textContent = 'Real-time telemetry link active between mobile companion and desktop sentinel. Gemma 4 photo verification ready.';
      }
      if (syncLastPingTime) {
        syncLastPingTime.textContent = 'Last Signal: Just now (Live)';
      }

      if (lockoutCompanionBox) {
        lockoutCompanionBox.className = 'lockout-companion-box connected';
      }
      if (lockoutCompanionDot) {
        lockoutCompanionDot.className = 'lockout-companion-dot';
      }
      if (lockoutCompanionText) {
        lockoutCompanionText.textContent = 'Android Companion Connected. Ready to submit outdoor photo verification.';
      }
    } else {
      if (companionHeaderBadge) {
        companionHeaderBadge.className = 'companion-status-badge disconnected';
      }
      if (companionHeaderDot) {
        companionHeaderDot.className = 'companion-indicator-dot offline';
      }
      if (companionHeaderText) {
        companionHeaderText.innerHTML = 'Android Companion: <strong>Not Connected</strong>';
      }

      if (companionSyncPanel) {
        companionSyncPanel.className = 'companion-sync-panel disconnected';
      }
      if (syncWaveBridge) {
        syncWaveBridge.innerHTML = '··· <i data-lucide="unplug" class="icon-xs"></i> ···';
      }
      if (syncStateChip) {
        syncStateChip.className = 'sync-state-chip disconnected';
        syncStateChip.innerHTML = '<i data-lucide="circle-slash" class="icon-xs"></i> DISCONNECTED';
      }
      if (syncStatusHeadline) {
        syncStatusHeadline.textContent = 'Android Companion App Not Connected';
      }
      if (syncStatusDetail) {
        syncStatusDetail.textContent = 'Desktop sentinel is ready. Launch the GrassLock companion app on your phone and tap Connect to Desktop.';
      }
      if (syncLastPingTime) {
        syncLastPingTime.textContent = lastMobileSeen
          ? `Last Signal: ${new Date(lastMobileSeen).toLocaleTimeString()}`
          : 'Last Signal: Not yet detected';
      }

      if (lockoutCompanionBox) {
        lockoutCompanionBox.className = 'lockout-companion-box disconnected';
      }
      if (lockoutCompanionDot) {
        lockoutCompanionDot.className = 'lockout-companion-dot';
      }
      if (lockoutCompanionText) {
        lockoutCompanionText.textContent = 'Companion Status: Waiting for Android app to connect...';
      }
    }
    renderIcons();
  }

  // ==========================================
  // CONNECTION MODE SELECTION (USB vs Wi-Fi)
  // ==========================================
  function updateConnectionModeUI() {
    const usbUrl = `http://127.0.0.1:${port}`;
    const wifiUrl = `http://${localIp}:${port}`;

    if (usbEndpointDisplay) usbEndpointDisplay.textContent = usbUrl;
    if (wifiEndpointDisplay) wifiEndpointDisplay.textContent = wifiUrl;

    if (connectionMode === 'usb') {
      connCardUsb.classList.add('active');
      connCardWifi.classList.remove('active');
      const radio = document.querySelector('input[name="connectionMode"][value="usb"]');
      if (radio) radio.checked = true;

      connEndpointText.textContent = usbUrl;
      connHelperText.innerHTML = `USB mode active. Open GrassLock on phone configured with <strong>${usbUrl}</strong> (USB cable + ADB reverse).`;
      if (lockoutEndpointNote) {
        lockoutEndpointNote.innerHTML = `USB Cable: <code>${usbUrl}</code>`;
      }
    } else {
      connCardWifi.classList.add('active');
      connCardUsb.classList.remove('active');
      const radio = document.querySelector('input[name="connectionMode"][value="wifi"]');
      if (radio) radio.checked = true;

      connEndpointText.textContent = wifiUrl;
      connHelperText.innerHTML = `Wi-Fi mode active. Connect phone and PC to the same Wi-Fi network, then open GrassLock pointing to <strong>${wifiUrl}</strong>.`;
      if (lockoutEndpointNote) {
        lockoutEndpointNote.innerHTML = `Wi-Fi LAN: <code>${wifiUrl}</code>`;
      }
    }
  }

  connRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (isTrackingActive) {
        radio.checked = (connectionMode === radio.value);
        showToast('Session is currently active. Pause or reset session first to change connection mode.');
        return;
      }
      connectionMode = radio.value;
      updateConnectionModeUI();
      notifyConnectionModeChange(connectionMode);
    });
  });

  connCardUsb?.addEventListener('click', (e) => {
    if (isTrackingActive) {
      showToast('Session is currently active. Pause or reset session first to change connection mode.');
      return;
    }
    if (e.target.tagName !== 'INPUT') {
      connectionMode = 'usb';
      updateConnectionModeUI();
      notifyConnectionModeChange('usb');
    }
  });

  connCardWifi?.addEventListener('click', (e) => {
    if (isTrackingActive) {
      showToast('Session is currently active. Pause or reset session first to change connection mode.');
      return;
    }
    if (e.target.tagName !== 'INPUT') {
      connectionMode = 'wifi';
      updateConnectionModeUI();
      notifyConnectionModeChange('wifi');
    }
  });

  function notifyConnectionModeChange(mode) {
    if (window.electronAPI?.setConnectionMode) {
      window.electronAPI.setConnectionMode(mode);
    } else if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'SET_CONNECTION_MODE', mode }));
    }
    fetch('/api/connection-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    }).catch(() => {});
  }

  // ==========================================
  // CONTROLS LOCKING DURING ACTIVE SESSION
  // ==========================================
  function updateControlsLockState() {
    const isLocked = isTrackingActive;

    // 1. Duration Presets & Custom Duration Controls
    pillButtons.forEach(btn => {
      btn.disabled = isLocked;
      btn.classList.toggle('control-locked', isLocked);
    });
    if (customDurationInput) {
      customDurationInput.disabled = isLocked;
      customDurationInput.classList.toggle('control-locked', isLocked);
    }
    if (unitBtnMin) {
      unitBtnMin.disabled = isLocked;
      unitBtnMin.classList.toggle('control-locked', isLocked);
    }
    if (unitBtnSec) {
      unitBtnSec.disabled = isLocked;
      unitBtnSec.classList.toggle('control-locked', isLocked);
    }
    if (btnApplyCustomDuration) {
      btnApplyCustomDuration.disabled = isLocked;
      btnApplyCustomDuration.classList.toggle('control-locked', isLocked);
    }
    if (timerConfigToolbar) {
      timerConfigToolbar.classList.toggle('session-locked-toolbar', isLocked);
    }

    // 2. App Selection Controls & Checkboxes
    if (btnSelectAllApps) {
      btnSelectAllApps.disabled = isLocked;
      btnSelectAllApps.classList.toggle('control-locked', isLocked);
    }
    if (btnDeselectAllApps) {
      btnDeselectAllApps.disabled = isLocked;
      btnDeselectAllApps.classList.toggle('control-locked', isLocked);
    }
    appCheckboxes.forEach(cb => {
      cb.disabled = isLocked;
      const card = cb.closest('.toggle-card');
      if (card) {
        card.classList.toggle('control-locked', isLocked);
      }
    });

    if (customProcessInput) {
      customProcessInput.disabled = isLocked;
    }
    const customAddBtn = customProcessForm?.querySelector('button[type="submit"]');
    if (customAddBtn) {
      customAddBtn.disabled = isLocked;
      customAddBtn.classList.toggle('control-locked', isLocked);
    }

    document.querySelectorAll('.custom-chip-check').forEach(el => {
      el.disabled = isLocked;
    });
    document.querySelectorAll('.btn-chip-remove').forEach(el => {
      el.disabled = isLocked;
      el.classList.toggle('control-locked', isLocked);
    });
    document.querySelectorAll('.custom-chip').forEach(el => {
      el.classList.toggle('control-locked', isLocked);
    });

    if (appsLockedBadge) {
      appsLockedBadge.classList.toggle('hidden', !isLocked);
    }

    // 3. Connection Mode Selection
    connRadios.forEach(r => {
      r.disabled = isLocked;
    });
    if (connCardUsb) {
      connCardUsb.classList.toggle('control-locked', isLocked);
    }
    if (connCardWifi) {
      connCardWifi.classList.toggle('control-locked', isLocked);
    }
    if (connLockedBadge) {
      connLockedBadge.classList.toggle('hidden', !isLocked);
    }
  }

  // ==========================================
  // SESSION CONTROLS (START / PAUSE / RESET)
  // ==========================================
  function updateSessionControlsUI() {
    const iconSpan = btnToggleSession.querySelector('.btn-icon');
    if (isTrackingActive) {
      btnToggleSession.className = 'btn-primary-sentinel active-pause';
      btnToggleSessionText.textContent = 'Pause Sentinel Session';
      if (iconSpan) iconSpan.innerHTML = '<i data-lucide="pause" class="icon-btn"></i>';
      sessionStatusTag.innerHTML = '<i data-lucide="activity" class="icon-xs"></i> MONITORING ACTIVE PROCESS';
      sessionStatusTag.className = 'live-tag active';
    } else {
      btnToggleSession.className = 'btn-primary-sentinel';
      btnToggleSessionText.textContent = secondsElapsed > 0 ? 'Resume Sentinel Session' : 'Start Sentinel Session';
      if (iconSpan) iconSpan.innerHTML = '<i data-lucide="play" class="icon-btn"></i>';
      sessionStatusTag.innerHTML = secondsElapsed > 0
        ? '<i data-lucide="pause-circle" class="icon-xs"></i> SESSION PAUSED'
        : '<i data-lucide="circle" class="icon-xs"></i> SESSION NOT STARTED';
      sessionStatusTag.className = secondsElapsed > 0 ? 'live-tag paused' : 'live-tag idle';
    }
    updateControlsLockState();
    renderIcons();
  }

  btnToggleSession?.addEventListener('click', () => {
    if (!isTrackingActive) {
      // Validation: User must select at least 1 app to monitor
      if (selectedApps.length === 0) {
        showToast('Please select at least 1 application to monitor before starting session!');
        document.getElementById('appTogglesList')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // START SESSION
      isTrackingActive = true;
      updateSessionControlsUI();
      if (window.electronAPI?.startSession) {
        window.electronAPI.startSession();
      } else if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'START_SESSION' }));
      }
      fetch('/api/session/start', { method: 'POST' }).catch(() => {});
      showToast('Sentinel session started. Focus timer is active while selected apps are running.');
    } else {
      // PAUSE SESSION
      isTrackingActive = false;
      updateSessionControlsUI();
      if (window.electronAPI?.pauseSession) {
        window.electronAPI.pauseSession();
      } else if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'PAUSE_SESSION' }));
      }
      fetch('/api/session/pause', { method: 'POST' }).catch(() => {});
      showToast('Sentinel session paused.');
    }
  });

  btnResetSession?.addEventListener('click', () => {
    isTrackingActive = false;
    secondsElapsed = 0;
    updateSessionControlsUI();
    updateTimerDisplay();

    if (window.electronAPI?.resetSession) {
      window.electronAPI.resetSession();
    } else if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'RESET_SESSION' }));
    }
    fetch('/api/session/reset', { method: 'POST' }).catch(() => {});
    showToast('Session reset to 00:00.');
  });

  function updateTimerDisplay() {
    timerDigits.textContent = formatTime(secondsElapsed);
    targetDigits.textContent = formatTime(targetDurationSeconds);
    const pct = Math.min(100, (secondsElapsed / targetDurationSeconds) * 100);
    progressBar.style.width = `${pct}%`;
  }

  // ==========================================
  // TARGET DURATION PRESETS & CUSTOM INPUT
  // ==========================================
  function updateDurationUI() {
    targetDigits.textContent = formatTime(targetDurationSeconds);

    pillButtons.forEach(btn => {
      const s = parseInt(btn.getAttribute('data-seconds'), 10);
      if (s === targetDurationSeconds) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (currentUnit === 'min') {
      customDurationInput.value = Math.round(targetDurationSeconds / 60) || 1;
      durationFeedback.innerHTML = `Target: <strong>${Math.round(targetDurationSeconds / 60)} min</strong>`;
    } else {
      customDurationInput.value = targetDurationSeconds;
      durationFeedback.innerHTML = `Target: <strong>${targetDurationSeconds} sec</strong>`;
    }
  }

  pillButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (isTrackingActive) {
        showToast('Session is currently active. Pause the session first to change duration preset.');
        return;
      }
      const s = parseInt(btn.getAttribute('data-seconds'), 10);
      targetDurationSeconds = s;
      updateDurationUI();
      notifyConfigChange();
      showToast(`Target duration set to: ${btn.textContent.trim()}`);
    });
  });

  unitBtnMin?.addEventListener('click', () => {
    if (isTrackingActive) return;
    currentUnit = 'min';
    unitBtnMin.classList.add('active');
    unitBtnSec.classList.remove('active');
    updateDurationUI();
  });

  unitBtnSec?.addEventListener('click', () => {
    if (isTrackingActive) return;
    currentUnit = 'sec';
    unitBtnSec.classList.add('active');
    unitBtnMin.classList.remove('active');
    updateDurationUI();
  });

  btnApplyCustomDuration?.addEventListener('click', () => {
    if (isTrackingActive) {
      showToast('Session is currently active. Pause the session first to set custom duration.');
      return;
    }
    const rawVal = parseInt(customDurationInput.value, 10);
    if (isNaN(rawVal) || rawVal <= 0) {
      showToast('Please enter a valid duration number.');
      return;
    }

    if (currentUnit === 'min') {
      targetDurationSeconds = rawVal * 60;
    } else {
      targetDurationSeconds = rawVal;
    }

    updateDurationUI();
    notifyConfigChange();
    showToast(`Custom target duration applied: ${formatTime(targetDurationSeconds)}.`);
  });

  // ==========================================
  // APP SELECTION (UNCHECKED BY DEFAULT, USER FREEDOM)
  // ==========================================
  function syncCheckboxes() {
    appCheckboxes.forEach(cb => {
      const isChecked = selectedApps.includes(cb.value);
      cb.checked = isChecked;
      const card = cb.closest('.toggle-card');
      if (card) {
        if (isChecked) card.classList.add('selected');
        else card.classList.remove('selected');
      }
    });
    updateSelectedCount();
  }

  appCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      if (isTrackingActive) {
        cb.checked = !cb.checked;
        showToast('Session is currently active. Pause session first to change monitored apps.');
        return;
      }
      if (cb.checked) {
        if (!selectedApps.includes(cb.value)) selectedApps.push(cb.value);
      } else {
        selectedApps = selectedApps.filter(a => a !== cb.value);
      }
      syncCheckboxes();
      notifyConfigChange();
    });
  });

  btnSelectAllApps?.addEventListener('click', () => {
    if (isTrackingActive) {
      showToast('Session is currently active. Pause session first to change apps.');
      return;
    }
    const all = ['antigravity', 'vscode', 'firefox', 'chrome', ...customApps];
    selectedApps = Array.from(new Set(all));
    syncCheckboxes();
    renderCustomAppChips();
    notifyConfigChange();
    showToast('All applications selected for monitoring.');
  });

  btnDeselectAllApps?.addEventListener('click', () => {
    if (isTrackingActive) {
      showToast('Session is currently active. Pause session first to change apps.');
      return;
    }
    selectedApps = [];
    syncCheckboxes();
    renderCustomAppChips();
    notifyConfigChange();
    showToast('App selection cleared.');
  });

  // Custom Process Form (if enabled)
  customProcessForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (isTrackingActive) {
      showToast('Session is currently active. Pause session first to add new process.');
      return;
    }
    const val = customProcessInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!val) {
      showToast('Please enter a valid process name.');
      return;
    }

    if (customApps.includes(val) || ['antigravity', 'vscode', 'firefox', 'chrome'].includes(val)) {
      showToast(`App "${val}" is already in the list.`);
      customProcessInput.value = '';
      return;
    }

    customApps.push(val);
    selectedApps.push(val);
    customProcessInput.value = '';
    renderCustomAppChips();
    updateSelectedCount();
    notifyConfigChange();
    showToast(`Process "${val}" added to monitor.`);
  });

  function renderCustomAppChips() {
    if (!customChipsContainer) return;
    customChipsContainer.innerHTML = '';

    if (customApps.length === 0) {
      customChipsContainer.innerHTML = '<span class="text-muted" style="font-size:0.78rem;color:var(--text-muted);">No custom applications added yet.</span>';
      return;
    }

    customApps.forEach(appName => {
      const isChecked = selectedApps.includes(appName);
      const chip = document.createElement('div');
      chip.className = 'custom-chip';
      chip.innerHTML = `
        <input type="checkbox" class="custom-chip-check" data-app="${appName}" ${isChecked ? 'checked' : ''}>
        <span class="custom-chip-name"><code>${appName}</code></span>
        <button type="button" class="btn-chip-remove" title="Remove process" data-remove="${appName}"><i data-lucide="x" class="icon-xs"></i></button>
      `;

      chip.querySelector('.custom-chip-check').addEventListener('change', (e) => {
        if (isTrackingActive) {
          e.target.checked = !e.target.checked;
          showToast('Session is currently active. Pause session first.');
          return;
        }
        if (e.target.checked) {
          if (!selectedApps.includes(appName)) selectedApps.push(appName);
        } else {
          selectedApps = selectedApps.filter(a => a !== appName);
        }
        updateSelectedCount();
        notifyConfigChange();
      });

      chip.querySelector('.btn-chip-remove').addEventListener('click', () => {
        if (isTrackingActive) {
          showToast('Session is currently active. Pause session first.');
          return;
        }
        customApps = customApps.filter(a => a !== appName);
        selectedApps = selectedApps.filter(a => a !== appName);
        renderCustomAppChips();
        updateSelectedCount();
        notifyConfigChange();
        showToast(`Process "${appName}" removed.`);
      });

      customChipsContainer.appendChild(chip);
    });

    updateControlsLockState();
    renderIcons();
  }

  function updateSelectedCount() {
    if (selectedAppsCount) {
      const count = selectedApps.length;
      selectedAppsCount.textContent = `${count} ${count === 1 ? 'app selected' : 'apps selected'}`;
    }
  }

  function updateActiveAppBadges(activeApps) {
    ['antigravity', 'vscode', 'firefox', 'chrome'].forEach(appKey => {
      const el = document.getElementById(`status-${appKey}`);
      if (el) {
        const isActive = activeApps.includes(appKey);
        el.textContent = isActive ? 'ACTIVE' : 'IDLE';
        el.className = `process-indicator ${isActive ? 'active' : ''}`;
      }
    });

    if (activeApps.length === 0) {
      detectedAppsContainer.innerHTML = isTrackingActive
        ? '<span class="app-chip idle">No target apps currently running</span>'
        : '<span class="app-chip idle">Session not started</span>';
    } else {
      detectedAppsContainer.innerHTML = activeApps.map(a => `<span class="app-chip active">${a.toUpperCase()}</span>`).join(' ');
    }
  }

  function notifyConfigChange() {
    const configData = {
      selectedApps,
      targetDurationSeconds,
      connectionMode,
      customApps
    };

    if (window.electronAPI?.setConfig) {
      window.electronAPI.setConfig(configData);
    } else if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'UPDATE_CONFIG', ...configData }));
    }

    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configData)
    }).catch(() => {});
  }

  // ==========================================
  // DUAL-GATED COOLDOWN & LOCKOUT LOGIC
  // ==========================================
  function updateCooldownUI() {
    const safeBreak = Math.max(0, breakSecondsRemaining);
    if (cooldownDigits) {
      cooldownDigits.textContent = formatTime(safeBreak);
    }

    // Timer Gate Pill
    if (gateTimerPill && gateTimerText) {
      if (safeBreak <= 0) {
        gateTimerPill.className = 'gate-pill verified';
        gateTimerText.textContent = 'Rest Cooldown: Completed';
        if (gateTimerIcon) gateTimerIcon.innerHTML = '<i data-lucide="check" class="icon-xs"></i>';
      } else {
        gateTimerPill.className = 'gate-pill in-progress';
        gateTimerText.textContent = `Rest Cooldown: ${formatTime(safeBreak)} Remaining`;
        if (gateTimerIcon) gateTimerIcon.innerHTML = '<i data-lucide="timer" class="icon-xs"></i>';
      }
    }

    // Nature Gate Pill
    if (gateNaturePill && gateNatureText) {
      if (isNatureVerified) {
        gateNaturePill.className = 'gate-pill verified';
        gateNatureText.textContent = 'Outdoor Photo: Verified by Gemma 4';
        if (gateNatureIcon) gateNatureIcon.innerHTML = '<i data-lucide="check" class="icon-xs"></i>';
      } else {
        gateNaturePill.className = 'gate-pill pending';
        gateNatureText.textContent = 'Outdoor Photo: Pending Verification';
        if (gateNatureIcon) gateNatureIcon.innerHTML = '<i data-lucide="sprout" class="icon-xs"></i>';
      }
    }

    // Cooldown Status Tag
    if (cooldownStatusTag) {
      if (safeBreak <= 0) {
        cooldownStatusTag.innerHTML = '<i data-lucide="check-circle" class="icon-xs"></i> REST COMPLETED';
        cooldownStatusTag.className = 'cooldown-status-tag completed';
      } else {
        cooldownStatusTag.innerHTML = '<i data-lucide="timer" class="icon-xs"></i> REST IN PROGRESS';
        cooldownStatusTag.className = 'cooldown-status-tag active';
      }
    }

    // Dynamic Waiting Text
    if (lockoutWaitingText) {
      if (isNatureVerified && safeBreak <= 0) {
        lockoutWaitingText.textContent = 'Both criteria met. Unlocking workstation and resuming apps...';
      } else if (isNatureVerified && safeBreak > 0) {
        lockoutWaitingText.textContent = `Outdoor nature verified. Relax your eyes: ${formatTime(safeBreak)} remaining.`;
      } else if (!isNatureVerified && safeBreak <= 0) {
        lockoutWaitingText.textContent = 'Rest cooldown completed. Snap an outdoor photo with companion app to unlock.';
      } else {
        lockoutWaitingText.textContent = 'Waiting for outdoor photo verification from Android app (Google Gemma AI)...';
      }
    }

    renderIcons();
  }

  function showLockout(payload) {
    if (payload) {
      if (payload.breakSecondsRemaining !== undefined) breakSecondsRemaining = payload.breakSecondsRemaining;
      if (payload.isNatureVerified !== undefined) isNatureVerified = payload.isNatureVerified;
    }
    updateCooldownUI();
    lockoutScreen.classList.remove('hidden');
    playAlertTone();
    renderIcons();
  }

  function hideLockout() {
    lockoutScreen.classList.add('hidden');
    progressBar.style.width = '0%';
    timerDigits.textContent = '00:00';
    breakSecondsRemaining = 300;
    isNatureVerified = false;
    updateCooldownUI();
    playSuccessTone();
  }

  function playAlertTone() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {}
  }

  function playSuccessTone() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15);
      osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {}
  }

  btnEmergencyOverride?.addEventListener('click', () => {
    if (confirm('Emergency manual unlock? Screen will thaw and processes will resume. Please remember to take a break later!')) {
      if (window.electronAPI?.triggerManualUnlock) {
        window.electronAPI.triggerManualUnlock();
      } else if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'MANUAL_UNLOCK' }));
      }
    }
  });

  // Initial WebSocket Connection & Icon Render
  connectWebSocket();
  renderIcons();
});
