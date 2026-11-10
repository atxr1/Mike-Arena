// Merge tune_teams.mjs outputs into src/content/teambalance.js. Usage: bun tools/write_teams.mjs a.json b.json c.json
import { readFileSync, writeFileSync } from 'node:fs';
import { TEAM_BALANCE } from '../src/content/teambalance.js';
for (const f of process.argv.slice(2)) Object.assign(TEAM_BALANCE, JSON.parse(readFileSync(f, 'utf8')).table);
const rows = Object.entries(TEAM_BALANCE).sort().filter(([, v]) => v.hp !== 1 || v.dmg !== 1).map(([k, v]) => `  '${k}': { hp: ${v.hp}, dmg: ${v.dmg} },`).join('\n');
writeFileSync(new URL('../src/content/teambalance.js', import.meta.url).pathname, `// Per-team balance for Trainer Battles, written by tools/tune_teams.mjs from AI-vs-AI results.
// key "env:trainer" -> { hp, dmg }, applied to every Pokémon on that trainer's team on top of its own balance.
// Missing entries mean 1. Pokémon Battles never use this table.
export const TEAM_BALANCE = {
${rows}
};
`);
console.log('wrote', Object.keys(TEAM_BALANCE).length, 'teams');
