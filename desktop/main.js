const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

// Crucial for Linux/Wayland/Ubuntu: disable GPU hardware acceleration to prevent blank black screen
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');

const { startServer, appState, triggerLockout, unlockDesktop, broadcast, processTracker } = require('./server');
const ProcessTracker = require('./tracker');

let mainWindow = null;
let tracker = null;
let trackerInterval = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1050,
    height: 750,
    minWidth: 850,
    minHeight: 620,
    title: 'GrassLock: Screen Sentinel',
    backgroundColor: '#090b0a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load via internal server bridge for seamless asset & websocket resolution
  mainWindow.loadURL('http://localhost:3847').catch(() => {
    mainWindow.loadFile(path.join(__dirname, 'public/index.html'));
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('did-fail-load', () => {
    mainWindow.loadFile(path.join(__dirname, 'public/index.html'));
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Start Process Tracking Loop
function startProcessTracking() {
  tracker = new ProcessTracker(appState.selectedApps);

  trackerInterval = setInterval(async () => {
    if (appState.isLocked) return;

    // IF SESSION IS NOT ACTIVE, DO NOT COUNT OR INCREMENT TIME
    if (!appState.isTrackingActive) {
      tracker.setTargetApps(appState.selectedApps);
      const { activeApps } = await tracker.checkRunningApps();
      appState.currentActiveApps = activeApps;
      broadcast('IDLE_TICK', {
        isTrackingActive: false,
        secondsElapsed: appState.secondsElapsed,
        targetDurationSeconds: appState.targetDurationSeconds,
        activeApps
      });
      return;
    }

    tracker.setTargetApps(appState.selectedApps);
    const { activeApps, isWorking } = await tracker.checkRunningApps();
    appState.currentActiveApps = activeApps;

    if (isWorking) {
      appState.secondsElapsed += 2;
      broadcast('TICK', {
        isTrackingActive: true,
        secondsElapsed: appState.secondsElapsed,
        targetDurationSeconds: appState.targetDurationSeconds,
        activeApps
      });

      // Check if threshold reached
      if (appState.secondsElapsed >= appState.targetDurationSeconds) {
        triggerLockout();
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.setAlwaysOnTop(true, 'screen-saver');
        }
      }
    } else {
      broadcast('IDLE_TICK', {
        isTrackingActive: true,
        secondsElapsed: appState.secondsElapsed,
        targetDurationSeconds: appState.targetDurationSeconds,
        activeApps: []
      });
    }
  }, 2000);
}

// IPC Handlers
ipcMain.handle('get-initial-state', () => {
  return appState;
});

ipcMain.on('start-session', () => {
  appState.isTrackingActive = true;
  broadcast('SESSION_STATE', appState);
});

ipcMain.on('pause-session', () => {
  appState.isTrackingActive = false;
  broadcast('SESSION_STATE', appState);
});

ipcMain.on('reset-session', () => {
  appState.isTrackingActive = false;
  appState.secondsElapsed = 0;
  broadcast('SESSION_STATE', appState);
});

ipcMain.on('set-connection-mode', (event, mode) => {
  if (mode === 'usb' || mode === 'wifi') {
    appState.connectionMode = mode;
    broadcast('CONNECTION_MODE_CHANGED', appState);
  }
});

ipcMain.on('set-config', (event, config) => {
  if (Array.isArray(config.selectedApps)) appState.selectedApps = config.selectedApps;
  if (typeof config.targetDurationSeconds === 'number') appState.targetDurationSeconds = config.targetDurationSeconds;
  if (config.connectionMode) appState.connectionMode = config.connectionMode;
  if (Array.isArray(config.customApps)) appState.customApps = config.customApps;
  broadcast('CONFIG_UPDATED', appState);
});

ipcMain.on('trigger-manual-lock', () => {
  triggerLockout();
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  }
});

ipcMain.on('trigger-manual-unlock', () => {
  unlockDesktop({
    naturalistComment: 'Developer resumed session manually.',
    gitExcuse: 'chore(desk): manual override invoked'
  });
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(false);
  }
});

app.whenReady().then(async () => {
  await startServer();
  await createWindow();
  startProcessTracking();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (processTracker) {
    processTracker.resumeProcesses();
  }
});

app.on('window-all-closed', () => {
  if (trackerInterval) clearInterval(trackerInterval);
  if (processTracker) {
    processTracker.resumeProcesses();
  }
  if (process.platform !== 'darwin') app.quit();
});
