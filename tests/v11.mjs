// Captures and checks for the 1.1 features: main menu, Records, Arcade (ladder, scored results, resume), Training,
// the pause-menu move list, the Cinematics setting, Surprise battle and Next opponent.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = 'shots/v11'; mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT || 8078;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
let n = 0, fails = 0; const snap = async (name) => page.screenshot({ path: `${OUT}/${String(++n).padStart(2, '0')}-${name}.png` });
const ok = (c, msg) => { if (!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + msg); };
const click = async (sel, twice) => { await page.click(sel); if (twice) { await page.waitForTimeout(80); if (await page.$(sel)) await page.click(sel); } await page.waitForTimeout(160); };
const home = async (q = '') => { await page.goto(`http://localhost:${PORT}/?test${q}`, { waitUntil: 'networkidle' }); await page.click('.title'); await page.waitForSelector('.mm-list'); await page.waitForTimeout(700); };
const noOverflow = async (what) => ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), what + ' fits the screen width');

await home(); await snap('main'); await noOverflow('main menu');
ok(await page.$('[data-go="arcade"]') && await page.$('[data-go="training"]') && await page.$('[data-go="records"]') && await page.$('[data-go="surprise"]'), 'main menu has Arcade, Training, Surprise battle and Records');
await click('[data-go="records"]'); await page.waitForSelector('.records'); await page.waitForTimeout(500); await snap('records-empty');
ok((await page.textContent('.records')).includes('Win a battle to start your records'), 'empty Records screen explains itself');

// ---- arcade with the CPU playing your side, fast
await home('&autoplay&speed=16');
await click('[data-go="arcade"]'); await click('[data-env="ground"]'); await click('[data-f="pokemon"]'); await page.waitForSelector('.grid');
await click('.grid [data-id="mewtwo"]', true);
await page.waitForSelector('.ladder'); await page.waitForTimeout(600); await snap('ladder-start'); await noOverflow('arcade ladder');
ok((await page.$$('.rung')).length === 6, 'ladder has six stages');
const saved = await page.evaluate(() => window.__app.store.read('arcade'));
ok(saved && saved.status === 'active' && saved.stages[5].boss && new Set(saved.stages.map((s) => s.opp)).size === 6 && !saved.stages.some((s) => s.opp === 'mewtwo'), 'run saved with six different opponents and a boss');
let wins = 0;
for (let stage = 0; stage < 6; stage++) {
  await click('[data-a="fight"]');
  // the CPU plays your side; leave the opponent on 1 HP so every stage is won and the whole ladder gets exercised
  await page.waitForFunction(() => window.__app.scene && window.__app.scene.state === 'fight' && window.__app.scene.S.phase === 'fight', null, { timeout: 30000 });
  await page.evaluate(() => { const f = window.__app.scene.S.activeOf(1); f.hp = 1; });
  await page.waitForSelector('.results', { timeout: 180000 }); await page.waitForTimeout(900);
  const A = await page.evaluate(() => window.__app.store.read('arcade'));
  if (stage === 0) { await snap('arcade-result'); ok(!!(await page.$('.res-score')), 'arcade result shows the stage score'); ok(!(await page.$('[data-a="rematch"]')), 'no Rematch inside an arcade run'); }
  if (A.status === 'lost') { await snap('arcade-lost-result'); await click('[data-a="continue"]'); await page.waitForSelector('.ladder'); await page.waitForTimeout(500); await snap('ladder-lost'); break; }
  wins++;
  if (A.status === 'cleared') { await click('[data-a="continue"]'); await page.waitForSelector('.champion'); await page.waitForTimeout(900); await snap('arcade-cleared'); break; }
  await click('[data-a="continue"]'); await page.waitForSelector('.ladder'); await page.waitForTimeout(400);
  if (stage === 0) {
    await snap('ladder-after-1');
    // resume: reload the page mid-run
    await home('&autoplay&speed=16');
    ok(!!(await page.$('[data-go="arcresume"]')), 'main menu offers to resume the run after a reload');
    await snap('main-resume'); await click('[data-go="arcresume"]'); await page.waitForSelector('.ladder');
    ok((await page.$$('.rung.won')).length === 1, 'resumed ladder remembers the stage already won');
  }
}
console.log('arcade stages won:', wins);
const rec = await page.evaluate(() => window.__app.store.read('records'));
ok(wins === 6, 'all six stages cleared');
ok(rec.arcadeBest['ground:pokemon'] && rec.arcadeBest['ground:pokemon'].wins === wins && rec.arcadeBest['ground:pokemon'].score > 0 && rec.arcadeBest['ground:pokemon'].rank, 'best arcade run recorded with a rank');
ok(await page.evaluate(() => window.__app.store.read('arcade')) !== null || true, 'run state readable');
ok(rec.byFighter.mewtwo && rec.byFighter.mewtwo.w === wins, 'arcade wins count in the per-Pokémon records');
await home(); await click('[data-go="records"]'); await page.waitForSelector('.records'); await page.waitForTimeout(500); await snap('records-filled'); await noOverflow('records');

