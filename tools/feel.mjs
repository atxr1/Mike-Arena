// Feel audit: frame data for every move (startup, total length, hitstun, advantage on hit, damage share) and
// pacing numbers from CPU-vs-CPU matches (what a fighter spends its time doing, how often hits land, how often
// the lead changes). Usage: bun tools/feel.mjs [--frames] [--strings] [--chains] [--pace] [--env ground] [--runs 40] [--level normal]
import { readFileSync, readdirSync } from 'node:fs';
import { registerContent, addSpriteMeta, ROSTER } from '../src/content/index.js';
import { MAPS_BY_ENV } from '../src/content/maps.js';
import { MOVES } from '../src/content/moves.js';
import { SPECIES } from '../src/content/species.js';
import { Match } from '../src/modes/match.js';
import { MATCH } from '../src/game/sim.js';
import { blankInput } from '../src/game/fighter.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
registerContent();
const dir = new URL('../site/assets/fighters/', import.meta.url).pathname;
for (const f of readdirSync(dir)) if (f.endsWith('.json') && !f.startsWith('_')) addSpriteMeta(f.slice(0, -5), JSON.parse(readFileSync(dir + f, 'utf8')));
const envs = args.env ? [args.env] : Object.keys(ROSTER);
const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

// ---------------------------------------------------------------- frame data
function frameData(env, id, slot) {
  const foe = ROSTER[env].find((x) => x !== id);
  const m = new Match({ seed: 5, env, format: 'pokemon', map: MAPS_BY_ENV[env][0], rules: { training: true }, sides: [{ team: [id], control: 'human' }, { team: [foe], control: 'human' }] });
  const S = m.sim;
  for (let t = 0; t < 40; t++) m.step([blankInput(), blankInput()]);
  m.startFight();
  for (let t = 0; t < 60; t++) m.step([blankInput(), blankInput()]);
  const a = S.activeOf(0), b = S.activeOf(1);
  const mv = MOVES[a.kit()[slot]];
  const gap = mv.ai.kind === 'melee' || mv.ai.kind === 'grab' ? 2 : Math.min(90, (mv.ai.r[0] + mv.ai.r[1]) / 2);
  const cx = (S.bounds.x0 + S.bounds.x1) / 2, cy = (S.bounds.y0 + S.bounds.y1) / 2;
  a.x = cx - (gap + a.r + b.r) / 2; b.x = cx + (gap + a.r + b.r) / 2; a.y = b.y = cy; a.faceAngle(0); b.faceAngle(Math.PI);
  a.stamina = 100; a.cds = [0, 0, 0, 0];
  const hp0 = b.hp;
  const inp = blankInput(); inp.slot = slot; inp.held[slot] = true;
  let first = -1, free = -1, foeFree = -1, t = 0, hits = 0;
  m.step([inp, blankInput()]);
  const start = S.tick;
  for (; t < 400; t++) {
    const evs = m.step([blankInput(), blankInput()]);
    for (const e of evs) if (e.e === 'hit' && e.tgt === b) { hits++; if (first < 0) first = S.tick - start; }
    if (free < 0 && a.canAct()) free = S.tick - start;
    if (first >= 0 && foeFree < 0 && b.canAct()) foeFree = S.tick - start;
    if (free >= 0 && (first < 0 || foeFree >= 0) && S.tick - start > 30) break;
  }
  return { id: mv.id, tier: mv.tier, kind: mv.ai.kind, cost: mv.cost, cd: mv.cd, startup: first, total: free, adv: first >= 0 ? foeFree - free : null, hits, dmg: Math.round(100 * (hp0 - Math.min(hp0, b.hp < hp0 ? b.hp : hp0)) / b.maxHp) };
}
if (args.frames || (!args.pace && !args.strings && !args.chains)) {
  const byTier = {};
  for (const env of envs) for (const id of ROSTER[env]) {
    const rows = [0, 1, 2, 3].map((s) => { try { return frameData(env, id, s); } catch (e) { return { id: SPECIES[id].kit[s], err: String(e).slice(0, 60) }; } });
    if (args.verbose) console.log(env, id, rows.map((r) => `${r.id}[${r.tier}] su${r.startup} tot${r.total} adv${r.adv} ${r.dmg}%`).join(' | '));
    for (const r of rows) if (!r.err) (byTier[r.tier] = byTier[r.tier] || []).push(r);
  }
  console.log('FRAME DATA (ticks at 60 Hz; adv = foe free minus attacker free, + means the attacker recovers first)');
  for (const [tier, rows] of Object.entries(byTier)) {
    const hit = rows.filter((r) => r.startup >= 0);
    console.log(`  ${tier.padEnd(6)} n=${String(rows.length).padEnd(3)} startup med ${med(hit.map((r) => r.startup))} (${Math.min(...hit.map((r) => r.startup))}-${Math.max(...hit.map((r) => r.startup))})  total med ${med(rows.map((r) => r.total))}  adv on hit med ${med(hit.map((r) => r.adv))}  dmg med ${med(hit.map((r) => r.dmg))}%  whiffed ${rows.length - hit.length}`);
  }
}

