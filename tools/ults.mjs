// How hard does each Ultimate hit? CPU-vs-CPU matches; for every Ultimate fired, the share of the target's
// max HP it took. Usage: bun tools/ults.mjs [--games 6] [--env ground]
import { readFileSync, readdirSync } from 'node:fs';
import { registerContent, addSpriteMeta, ROSTER } from '../src/content/index.js';
import { MAPS_BY_ENV } from '../src/content/maps.js';
import { Match } from '../src/modes/match.js';
import { MATCH } from '../src/game/sim.js';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a; }, []));
registerContent();
const dir = new URL('../site/assets/fighters/', import.meta.url).pathname;
for (const f of readdirSync(dir)) if (f.endsWith('.json') && !f.startsWith('_')) addSpriteMeta(f.slice(0, -5), JSON.parse(readFileSync(dir + f, 'utf8')));
const GAMES = +(args.games || 6), envs = args.env ? [args.env] : Object.keys(ROSTER);
const by = {}, all = [];
for (const env of envs) {
  const ids = ROSTER[env];
  for (let i = 0; i < ids.length; i++) for (let g = 0; g < GAMES; g++) {
    const foe = ids[(i + 1 + g * 3) % ids.length]; if (foe === ids[i]) continue;
    const m = new Match({ seed: 4000 + i * 31 + g * 7, env, format: 'pokemon', map: MAPS_BY_ENV[env][g % 4], sides: [{ team: [ids[i]], control: 'cpu', level: 'normal' }, { team: [foe], control: 'cpu', level: 'normal' }] });
    const S = m.sim; for (let t = 0; t < 40; t++) m.step([null, null]); m.startFight();
    const cur = [null, null]; let t = 0;
    const close = (s) => { const c = cur[s]; if (!c) return; const k = `${env[0]}:${c.id}`; (by[k] = by[k] || []).push(c.pct); all.push(c.pct); cur[s] = null; };
    while (S.phase !== 'over' && t++ < MATCH.pokemonTicks + 6000) {
      m.step([null, null]);
      for (const e of S.events) {
        if (e.e === 'ultimate' && e.f) { close(e.f.side); cur[e.f.side] = { id: e.f.sp.id, pct: 0, at: S.tick }; }
        if (e.e === 'hit' && e.ult && e.att && cur[e.att.side] && e.dmg > 0) cur[e.att.side].pct += 100 * e.dmg / e.tgt.maxHp;
      }
      for (const s of [0, 1]) if (cur[s] && S.tick - cur[s].at > 360) close(s);
    }
    close(0); close(1);
  }
}
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
console.log(`Ultimates fired: ${all.length}   share of the target's max HP: mean ${mean(all).toFixed(1)}%  median ${q(all, 0.5).toFixed(1)}%  90th pct ${q(all, 0.9).toFixed(1)}%  max ${Math.max(...all).toFixed(1)}%   missed completely ${Math.round(100 * all.filter((x) => x === 0).length / all.length)}%`);
const rows = Object.entries(by).map(([k, v]) => [k, mean(v), Math.max(...v), v.length]).sort((a, b) => b[1] - a[1]);
console.log('  hardest: ' + rows.slice(0, 8).map(([k, m, mx, n]) => `${k} ${m.toFixed(0)}% (max ${mx.toFixed(0)}, n${n})`).join('  '));
console.log('  weakest: ' + rows.slice(-8).map(([k, m, mx, n]) => `${k} ${m.toFixed(0)}% (max ${mx.toFixed(0)}, n${n})`).join('  '));
