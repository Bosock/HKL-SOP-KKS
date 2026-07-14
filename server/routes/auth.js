'use strict';
const { URL } = require('url');
const config = require('../config.js');
const { sendJSON } = require('../http-util.js');

function matches(pathname) {
  return pathname.startsWith('/auth/');
}

async function handle(req, res, url) {
  if (!config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET) {
    sendJSON(res, 400, { error: 'GitHub OAuth not configured' });
    return;
  }

  if (url.pathname === '/auth/github' && req.method === 'GET') {
    handleGitHubLogin(req, res, url);
  } else if (url.pathname === '/auth/github/callback' && req.method === 'GET') {
    await handleGitHubCallback(req, res, url);
  } else if (url.pathname === '/auth/logout' && req.method === 'GET') {
    handleLogout(req, res);
  } else if (url.pathname === '/auth/user' && req.method === 'GET') {
    handleGetUser(req, res);
  } else {
    sendJSON(res, 404, { error: 'Not found' });
  }
}

function handleGitHubLogin(req, res, url) {
  const state = Math.random().toString(36).substring(7);
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', config.GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set('redirect_uri', config.GITHUB_CALLBACK_URL);
  githubAuthUrl.searchParams.set('scope', 'user:email read:user');
  githubAuthUrl.searchParams.set('state', state);

  res.writeHead(302, { 'Set-Cookie': `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax` });
  res.writeHead(302, { Location: githubAuthUrl.toString() });
  res.end();
}

async function handleGitHubCallback(req, res, url) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookies = parseCookies(req);

  if (!code || !state || state !== cookies.oauth_state) {
    sendJSON(res, 400, { error: 'Invalid OAuth state' });
    return;
  }

  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.GITHUB_CLIENT_ID,
        client_secret: config.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error) {
      sendJSON(res, 400, { error: tokenData.error_description || 'OAuth failed' });
      return;
    }

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const userData = await userResponse.json();

    const token = Buffer.from(`${userData.id}:${tokenData.access_token}`).toString('base64');
    res.writeHead(302, {
      'Set-Cookie': [
        `github_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
        `oauth_state=; Path=/; HttpOnly; Max-Age=0`,
      ],
      'Location': '/',
    });
    res.end();
  } catch (err) {
    console.error('GitHub OAuth error:', err);
    sendJSON(res, 500, { error: 'OAuth exchange failed' });
  }
}

function handleLogout(req, res) {
  res.writeHead(302, {
    'Set-Cookie': 'github_token=; Path=/; HttpOnly; Max-Age=0',
    'Location': '/',
  });
  res.end();
}

function handleGetUser(req, res) {
  const cookies = parseCookies(req);
  if (!cookies.github_token) {
    sendJSON(res, 200, { user: null });
    return;
  }

  try {
    const [userId] = Buffer.from(cookies.github_token, 'base64').toString().split(':');
    sendJSON(res, 200, { user: { id: userId } });
  } catch (err) {
    sendJSON(res, 200, { user: null });
  }
}

function parseCookies(req) {
  const cookies = {};
  const cookieHeader = req.headers.cookie || '';
  cookieHeader.split(';').forEach(cookie => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

module.exports = { matches, handle };
