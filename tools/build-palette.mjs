// Derive a second stylesheet set from dist/ by swapping the accent colours.
//
//   node tools/build-palette.mjs scient     ->  dist-scient/  and  assets/scient/*.svg
//
// dist/ (Stem Quest Academy) is the single source and is never written to, so
// the two sets always share one layout. A palette is a colour-to-colour map in
// palettes/<name>.json; every notation the build emits is covered: #RRGGBB,
// #RRGGBBAA (tokens), rgb()/rgba() numbers, and %23RRGGBB inside data: URIs.
// The SVG art the stylesheet points at is recoloured the same way.
// A site selects the set with tutor-indigo's INDIGO_BRAND_PROFILE.
import fs from 'node:fs';
import path from 'node:path';

const name = process.argv[2];
if (!name) { console.error('usage: node tools/build-palette.mjs <palette>'); process.exit(1); }
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const palette = JSON.parse(fs.readFileSync(path.join(root, 'palettes', `${name}.json`), 'utf8'));

const norm = (h) => h.replace('#', '').toUpperCase();
const map = new Map(Object.entries(palette.colors).map(([a, b]) => [norm(a), norm(b)]));
const triple = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const tripleMap = new Map([...map].map(([a, b]) => [triple(a).join(','), triple(b)]));
const hits = new Map([...map.keys()].map((k) => [k, 0]));
const keepCase = (from, to) => (from === from.toLowerCase() ? to.toLowerCase() : to);

function recolour(text) {
  return text
    // #RRGGBB and #RRGGBBAA; also %23RRGGBB in data: URIs
    .replace(/(#|%23)([0-9a-fA-F]{6})([0-9a-fA-F]{2})?(?![0-9a-fA-F])/g, (m, lead, hex, alpha = '') => {
      const to = map.get(hex.toUpperCase());
      if (!to) { return m; }
      hits.set(hex.toUpperCase(), hits.get(hex.toUpperCase()) + 1);
      return lead + keepCase(hex, to) + alpha;
    })
    // rgb(r, g, b ...) and rgba(r, g, b, a); separators are kept as written
    .replace(/(rgba?\(\s*)(\d{1,3})(\s*[, ]\s*)(\d{1,3})(\s*[, ]\s*)(\d{1,3})/g, (m, open, r, s1, g, s2, b) => {
      const to = tripleMap.get(`${+r},${+g},${+b}`);
      if (!to) { return m; }
      const key = [r, g, b].map((n) => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
      hits.set(key, hits.get(key) + 1);
      return `${open}${to[0]}${s1}${to[1]}${s2}${to[2]}`;
    });
}

const dist = path.join(root, 'dist');
const out = path.join(root, `dist-${name}`);
const assetsOut = path.join(root, 'assets', name);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(assetsOut, { recursive: true });

const art = new Set();
for (const file of fs.readdirSync(dist).filter((f) => f.endsWith('.css'))) {
  let css = recolour(fs.readFileSync(path.join(dist, file), 'utf8'));
  // The art sits next to dist/ on the CDN; point at this palette's recoloured copies.
  css = css.replace(/url\((["']?)\.\.\/assets\/([\w.-]+\.svg)\1\)/g, (m, q, svg) => { art.add(svg); return `url(${q}../assets/${name}/${svg}${q})`; });
  // The maps describe dist/, not this output.
  css = css.replace(/\n?\/\*# sourceMappingURL=[^*]*\*\/\s*$/, '\n');
  fs.writeFileSync(path.join(out, file), css);
}
for (const svg of art) {
  fs.writeFileSync(path.join(assetsOut, svg), recolour(fs.readFileSync(path.join(root, 'assets', svg), 'utf8')));
}
fs.copyFileSync(path.join(dist, 'theme-urls.json'), path.join(out, 'theme-urls.json'));

const unused = [...hits].filter(([, n]) => n === 0).map(([k]) => `#${k}`);
console.log(`dist-${name}: ${fs.readdirSync(out).length} files, ${[...hits.values()].reduce((a, b) => a + b, 0)} colours swapped, ${art.size} art files recoloured`);
for (const [k, n] of hits) { console.log(`  #${k} -> #${map.get(k)}  ${n}`); }
if (unused.length) { console.log(`note: in the palette but not in the build: ${unused.join(' ')}`); }
