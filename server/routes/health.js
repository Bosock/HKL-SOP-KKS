/* GET /healthz — Liveness-Probe für den Docker-Healthcheck. */
'use strict';
const { SECURITY_HEADERS } = require('../config');

module.exports = {
  matches: pathname => pathname === '/healthz',
  async handle(req, res) {
    res.writeHead(200, Object.assign({ 'Content-Type': 'text/plain' }, SECURITY_HEADERS));
    res.end('ok\n');
  },
};
