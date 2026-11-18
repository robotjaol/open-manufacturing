// Headless screenshots of the built page. Usage: node scripts/shot.mjs [name] [width] [height] [query]
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const [name = 'desk', w = '1440', h = '900', q = ''] = process.argv.slice(2);
const root = path.resolve('web');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const f = path.join(root, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = srv.address().port;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
await page.setViewport({ width: +w, height: +h, deviceScaleFactor: 1 });
await page.goto(`http://localhost:${port}/?${q}`, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 4500));
await page.screenshot({ path: `shots/${name}.png`, fullPage: process.env.FULL === '1' });
console.log(logs.slice(0, 15).join('\n') || 'no console output');
await browser.close();
srv.close();
