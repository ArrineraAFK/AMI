// Refreshes the AMVGG "baseless" values in values.json by fetching each
// entry's public page and pulling the data object Next.js embeds in the
// page's RSC payload. Tries /pet/<Name> first (regular/neon/mega values);
// entries without a pet page (eggs) fall back to /egg/<Name> (single value).
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

function emptySources() {
  return {
    amvgg: {
      baseless: { regular: null, neon: null, mega: null }
    },
    elvebredd: {
      frost: { regular: null, neon: null, mega: null },
      shark: { regular: null, neon: null, mega: null }
    }
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

function balancedObject(text, braceStart) {
  let depth = 0, inStr = false, esc = false, i = braceStart;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else {
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
    }
  }
  return text.slice(braceStart, i);
}

function extractDataBlock(html, key) {
  // The data appears either as literal `"<key>":{...}` (rare, direct HTML)
  // or as `\"<key>\":{...}` inside a JS string literal (self.__next_f.push(...)).
  // Try the escaped form first since that's what a plain page load returns.
  for (const marker of [`\\"${key}\\":{`, `"${key}":{`]) {
    const idx = html.indexOf(marker);
    if (idx < 0) continue;
    const escaped = marker.startsWith('\\');
    // Unescape a generous raw window FIRST, then balance braces on the
    // resulting plain JSON — matching directly on the still-escaped text
    // misreads the doubled backslashes/quotes as string content.
    const rawWindow = html.slice(idx, idx + 6000);
    const window = escaped ? rawWindow.replace(/\\"/g, '"').replace(/\\\\/g, '\\') : rawWindow;
    const objStr = balancedObject(window, window.indexOf('{'));
    try {
      return JSON.parse(objStr);
    } catch (e) {
      continue;
    }
  }
  return null;
}

// Pets have their own page under /pet/<Name> with regular/neon/mega values.
// Eggs (not pets, so no /pet/ page) live under /egg/<Name> with a single
// flat "value" instead — normalize both shapes to {regularValue,neonValue,megaValue}.
async function fetchEntry(name) {
  const slug = slugify(name);

  const petRes = await fetch(`https://amvgg.com/pet/${slug}`, { headers: { 'User-Agent': USER_AGENT } });
  if (petRes.ok) {
    const obj = extractDataBlock(await petRes.text(), 'pet');
    if (obj) return { regularValue: obj.regularValue, neonValue: obj.neonValue, megaValue: obj.megaValue };
  }

  const eggRes = await fetch(`https://amvgg.com/egg/${slug}`, { headers: { 'User-Agent': USER_AGENT } });
  if (eggRes.ok) {
    const obj = extractDataBlock(await eggRes.text(), 'item');
    if (obj) return { regularValue: obj.value, neonValue: null, megaValue: null };
  }

  throw new Error(`not found (pet: ${petRes.status}, egg: ${eggRes.status})`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Only "baseless" is fetched/stored. Frost and Ride Potion are derived value
// types (baseless divided by a reference pet's baseless, rounded) — computed
// live in pet-values.js at render time instead of being duplicated here.
async function main() {
  const data = JSON.parse(fs.readFileSync(VALUES_PATH, 'utf8'));
  syncNewPetsFromPetsJson(data);
  let updated = 0, failed = [];

  for (const pet of data.pets) {
    try {
      const obj = await fetchEntry(pet.name);
      const num = v => (v == null ? null : Number(v));
      if (!pet.sources) pet.sources = {};
      if (!pet.sources.amvgg) pet.sources.amvgg = {};
      pet.sources.amvgg.baseless = {
        regular: num(obj.regularValue),
        neon: num(obj.neonValue),
        mega: num(obj.megaValue)
      };
      updated++;
      console.log('OK  ', pet.name);
    } catch (e) {
      failed.push(pet.name);
      console.log('FAIL', pet.name, '-', e.message);
    }
    await sleep(DELAY_MS);
  }

  data.lastFetchedAt = new Date().toISOString();
  fs.writeFileSync(VALUES_PATH, JSON.stringify(data, null, 2) + '\n');

  console.log(`\nDone: ${updated}/${data.pets.length} updated.`);
  if (failed.length) console.log('Failed:', failed.join(', '));
}

main().catch(e => { console.error(e); process.exit(1); });
