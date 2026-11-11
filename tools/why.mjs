// Why does a bot win or lose? Plays a bot (see tools/bots.mjs) against a CPU level and reports, for each side,
// who opens the exchanges and what each opening is worth. Usage: bun tools/why.mjs --bot masherPlus --level hard [--games 40] [--env ground]
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
const GAMES = +(args.games || 40), env = args.env || 'ground', bot = args.bot || 'masherPlus', level = args.level || 'normal';
const roster = ROSTER[env];
const T = [0, 1].map(() => ({ wins: 0, openers: 0, openBasic: 0, openSpecial: 0, openCounter: 0, openPunish: 0, openDash: 0, hits: 0, dmg: 0, dmgBasic: 0, dmgSpecial: 0, dmgUlt: 0, comboDmg: 0, combos: 0, ults: 0, breaks: 0, armors: 0, dodges: 0, perfect: 0, whiffs: 0, swings: 0, ticksAct: 0, ticksHurt: 0, ticks: 0 }));
for (let g = 0; g < GAMES; g++) {
  const me = roster[g % roster.length], foe = roster[(g * 7 + 3) % roster.length === g % roster.length ? (g + 1) % roster.length : (g * 7 + 3) % roster.length];
  const sides = [bot === 'cpu' ? { team: [me], control: 'cpu', level: args.botLevel || 'normal' } : { team: [me], control: 'human' }, { team: [foe], control: 'cpu', level }];
  const m = new Match({ seed: 90000 + g * 13, env, format: 'pokemon', map: MAPS_BY_ENV[env][g % 4], sides });
  const S = m.sim, st = { rng: mulberry32(777 + g) };
  for (let t = 0; t < 40; t++) m.step([bot === 'cpu' ? null : blankInput(), null]);
  m.startFight();
  let t = 0, seen = 0;
  while (S.phase !== 'over' && t++ < MATCH.pokemonTicks + 6000) {
    const f = S.activeOf(0), o = S.activeOf(1);
    m.step([bot === 'cpu' ? null : (f && o && S.phase === 'fight' ? BOTS[bot](S, f, o, st) : blankInput()), null]);
    for (const e of S.events) {
      if (e.e === 'hit' && e.att && e.att.side !== undefined && !e.att.isEnv && e.dmg > 0) {
        const a = T[e.att.side]; a.hits++; a.dmg += e.dmg;
        if (e.ult) a.dmgUlt += e.dmg; else if (e.basic) a.dmgBasic += e.dmg; else a.dmgSpecial += e.dmg;
        if (e.combo === 1) { a.openers++; if (e.basic) a.openBasic++; else a.openSpecial++; if (e.ch === 'counter') a.openCounter++; if (e.ch === 'punish') a.openPunish++; }
      }
      if (e.e === 'ultimate' && e.f) T[e.f.side].ults++;
      if (e.e === 'breakout' && e.f) T[e.f.side].breaks++;
      if (e.e === 'armor' && e.f) T[e.f.side].armors++;
      if (e.e === 'dashStrike' && e.f) T[e.f.side].openDash++;
    }
    if (S.phase === 'fight') for (const s of [0, 1]) { const x = S.activeOf(s); if (!x) continue; T[s].ticks++; if (x.state === 'act') T[s].ticksAct++; if (x.state === 'hurt') T[s].ticksHurt++; }
  }
  if (S.result) T[S.result.winner] && T[S.result.winner].wins++;
  for (const s of [0, 1]) { const x = S.sides[s].team[0]; T[s].dodges += x.stats.dodges; T[s].perfect += x.stats.perfect; T[s].combos += x.stats.combos; T[s].comboDmg += x.stats.maxComboDmg; }
}
const per = (v) => (v / GAMES).toFixed(1);
console.log(`${bot} vs CPU ${level} — ${env}, ${GAMES} games (per match)`);
for (const [i, name] of [[0, bot], [1, 'cpu ' + level]]) {
  const a = T[i];
  console.log(`  ${name.padEnd(12)} wins ${String(Math.round(100 * a.wins / GAMES)).padStart(3)}%  openers ${per(a.openers)} (basic ${per(a.openBasic)}, special ${per(a.openSpecial)}, counter ${per(a.openCounter)}, punish ${per(a.openPunish)})  dmg/opener ${(a.dmg / Math.max(1, a.openers)).toFixed(0)}  dmg ${per(a.dmg)} = basic ${Math.round(100 * a.dmgBasic / a.dmg)}% special ${Math.round(100 * a.dmgSpecial / a.dmg)}% ult ${Math.round(100 * a.dmgUlt / a.dmg)}%`);
  console.log(`  ${''.padEnd(12)} ults ${per(a.ults)}  breaks ${per(a.breaks)}  armour ${per(a.armors)}  dash strikes ${per(a.openDash)}  dodges ${per(a.dodges)} (perfect ${per(a.perfect)})  best combo ${per(a.comboDmg)}  attacking ${Math.round(100 * a.ticksAct / a.ticks)}%  hurt ${Math.round(100 * a.ticksHurt / a.ticks)}%`);
}
