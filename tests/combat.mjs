// Captures of the 2.0 combat in a real battle at phone size: combo counter, finisher, counter hit, armour, clash,
// on fire, chain into a special. The CPU plays both sides; frames are taken the moment each thing first happens.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = 'shots/combat'; mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT || 8078;
const A = process.env.A || 'garchomp', B = process.env.B || 'charizard', ENV = process.env.ENVN || 'ground';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://localhost:${PORT}/?test&autoplay&speed=1`, { waitUntil: 'networkidle' });
await page.click('.title'); await page.waitForSelector('.mm-list');
await page.evaluate(() => { const s = window.__app.settings; s.skipIntros = true; });
const click = async (sel, twice) => { await page.click(sel); if (twice) { await page.waitForTimeout(80); if (await page.$(sel)) await page.click(sel); } await page.waitForTimeout(160); };
await click('[data-go="quick"]'); await click(`[data-env="${ENV}"]`); await click('[data-f="pokemon"]'); await page.waitForSelector('.grid');
await click(`.grid [data-id="${A}"]`, true); await click(`.grid [data-id="${B}"]`, true); await click('.maps [data-id="random"]'); await click('[data-l="hard"]');
await page.waitForFunction(() => window.__app.scene && window.__app.scene.state === 'fight' && window.__app.scene.S.phase === 'fight', null, { timeout: 30000 });
// record which events have fired, inside the page
await page.evaluate(() => {
  const sc = window.__app.scene, seen = (window.__seen = {});
  const orig = sc.consume.bind(sc);
  sc.consume = (evs) => { for (const e of evs) { let k = e.e; if (k === 'hit' && e.finisher) k = 'finisher'; if (k === 'combo' && e.n >= 5) k = 'combo5'; if (k === 'chain') k = 'chain:' + (e.to === 'ult' ? 'ult' : 'special'); if (k === 'clash' && e.melee) k = 'meleeClash'; seen[k] = (seen[k] || 0) + 1; } return orig(evs); };
});
const want = ['finisher', 'combo5', 'counterHit', 'armor', 'meleeClash', 'onFire', 'chain:special', 'chain:ult', 'breakout', 'dashStrike'];
const got = new Set(); let n = 0;
for (let i = 0; i < 1500 && got.size < want.length; i++) {
  const seen = await page.evaluate(() => Object.assign({}, window.__seen, { over: !window.__app.scene || !!window.__app.scene.S.result }));
  for (const k of want) if (seen[k] && !got.has(k)) { got.add(k); await page.screenshot({ path: `${OUT}/${String(++n).padStart(2, '0')}-${k.replace(':', '-')}.png` }); }
  if (seen.over) break;
  await page.waitForTimeout(30);
}
console.log('captured:', [...got].join(', ') || 'nothing', '| missing:', want.filter((k) => !got.has(k)).join(', ') || 'none');
console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors');
await browser.close();
