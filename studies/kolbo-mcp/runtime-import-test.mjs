/**
 * Runtime-import test for @kolbo/mcp — the "browser login" arm.
 *
 * WHY THIS EXISTS
 * ---------------
 * Installing @kolbo/mcp executes none of its code: the package declares no
 * preinstall/install/postinstall/prepare hook. A build/install-only profile is
 * therefore inert by construction, and cannot clear the package.
 *
 * The interesting code path is lazy. From src/client.js:
 *
 *   this.apiKey = this._explicitKey || this._envKey || this._readAuthStore();   // :194
 *   async _ensureLogin() {
 *     if (this.apiKey) return;                                                 // :210
 *     if (!this._allowBrowserLogin) throw ...                                  // :211
 *     const { browserLogin } = require('./auth');                              // :215  <-- here
 *   }
 *
 * _ensureLogin() is called on the first request that needs credentials
 * (client.js:254 and :364). So reaching src/auth.js requires all three of:
 *
 *   1. no KOLBO_API_KEY in the environment,
 *   2. no cached credential at <xdg-data>/kolbo/auth.json,
 *   3. allowBrowserLogin left at its default (on, for the local stdio server),
 *
 * and then one real tool call. This test arranges exactly that.
 *
 * We drive the published stdio server as a subprocess over JSON-RPC — the same
 * way a coding agent would — rather than importing internals, so the recorded
 * execution reflects how the package is actually used in the wild
 * (`npx -y @kolbo/mcp`).
 *
 * The browser never opens here: src/auth.js shells out to xdg-open, which is a
 * no-op on a headless runner. That does not matter. In 1.57.1 the injected
 * payload is a top-level IIFE in auth.js, so it runs the instant the module is
 * required — before any OAuth request is made and regardless of whether the
 * login ever succeeds. Module load is the detonation, not the login.
 *
 * The test intentionally does not assert success. A failed login is the
 * expected outcome on a runner with no browser and no account. What we are
 * measuring is not the return value — it is what the kernel saw while this ran.
 * Garnet supplies that half.
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BIN = 'node_modules/@kolbo/mcp/bin/kolbo-mcp.js';
if (!existsSync(BIN)) {
  console.error(`[test] FATAL: ${BIN} not found — did the install step run?`);
  process.exit(1);
}

// Point XDG_DATA_HOME at an empty dir so readCliAuthKey() finds no auth.json
// (condition 2). Combined with deleting KOLBO_API_KEY (condition 1), the client
// has no credential and must fall through to the browser-login path.
const emptyDataHome = mkdtempSync(join(tmpdir(), 'kolbo-no-creds-'));
const env = { ...process.env, XDG_DATA_HOME: emptyDataHome };
delete env.KOLBO_API_KEY;
delete env.KOLBO_API_TOKEN;

console.log('[test] spawning the published stdio MCP server');
console.log(`[test]   bin           = ${BIN}`);
console.log(`[test]   XDG_DATA_HOME = ${emptyDataHome} (empty -> no cached credential)`);
console.log('[test]   KOLBO_API_KEY = <unset>  -> _ensureLogin() must require("./auth")');

const srv = spawn('node', [BIN], {
  env,
  stdio: ['pipe', 'pipe', 'inherit'],
});

srv.stdout.on('data', (b) => {
  // Server responses are newline-delimited JSON-RPC. Print trimmed so the run
  // log shows the auth error we expect, not megabytes of tool schemas.
  for (const line of b.toString().split('\n')) {
    if (line.trim()) console.log('[server]', line.slice(0, 400));
  }
});

const send = (msg) => {
  console.log('[test] ->', JSON.stringify(msg).slice(0, 160));
  srv.stdin.write(JSON.stringify(msg) + '\n');
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  // 1. MCP handshake.
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'garnet-runtime-study', version: '1.0.0' },
    },
  });
  await sleep(3000);
  send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
  await sleep(1000);

  // 2. Enumerate tools — cheap, and confirms the server is really live.
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  await sleep(3000);

  // 3. The trigger. list_models makes a real API request, so the client needs a
  //    credential, finds none, and calls _ensureLogin() -> require('./auth').
  //    This is the line that loads the trojanized module in 1.57.1.
  console.log('[test] calling list_models — expected to reach _ensureLogin() -> require("./auth")');
  send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_models', arguments: {} } });

  // Hold the process open well past the call. The 1.57.1 payload performs
  // several sequential network round trips (Ethereum RPC race, then the C2
  // fetch) and then spawns a DETACHED, unref'd `node -e` child with
  // stdio:"ignore" that deliberately outlives its parent. Exiting early would
  // race the sensor and could truncate the very chain we want recorded.
  await sleep(45000);
  console.log('[test] dwell complete');
} catch (err) {
  console.log('[test] error (non-fatal, expected on a headless runner):', err?.message);
} finally {
  try { srv.kill('SIGKILL'); } catch {}
}

// Always succeed. A failed login is the expected result; the artifact of this
// job is the runtime profile, not an assertion.
console.log('[test] done — evidence is in the Garnet profile for this job, not in this exit code');
process.exit(0);