// ---------------------------------------------------------------- chains: does every special connect when chained out of the string?
// For each fighter and each damaging special: land hit 1 (or the whole string), press the special the moment the hit lands.
function chainData(env, id, slot, afterFinisher) {
  const immune = (x) => (MOVES[SPECIES[id].kit[slot]].type === 'Electric' && SPECIES[x].types.includes('Ground')) || (MOVES[SPECIES[id].kit[slot]].type === 'Ground' && (SPECIES[x].types.includes('Flying') || env === 'air')) || (['Normal', 'Fighting'].includes(MOVES[SPECIES[id].kit[slot]].type) && SPECIES[x].types.includes('Ghost')) || (MOVES[SPECIES[id].kit[slot]].type === 'Psychic' && SPECIES[x].types.includes('Dark')) || (MOVES[SPECIES[id].kit[slot]].type === 'Dragon' && SPECIES[x].types.includes('Fairy')) || (MOVES[SPECIES[id].kit[slot]].type === 'Poison' && SPECIES[x].types.includes('Steel')) || (MOVES[SPECIES[id].kit[slot]].type === 'Ghost' && SPECIES[x].types.includes('Normal'));
  const foe = ROSTER[env].find((x) => x !== id && !SPECIES[x].serpent && !immune(x)) || ROSTER[env].find((x) => x !== id);
  const m = new Match({ seed: 5, env, format: 'pokemon', map: MAPS_BY_ENV[env][0], rules: { training: true }, sides: [{ team: [id], control: 'human' }, { team: [foe], control: 'human' }] });
  const S = m.sim;
  for (let t = 0; t < 40; t++) m.step([blankInput(), blankInput()]);
  m.startFight();
  for (let t = 0; t < 60; t++) m.step([blankInput(), blankInput()]);
  const a = S.activeOf(0), b = S.activeOf(1);
  const basic = MOVES[a.kit()[0]], contact = basic.ai.kind === 'melee' || basic.ai.kind === 'dash';
  // ranged basics are tested from a little inside their reach
  const st0 = basic.steps.find((x) => x.k !== 'blink') || {};
  const gap = contact ? 2 : Math.max(10, Math.min(70, (st0.range || st0.len || 180) * 0.6 - b.r));
  const cx = (S.bounds.x0 + S.bounds.x1) / 2, cy = (S.bounds.y0 + S.bounds.y1) / 2;
  a.x = cx - (gap + a.r + b.r) / 2; b.x = cx + (gap + a.r + b.r) / 2; a.y = b.y = cy; a.faceAngle(0); b.faceAngle(Math.PI);
  a.stamina = 100; a.cds = [0, 0, 0, 0];
  let chained = false, hit = false, inCombo = false, basicHits = 0;
  for (let t = 0; t < 160; t++) {
    const inp = blankInput();
    const mv = a.move, landed = mv && S.tick - mv.landedT <= 3;
    if (!chained) {
      if (landed && mv.basic && (afterFinisher ? mv.si === 2 : true)) { inp.slot = slot; inp.held[slot] = true; }
      else inp.held[0] = true;
    }
    const evs = m.step([inp, blankInput()]);
    for (const e of evs) {
      if (e.e === 'chain' && e.f === a) chained = true;
      if (e.e === 'hit' && e.tgt === b && e.dmg > 0) { if (e.basic) basicHits++; else if (chained) { hit = true; inCombo = e.combo >= 2; } }
    }
    if (hit) break;
  }
  return { chained, hit, inCombo };
}
if (args.chains) {
  let total = 0, bad = 0;
  for (const env of envs) for (const id of ROSTER[env]) {
    if (MOVES[SPECIES[id].kit[0]].tier !== 'light') continue;
    const out = [];
    for (const s of [1, 2, 3]) {
      const mv = MOVES[SPECIES[id].kit[s]]; if (!(mv.power > 0)) continue;
      const r1 = chainData(env, id, s, false), r3 = chainData(env, id, s, true);
      const mark = (r) => (!r.chained ? 'no-chain' : r.hit ? (r.inCombo ? 'combo' : 'hit') : 'WHIFF');
      total += 2; if (!r1.hit) bad++; if (!r3.hit) bad++;
      out.push(`${mv.id}[${mv.ai.kind}] ${mark(r1)}/${mark(r3)}`);
    }
    console.log(`${env.padEnd(6)} ${id.padEnd(10)} ${out.join('   ')}`);
  }
  console.log(`chains that connect: ${total - bad} of ${total} (first hit / finisher)`);
}

