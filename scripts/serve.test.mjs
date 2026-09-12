import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('serves the built game and refuses private files and writes', async () => {
  const child = spawn(process.execPath, ['scripts/serve.mjs', '--port', '0'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Preview did not start')),
        15000,
      );
      child.stdout.on('data', (data) => {
        const match = String(data).match(/http:\/\/[^\s]+/);
        if (match) {
          clearTimeout(timer);
          resolve(match[0]);
        }
      });
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`Preview exited: ${code}`));
      });
    });
    const response = await fetch(url);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Mini World/);
    const asset = html.match(/src="([^\"]+\.js)"/)[1];
    assert.equal((await fetch(new URL(asset, url))).status, 200);
    for (const path of [
      '/.env',
      '/.openai/hosting.json',
      '/package.json',
      '/%2e%2e%2fpackage.json',
      '/missing-file',
    ])
      assert.equal((await fetch(url + path)).status, 404);
    assert.equal((await fetch(url, { method: 'POST' })).status, 405);
    assert.equal((await fetch(url, { method: 'HEAD' })).status, 200);
  } finally {
    child.kill();
  }
});
