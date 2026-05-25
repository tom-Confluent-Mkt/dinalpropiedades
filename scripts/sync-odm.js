import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_KEY = process.env.VITE_ODM_TOKKO_API_KEY;
const BASE    = 'https://tokkobroker.com/api/v1';
const OUT_DIR = join(__dirname, '..', 'public', 'data');

if (!API_KEY) {
  console.error('Missing VITE_ODM_TOKKO_API_KEY in environment.');
  process.exit(1);
}

async function fetchAllProperties() {
  const all = [];
  let offset = 0;
  const limit = 200;

  while (true) {
    const url = `${BASE}/property/?key=${API_KEY}&lang=es_ar&format=json&limit=${limit}&offset=${offset}`;
    console.log(`  [ODM] Fetching properties offset=${offset}…`);
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
  console.log('  [ODM] Fetching developments…');
  const res  = await fetch(url);
  const data = await res.json();
  return data.objects || [];
}

async function sync() {
  const start = new Date();
  console.log(`[${start.toISOString()}] Starting Obras de Mar Tokko sync…`);

  try {
    mkdirSync(OUT_DIR, { recursive: true });

    const [properties, developments] = await Promise.all([
      fetchAllProperties(),
      fetchAllDevelopments(),
    ]);

    const meta = { lastSync: start.toISOString() };

    writeFileSync(
      join(OUT_DIR, 'odm-properties.json'),
      JSON.stringify({ meta, objects: properties }, null, 2),
    );

    writeFileSync(
      join(OUT_DIR, 'odm-developments.json'),
      JSON.stringify({ meta, objects: developments }, null, 2),
    );

    console.log(
      `[${new Date().toISOString()}] ODM Done. ` +
      `Properties: ${properties.length}, Developments: ${developments.length}`,
    );

    execFileSync(process.execPath, [join(__dirname, 'enhance-odm.js')], { stdio: 'inherit' });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ODM Sync failed:`, err);
    process.exit(1);
  }
}

sync();
