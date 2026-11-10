// ui_roles.mjs — run by ui_roles.py, which signs the people in. For each one: build their menu with the app's own
// navConfig.js, open every page in it, then every page that is NOT in it, and record what went wrong.
//   node tests/ui_roles.mjs <frontend URL> <personas.json> <report.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [front, personasPath, reportPath] = process.argv.slice(2);
const personas = JSON.parse(readFileSync(personasPath, 'utf8'));
const { getNavItems } = await import(pathToFileURL(resolve(ROOT, 'src/components/layout/navConfig.js')).href);

// Every signed-in page in App.jsx (public pages, redirects and old links left out). "/" is the 3D campus,
// which needs WebGL: it is checked on its own by the campus tests, not here.
const appSource = readFileSync(resolve(ROOT, 'src/App.jsx'), 'utf8');
const SKIP = new Set(['/', '/login', '/register', '/forgot-password', '/verify', '/visit', '/find', '/rooms',
  '/ai/predictions', '/ai/assistant', '/ai/recommendations', '/account']);
const ALL = [...new Set([...appSource.matchAll(/path="(\/[^"]*)"/g)].map((m) => m[1]))]
  .filter((p) => !SKIP.has(p) && !p.includes(':') && !p.includes('*'));

const flatten = (items) => items.flatMap((i) => (i.dropdown ? i.items : [i])).map((i) => ({ to: i.to, label: i.label }));

async function visit(page, path) {
  const api = [];
  const errors = [];
  const onResponse = (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/api/') && r.status() >= 400) api.push(`${r.request().method()} ${u.pathname} -> ${r.status()}`);
  };
  const onPageError = (e) => errors.push(`page error: ${e.message.split('\n')[0]}`);
  const onConsole = (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(`console: ${m.text().split('\n')[0].slice(0, 200)}`);
  };
  page.on('response', onResponse); page.on('pageerror', onPageError); page.on('console', onConsole);
  // A redirect while the page loads aborts goto: that's a result to record, not a failure of the check
  await page.goto(front + path, { waitUntil: 'domcontentloaded' }).catch((e) => errors.push(`navigation: ${e.message.split('\n')[0]}`));
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
  const landed = new URL(page.url()).pathname;
  const crashed = await page.getByText("This page couldn't be shown").count();
  const missing = await page.getByText('Page not found').count();
  page.off('response', onResponse); page.off('pageerror', onPageError); page.off('console', onConsole);
  return { path, landed, redirected: landed !== path, crashed: crashed > 0, notFound: missing > 0, api, errors };
}

async function check(browser, p) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const user = { ...p.user, avatar: p.user.name.slice(0, 2).toUpperCase() };
  await ctx.addInitScript(([t, u]) => {
    localStorage.setItem('campussphere_token', t);
    localStorage.setItem('campussphere_user', u);
  }, [p.token, JSON.stringify(user)]);
  const page = await ctx.newPage();
  const menu = flatten(getNavItems(p.user.role, p.roles)).filter((i) => i.to !== '/');
  const inMenu = new Set(menu.map((i) => i.to));
  const menuResults = [];
  for (const item of menu) menuResults.push({ label: item.label, ...(await visit(page, item.to)) });
  const offMenu = [];
  for (const path of ALL.filter((x) => !inMenu.has(x))) offMenu.push(await visit(page, path));
  await ctx.close();
  return { key: p.key, label: p.label, role: p.user.role, roles: p.roles, menu: menuResults, offMenu };
}

const browser = await chromium.launch();
const results = [];
const queue = [...personas];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const p = queue.shift();
    const r = await check(browser, p);
    results.push(r);
    const bad = r.menu.filter((m) => m.redirected || m.crashed || m.notFound || m.api.length || m.errors.length);
    console.log(`${bad.length ? 'ISSUES' : 'OK    '}  ${r.label.padEnd(36)} ${r.menu.length} menu pages, ${bad.length} with problems`);
  }
}));
await browser.close();
writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\nreport: ${reportPath}`);
