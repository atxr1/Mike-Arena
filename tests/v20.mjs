// Checks and captures for Combat 2.0 in the real game at phone size, played by hand through the touch input hook:
// Training goals, the basic string, a chain (and the buttons lighting up for it), knockdown and get-up, the results
// screen with style rank, medals and mastery, the Records mastery column and the How to fight text.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = 'shots/v20'; mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT || 8078;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
let n = 0, fails = 0; const snap = async (name) => page.screenshot({ path: `${OUT}/${String(++n).padStart(2, '0')}-${name}.png` });
const ok = (c, msg) => { if (!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + msg); };
const click = async (sel, twice) => { await page.click(sel); if (twice) { await page.waitForTimeout(80); if (await page.$(sel)) await page.click(sel); } await page.waitForTimeout(160); };
const home = async (q = '') => { await page.goto(`http://localhost:${PORT}/?test${q}`, { waitUntil: 'networkidle' }); await page.click('.title'); await page.waitForSelector('.mm-list'); await page.waitForTimeout(700); };
const st = () => page.evaluate(() => { const sc = window.__app.scene, S = sc.S, f = S.activeOf(0), o = S.activeOf(1); return { tick: S.tick, fin: f.stats.finishers, chains: f.stats.chains, combo: f.stats.maxCombo, foeUp: S.tick < o.mercyUntil, foeHp: o.hp / o.maxHp, goal: sc.goals ? sc.goals[sc.goalIdx] && sc.goals[sc.goalIdx].title : null, goalIdx: sc.goalIdx, state: f.state }; });
// put the training opponent right in front of the player
const face = () => page.evaluate(() => { const S = window.__app.scene.S, f = S.activeOf(0), o = S.activeOf(1); const cx = (S.bounds.x0 + S.bounds.x1) / 2, cy = (S.bounds.y0 + S.bounds.y1) / 2; f.x = cx - 16; f.y = cy; o.x = cx + 16; o.y = cy; f.vx = f.vy = o.vx = o.vy = 0; o.kvx = o.kvy = 0; f.stamina = 100; f.cds = [0, 0, 0, 0]; });
const tap = (b) => page.evaluate((b2) => window.__app.input.tap(b2), b);

