'use strict';

let currentGithubUser = null;

async function initAuth() {
  try {
    const res = await fetch('/auth/user');
    const data = await res.json();
    currentGithubUser = data.user;
    updateAuthUI();
  } catch (err) {
    console.error('Failed to load auth user:', err);
  }
}

function updateAuthUI() {
  const authBtn = document.getElementById('authBtn');
  if (!authBtn) return;

  if (currentGithubUser) {
    authBtn.textContent = '👤';
    authBtn.title = `Angemeldet als: ${currentGithubUser.id}`;
    authBtn.onclick = () => {
      const msg = `${currentGithubUser.id}\n\nAbmelden?`;
      if (confirm(msg)) window.location.href = '/auth/logout';
    };
  } else {
    authBtn.textContent = '🔓';
    authBtn.title = 'Mit GitHub anmelden';
    authBtn.onclick = () => window.location.href = '/auth/github';
  }
}

function isAuthenticated() {
  return !!currentGithubUser;
}

function getGithubUserId() {
  return currentGithubUser?.id || null;
}
