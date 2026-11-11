// Combat 2.0 rule checks, run headless in the real simulation (bun tests/rules.mjs). Each check sets two fighters
// up in Training rules (no clock, no knockouts), feeds inputs, and looks at the events and state that come out.
import { readFileSync, readdirSync } from 'node:fs';
import { registerContent, addSpriteMeta, ROSTER } from '../src/content/index.js';
import { MAPS_BY_ENV } from '../src/content/maps.js';
import { MOVES } from '../src/content/moves.js';
import { Match } from '../src/modes/match.js';
import { blankInput } from '../src/game/fighter.js';
import { COMBAT } from '../src/game/combat.js';

registerContent();
const dir = new URL('../site/assets/fighters/', import.meta.url).pathname;
for (const f of readdirSync(dir)) if (f.endsWith('.json') && !f.startsWith('_')) addSpriteMeta(f.slice(0, -5), JSON.parse(readFileSync(dir + f, 'utf8')));

let fails = 0;
const ok = (c, msg) => { if (!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + msg); };

// two fighters facing each other `gap` px apart (edge to edge) in the middle of the arena
function duel(a, b, gap = 2, env = 'ground') {
  const m = new Match({ seed: 11, env, format: 'pokemon', map: MAPS_BY_ENV[env][0], rules: { training: true }, sides: [{ team: [a], control: 'human' }, { team: [b], control: 'human' }] });
  const S = m.sim;
  for (let t = 0; t < 40; t++) m.step([blankInput(), blankInput()]);
  m.startFight();
  for (let t = 0; t < 60; t++) m.step([blankInput(), blankInput()]);
  const A = S.activeOf(0), B = S.activeOf(1);
  const cx = (S.bounds.x0 + S.bounds.x1) / 2, cy = (S.bounds.y0 + S.bounds.y1) / 2;
  A.x = cx - (gap + A.r + B.r) / 2; B.x = cx + (gap + A.r + B.r) / 2; A.y = B.y = cy; A.faceAngle(0); B.faceAngle(Math.PI);
  for (const f of [A, B]) { f.stamina = 100; f.cds = [0, 0, 0, 0]; f.vx = f.vy = 0; }
  const log = [];
  const step = (ia, ib) => { const evs = m.step([ia || blankInput(), ib || blankInput()]); for (const e of evs) log.push(e); return evs; };
  const run = (n, fa, fb) => { for (let t = 0; t < n; t++) step(fa ? fa(t) : null, fb ? fb(t) : null); };
  const press = (o) => Object.assign(blankInput(), o);
  const slot = (i) => { const p = blankInput(); p.slot = i; p.held[i] = true; return p; };
  const hold0 = () => { const p = blankInput(); p.held[0] = true; return p; };
  return { m, S, A, B, log, step, run, press, slot, hold0, hits: (tgt) => log.filter((e) => e.e === 'hit' && e.tgt === tgt && e.dmg > 0), has: (name) => log.some((e) => e.e === name) };
}
const specialSlot = (f, pred) => [1, 2, 3].find((i) => pred(MOVES[f.kit()[i]]));
const contact = (m) => m.power > 0 && ['melee', 'dash'].includes(m.ai.kind);

