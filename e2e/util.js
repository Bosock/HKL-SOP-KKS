/* Gemeinsamer Unterbau der E2E-Tests: echten Server starten (eigener Port,
   frisches STATE_DIR pro Test) und einen Chromium-Browser öffnen.
   Bewusst KEIN Teil von `npm test` (CI hat kein Chromium) — Aufruf lokal:
   `npm run e2e` bzw. `node e2e/<datei>`. Siehe e2e/README.md. */
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* playwright auflösen: lokal installiert → global (npm root -g). */
function playwright() {
  try { return require('playwright'); } catch (e) {}
  const g = execSync('npm root -g').toString().trim();
  return require(path.join(g, 'playwright'));
}

/* Chromium starten: erst Standard-Auflösung (PLAYWRIGHT_BROWSERS_PATH),
   sonst bekannte Installationen unter /opt/pw-browsers durchsuchen,
   zusätzlich per E2E_CHROME übersteuerbar. */
async function launchBrowser() {
  const pw = playwright();
  if (process.env.E2E_CHROME) return pw.chromium.launch({ executablePath: process.env.E2E_CHROME });
  try { return await pw.chromium.launch(); }
  catch (e) {
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
    for (const d of (fs.existsSync(base) ? fs.readdirSync(base) : [])) {
      const exe = path.join(base, d, 'chrome-linux', 'chrome');
      if (d.startsWith('chromium') && fs.existsSync(exe)) return pw.chromium.launch({ executablePath: exe });
    }
    throw e;
  }
}

/* Server als Kindprozess mit frischem STATE_DIR; wartet auf /healthz. */
async function startServer(extraEnv = {}) {
  const port = 30000 + Math.floor(Math.random() * 20000);
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hkl-e2e-'));
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    env: { ...process.env, PORT: String(port), STATE_DIR: stateDir, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = ''; child.stdout.on('data', d => out += d); child.stderr.on('data', d => out += d);
  const base = `http://localhost:${port}`;
  const deadline = Date.now() + 10000;
  for (;;) {
    try { const r = await fetch(base + '/healthz'); if (r.ok) break; } catch (e) {}
    if (Date.now() > deadline) { child.kill(); throw new Error('Server startete nicht:\n' + out); }
    await new Promise(r => setTimeout(r, 150));
  }
  return {
    base, port, stateDir,
    log: () => out,
    stop: () => new Promise(res => { child.once('exit', res); child.kill(); setTimeout(res, 1500); }),
  };
}

/* Seite laden und auf vollständigen Boot warten (DB + aktiver Sync-Hook).
   Sammelt Konsolen-/Seitenfehler; Dialoge werden automatisch bestätigt. */
async function bootPage(browser, base, { viewport = { width: 390, height: 844 }, dialogText = 'E2E', hasTouch = false } = {}) {
  const ctx = await browser.newContext({ viewport, hasTouch });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  page.on('dialog', d => d.accept(dialogText));
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => typeof DB !== 'undefined' && DB && DB.standards && DB.standards.length > 0 && typeof onStoreSet === 'function',
    { timeout: 15000 });
  return { page, ctx, errs };
}

/* Einheitliche Ausgabe + Sammel-Exitcode. */
function reporter(name) {
  let failed = false;
  return {
    ok(label) { console.log('  ✓ ' + label); },
    fail(label) { console.error('  ✗ ' + label); failed = true; },
    check(label, cond) { cond ? this.ok(label) : this.fail(label); return !!cond; },
    async finish(browser, servers = []) {
      if (browser) await browser.close().catch(() => {});
      for (const s of servers) await s.stop().catch(() => {});
      console.log((failed ? 'FAIL ' : 'PASS ') + name);
      process.exit(failed ? 1 : 0);
    },
  };
}

module.exports = { launchBrowser, startServer, bootPage, reporter, ROOT };
