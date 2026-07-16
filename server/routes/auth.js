/* GitHub-OAuth-Login (optional). Endpunkte:
     GET /auth/github           → Weiterleitung zu GitHub (Authorize)
     GET /auth/github/callback  → Code gegen Token tauschen, Cookie setzen
     GET /auth/logout           → Session-Cookie löschen
     GET /auth/user             → aktuellen Nutzer melden ({user:null} wenn keiner)
   Ist GITHUB_CLIENT_ID/SECRET nicht gesetzt, sind nur /auth/user und
   /auth/logout nutzbar (liefern sauberes JSON); der eigentliche Flow meldet 400. */
'use strict';
const crypto = require('crypto');
const config = require('../config.js');
const { sendJSON } = require('../http-util.js');

/* Session-Signierung (HMAC-SHA256). Das Cookie trägt die Nutzerdaten als
   base64url-JSON plus eine Signatur: "<payload>.<sig>". Ohne gültige Signatur
   wird das Cookie verworfen — so kann niemand durch simples base64-Basteln
   eine fremde Identität (oder Admin-Rechte, falls später darauf aufgebaut
   wird) vortäuschen. */
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(str) {
  return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
function hmac(payloadB64) {
  return b64url(crypto.createHmac('sha256', config.SESSION_SECRET).update(payloadB64).digest());
}
function signSession(obj) {
  const payload = b64url(JSON.stringify(obj));
  return payload + '.' + hmac(payload);
}
function verifySession(raw) {
  if (typeof raw !== 'string' || raw.indexOf('.') < 0) return null;
  const i = raw.lastIndexOf('.');
  const payload = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  const expected = hmac(payload);
  // Längen-Guard vor timingSafeEqual (wirft bei ungleicher Länge).
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try { return JSON.parse(fromB64url(payload).toString('utf8')); }
  catch (e) { return null; }
}
function sessionCookie(name, value, maxAge) {
  const secure = config.COOKIE_SECURE ? ' Secure;' : '';
  return `${name}=${value}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${maxAge}`;
}

function matches(pathname) {
  return pathname.startsWith('/auth/');
}

async function handle(req, res, url) {
  const p = url.pathname;
  if (p === '/auth/user' && req.method === 'GET') { handleGetUser(req, res); return; }
  if (p === '/auth/logout' && req.method === 'GET') { handleLogout(res); return; }

  // Ab hier ist GitHub-OAuth-Konfiguration erforderlich.
  if (!config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET) {
    sendJSON(req, res, 400, { error: 'GitHub OAuth ist auf diesem Server nicht konfiguriert' });
    return;
  }
  if (p === '/auth/github' && req.method === 'GET') { handleGitHubLogin(res); return; }
  if (p === '/auth/github/callback' && req.method === 'GET') { await handleGitHubCallback(req, res, url); return; }
  sendJSON(req, res, 404, { error: 'Not found' });
}

function handleGitHubLogin(res) {
  const state = randomToken();
  const auth = new URL('https://github.com/login/oauth/authorize');
  auth.searchParams.set('client_id', config.GITHUB_CLIENT_ID);
  auth.searchParams.set('redirect_uri', config.GITHUB_CALLBACK_URL);
  auth.searchParams.set('scope', 'read:user user:email');
  auth.searchParams.set('state', state);
  res.writeHead(302, {
    'Set-Cookie': sessionCookie('oauth_state', state, 600),
    'Location': auth.toString(),
  });
  res.end();
}

async function handleGitHubCallback(req, res, url) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookies = parseCookies(req);
  if (!code || !state || state !== cookies.oauth_state) {
    sendJSON(req, res, 400, { error: 'Ungültiger OAuth-Zustand' });
    return;
  }
  try {
    const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: config.GITHUB_CLIENT_ID,
        client_secret: config.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: config.GITHUB_CALLBACK_URL,
      }),
    });
    const token = await tokenResp.json();
    if (token.error || !token.access_token) {
      sendJSON(req, res, 400, { error: token.error_description || 'OAuth fehlgeschlagen' });
      return;
    }
    const userResp = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'hkl-sop-kks',
      },
    });
    const user = await userResp.json();
    const session = signSession({
      id: user.id, login: user.login, name: user.name || user.login,
    });
    res.writeHead(302, {
      'Set-Cookie': [
        sessionCookie('github_session', session, 2592000),
        `oauth_state=; Path=/; HttpOnly; Max-Age=0`,
      ],
      'Location': '/',
    });
    res.end();
  } catch (err) {
    console.error('[auth] GitHub OAuth error:', err && err.message);
    sendJSON(req, res, 502, { error: 'OAuth-Austausch fehlgeschlagen' });
  }
}

function handleLogout(res) {
  res.writeHead(302, {
    'Set-Cookie': 'github_session=; Path=/; HttpOnly; Max-Age=0',
    'Location': '/',
  });
  res.end();
}

function handleGetUser(req, res) {
  const cookies = parseCookies(req);
  const u = verifySession(cookies.github_session);
  if (!u) { sendJSON(req, res, 200, { user: null }); return; }
  sendJSON(req, res, 200, { user: { id: u.id, login: u.login, name: u.name } });
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i < 0) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function randomToken() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = { matches, handle, signSession, verifySession };
