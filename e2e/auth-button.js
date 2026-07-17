/* Login-Knopf-Verhalten je Server-Konfiguration: ohne OAuth versteckt
   (keine 400-Sackgasse), mit OAuth sichtbar; /auth/user meldet das Flag. */
'use strict';
const { launchBrowser, startServer, bootPage, reporter } = require('./util');

async function probe(browser, base) {
  const { page, ctx } = await bootPage(browser, base);
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => { const b = document.getElementById('authBtn');
    return { shown: b && getComputedStyle(b).display !== 'none', avail: typeof oauthAvailable !== 'undefined' ? oauthAvailable : null }; });
  await ctx.close();
  return r;
}

(async () => {
  const r = reporter('auth-button');
  const plain = await startServer();
  const oauth = await startServer({ GITHUB_CLIENT_ID: 'Iv1.test', GITHUB_CLIENT_SECRET: 'secret', SESSION_SECRET: 'fixed-e2e' });
  const browser = await launchBrowser();

  const a = await probe(browser, plain.base);
  r.check('ohne OAuth: Knopf versteckt', a.shown === false && a.avail === false);
  const b = await probe(browser, oauth.base);
  r.check('mit OAuth: Knopf sichtbar', b.shown === true && b.avail === true);

  const ju = await (await fetch(plain.base + '/auth/user')).json();
  r.check('/auth/user meldet oauth:false', ju.oauth === false && ju.user === null);
  const red = await fetch(oauth.base + '/auth/github', { redirect: 'manual' });
  r.check('/auth/github leitet zu GitHub um (302 + state)', red.status === 302 && /github\.com\/login\/oauth\/authorize.*state=/.test(red.headers.get('location') || ''));

  await r.finish(browser, [plain, oauth]);
})().catch(e => { console.error('DRIVER', e); process.exit(1); });