// ---- training: goals, string, chain, knockdown
await home();
await click('[data-go="training"]'); await click('[data-env="ground"]'); await page.waitForSelector('.grid');
await click('.grid [data-id="lucario"]', true); await click('.grid [data-id="tyranitar"]', true); await click('.maps [data-id="random"]');
await page.waitForFunction(() => window.__app.scene && window.__app.scene.state === 'fight' && window.__app.scene.S.phase === 'fight', null, { timeout: 30000 });
await page.waitForTimeout(1200);
let s = await st();
ok(s.goal === 'Land a full basic string', `Training opens with the first goal (${s.goal})`);
await snap('training-goal-1');
// the basic string: three taps
await face();
for (let i = 0; i < 12 && (await st()).fin < 1; i++) { await tap('cross'); await page.waitForTimeout(150); }
s = await st();
ok(s.fin >= 1, 'three taps of the basic attack land a Finisher');
await page.waitForTimeout(250);
const up = await page.evaluate(async () => { const S = window.__app.scene.S, o = S.activeOf(1); for (let i = 0; i < 90; i++) { if (S.tick < o.mercyUntil) return true; await new Promise((r) => setTimeout(r, 16)); } return false; });
ok(up, 'the Finisher knocks the opponent down: it gets up untouchable');
await snap('knockdown');
await page.waitForTimeout(1600);
s = await st();
ok(s.goalIdx >= 1, `the first goal completes and the next one shows (${s.goal})`);
// a chain: tap the basic attack, and press a special the moment the hit lands; the special buttons must light up
await page.waitForFunction(() => { const S = window.__app.scene.S; return S.tick >= S.activeOf(1).mercyUntil; });
let lit = false, chained = false;
for (let attempt = 0; attempt < 6 && !chained; attempt++) {
  await face(); await page.waitForTimeout(120);
  await tap('cross');
  for (let i = 0; i < 40 && !chained; i++) {
    const v = await page.evaluate(() => { const f = window.__app.scene.S.activeOf(0); return { open: f.canChainNow(), lit: !!document.querySelector('.t-face.chain'), chains: f.stats.chains }; });
    if (v.lit) lit = true;
    if (v.open) { if (!lit) { await page.waitForTimeout(20); lit = !!(await page.$('.t-face.chain')); } if (lit && n < 3) await snap('chain-window'); await tap('square'); await page.waitForTimeout(60); }
    chained = v.chains >= 1 || (await st()).chains >= 1;
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(900);
}
ok(lit, 'the special buttons light up while the chain window is open');
ok(chained, 'pressing a special in the window chains into it');
await page.waitForTimeout(1800);
s = await st();
ok(s.goalIdx >= 2, `the chain goal completes (${s.goal})`);
await snap('training-goal-next');
await page.evaluate(() => window.__app.scene.pause()); await page.waitForSelector('.menu-layer'); await page.waitForTimeout(250);
await page.evaluate(() => { const b = [...document.querySelectorAll('.menu-layer button, .menu-layer [data-x]')].find((x) => /^\s*Moves\s*$/.test(x.textContent)); if (b) b.click(); });
await page.waitForTimeout(350);
const pauseText = await page.evaluate(() => document.body.textContent);
ok(/Basic attack/.test(pauseText), 'the pause menu move list marks the basic attack');
await snap('pause-moves');

// ---- how to fight
await home();
await click('[data-go="options"]').catch(() => {});
const ctl = await page.$('[data-go="controls"]') || await page.$('[data-a="controls"]');
if (ctl) { await ctl.click(); await page.waitForTimeout(400); }
const how = await page.evaluate(() => document.body.textContent);
ok(/Knockdown/.test(how) && /Chains/.test(how) && /Break/.test(how), 'How to fight explains chains, knockdown and Break');
await snap('how-to-fight');

// ---- a full battle on autoplay: results with style rank, medals and mastery
await home('&autoplay&speed=16');
await page.evaluate(() => { window.__app.settings.skipIntros = true; });
await click('[data-go="quick"]'); await click('[data-env="ground"]'); await click('[data-f="pokemon"]'); await page.waitForSelector('.grid');
await click('.grid [data-id="garchomp"]', true); await click('.grid [data-id="charizard"]', true); await click('.maps [data-id="random"]'); await click('[data-l="normal"]');
await page.waitForSelector('.rank', { timeout: 120000 });
await page.waitForTimeout(1800);
const res = await page.evaluate(() => ({ rank: document.querySelector('.rank b') && document.querySelector('.rank b').textContent, pts: +(document.querySelector('.rank span') || {}).dataset.pts, medals: document.querySelectorAll('.medal').length, mast: (document.querySelector('.mast-n') || {}).textContent, wide: document.documentElement.scrollWidth <= window.innerWidth + 1 }));
ok('SABCD'.includes(res.rank) && res.rank.length === 1, `results show a style rank (${res.rank}, ${res.pts} points)`);
ok(res.medals >= 1, `results show medals (${res.medals})`);
ok(/Garchomp · Mastery \d+/.test(res.mast || ''), `results show mastery progress (${res.mast})`);
ok(res.wide, 'the results screen fits the screen width');
await snap('results');
const rec = await page.evaluate(() => window.__app.store.read('records'));
ok(rec.mastery && rec.mastery.garchomp > 0, `mastery is saved (${rec.mastery && Math.round(rec.mastery.garchomp)} XP)`);
ok(typeof rec.bestCombo === 'number' && rec.bestRank, `best combo and best rank are saved (${rec.bestCombo}, ${rec.bestRank})`);

// ---- records: mastery column
await home();
await click('[data-go="records"]'); await page.waitForTimeout(400);
const recText = await page.evaluate(() => document.body.textContent);
ok(/Mastery/.test(recText), 'Records shows mastery');
await snap('records');

console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors');
if (errs.length) fails++;
console.log(fails ? `${fails} FAILED` : 'v20 OK');
await browser.close();
process.exit(fails ? 1 : 0);
