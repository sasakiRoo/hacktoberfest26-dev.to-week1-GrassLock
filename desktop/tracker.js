const { exec } = require('child_process');

// Default target app process signatures on Linux
const APP_SIGNATURES = {
  antigravity: ['antigravity', 'antigravity-ide'],
  vscode: ['code', 'code-oss'],
  firefox: ['firefox'],
  chrome: ['google-chrome', 'chrome', 'chromium', 'brave']
};

// System and self-protection blacklist (never freeze these)
const PROTECTED_COMM = new Set([
  'grasslock-deskt',
  'grasslock-desktop',
  'electron',
  'node',
  'bash',
  'sh',
  'zsh',
  'systemd',
  'dbus-daemon',
  'pipewire',
  'wireplumber',
  'xorg',
  'wayland'
]);

class ProcessTracker {
  constructor(targetApps = ['antigravity', 'vscode', 'firefox', 'chrome']) {
    this.targetApps = targetApps;
    this.currentlyFrozenPids = new Set();
  }

  setTargetApps(apps) {
    this.targetApps = apps;
  }

  checkRunningApps() {
    return new Promise((resolve) => {
      exec('ps -eo comm', (err, stdout) => {
        if (err || !stdout) {
          resolve({ activeApps: [], isWorking: false });
          return;
        }

        const runningProcesses = new Set(
          stdout.split('\n').map(p => p.trim().toLowerCase())
        );

        const detected = [];

        for (const appKey of this.targetApps) {
          const keyLower = appKey.toLowerCase();
          const signatures = APP_SIGNATURES[keyLower] || [keyLower];
          const isFound = signatures.some(sig => {
            if (runningProcesses.has(sig)) return true;
            for (const p of runningProcesses) {
              if (p.includes(sig)) return true;
            }
            return false;
          });
          if (isFound) {
            detected.push(appKey);
          }
        }

        resolve({
          activeApps: detected,
          isWorking: detected.length > 0
        });
      });
    });
  }

  // Find exact process PIDs for the user's selected monitored apps
  getTargetAppPids(selectedApps = this.targetApps) {
    return new Promise((resolve) => {
      if (!selectedApps || selectedApps.length === 0) {
        resolve([]);
        return;
      }

      // Collect all signatures to match
      const targetSignatures = [];
      for (const appKey of selectedApps) {
        const keyLower = appKey.toLowerCase();
        const sigs = APP_SIGNATURES[keyLower] || [keyLower];
        targetSignatures.push(...sigs);
      }

      const currentUser = process.env.USER || '';
      const cmd = currentUser 
        ? `ps -u ${currentUser} -o pid,comm` 
        : 'ps -eo pid,comm';

      exec(cmd, (err, stdout) => {
        if (err || !stdout) {
          resolve([]);
          return;
        }

        const lines = stdout.trim().split('\n').slice(1);
        const matched = [];
        const selfPid = process.pid;
        const selfPpid = process.ppid;

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[0], 10);
          const comm = (parts[1] || '').toLowerCase();

          if (isNaN(pid) || pid <= 1 || pid === selfPid || pid === selfPpid) continue;
          if (PROTECTED_COMM.has(comm)) continue;

          for (const sig of targetSignatures) {
            const sigLower = sig.toLowerCase();
            if (comm === sigLower || comm.startsWith(sigLower)) {
              matched.push({ pid, comm, appKey: sigLower });
              break;
            }
          }
        }

        resolve(matched);
      });
    });
  }

  // Freeze target applications (SIGSTOP: halts process execution instantly)
  freezeProcesses(pidList) {
    return new Promise((resolve) => {
      if (!pidList || pidList.length === 0) {
        resolve([]);
        return;
      }

      const pids = pidList.map(item => (typeof item === 'number' ? item : item.pid));
      const successful = [];

      let completed = 0;
      for (const pid of pids) {
        exec(`kill -STOP ${pid}`, (err) => {
          if (!err) {
            this.currentlyFrozenPids.add(pid);
            successful.push(pid);
          }
          completed++;
          if (completed === pids.length) {
            console.log(`🧊 Process Freeze: Halting ${successful.length} PIDs via SIGSTOP [${successful.slice(0, 5).join(', ')}${successful.length > 5 ? '...' : ''}]`);
            resolve(successful);
          }
        });
      }
    });
  }

  // Resume target applications (SIGCONT: thaws execution back to active state)
  resumeProcesses(pidList = Array.from(this.currentlyFrozenPids)) {
    return new Promise((resolve) => {
      if (!pidList || pidList.length === 0) {
        resolve([]);
        return;
      }

      const pids = pidList.map(item => (typeof item === 'number' ? item : item.pid));
      const successful = [];

      let completed = 0;
      for (const pid of pids) {
        exec(`kill -CONT ${pid}`, (err) => {
          if (!err) {
            this.currentlyFrozenPids.delete(pid);
            successful.push(pid);
          }
          completed++;
          if (completed === pids.length) {
            console.log(`☀️ Process Thaw: Resumed ${successful.length} PIDs via SIGCONT [${successful.slice(0, 5).join(', ')}${successful.length > 5 ? '...' : ''}]`);
            resolve(successful);
          }
        });
      }
    });
  }
}

module.exports = ProcessTracker;
