// Exports the machine twin to models/ using the page's own exporter in headless Chrome.
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('web');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const f = path.join(root, u === '/' ? 'index.html' : u);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.goto(`http://localhost:${srv.address().port}/machine.html?t=503`, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 3000));
const b64 = await page.evaluate(async () => {
  const buf = await window.__machine.m3d.exportGLB();
  let s = '';
  const u = new Uint8Array(buf);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
});
fs.mkdirSync('models', { recursive: true });
fs.writeFileSync('models/2040-cnv-202-drive-unit.glb', Buffer.from(b64, 'base64'));
console.log('GLB bytes', Buffer.from(b64, 'base64').length);
await browser.close();
srv.close();
