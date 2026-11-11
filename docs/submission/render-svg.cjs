// Render a checked-in SVG with Chromium; run after installing application dependencies.
const { createRequire } = require('module');
const path = require('path');
const { pathToFileURL } = require('url');
const root = path.resolve(__dirname, '../..');
const appRequire = createRequire(path.join(root, 'logistics-foundation/package.json'));
const { chromium } = appRequire('playwright');
(async () => {
  const [input, output] = process.argv.slice(2);
  const b = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/local/bin/chromium', args: ['--no-sandbox'] });
  const page = await b.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 1.5 });
  await page.goto(pathToFileURL(path.resolve(input)).href);
  await page.locator('svg').screenshot({ path: output });
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