// 1. the basic string
{
  const d = duel('garchomp', 'tyranitar');
  const st0 = d.A.stamina;
  d.run(70, () => d.hold0());
  const h = d.hits(d.B).filter((e) => e.basic);
  ok(h.length >= 3 && h[0].si === 0 && h[1].si === 1 && h[2].si === 2 && h[2].finisher, `holding the basic attack lands a three-hit string ending in a Finisher (${h.slice(0, 3).map((e) => e.si).join(',')})`);
  ok(h.length >= 3 && h[2].tick - h[0].tick <= 40, `the three hits land within 40 ticks (${h.length >= 3 ? h[2].tick - h[0].tick : '-'})`);
  ok(d.A.stats.finishers >= 1, 'the Finisher is counted');
  ok(d.A.stamina >= st0 - 0.01 && d.A.cds[0] === 0, 'the basic attack costs no stamina and has no cooldown');
  ok(h.length >= 3 && h[2].kb > h[0].kb * 2, 'the Finisher knocks back much harder than the first hit');
}
// 2. holding only swings in reach; a tap always swings and a whiff is punishable
{
  const d = duel('garchomp', 'tyranitar', 220);
  d.run(30, () => d.hold0());
  ok(!d.log.some((e) => e.e === 'moveCall' && e.f === d.A), 'holding the basic attack out of reach does not swing');
  d.step(d.slot(0)); d.run(40);
  ok(d.log.some((e) => e.e === 'moveCall' && e.f === d.A && e.basic), 'a tap out of reach swings anyway');
  ok(d.A.whiffs >= 1, 'a contact swing that hits nothing is counted as a whiff');
}
// 3. chain: a landed basic hit cancels into a special, which comes out faster and connects
{
  const probe = duel('garchomp', 'tyranitar');
  const s = specialSlot(probe.A, contact);
  probe.step(probe.slot(s)); const raw = probe.A.move.hitT;
  const d = duel('garchomp', 'tyranitar');
  d.step(d.slot(0));
  let chained = false, chainHitT = -1;
  for (let t = 0; t < 60; t++) {
    const landed = d.A.move && d.S.tick - d.A.move.landedT <= 4;
    d.step(!chained && landed ? d.slot(s) : null);
    if (!chained && d.has('chain')) { chained = true; chainHitT = d.A.move ? d.A.move.hitT : -1; }
  }
  const sh = d.hits(d.B).find((e) => !e.basic);
  ok(chained, 'pressing a special right after a basic hit lands chains into it');
  ok(chainHitT > 0 && chainHitT < raw, `a chained special starts faster (${chainHitT} ticks instead of ${raw})`);
  ok(sh && sh.combo >= 2, `the chained special connects as part of the same combo (combo ${sh ? sh.combo : '-'})`);
  ok(d.A.stats.chains >= 1, 'the chain is counted');
}
// 4. armour: a heavy or signature move shrugs off basic hits while it starts up
{
  const d = duel('garchomp', 'tyranitar');
  const hs = specialSlot(d.B, (m) => (m.tier === 'heavy' || m.tier === 'sig') && m.power > 0);
  d.step(d.slot(0), d.slot(hs));
  d.run(10, () => d.hold0());
  const h = d.hits(d.B)[0];
  ok(h && h.armored, 'a basic hit on a heavy move in start-up is armoured');
  ok(d.B.state === 'act' && d.B.move && d.B.move.def.id === d.B.kit()[hs], 'the heavy move carries on through the hit');
  ok(d.has('armor'), 'the armour event fires');
}
// 5. an Ultimate cannot be interrupted while it starts up
{
  const d = duel('garchomp', 'tyranitar');
  d.B.ult = 100;
  const s = specialSlot(d.A, contact);
  d.step(d.slot(s), d.press({ ult: true }));
  ok(d.B.move && d.B.move.ult, 'the Ultimate starts');
  let interrupted = false;
  for (let t = 0; t < 30 && d.B.move && d.B.move.ult && d.B.move.t <= d.B.move.hitT; t++) { d.step(d.hold0()); if (d.B.state === 'hurt') interrupted = true; }
  ok(!interrupted, 'hits during the start-up do not interrupt it');
}
// 6. counter hit: a hit on a fighter starting an unarmoured attack
{
  const d = duel('garchomp', 'tyranitar');
  const ls = specialSlot(d.B, (m) => m.power > 0 && m.tier !== 'heavy' && m.tier !== 'sig' && (m.startup ?? 14) >= 10) ?? 0;
  d.step(null, d.slot(ls)); d.step(d.slot(0));
  d.run(14);
  const h = d.hits(d.B)[0];
  ok(h && (h.ch === 'counter' || h.armored) , `a hit during an attack's start-up is a Counter (${h ? h.ch || (h.armored ? 'armoured' : 'plain') : 'no hit'})`);
}
// 7. clash: two basic swings meeting head-on
{
  const d = duel('garchomp', 'tyranitar');
  const hpA = d.A.hp, hpB = d.B.hp;
  d.step(d.slot(0), d.slot(0)); d.run(16);
  ok(d.log.some((e) => e.e === 'clash' && e.melee), 'two basic attacks started together clash');
  ok(d.A.hp === hpA && d.B.hp === hpB, 'a clash does no damage');
  ok(d.A.stats.clashes >= 1 && d.B.stats.clashes >= 1, 'both fighters are credited');
}
// 8. break: R while being comboed
{
  const d = duel('garchomp', 'tyranitar');
  let broke = false, stBefore = 0;
  for (let t = 0; t < 120 && !broke; t++) {
    const can = d.B.state === 'hurt' && d.B.canBreak();
    if (can) stBefore = d.B.stamina;
    d.step(d.hold0(), can ? d.press({ dodge: true }) : null);
    broke = d.has('breakout');
  }
  ok(broke, 'pressing R three hits into a combo breaks free');
  ok(broke && stBefore - d.B.stamina >= COMBAT.breakOut.cost - 1, `Break costs ${COMBAT.breakOut.cost} stamina`);
  ok(broke && d.B.state !== 'hurt' && d.B.breakAt > 0, 'the fighter is free and Break goes on cooldown');
  ok(!d.B.canBreak(), 'Break cannot be used again at once');
}
// 9. heat and On fire
{
  const d = duel('garchomp', 'tyranitar');
  d.A.heat = 99;
  d.run(30, () => d.hold0());
  ok(d.has('onFire') && d.A.fire > 0, 'filling the heat gauge sets the fighter on fire');
  ok(d.A.stats.fires === 1, 'On fire is counted once');
}
// 10. dash strike: the basic attack out of a dodge
{
  // (a fighter whose R is a plain dodge, not a movement ability)
  const plain = ROSTER.ground.find((id) => { const x = duel(id, 'tyranitar'); const T = x.A.T; return !(T && (typeof T.replacesDodge === 'function' ? T.replacesDodge(x.A) : T.replacesDodge)) && contact(MOVES[x.A.kit()[0]]); });
  const d = duel(plain, 'tyranitar', 70);
  d.step(d.press({ dodge: true, mx: 1, my: 0 }));
  for (let t = 0; t < 30 && !d.has('dashStrike'); t++) d.step(d.A.state === 'dodge' && d.A.st >= 8 ? d.slot(0) : d.press({ mx: 1 }));
  d.run(20);
  ok(d.has('dashStrike'), 'the basic attack during a dodge is a dash strike');
  ok(d.hits(d.B).length >= 1, 'the dash strike reaches the target from 70 px away');
}
// 11. no infinite combos: stun fatigue ends a combo even with unlimited stamina
{
  const d = duel('garchomp', 'tyranitar');
  let longest = 0, hitWhileUp = 0;
  for (let t = 0; t < 900; t++) {
    d.A.stamina = 100; d.A.cds = [0, 0, 0, 0];
    const landed = d.A.move && d.S.tick - d.A.move.landedT <= 4;
    const s = landed ? [1, 2, 3].find((i) => i !== d.A.move.slot && contact(MOVES[d.A.kit()[i]])) : undefined;
    const p = s !== undefined && d.A.move.basic && d.A.move.si === 2 ? d.slot(s) : d.hold0();
    p.mx = 1;
    const up = d.S.tick < d.B.mercyUntil - 1;
    for (const e of d.step(p)) if (up && e.e === 'hit' && e.tgt === d.B && e.dmg > 0) hitWhileUp++;
    longest = Math.max(longest, d.B.cmb.n);
  }
  ok(longest >= 4, `combos do happen (longest ${longest} hits)`);
  ok(longest <= 24, `no combo runs forever (longest ${longest} hits in 15 seconds of perfect offence)`);
  ok(d.has('getUp'), 'a combo with a Finisher ends in a knockdown');
  ok(hitWhileUp === 0, 'a fighter that is getting up cannot be hit');
}
// 11b. getting up: no attacks for a moment
{
  const d = duel('garchomp', 'tyranitar');
  d.run(60, () => d.hold0());
  let tried = 0, started = 0;
  for (let t = 0; t < 80; t++) {
    const lock = d.S.tick + 1 < d.B.downUntil;
    const evs = d.step(null, lock ? d.slot(0) : null);
    if (lock) { tried++; if (evs.some((e) => e.e === 'moveCall' && e.f === d.B)) started++; }
  }
  ok(tried > 0 && started === 0, `a fighter that is getting up cannot attack (${tried} ticks tried)`);
}
// 12. the basic attack is never fully blocked by a type immunity
{
  const d = duel('pikachu', 'garchomp');
  d.run(40, () => d.hold0());
  ok(d.hits(d.B).some((e) => e.basic && e.dmg > 0), 'an Electric basic attack still chips a Ground type');
}
console.log(fails ? `${fails} FAILED` : 'combat rules OK');
process.exit(fails ? 1 : 0);