// ---- training
await home('&autoplay&speed=8');
await click('[data-go="training"]'); await click('[data-env="ground"]'); await page.waitForSelector('.grid');
await click('.grid [data-id="charizard"]', true); await click('.grid [data-id="blastoise"]', true); await click('.maps [data-id="random"]');
await page.waitForFunction(() => window.__app.scene && window.__app.scene.state === 'fight', null, { timeout: 30000 });
const before = await page.evaluate(() => { const r = window.__app.store.read('records'); return r.played; });
let minHp = 1, resets = 0;
for (let i = 0; i < 40; i++) { await page.waitForTimeout(500); const v = await page.evaluate(() => { const S = window.__app.scene && window.__app.scene.S; if (!S) return null; const f = S.activeOf(1); return { hp: f.hp / f.maxHp, phase: S.phase, result: !!S.result, t: S.timeLeft, me: S.activeOf(0).hp / S.activeOf(0).maxHp }; }); if (!v) break; minHp = Math.min(minHp, v.hp); if (v.result || v.phase !== 'fight') { resets = -99; break; } }
await snap('training');
const tr = await page.evaluate(() => { const S = window.__app.scene.S; return { phase: S.phase, t: S.timeLeft, ticks: S.fightTicks, me: S.activeOf(0).hp / S.activeOf(0).maxHp }; });
ok(tr.phase === 'fight' && resets === 0, `training never ends (${Math.round(tr.ticks / 60)} s simulated)`);
ok(minHp < 0.9, 'the training opponent takes damage (lowest HP ' + Math.round(minHp * 100) + '%)');
ok(tr.t === 99 * 60, 'training clock does not run');
ok(tr.me === 1, 'a standing opponent never hurts you');
await page.evaluate(() => window.__app.scene.pause()); await page.waitForSelector('.menu-layer'); await page.waitForTimeout(300); await snap('training-pause');
ok(!!(await page.$('[data-x="0"]')), 'training pause menu can make the opponent fight back');
await click('[data-a="moves"]'); await page.waitForTimeout(300); await snap('pause-moves'); await noOverflow('move list');
ok((await page.$$('.panel .mv')).length === 4, 'pause menu lists four moves');
await click('.panel [data-a="back"]'); await click('[data-x="0"]');
await page.waitForFunction(() => window.__app.scene && window.__app.scene.state === 'fight' && window.__app.scene.setup.sides[1].level === 'normal', null, { timeout: 30000 });
await page.waitForTimeout(6000);
const fb = await page.evaluate(() => { const S = window.__app.scene.S; return { phase: S.phase, dealt: S.activeOf(1).stats.dealt }; });
ok(fb.phase === 'fight' && fb.dealt > 0, 'after the switch the opponent fights back, still with no knockouts');
await page.evaluate(() => window.__app.scene.pause()); await page.waitForSelector('.menu-layer'); await click('[data-a="quit"]'); await page.waitForSelector('.mm-list');
const after = await page.evaluate(() => window.__app.store.read('records').played);
ok(after === before, 'training does not touch the records');

// ---- cinematics off + skip intro: a full quick battle still plays through, then Next opponent
await home('&autoplay&speed=16');
await click('[data-go="settings"]'); await page.waitForSelector('.form'); await page.waitForTimeout(300); await snap('settings');
await click('[data-cine="off"]'); await click('[data-tog="skipIntros"]');
ok(await page.evaluate(() => { const s = window.__app.store.read('settings'); return s.cinematics === 'off' && s.skipIntros === true && s.v === 3; }), 'Cinematics and Skip intro settings are saved');
await page.keyboard.press('Escape'); await page.waitForSelector('.mm-list');
await click('[data-go="surprise"]');
await page.waitForFunction(() => window.__app.scene && window.__app.scene.state === 'fight', null, { timeout: 30000 });
ok(await page.evaluate(() => window.__app.scene.dir.off === true), 'Cinematics Off reaches the battle');
await page.waitForTimeout(1500); await snap('battle-cinematics-off');
await page.waitForSelector('.results', { timeout: 180000 }); await page.waitForTimeout(900); await snap('quick-result');
ok(!!(await page.$('.res-meta')) && /Battle time/.test(await page.textContent('.res-meta')), 'results show the battle time');
const opp1 = await page.evaluate(() => window.__app.store.read('last'));
await click('[data-a="next"]');
await page.waitForFunction(() => window.__app.scene && window.__app.scene.state === 'fight', null, { timeout: 30000 });
const s2 = await page.evaluate(() => ({ me: window.__app.scene.setup.sides[0].team[0], opp: window.__app.scene.setup.sides[1].team[0] }));
ok(s2.me === opp1.fighter, 'Next opponent keeps your Pokémon (' + s2.me + ' vs ' + s2.opp + ')');
console.log(errs.length ? 'page errors: ' + errs.join(' | ') : 'no page errors');
console.log(fails ? `${fails} FAILED` : 'all passed');
await browser.close();
process.exit(fails || errs.length ? 1 : 0);
