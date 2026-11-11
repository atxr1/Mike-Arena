"""Rebuild code-authored vector assets. Painted art and official portraits are preserved."""
from pathlib import Path
import json, math
R=Path(__file__).resolve().parents[1]/'inputs/visual-overhaul'
def svg(name,body,color='#e9c67f',folder='icons',box='0 0 100 100'):
 p=R/folder/(name+'.svg');p.parent.mkdir(exist_ok=True);p.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{box}" fill="none" stroke="{color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">{body}</svg>')
shapes={
'league-crest':'<path d="M50 5 85 20v32Q80 78 50 95 20 78 15 52V20Z"/><circle cx="50" cy="45" r="22"/><path d="M28 45h44M35 78h30"/><circle cx="50" cy="45" r="7" fill="#102d40"/>',
'trophy':'<path d="M30 15h40v25Q70 65 50 65T30 40ZM30 22H15v13q0 20 22 20M70 22h15v13q0 20-22 20M50 65v18M32 88h36"/><path d="m50 25 4 8 9 1-6 6 1 9-8-4-8 4 1-9-6-6 9-1Z"/>',
'ground':'<path d="m10 78 28-48 18 24 12-40 24 64ZM29 47l9 8 8-10M61 36l8 8 8-8"/>',
'water':'<path d="M50 10Q18 45 18 63a32 32 0 0 0 64 0Q82 45 50 10ZM31 65q0 17 18 17"/>',
'air':'<path d="M10 32h56q23 0 15-16-9-14-20-2M10 49h73q17 0 10 15M10 66h40q20 0 14 16-8 12-19 0"/>',
'fire':'<path d="M53 8Q35 35 47 44 30 42 27 27 7 51 22 76q27 30 54 0 20-25-6-48 1 18-10 22Q67 27 53 8Z"/>',
'electric':'<path d="M55 5 20 57h27l-5 38 38-55H53Z"/>',
'grass':'<path d="M16 80Q3 22 85 12 95 80 16 80ZM16 80l52-48M36 60V37M36 60h25"/>',
'ice':'<path d="M50 8v84M14 29l72 42M14 71l72-42M37 16l13 12 13-12M37 84l13-12 13 12M16 43l17-4 1-18M84 57l-17 4-1 18M16 57l17 4 1 18M84 43l-17-4-1-18"/>',
'fighting':'<path d="M25 82 14 58V38q8-12 16 0V22q8-12 15 0v13-19q9-11 15 0v20-12q9-10 15 0v20q17-8 12 10L72 82Z"/>',
'poison':'<path d="M17 55q-12-40 33-40t33 40L67 64v20H33V64Z"/><circle cx="34" cy="43" r="8"/><circle cx="66" cy="43" r="8"/><path d="m45 63 5-8 5 8M44 72v12M56 72v12"/>',
'psychic':'<path d="M88 47Q50 4 12 47q38 43 76 0Z"/><circle cx="50" cy="47" r="17"/><path d="M50 23q-27 38 0 43 20-8 0-19"/>',
'bug':'<ellipse cx="50" cy="54" rx="22" ry="30"/><path d="M50 26v57M32 36 17 25M29 50H10M31 67 17 81M68 36l15-11M71 50h19M69 67l14 14M40 25 33 12M60 25l7-13"/>',
'rock':'<path d="m12 65 15-42 37-11 24 35-10 35-44 8ZM27 23l19 25 18-36M46 48l-12 42M46 48l42-1"/>',
'ghost':'<path d="M17 82V46q0-36 33-36t33 36v36L66 72 50 87 34 72Z"/><ellipse cx="36" cy="44" rx="5" ry="9"/><ellipse cx="64" cy="44" rx="5" ry="9"/>',
'dragon':'<path d="m20 78 5-33 24-20 3-16 9 17 22 8-16 10-15-1-9 16 27 3 10 18-30 10Z"/><path d="m28 35-12-9 4 28M60 33h4"/>',
'dark':'<path d="M75 15Q36 10 16 44q-5 42 37 43 26-3 34-26Q49 76 42 45q-1-23 33-30Z"/>',
'steel':'<path d="M27 10h46l23 40-23 40H27L4 50Z"/><circle cx="50" cy="50" r="21"/>',
'fairy':'<path d="m50 6 12 30 32 14-32 14-12 30-12-30L6 50l32-14Z"/><path d="m80 10 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z"/>',
'normal':'<circle cx="50" cy="50" r="34"/><circle cx="50" cy="50" r="14"/>',
'flying':'<path d="M12 80Q20 14 88 12 78 55 12 80ZM29 66l45-38M37 54l28 1M47 42l26 1"/>',
'quick-battle':'<path d="m18 12 58 65-8 8L10 20ZM82 12 24 77l8 8L90 20ZM18 68 36 86M64 86l18-18"/>',
'bracket':'<path d="M12 14h22v24H12M12 62h22v24H12M34 26h20v48H34M54 50h22M76 37v26h15"/>',
'arcade':'<path d="M18 85h16V65h18V45h18V25h17M14 92h78"/><path d="m45 10 4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1Z"/>',
'records':'<path d="M20 88V56h15v32M43 88V34h15v54M66 88V12h15v76M10 88h80"/>',
'settings':'<circle cx="50" cy="50" r="25"/><circle cx="50" cy="50" r="9"/>'+''.join(f'<path transform="rotate({a} 50 50)" d="M44 25V13h12v12"/>' for a in range(0,360,60)),
'back':'<path d="M83 50H18l25-25M18 50l25 25"/>',
'play':'<path d="m30 15 55 35-55 35Z"/>',
'pause':'<path d="M30 18h10v64H30ZM60 18h10v64H60Z"/>',
'check':'<path d="m18 52 22 23 44-50"/>',
'close':'<path d="m25 25 50 50M75 25 25 75"/>',
'crown':'<path d="m12 25 20 18L50 12l18 31 20-18-9 50H21ZM24 87h52"/>',
'pokeball':'<circle cx="50" cy="50" r="36"/><path d="M14 50h72"/><circle cx="50" cy="50" r="11" fill="#102d40"/>',
'heart':'<path d="M50 86 14 48Q0 15 27 14q15 0 23 18 8-18 23-18 27 1 13 34Z"/>'}
for n,s in shapes.items():svg(n,s)
colors={'fire':'#f39c69','water':'#78cfe9','grass':'#9bd5a2','electric':'#f5d77f','ice':'#b7e5ed','fighting':'#e88982','poison':'#bd9bdb','ground':'#d8b783','flying':'#acbce9','psychic':'#f3a4c6','bug':'#c8d686','rock':'#c6b18b','ghost':'#b3a3de','dragon':'#9db8ff','dark':'#b8a5af','steel':'#bdd2db','fairy':'#f2c1db','normal':'#d0d4c6'}
for n,col in colors.items():svg('type-'+n,'<circle cx="50" cy="50" r="47" fill="#102d40" stroke-width="2"/><g transform="translate(20 20) scale(.6)">'+shapes[n]+'</g>',col)
for n,col in [('ivory','#fff1c8'),('gold','#e9c67f'),('teal','#81d9df'),('ruby','#e7a39b'),('sapphire','#a1c4ef'),('violet','#c4b5e8')]:
 svg('panel-'+n,'<path d="M18 2h880v138l-18 18H2V20Z" fill="#102d40" stroke-width="2"/><path d="M20 10h864M10 25v110M20 148h840" opacity=".4" stroke-width="1"/><path d="M2 35V20L18 2h65" stroke-width="4"/>',col,'ui','0 0 900 160')
for n,col in [('aura','#a1deef'),('flame','#ffd28a'),('psychic','#e6b9ef'),('heal','#b7e9c3')]:
 svg('burst-'+n,''.join(f'<path transform="rotate({a} 50 50)" d="M50 3 48 22 50 15 52 22Z" fill="{col}" stroke-width="1"/>' for a in range(0,360,30))+ '<circle cx="50" cy="50" r="26" stroke-width="2"/><circle cx="50" cy="50" r="32" stroke-width="1" opacity=".4"/>',col,'fx')
 svg('ring-'+n,'<ellipse cx="50" cy="50" rx="45" ry="20" stroke-width="3"/><ellipse cx="50" cy="50" rx="37" ry="14" stroke-width="1" opacity=".5"/>',col,'fx')
(R/'tokens.json').write_text(json.dumps({'name':'League Atelier','colors':{'navy':'#071c2c','panel':'#102d40','ivory':'#fff9e9','gold':'#e9c67f','muted':'#aac4cf'},'typeColors':colors,'spacing':[4,8,12,16,24,32,48],'radius':[3,4,6]},indent=2))
print('Authored',len(shapes)+len(colors)+14,'reusable vector assets')
