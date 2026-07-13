/* /api/state — die Persistenz-API der App.

   GET  ?since=<rev>  → { rev, unchanged:true } wenn nichts Neues, sonst voller Stand
   PUT/POST { state } → Top-Level-Key-Merge, antwortet mit dem autoritativen Stand */
'use strict';
const state = require('../state');
const { sendJSON, readBody } = require('../http-util');
const { SECURITY_HEADERS } = require('../config');

async function handle(req, res, url) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    const STATE = state.getState();
    const since = parseInt(url.searchParams.get('since') || '', 10);
    if (Number.isFinite(since) && since === STATE.rev) {
      sendJSON(req, res, 200, { rev: STATE.rev, unchanged: true });
      return;
    }
    sendJSON(req, res, 200, { rev: STATE.rev, updatedAt: STATE.updatedAt, state: STATE.state });
    return;
  }
  if (req.method === 'PUT' || req.method === 'POST') {
    let body;
    try { body = await readBody(req); }
    catch (e) {
      if (e.code === 'TOO_LARGE') { sendJSON(req, res, 413, { error: 'payload too large' }); return; }
      sendJSON(req, res, 400, { error: 'read error' }); return;
    }
    let payload;
    try { payload = JSON.parse(body.toString('utf8') || '{}'); }
    catch (e) { sendJSON(req, res, 400, { error: 'invalid JSON' }); return; }
    const incoming = payload && typeof payload.state === 'object' && payload.state ? payload.state : null;
    if (!incoming) { sendJSON(req, res, 400, { error: 'missing state object' }); return; }
    const STATE = state.update(incoming);
    // Return the full authoritative state so the client converges on any
    // keys other editors changed in the meantime.
    sendJSON(req, res, 200, { rev: STATE.rev, updatedAt: STATE.updatedAt, state: STATE.state });
    return;
  }
  res.writeHead(405, Object.assign({ 'Allow': 'GET, PUT, POST' }, SECURITY_HEADERS));
  res.end('method not allowed');
}

module.exports = {
  matches: pathname => pathname === '/api/state',
  handle,
};
