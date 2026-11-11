// Exchange trace: for every opening hit in bot-vs-CPU games, what was the side that got hit doing?
// Usage: bun tools/trace.mjs --bot masherPlus --level hard [--games 20] [--env ground] [--log 1]
import { readFileSync, readdirSync } from 'node:fs';
import { registerContent, addSpriteMeta, ROSTER } from '../src/content/index.js';
import { MAPS_BY_ENV } from '../src/content/maps.js';
import { Match } from '../src/modes/match.js';
import { MATCH } from '../src/game/sim.js';
import { blankInput } from '../src/game/fighter.js';
import { mulberry32 } from '../src/core/util.js';
import { BOTS } from './bots.mjs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
registerContent();
const dir = new URL('../site/assets/fighters/', import.meta.url).pathname;
for (const f of readdirSync(dir)) if (f.endsWith('.json') && !f.startsWith('_')) addSpriteMeta(f.slice(0, -5), JSON.parse(readFileSync(dir + f, 'utf8')));
const GAMES = +(args.games || 20), env = args.env || 'ground', bot = args.bot || 'masherPlus', level = args.level || 'hard';
const roster = ROSTER[env];
const tally = [{}, {}], dmgBy = [{}, {}];
const describe = (x, S) => {
  if (x.state === 'act' && x.move) { const mv = x.move; const ph = mv.t < mv.hitT ? 'startup' : 'recovery'; return `${mv.basic ? 'basic' : mv.ult ? 'ult' : (mv.def.tier || 'special')} ${ph}`; }
  if (x.state === 'idle' || x.state === 'walk') return x.basicLock > S.tick ? 'whiff lockout' : (x.status.sleep || x.status.freeze || x.status.para ? 'statused' : 'free (idle/walk)');
  return x.state;
};
for (let g = 0; g < GAMES; g++) {
  const me = roster[g % roster.length], foe = roster[(g * 7 + 3) % roster.length === g % roster.length ? (g + 1) % roster.length : (g * 7 + 3) % roster.length];
  const m = new Match({ seed: 90000 + g * 13, env, format: 'pokemon', map: MAPS_BY_ENV[env][g % 4], sides: [{ team: [me], control: 'human' }, { team: [foe], control: 'cpu', level }] });
  const S = m.sim, st = { rng: mulberry32(777 + g) };
  for (let t = 0; t < 40; t++) m.step([blankInput(), null]);
  m.startFight();
  let t = 0, prev = [null, null], open = [null, null];
  while (S.phase !== 'over' && t++ < MATCH.pokemonTicks + 6000) {
    const f = S.activeOf(0), o = S.activeOf(1);
    if (f && o) prev = [describe(f, S), describe(o, S)];
    m.step([f && o && S.phase === 'fight' ? BOTS[bot](S, f, o, st) : blankInput(), null]);
    for (const e of S.events) {
      if (e.e !== 'hit' || !e.att || e.att.isEnv || !(e.dmg > 0) || e.att.side === undefined) continue;
      const a = e.att.side, key = `${e.basic ? 'basic' : e.ult ? 'ult' : 'special'} hits foe in: ${prev[1 - a]}`;
      if (e.combo === 1) { tally[a][key] = (tally[a][key] || 0) + 1; open[a] = key; if (args.log && g === 0) console.log(String(S.tick).padStart(5), a === 0 ? 'BOT' : 'CPU', key, e.moveId, 'gap', Math.round(Math.hypot(f.x - o.x, f.y - o.y) - f.r - o.r)); }
      if (open[a]) dmgBy[a][open[a]] = (dmgBy[a][open[a]] || 0) + e.dmg;
    }
  }
}
for (const [i, name] of [[0, bot], [1, 'cpu ' + level]]) {
  console.log(`${name} opens (per match)  — count, damage that followed`);
  for (const [k, v] of Object.entries(tally[i]).sort((a, b) => (dmgBy[i][b[0]] || 0) - (dmgBy[i][a[0]] || 0)).slice(0, 12)) console.log(`   ${(v / GAMES).toFixed(1).padStart(5)}  ${((dmgBy[i][k] || 0) / GAMES).toFixed(0).padStart(4)} dmg   ${k}`);
}
