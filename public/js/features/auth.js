'use strict';

let currentGithubUser = null;
/* Ob der Server GitHub-OAuth überhaupt konfiguriert hat. Ist es nicht der Fall,
   blenden wir den Login-Knopf aus – sonst landet ein Klick auf der 400-Seite
   von /auth/github. Voreinstellung true (backward-kompatibel: meldet ein alter
   Server das Feld nicht, verhält sich die App wie bisher). */
let oauthAvailable = true;

async function initAuth() {
  try {
    const res = await fetch('/auth/user');
    const data = await res.json();
    currentGithubUser = data.user;
    if (data && data.oauth === false) oauthAvailable = false;
    updateAuthUI();
  } catch (err) {
    console.error('Failed to load auth user:', err);
  }
}

function updateAuthUI() {
  const authBtn = document.getElementById('authBtn');
  if (!authBtn) return;

  if (currentGithubUser) {
    const who = currentGithubUser.name || currentGithubUser.login || ('#' + currentGithubUser.id);
    authBtn.style.display = '';
    authBtn.textContent = '👤';
    authBtn.title = `Angemeldet als ${who} (GitHub)`;
    authBtn.onclick = () => {
      if (confirm(`Angemeldet als ${who}.\n\nAbmelden?`)) window.location.href = '/auth/logout';
    };
  } else if (oauthAvailable) {
    authBtn.style.display = '';
    authBtn.textContent = '🔓';
    authBtn.title = 'Mit GitHub anmelden';
    authBtn.onclick = () => window.location.href = '/auth/github';
  } else {
    // OAuth auf diesem Server nicht konfiguriert → Knopf verbergen (der
    // Verwaltungsmodus wird ohnehin per Passwort über das ☰-Menü freigeschaltet).
    authBtn.style.display = 'none';
    authBtn.onclick = null;
  }
}

function isAuthenticated() {
  return !!currentGithubUser;
}

function getGithubUserId() {
  return currentGithubUser?.id || null;
}
