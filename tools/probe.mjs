// Fighter probe: plays one fighter against its whole roster (CPU normal both sides) and reports where its damage
// comes from and how the fights go. Usage: bun tools/probe.mjs garchomp [--env ground] [--games 44] [--level normal]
import { readFileSync, readdirSync } from 'node:fs';
import { registerContent, addSpriteMeta, ROSTER } from '../src/content/index.js';
import { MAPS_BY_ENV } from '../src/content/maps.js';
import { MOVES } from '../src/content/moves.js';
import { SPECIES } from '../src/content/species.js';
import { BALANCE } from '../src/content/balance.js';
import { Match } from '../src/modes/match.js';
import { MATCH } from '../src/game/sim.js';
const ids = process.argv.slice(2).filter((x) => !x.startsWith('--') && SPECIES[x]);
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
registerContent();
const dir = new URL('../site/assets/fighters/', import.meta.url).pathname;
for (const f of readdirSync(dir)) if (f.endsWith('.json') && !f.startsWith('_')) addSpriteMeta(f.slice(0, -5), JSON.parse(readFileSync(dir + f, 'utf8')));
const GAMES = +(args.games || 44), LEVEL = args.level || 'normal';
for (const id of ids) {
  const env = args.env || SPECIES[id].envs[0], foes = ROSTER[env].filter((x) => x !== id);
  let wins = 0, len = 0; const dmg = {}, taken = {}, st = { me: {}, foe: {} }; let myHits = 0, foeHits = 0, myCmb = [], foeCmb = [];
  for (let g = 0; g < GAMES; g++) {
    const foe = foes[g % foes.length], side = g % 2;
    const sides = [{ team: [id], control: 'cpu', level: LEVEL }, { team: [foe], control: 'cpu', level: LEVEL }];
    if (side) sides.reverse();
    const m = new Match({ seed: 4242 + g * 31, env, format: 'pokemon', map: MAPS_BY_ENV[env][g % 4], sides });
    const S = m.sim; for (let t = 0; t < 40; t++) m.step(); m.startFight();
    let t = 0;
    while (S.phase !== 'over' && t++ < MATCH.pokemonTicks + 6000) {
      const evs = m.step();
      if (S.phase === 'fight') for (const f of S.fighters()) { const k = f.side === side ? st.me : st.foe; k[f.state] = (k[f.state] || 0) + 1; }
      for (const e of evs) {
        if (e.e === 'hit' && e.dmg > 0 && !e.att.isEnv) { const mine = e.att.side === side; const key = e.basic ? 'basic' : e.ult ? 'ULT' : e.moveId || 'other'; (mine ? dmg : taken)[key] = ((mine ? dmg : taken)[key] || 0) + e.dmg / e.tgt.maxHp; if (mine) myHits++; else foeHits++; }
        else if (e.e === 'wallSlam') { const mine = e.f.side !== side; (mine ? dmg : taken).wallSlam = ((mine ? dmg : taken).wallSlam || 0) + e.dmg / e.f.maxHp; }
        else if (e.e === 'dot') { const mine = e.f.side !== side; (mine ? dmg : taken)['status:' + e.kind] = ((mine ? dmg : taken)['status:' + e.kind] || 0) + e.dmg / e.f.maxHp; }
        else if (e.e === 'comboEnd') (e.att.side === side ? myCmb : foeCmb).push(e.n);
      }
    }
    if (S.result && S.result.winner === side) wins++;
    len += S.fightTicks / 60;
  }
  const pct = (o) => { const t = Object.values(o).reduce((a, b) => a + b, 0) || 1; return Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k, v]) => `${k} ${(100 * v / t).toFixed(0)}%`).join(', '); };
  const tot = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const tm = (o) => { const t = tot(o) || 1; return ['walk', 'idle', 'act', 'hurt', 'dodge', 'trav'].map((k) => `${k} ${(100 * (o[k] || 0) / t).toFixed(0)}`).join(' '); };
  const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '-');
  const b = BALANCE[env + ':' + id] || { hp: 1, dmg: 1 };
  console.log(`${id} @ ${env}  kit ${SPECIES[id].kit.join(',')}  balance hp ${b.hp} dmg ${b.dmg}`);
  console.log(`  wins ${(100 * wins / GAMES).toFixed(0)}%  avg ${(len / GAMES).toFixed(0)} s   dealt ${(tot(dmg) / GAMES * 100).toFixed(0)}% of a bar per match (${myHits / GAMES | 0} hits), took ${(tot(taken) / GAMES * 100).toFixed(0)}% (${foeHits / GAMES | 0} hits)   combos mine avg ${avg(myCmb)} x${(myCmb.length / GAMES).toFixed(1)}, theirs ${avg(foeCmb)} x${(foeCmb.length / GAMES).toFixed(1)}`);
  console.log(`  damage from: ${pct(dmg)}`);
  console.log(`  time me: ${tm(st.me)} | foe: ${tm(st.foe)}`);
}
