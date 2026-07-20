import 'dotenv/config';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_KEY = process.env.VITE_TOKKO_API_KEY;
const BASE    = 'https://tokkobroker.com/api/v1';
const OUT_DIR = join(__dirname, '..', 'public', 'data');

if (!API_KEY) {
  console.error('Missing VITE_TOKKO_API_KEY in environment.');
  process.exit(1);
}

async function fetchAllProperties() {
  const all = [];
  let offset = 0;
  const limit = 200;

  while (true) {
    const url = `${BASE}/property/?key=${API_KEY}&lang=es_ar&format=json&limit=${limit}&offset=${offset}`;
    console.log(`  Fetching properties offset=${offset}…`);
    const res  = await fetch(url);
    const data = await res.json();

    if (!data.objects || data.objects.length === 0) break;
    all.push(...data.objects);

    if (!data.meta?.next) break;
    offset += limit;
  }

  return all;
}

async function fetchAllDevelopments() {
  const url  = `${BASE}/development/?key=${API_KEY}&lang=es_ar&format=json&limit=100`;
  console.log('  Fetching developments…');
  const res  = await fetch(url);
  const data = await res.json();
  return data.objects || [];
}

function hashProperty(p) {
  const { _last_changed, enhanced_description, ...rest } = p;
  return createHash('sha256').update(JSON.stringify(rest)).digest('hex').slice(0, 16);
}

async function sync() {
  const start = new Date();
  console.log(`[${start.toISOString()}] Starting Tokko sync…`);

  try {
    mkdirSync(OUT_DIR, { recursive: true });

    const [properties, developments] = await Promise.all([
      fetchAllProperties(),
      fetchAllDevelopments(),
    ]);

    // Load previous snapshot to detect changes
    const propsFile = join(OUT_DIR, 'properties.json');
    const prevMap = {};
    if (existsSync(propsFile)) {
      const prev = JSON.parse(readFileSync(propsFile, 'utf8'));
      for (const p of prev.objects) prevMap[p.id] = p;
    }

    // Stamp each property with _last_changed
    const now = start.toISOString();
    for (const p of properties) {
      const prev = prevMap[p.id];
      if (!prev) {
        p._last_changed = p.created_at || now;
      } else if (hashProperty(p) !== hashProperty(prev)) {
        p._last_changed = now;
      } else {
        p._last_changed = prev._last_changed || prev.created_at || now;
      }
    }

    const meta = { lastSync: start.toISOString() };

    writeFileSync(
      join(OUT_DIR, 'properties.json'),
      JSON.stringify({ meta, objects: properties }, null, 2),
    );

    writeFileSync(
      join(OUT_DIR, 'developments.json'),
      JSON.stringify({ meta, objects: developments }, null, 2),
    );

    console.log(
      `[${new Date().toISOString()}] Done. ` +
      `Properties: ${properties.length}, Developments: ${developments.length}`,
    );

    execFileSync(process.execPath, [join(__dirname, 'enhance.js')], { stdio: 'inherit' });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Sync failed:`, err);
    process.exit(1);
  }
}

sync();
