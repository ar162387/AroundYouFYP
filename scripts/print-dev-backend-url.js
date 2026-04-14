#!/usr/bin/env node
/**
 * Prints a suggested BACKEND_API_URL for dev on a physical phone (same Wi‑Fi as this Mac).
 * Port must match backend/Properties/launchSettings.json (default 5017).
 */
const os = require('os');
const { execSync } = require('child_process');

const DEFAULT_PORT = process.env.BACKEND_PORT || '5017';

function isPrivateIPv4(addr) {
  if (!addr || typeof addr !== 'string') return false;
  if (addr.startsWith('192.168.')) return true;
  if (addr.startsWith('10.')) return true;
  const m = addr.match(/^172\.(\d+)\./);
  if (m) {
    const second = parseInt(m[1], 10);
    return second >= 16 && second <= 31;
  }
  return false;
}

function score(addr) {
  if (addr.startsWith('192.168.')) return 30;
  if (addr.startsWith('10.')) return 20;
  const m = addr.match(/^172\.(\d+)\./);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 16 && n <= 31) return 25;
  }
  return 10;
}

function collectIPv4() {
  const out = [];
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family !== 'IPv4' && net.family !== 4) continue;
        if (net.internal) continue;
        out.push({ name, address: net.address });
      }
    }
  } catch {
    // Sandboxed or restricted environments (e.g. CI) may block interface enumeration.
  }
  return out;
}

/** macOS: common Wi‑Fi interfaces when Node cannot list interfaces */
function darwinFallbackIps() {
  if (process.platform !== 'darwin') return [];
  const out = [];
  for (const iface of ['en0', 'en1', 'en2']) {
    try {
      const addr = execSync(`ipconfig getifaddr ${iface}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (addr && /^[\d.]+$/.test(addr) && !addr.startsWith('127.')) {
        out.push({ name: iface, address: addr });
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

let candidates = collectIPv4().filter((x) => isPrivateIPv4(x.address));
if (candidates.length === 0) {
  candidates = darwinFallbackIps().filter((x) => isPrivateIPv4(x.address));
}
candidates.sort((a, b) => score(b.address) - score(a.address));

console.log('');
console.log('--- Dev backend URL (physical phone, same Wi‑Fi) ---');
console.log('');
if (candidates.length === 0) {
  console.log('No private LAN IPv4 found. Connect Wi‑Fi, then run again.');
  console.log('Or set BACKEND_API_URL manually to http://<your-mac-lan-ip>:' + DEFAULT_PORT);
} else {
  const best = candidates[0];
  const url = `http://${best.address}:${DEFAULT_PORT}`;
  console.log('Suggested (phone + Mac on same home Wi‑Fi):');
  console.log('');
  console.log(`  BACKEND_API_URL=${url}`);
  console.log('');
  if (candidates.length > 1) {
    console.log('Other LAN addresses on this Mac:');
    for (const c of candidates.slice(1)) {
      console.log(`  http://${c.address}:${DEFAULT_PORT}  (${c.name})`);
    }
    console.log('');
  }
}
console.log('1. Put that line in repo-root .env');
console.log('2. Run backend: dotnet run --project backend/Ay.WebApi.csproj (or your IDE)');
console.log('3. Rebuild app: yarn android (USB device) — debug builds allow HTTP');
console.log('   Android emulator still uses: BACKEND_API_URL=http://10.0.2.2:' + DEFAULT_PORT);
console.log('');
console.log('--- Metro (JS bundle) on a physical phone ---');
console.log('Debug builds load JavaScript from your Mac on port 8081. On the phone,');
console.log('"localhost" is the phone itself, so you must do one of the following:');
console.log('');
console.log('  USB:  yarn android:adb-reverse   then reload the app (or re-run yarn android)');
console.log('  Wi‑Fi: yarn start:lan             then on the phone: shake → Dev settings →');
console.log('        "Debug server host & port for device" → <same-LAN-IP-as-above>:8081');
console.log('');
console.log('debugRelease APK on a real phone: use this same LAN URL in .env.lan, then:');
console.log('  cp .env .env.lan  → edit BACKEND_API_URL in .env.lan → yarn android:apk:debugRelease:lan');
console.log('');
