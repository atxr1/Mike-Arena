// Arcade: a ladder of six battles against tougher and tougher opponents, ending with a boss. One loss ends the
// run. Everything about a run (opponents, arenas, seeds) is fixed when it starts, from one seed, and the run is
// saved before and after every battle, so it can be closed and resumed at any point.
import { ROSTER, SPECIES } from '../content/species.js';
import { TRAINERS } from '../content/trainers.js';
import { MAPS_BY_ENV } from '../content/maps.js';
import { mulberry32 } from '../core/util.js';

export const ARCADE_LEVELS = ['easy', 'easy', 'normal', 'normal', 'hard', 'hard'];
export const ARCADE_BASE = { easy: 1000, normal: 1500, hard: 2000 };
// the final stage is a Legendary when the roster still has one
const LEGENDS = new Set(['mewtwo', 'darkrai', 'rayquaza', 'kyogre', 'groudon', 'lugia', 'ho_oh', 'deoxys', 'latios', 'latias', 'suicune', 'entei', 'raikou', 'articuno', 'zapdos', 'moltres', 'dialga', 'palkia', 'giratina']);
const bst = (id) => Object.values(SPECIES[id].base || {}).reduce((a, b) => a + b, 0);

export function createArcade(o) {
  const rng = mulberry32(o.seed >>> 0);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const n = ARCADE_LEVELS.length;
  let opps;
  if (o.format === 'pokemon') {
    // the boss is the strongest Pokémon left in the roster (a Legendary wherever there is one)
    const pool = ROSTER[o.env].filter((x) => x !== o.fighter);
    const legends = pool.filter((x) => LEGENDS.has(x)), from = legends.length ? legends : pool;
    const boss = from.reduce((a, b) => (bst(b) > bst(a) ? b : a), from[0]);
    opps = [...shuffle(pool.filter((x) => x !== boss)).slice(0, n - 1), boss];
  } else {
    const boss = o.trainer === 'cynthia' ? 'red' : 'cynthia';
    opps = [...shuffle(Object.keys(TRAINERS).filter((k) => k !== o.trainer && k !== boss)).slice(0, n - 1), boss];
  }
  const maps = shuffle(MAPS_BY_ENV[o.env].slice());
  const stages = opps.map((opp, i) => ({ opp, level: ARCADE_LEVELS[i], map: maps[i % maps.length], seed: Math.floor(rng() * 1e9), boss: i === n - 1, score: null }));
  return { v: 1, env: o.env, format: o.format, fighter: o.fighter, trainer: o.trainer, seed: o.seed >>> 0, stages, index: 0, score: 0, status: 'active' };
}
// points for one won stage: difficulty, HP left, time left, perfect dodges, and a bonus for taking no damage
export function stageScore(level, hpFrac, timeFrac, perfect, flawless) {
  const parts = { base: ARCADE_BASE[level] || 1000, hp: Math.round(hpFrac * 1000), time: Math.round(timeFrac * 600), perfect: perfect * 100, flawless: flawless ? 1000 : 0 };
  parts.total = parts.base + parts.hp + parts.time + parts.perfect + parts.flawless;
  return parts;
}
export function arcadeRank(score, wins) {
  if (wins < ARCADE_LEVELS.length) return '';
  return score >= 15500 ? 'S' : score >= 13500 ? 'A' : score >= 11500 ? 'B' : 'C';
}
// apply one battle's outcome to the run. A draw replays the stage.
export function recordArcade(A, outcome, parts) {
  if (!A || A.status !== 'active') return;
  if (outcome === 'draw') return;
  const st = A.stages[A.index];
  if (outcome === 'win') { st.score = parts.total; st.parts = parts; A.score += parts.total; A.index++; if (A.index >= A.stages.length) A.status = 'cleared'; }
  else { st.lost = true; A.status = 'lost'; }
}
export const arcadeWins = (A) => A.stages.filter((s) => s.score !== null).length;
