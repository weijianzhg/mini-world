import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: process.env.PORT || '3000' },
    host: { type: 'string', default: '127.0.0.1' },
  },
});
const port = Number(values.port);
if (!Number.isInteger(port) || port < 0 || port > 65535)
  throw new Error('Choose a port between 0 and 65535.');
let root;
try {
  root = await realpath(resolve('dist/client'));
  await stat(resolve(root, 'index.html'));
} catch {
  console.error('Build Mini World first: npm run build');
  process.exit(1);
}
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};
const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, 'http://localhost').pathname,
    );
    if (pathname.split('/').some((p) => p.startsWith('.')))
      throw new Error('Hidden file');
    let file = resolve(root, '.' + pathname);
    if (!file.startsWith(root + sep) && file !== root)
      throw new Error('Outside public folder');
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    file = await realpath(file);
    if (!file.startsWith(root + sep)) throw new Error('Outside public folder');
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Content-Length': body.length,
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});
server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, values.host, () =>
  console.log(`Mini World: http://${values.host}:${server.address().port}`),
);
