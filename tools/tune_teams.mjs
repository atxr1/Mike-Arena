// Team tuner: plays CPU-vs-CPU Trainer Battles between every pair of trainers in one environment and nudges each
// team's multiplier toward a 50 % win rate, then prints the table for src/content/teambalance.js.
// Usage: bun tools/tune_teams.mjs --env air [--rounds 6] [--seeds 2] [--out file.json]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { registerContent, addSpriteMeta } from '../src/content/index.js';
import { MAPS_BY_ENV } from '../src/content/maps.js';
import { TRAINERS } from '../src/content/trainers.js';
import { TEAM_BALANCE } from '../src/content/teambalance.js';
import { Match } from '../src/modes/match.js';
import { MATCH } from '../src/game/sim.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
const env = args.env || 'ground', ROUNDS = +(args.rounds ?? 6), SEEDS = +(args.seeds || 2);
registerContent();
const dir = new URL('../site/assets/fighters/', import.meta.url).pathname;
for (const f of readdirSync(dir)) if (f.endsWith('.json') && !f.startsWith('_')) addSpriteMeta(f.slice(0, -5), JSON.parse(readFileSync(dir + f, 'utf8')));
const ids = Object.keys(TRAINERS);
const LO = 0.8, HI = 1.25;
const strength = {};
for (const t of ids) { const b = TEAM_BALANCE[env + ':' + t]; strength[t] = b ? b.hp * b.dmg : 1; }
const split = (s) => { const h = Math.min(HI, Math.max(LO, Math.sqrt(s))); return { hp: +h.toFixed(3), dmg: +Math.min(HI, Math.max(LO, s / h)).toFixed(3) }; };
const apply = () => { for (const t of ids) TEAM_BALANCE[env + ':' + t] = split(strength[t]); };
function play(a, b, seed, map) {
  const m = new Match({ seed, env, format: 'trainer', map, sides: [{ team: TRAINERS[a].teams[env], trainer: a, control: 'cpu', level: 'normal' }, { team: TRAINERS[b].teams[env], trainer: b, control: 'cpu', level: 'normal' }] });
  for (let t = 0; t < 40; t++) m.step();
  m.startFight();
  const S = m.sim; let t = 0;
  while (S.phase !== 'over' && t < MATCH.trainerTicks + 6000) { m.step(); t++; }
  return S.result ? S.result.winner : -1;
}
function measure(round, seeds) {
  const wins = {}, games = {}; let r = 0;
  for (let s = 0; s < seeds; s++) for (let i = 0; i < ids.length; i++) for (let j = 0; j < ids.length; j++) {
    if (i === j) continue;
    const w = play(ids[i], ids[j], (round * 104729 + 7919 * r++ + 31) >>> 0, MAPS_BY_ENV[env][(i + j + s) % 4]);
    for (const [t, side] of [[ids[i], 0], [ids[j], 1]]) { games[t] = (games[t] || 0) + 1; wins[t] = (wins[t] || 0) + (w === side ? 1 : w < 0 ? 0.5 : 0); }
  }
  return Object.fromEntries(ids.map((t) => [t, wins[t] / games[t]]));
}
let rates;
for (let round = 1; round <= ROUNDS; round++) {
  apply();
  rates = measure(round, SEEDS);
  console.log(`${env} round ${round}: ` + ids.map((t) => `${t} ${(rates[t] * 100).toFixed(0)}`).join('  '));
  for (const t of ids) { const rr = Math.min(0.95, Math.max(0.05, rates[t])); if (Math.abs(rates[t] - 0.5) > 0.05) strength[t] = Math.min(HI * HI, Math.max(LO * LO, strength[t] * Math.pow(0.5 / rr, 0.22))); }
}
apply();
const fin = measure(999, +(args.check || SEEDS * 2));
console.log(`${env} final: ` + ids.map((t) => `${t} ${(fin[t] * 100).toFixed(0)}`).join('  '));
const out = { env, table: Object.fromEntries(ids.map((t) => [env + ':' + t, TEAM_BALANCE[env + ':' + t]])), rates: fin };
if (args.out) writeFileSync(args.out, JSON.stringify(out, null, 1));
