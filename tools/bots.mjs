// Playtest bots: simple scripted "players" against the CPU at each difficulty. They answer two questions the
// CPU-vs-CPU numbers cannot: can a beginner who only mashes win on Easy, and does any one-button strategy beat
// Normal or Hard? Usage: bun tools/bots.mjs [--games 30] [--env ground] [--bots masher,novice]
import { readFileSync, readdirSync } from 'node:fs';
import { registerContent, addSpriteMeta, ROSTER } from '../src/content/index.js';
import { MAPS_BY_ENV } from '../src/content/maps.js';
import { MOVES } from '../src/content/moves.js';
import { Match } from '../src/modes/match.js';
import { MATCH } from '../src/game/sim.js';
import { blankInput } from '../src/game/fighter.js';
import { mulberry32 } from '../src/core/util.js';
import { COMBAT } from '../src/game/combat.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
registerContent();
const dir = new URL('../site/assets/fighters/', import.meta.url).pathname;
for (const f of readdirSync(dir)) if (f.endsWith('.json') && !f.startsWith('_')) addSpriteMeta(f.slice(0, -5), JSON.parse(readFileSync(dir + f, 'utf8')));
const GAMES = +(args.games || 30), envs = args.env ? [args.env] : Object.keys(ROSTER);

const toward = (inp, f, o, k = 1) => { const a = Math.atan2(o.y - f.y, o.x - f.x); inp.mx = Math.cos(a) * k; inp.my = Math.sin(a) * k; };
export const BOTS = {
  // holds the basic attack and walks at the opponent. Nothing else.
  masher(S, f, o, st) { const inp = blankInput(); toward(inp, f, o); inp.held[0] = true; return inp; },
  // mashes, chains a random ready special when a hit lands, fires the Ultimate when it has one
  masherPlus(S, f, o, st) {
    const inp = BOTS.masher(S, f, o, st);
    if (f.ult >= 100 && st.rng() < 0.1) inp.ult = true;
    if (f.move && S.tick - f.move.landedT <= 6 && st.rng() < 0.5) { const ready = [1, 2, 3].filter((i) => f.canStartMove(i) && MOVES[f.kit()[i]].power > 0); if (ready.length) inp.slot = ready[Math.floor(st.rng() * ready.length)]; }
    return inp;
  },
  // a beginner: wanders roughly toward the opponent and presses a random button a few times a second
  novice(S, f, o, st) {
    const inp = blankInput();
    if (S.tick % 30 === 0) st.dir = Math.atan2(o.y - f.y, o.x - f.x) + (st.rng() - 0.5) * 2.4;
    inp.mx = Math.cos(st.dir || 0); inp.my = Math.sin(st.dir || 0);
    if (S.tick % 14 === 0) { const r = st.rng(); if (r < 0.5) inp.slot = 0; else if (r < 0.8) inp.slot = 1 + Math.floor(st.rng() * 3); else if (r < 0.9) inp.dodge = true; else inp.ult = true; }
    return inp;
  },
  // only ever runs away and pokes with the basic attack from range (works only for ranged basics)
  runner(S, f, o, st) {
    const inp = blankInput(), d = Math.hypot(o.x - f.x, o.y - f.y);
    if (d < 120) { toward(inp, f, o, -1); const b = S.bounds; if (f.x < b.x0 + 40 || f.x > b.x1 - 40 || f.y < b.y0 + 40 || f.y > b.y1 - 40) { const a = Math.atan2(o.y - f.y, o.x - f.x) + 1.4; inp.mx = Math.cos(a); inp.my = Math.sin(a); } }
    inp.held[0] = true;
    return inp;
  },
  // a careful player: mashes, but dodges specials on reaction, breaks out of combos, and strikes out of the dodge
  solid(S, f, o, st) {
    const inp = BOTS.masherPlus(S, f, o, st);
    if (o.move && !o.move.basic && o.move.t === Math.min(12, o.move.hitT - 4) && Math.hypot(o.x - f.x, o.y - f.y) < 90 && f.stamina >= 20) { inp.dodge = true; const a = Math.atan2(o.y - f.y, o.x - f.x) + 1.5; inp.mx = Math.cos(a); inp.my = Math.sin(a); }
    if (f.state === 'hurt' && f.cmb.n >= 4 && f.canBreak()) inp.dodge = true;
    return inp;
  },
};
const names = (args.bots ? String(args.bots).split(',') : Object.keys(BOTS));
if (import.meta.main) for (const env of envs) {
  const roster = ROSTER[env];
  console.log(`BOTS vs CPU — ${env} (${GAMES} games per cell; win % for the bot)`);
  for (const bot of names) {
    const row = [];
    for (const level of ['easy', 'normal', 'hard']) {
      let wins = 0, len = 0;
      for (let g = 0; g < GAMES; g++) {
        const me = roster[g % roster.length], foe = roster[(g * 7 + 3) % roster.length === g % roster.length ? (g + 1) % roster.length : (g * 7 + 3) % roster.length];
        const m = new Match({ seed: 90000 + g * 13, env, format: 'pokemon', map: MAPS_BY_ENV[env][g % 4], sides: [{ team: [me], control: 'human' }, { team: [foe], control: 'cpu', level }] });
        const S = m.sim, st = { rng: mulberry32(777 + g) };
        for (let t = 0; t < 40; t++) m.step([blankInput(), null]);
        m.startFight();
        let t = 0;
        while (S.phase !== 'over' && t++ < MATCH.pokemonTicks + 6000) { const f = S.activeOf(0), o = S.activeOf(1); m.step([f && o && S.phase === 'fight' ? BOTS[bot](S, f, o, st) : blankInput(), null]); }
        if (S.result && S.result.winner === 0) wins++;
        len += S.fightTicks / 60;
      }
      row.push(`${level} ${String(Math.round(100 * wins / GAMES)).padStart(3)}% (${Math.round(len / GAMES)} s)`);
    }
    console.log(`  ${bot.padEnd(11)} ${row.join('   ')}`);
  }
}