// ---------------------------------------------------------------- basic strings: hold the basic attack next to (or 40 px from) a dummy
function stringData(env, id, gap) {
  const foe = ROSTER[env].find((x) => x !== id);
  const m = new Match({ seed: 5, env, format: 'pokemon', map: MAPS_BY_ENV[env][0], rules: { training: true }, sides: [{ team: [id], control: 'human' }, { team: [foe], control: 'human' }] });
  const S = m.sim;
  for (let t = 0; t < 40; t++) m.step([blankInput(), blankInput()]);
  m.startFight();
  for (let t = 0; t < 60; t++) m.step([blankInput(), blankInput()]);
  const a = S.activeOf(0), b = S.activeOf(1);
  const cx = (S.bounds.x0 + S.bounds.x1) / 2, cy = (S.bounds.y0 + S.bounds.y1) / 2;
  a.x = cx - (gap + a.r + b.r) / 2; b.x = cx + (gap + a.r + b.r) / 2; a.y = b.y = cy; a.faceAngle(0); b.faceAngle(Math.PI);
  const hp0 = b.hp, start = S.tick; let hits = [], escaped = 0, free = -1, foeFree = -1, last = -1;
  for (let t = 0; t < 140; t++) {
    const inp = blankInput(); if (t < 46) { inp.held[0] = true; if (t === 0) inp.slot = 0; }
    const evs = m.step([inp, blankInput()]);
    for (const e of evs) if (e.e === 'hit' && e.tgt === b && e.dmg > 0) { hits.push(S.tick - start); last = S.tick; }
    if (hits.length && hits.length < 3 && b.canAct() && S.tick - last > 1) escaped++;
    if (hits.length >= 3 || t > 60) { if (free < 0 && a.canAct()) free = S.tick - start; if (foeFree < 0 && b.canAct() && hits.length) foeFree = S.tick - start; }
  }
  return { id, kind: MOVES[a.kit()[0]].ai.kind, hits, escaped, adv: foeFree - free, dmg: +(100 * (hp0 - b.hp) / b.maxHp).toFixed(1), basic: a.hasBasic() };
}
if (args.strings) {
  for (const env of envs) for (const id of ROSTER[env]) {
    const r0 = stringData(env, id, 2), r1 = stringData(env, id, 40);
    console.log(`${env.padEnd(6)} ${id.padEnd(10)} ${r0.kind.padEnd(5)} close: hits at ${r0.hits.slice(0, 6).join(',').padEnd(18)} gaps-free ${r0.escaped ? 'DROPS(' + r0.escaped + ')' : 'ok'}  adv ${String(r0.adv).padStart(3)}  ${r0.dmg}%   | from 40 px: hits ${r1.hits.slice(0, 5).join(',').padEnd(16)} ${r1.escaped ? 'DROPS' : 'ok'} ${r1.dmg}%`);
  }
}
// ---------------------------------------------------------------- pacing
if (args.pace || (!args.frames && !args.strings && !args.chains)) {
  const RUNS = +(args.runs || 40), LEVEL = args.level || 'normal';
  for (const env of envs) {
    const roster = ROSTER[env];
    const src = (k, d) => { T.src[k] = (T.src[k] || 0) + d; };
    const T = { src: {}, ch: {}, cmbEnd: [], ticks: 0, state: {}, starved: 0, hits: 0, heavyHits: 0, gaps: [], lens: [], leads: [], closeEnd: 0, moves: 0, dodges: 0, perfect: 0, ults: 0, n: 0, firstHit: [], koReason: {}, idleStreaks: [], combos: [] };
    for (let r = 0; r < RUNS; r++) {
      const i = r % roster.length, j = (i + 1 + (Math.floor(r / roster.length) % (roster.length - 1))) % roster.length;
      const m = new Match({ seed: 1000 + r * 7, env, format: 'pokemon', map: MAPS_BY_ENV[env][r % 4], sides: [{ team: [roster[i]], control: 'cpu', level: LEVEL }, { team: [roster[j]], control: 'cpu', level: LEVEL }] });
      const S = m.sim;
      for (let t = 0; t < 40; t++) m.step();
      m.startFight();
      let lastHit = -1, lead = 0, leads = 0, first = -1, quiet = 0, t = 0, chain = 0, chainSide = -1, chainAt = -99;
      while (S.phase !== 'over' && t++ < MATCH.pokemonTicks + 6000) {
        const evs = m.step();
        if (S.phase !== 'fight') continue;
        T.ticks++;
        for (const f of S.fighters()) {
          T.state[f.state] = (T.state[f.state] || 0) + 1;
          const cheapest = Math.min(...f.kit().map((k, i) => (i === 0 && MOVES[k].tier === 'light' ? 999 : MOVES[k].cost)));
          if (f.fire > 0) T.fireTicks = (T.fireTicks || 0) + 1;
          if (f.stamina < cheapest) T.starved++;
        }
        let hitNow = false;
        for (const e of evs) {
          if (e.e === 'wallSlam') src('wall slam', e.dmg); else if (e.e === 'dot') src('status', e.dmg);
          else if (e.e === 'counterHit') T.ch[e.kind] = (T.ch[e.kind] || 0) + 1; else if (e.e === 'armor') T.ch.armor = (T.ch.armor || 0) + 1; else if (e.e === 'clash' && e.melee) T.ch.clash = (T.ch.clash || 0) + 1;
          else if (e.e === 'chain') T.ch['chain:' + (e.to === 'ult' ? 'ult' : 'special')] = (T.ch['chain:' + (e.to === 'ult' ? 'ult' : 'special')] || 0) + 1; else if (e.e === 'dashStrike') T.ch.dashStrike = (T.ch.dashStrike || 0) + 1; else if (e.e === 'onFire') T.ch.onFire = (T.ch.onFire || 0) + 1; else if (e.e === 'breakout') T.ch.breakout = (T.ch.breakout || 0) + 1;
          else if (e.e === 'comboEnd') T.cmbEnd.push(e.n);
        }
        for (const e of evs) if (e.e === 'hit' && !e.statusOnly && e.dmg > 0) {
          src(e.ult ? 'ultimate' : e.basic ? (e.finisher ? 'basic finisher' : 'basic') : (MOVES[e.set && 0] || 1) && e.att.isEnv ? 'arena' : 'special', e.dmg);
          hitNow = true; T.hits++; if (e.heavy) T.heavyHits++;
          if (first < 0) first = S.fightTicks;
          // a "combo" here = hits by one side with the victim never free in between
          if (e.att.side === chainSide && S.tick - chainAt < 45 && e.tgt.state === 'hurt') chain++; else { if (chain > 0) T.combos.push(chain); chain = 1; chainSide = e.att.side; }
          chainAt = S.tick;
        }
        if (hitNow) { if (lastHit >= 0) T.gaps.push(S.fightTicks - lastHit); lastHit = S.fightTicks; quiet = 0; } else quiet++;
        const sc = S.hpScores(), l = sc[0] > sc[1] + 0.02 ? 1 : sc[1] > sc[0] + 0.02 ? -1 : lead;
        if (l !== lead && lead !== 0) leads++; lead = l;
      }
      T.n++; T.lens.push(S.fightTicks / 60); T.leads.push(leads); if (first >= 0) T.firstHit.push(first / 60);
      const sc = S.hpScores(); if (Math.max(sc[0], sc[1]) < 0.3) T.closeEnd++;
      T.koReason[S.result ? S.result.reason : 'none'] = (T.koReason[S.result ? S.result.reason : 'none'] || 0) + 1;
      for (const sd of S.sides) for (const f of sd.team) { T.moves += f.stats.moves; T.dodges += f.stats.dodges; T.perfect += f.stats.perfect; T.ults += f.stats.ults; }
    }
    const tot = Object.values(T.state).reduce((a, b) => a + b, 0), pct = (k) => (100 * (T.state[k] || 0) / tot).toFixed(0) + '%';
    const mins = T.ticks / 3600;
    console.log(`PACING ${env} (${T.n} matches, CPU ${LEVEL})`);
    console.log(`  match length med ${med(T.lens).toFixed(0)} s   first hit med ${med(T.firstHit).toFixed(1)} s   ends: ${JSON.stringify(T.koReason)}   winner under 30% HP: ${(100 * T.closeEnd / T.n).toFixed(0)}%   lead changes avg ${avg(T.leads).toFixed(1)}`);
    console.log(`  time: moving/idle ${pct('walk')}/${pct('idle')}  attacking ${pct('act')}  hurt ${pct('hurt')}  dodging ${pct('dodge')}  special move ${pct('trav')}   out of stamina ${(100 * T.starved / tot).toFixed(0)}%`);
    console.log(`  per fighter per minute: moves ${(T.moves / 2 / mins).toFixed(1)}  hits landed ${(T.hits / 2 / mins).toFixed(1)}  dodges ${(T.dodges / 2 / mins).toFixed(1)}  perfect dodges ${(T.perfect / 2 / mins).toFixed(2)}  ultimates per match ${(T.ults / 2 / T.n).toFixed(2)}`);
    const stot = Object.values(T.src).reduce((a, b) => a + b, 0);
    console.log('  damage from: ' + Object.entries(T.src).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / stot).toFixed(0)}%`).join(', ') + `   on fire ${(100 * (T.fireTicks || 0) / tot).toFixed(0)}% of the time`);
    console.log('  per match (both fighters): ' + Object.entries(T.ch).map(([k, v]) => `${k} ${(v / T.n).toFixed(1)}`).join(', ') + `   reported combos avg ${avg(T.cmbEnd).toFixed(1)} hits, ${(T.cmbEnd.length / T.n).toFixed(1)} per match, longest ${Math.max(0, ...T.cmbEnd)}`);
    console.log(`  gap between hits: med ${(med(T.gaps) / 60).toFixed(2)} s, 90th pct ${(T.gaps.slice().sort((a, b) => a - b)[Math.floor(T.gaps.length * 0.9)] / 60).toFixed(1)} s   combos: avg ${avg(T.combos).toFixed(2)} hits, 3+ hits ${(100 * T.combos.filter((c) => c >= 3).length / Math.max(1, T.combos.length)).toFixed(0)}%, longest ${Math.max(0, ...T.combos)}`);
  }
}
