// Refreshes AMVGG pet values in values.json.
//
// Primary source: the single https://amvgg.com/values/pets listing page,
// which embeds a full price matrix per pet in one request — regular/neon/mega
// tier x {both potions, fly only, ride only, no potion}. That's ~1 request
// instead of ~750, and gives us data (fly/ride/no-potion) the individual
// /pet/<Name> pages don't expose at all.
//
// Anything not on that list (eggs, and a handful of very obscure pets AMVGG
// doesn't track on /values/pets) falls back to per-item pages: /pet/<Name>
// then /egg/<Name> — those only ever give the "both potions" (FR) value.
//
// Run manually: node scripts/fetch-amvgg-values.js
// Run periodically via .github/workflows/update-values.yml

const fs = require('fs');
const path = require('path');

const VALUES_PATH = path.join(__dirname, '..', 'values.json');
const PETS_PATH = path.join(__dirname, '..', 'pets.json');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const DELAY_MS = 400; // be polite between requests
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'ultrarare', 'legendary'];

function emptyTier() {
  return { both: null, fly: null, ride: null, none: null };
}
function emptyBaseless() {
  return { regular: emptyTier(), neon: emptyTier(), mega: emptyTier() };
}
function emptySources() {
  return {
    amvgg: { baseless: emptyBaseless() },
    elvebredd: { frost: emptyBaseless(), shark: emptyBaseless() }
  };
}

// Adds any pet from pets.json (the Collections tracker's pet list) that isn't
// in values.json yet, so newly added pets get picked up automatically on the
// next run instead of staying invisible until someone edits values.json by hand.
function syncNewPetsFromPetsJson(data) {
  const petsData = JSON.parse(fs.readFileSync(PETS_PATH, 'utf8'));
  const known = new Set(data.pets.map(p => p.name));
  let added = 0;
  RARITY_ORDER.forEach(rarity => {
    (petsData.pets[rarity] || []).forEach(p => {
      if (known.has(p.name)) return;
      data.pets.push({ name: p.name, rarity, origin: null, sources: emptySources() });
      known.add(p.name);
      added++;
    });
  });
  if (added) console.log(`Synced ${added} new pet(s) from pets.json.`);
  return data;
}

function slugify(name) {
  return name.replace(/ /g, '_');
}

function balancedSpan(text, start, openChar, closeChar) {
  let depth = 0, inStr = false, esc = false, i = start;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else {
      if (c === '"') inStr = true;
      else if (c === openChar) depth++;
      else if (c === closeChar) { depth--; if (depth === 0) { i++; break; } }
    }
  }
  return text.slice(start, i);
}

function extractEscapedJson(html, marker, openChar, closeChar) {
  const idx = html.indexOf(marker);
  if (idx < 0) return null;
  // Unescape a raw window FIRST, then balance brackets on the resulting plain
  // JSON — matching directly on the still-escaped text misreads the doubled
  // backslashes/quotes as string content.
  const rawWindow = html.slice(idx, idx + 3000000);
  const win = rawWindow.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  const spanStart = win.indexOf(openChar);
  const spanStr = balancedSpan(win, spanStart, openChar, closeChar);
  try { return JSON.parse(spanStr); } catch (e) { return null; }
}

const num = v => (v == null ? null : Number(v));

// ── Bulk source: /values/pets (full potion/tier matrix) ────────────
async function fetchPetsListMatrix() {
  const res = await fetch('https://amvgg.com/values/pets', { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const html = await res.text();
  const list = extractEscapedJson(html, '\\"pets\\":[', '[', ']');
  if (!list) throw new Error('pets array not found on /values/pets');
  const byName = new Map();
  list.forEach(p => {
    byName.set(p.name, {
      regular: { both: num(p.regularValue), fly: num(p.fValue), ride: num(p.rValue), none: num(p.npRegularValue) },
      neon: { both: num(p.neonValue), fly: num(p.nfValue), ride: num(p.nrValue), none: num(p.npNeonValue) },
      mega: { both: num(p.megaValue), fly: num(p.mfValue), ride: num(p.mrValue), none: num(p.npMegaValue) }
    });
  });
  return byName;
}

// ── Per-item fallback: /pet/<Name> then /egg/<Name> (only gives "both") ──
function extractDataBlock(html, key) {
  for (const marker of [`\\"${key}\\":{`, `"${key}":{`]) {
    const idx = html.indexOf(marker);
    if (idx < 0) continue;
    const escaped = marker.startsWith('\\');
    const rawWindow = html.slice(idx, idx + 6000);
    const window = escaped ? rawWindow.replace(/\\"/g, '"').replace(/\\\\/g, '\\') : rawWindow;
    const objStr = balancedSpan(window, window.indexOf('{'), '{', '}');
    try { return JSON.parse(objStr); } catch (e) { continue; }
  }
  return null;
}
async function fetchEntryFallback(name) {
  const slug = slugify(name);

  const petRes = await fetch(`https://amvgg.com/pet/${slug}`, { headers: { 'User-Agent': USER_AGENT } });
  if (petRes.ok) {
    const obj = extractDataBlock(await petRes.text(), 'pet');
    if (obj) {
      const b = emptyBaseless();
      b.regular.both = num(obj.regularValue);
      b.neon.both = num(obj.neonValue);
      b.mega.both = num(obj.megaValue);
      return b;
    }
  }

  const eggRes = await fetch(`https://amvgg.com/egg/${slug}`, { headers: { 'User-Agent': USER_AGENT } });
  if (eggRes.ok) {
    const obj = extractDataBlock(await eggRes.text(), 'item');
    if (obj) {
      const b = emptyBaseless();
      b.regular.both = num(obj.value);
      return b;
    }
  }

  throw new Error(`not found (pet: ${petRes.status}, egg: ${eggRes.status})`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const data = JSON.parse(fs.readFileSync(VALUES_PATH, 'utf8'));
  syncNewPetsFromPetsJson(data);

  console.log('Fetching /values/pets matrix...');
  const matrix = await fetchPetsListMatrix();
  console.log(`Matrix covers ${matrix.size} pets.`);

  let matrixHits = 0, fallbackOk = 0, failed = [];

  for (const pet of data.pets) {
    if (!pet.sources) pet.sources = emptySources();
    if (!pet.sources.amvgg) pet.sources.amvgg = { baseless: emptyBaseless() };

    const fromMatrix = matrix.get(pet.name);
    if (fromMatrix) {
      pet.sources.amvgg.baseless = fromMatrix;
      matrixHits++;
      console.log('OK (matrix)  ', pet.name);
      continue;
    }

    try {
      pet.sources.amvgg.baseless = await fetchEntryFallback(pet.name);
      fallbackOk++;
      console.log('OK (fallback)', pet.name);
    } catch (e) {
      failed.push(pet.name);
      console.log('FAIL         ', pet.name, '-', e.message);
    }
    await sleep(DELAY_MS);
  }

  data.lastFetchedAt = new Date().toISOString();
  fs.writeFileSync(VALUES_PATH, JSON.stringify(data, null, 2) + '\n');

  const total = data.pets.length;
  console.log(`\nDone: ${matrixHits} from matrix, ${fallbackOk} from fallback, ${failed.length} failed, ${total} total.`);
  if (failed.length) console.log('Failed:', failed.join(', '));
}

main().catch(e => { console.error(e); process.exit(1); });
