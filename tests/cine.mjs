// Cinematic captures: full-screen shots of a real match at iPhone size through the VS card, establishing shot,
// Fight!, gameplay framing, an Ultimate cut-in, the deciding knockout, the victory shot, Play of the Match and
// results. Usage: node tests/cine.mjs [env] [fighter] [foe] [map]   → shots/cine/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const [env = 'ground', mine = 'charizard', foe = 'garchomp', map = 'bell_tower'] = process.argv.slice(2);
const OUT = 'shots/cine/' + env; mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT || 8078;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/decode/i.test(m.text())) errs.push(m.text()); });
let n = 0; const snap = async (name) => page.screenshot({ path: `${OUT}/${String(++n).padStart(2, '0')}-${name}.png` });
const click = async (sel, twice) => { await page.click(sel); if (twice) { await page.waitForTimeout(80); if (await page.$(sel)) await page.click(sel); } await page.waitForTimeout(150); };
await page.goto(`http://localhost:${PORT}/?test&autoplay`, { waitUntil: 'networkidle' });
await page.click('.title'); await page.waitForSelector('.mm-list');
await click('[data-go="quick"]'); await click(`[data-env="${env}"]`); await click('[data-f="pokemon"]'); await page.waitForSelector('.grid');
await click(`.grid [data-id="${mine}"]`, true); await click(`.grid [data-id="${foe}"]`, true); await click(`.maps [data-id="${map}"]`); await click('[data-l="normal"]');
await page.waitForSelector('.vs', { timeout: 20000 }); await page.waitForTimeout(700); await snap('vs');
const st = () => page.evaluate(() => { const sc = window.__app.scene; return sc ? { state: sc.state, phase: sc.S && sc.S.phase, tick: sc.S && sc.S.tick, letter: sc.dir && sc.dir.letter, keff: sc.dir && sc.dir.keff } : null; });
await page.waitForFunction(() => window.__app.scene && window.__app.scene.state === 'establish', null, { timeout: 8000 });
await page.waitForTimeout(450); await snap('establish-a');
await page.waitForTimeout(800); await snap('establish-b');
await page.waitForFunction(() => window.__app.scene.fightCalled, null, { timeout: 8000 });
await page.waitForTimeout(250); await snap('fight');
await page.waitForTimeout(2500); await snap('gameplay-a');
await page.waitForTimeout(1800); await snap('gameplay-b');
console.log('state', JSON.stringify(await st()));
// Ultimate: fill my meter; the CPU playing my side fires it
await page.evaluate(() => { window.__app.scene.S.activeOf(0).ult = 100; });
await page.waitForFunction(() => window.__app.scene.dir.cut, null, { timeout: 15000 }).catch(() => console.log('no cut-in seen'));
await page.waitForTimeout(120); await snap('ult-cutin-a');
await page.waitForTimeout(260); await snap('ult-cutin-b');
await page.waitForFunction(() => !window.__app.scene.dir.cut, null, { timeout: 5000 });
await page.waitForTimeout(250); await snap('ult-after');
await page.waitForTimeout(1500);
// deciding knockout
await page.evaluate(() => { const S = window.__app.scene.S; S.activeOf(1).hp = 1; });
await page.waitForFunction(() => window.__app.scene.S && window.__app.scene.S.phase !== 'fight', null, { timeout: 20000 });
await page.waitForTimeout(60); await snap('ko-a');
await page.waitForTimeout(350); await snap('ko-b');
await page.waitForTimeout(900); await snap('ko-c');
await page.waitForFunction(() => window.__app.scene && window.__app.scene.dir && window.__app.scene.dir.lower, null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(900); await snap('victory');
await page.waitForFunction(() => window.__app.scene && (window.__app.scene.state === 'potm' || window.__app.scene.state === 'results'), null, { timeout: 12000 }).catch(() => {});
if ((await st()) && (await st()).state === 'potm') { await page.waitForTimeout(1200); await snap('potm'); }
await page.waitForSelector('.screen.results', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(800); await snap('results');
console.log(errs.length ? 'errors: ' + [...new Set(errs)].join(' | ') : 'no page errors');
await browser.close();
