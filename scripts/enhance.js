import 'dotenv/config';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const DATA_DIR   = join(__dirname, '..', 'public', 'data');
const CACHE_FILE = join(DATA_DIR, 'desc-cache.json');

const FORCE = process.argv.includes('--force');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Sos un redactor inmobiliario para una agencia argentina. \
Convertí la descripción cruda de la propiedad en HTML limpio. Reglas:
- Idioma: español, conservá todos los datos originales (no inventes nada)
- Usá <h3> para títulos de sección (ej: "Planta Baja", "El Proyecto", "Ubicación")
- Usá <ul><li> para listas de características, <p> para párrafos de texto
- Sin estilos inline, sin etiquetas <html>/<body>, sin markdown
- Eliminá caracteres de tabulación, símbolos de viñeta (•, ·, –) y gritos en MAYÚSCULAS
- Devolvé ÚNICAMENTE el fragmento HTML, nada más`;

function hash(text) {
  return createHash('sha256').update(text ?? '').digest('hex').slice(0, 16);
}

function stripCodeFence(text) {
  return text.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

async function enhance(id, description) {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: description }],
  });
  return stripCodeFence(msg.content[0].text.trim());
}

async function processCollection(items, cache, label) {
  let processed = 0;
  let skipped   = 0;

  for (const item of items) {
    const raw  = item.description ?? '';
    const h    = hash(raw);
    const key  = String(item.id);

    if (!FORCE && cache[key]?.hash === h) {
      item.enhanced_description = cache[key].html;
      skipped++;
      continue;
    }

    if (!raw.trim()) {
      item.enhanced_description = '';
      skipped++;
      continue;
    }

    process.stdout.write(`  [${label}] ${item.id} — enhancing…`);
    try {
      const html = await enhance(item.id, raw);
      cache[key] = { hash: h, html, ts: new Date().toISOString() };
      item.enhanced_description = html;
      process.stdout.write(' ✓\n');
      processed++;
    } catch (err) {
      process.stdout.write(` ✗ ${err.message}\n`);
      item.enhanced_description = raw;
    }
  }

  console.log(`  [${label}] Done — ${processed} enhanced, ${skipped} skipped.`);
}

async function run() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Missing ANTHROPIC_API_KEY in environment.');
    process.exit(1);
  }

  const start = new Date();
  console.log(`[${start.toISOString()}] Starting description enhancement… ${FORCE ? '(--force)' : ''}`);

  const propsFile = join(DATA_DIR, 'properties.json');
  const devsFile  = join(DATA_DIR, 'developments.json');

  const propsData = JSON.parse(readFileSync(propsFile, 'utf8'));
  const devsData  = JSON.parse(readFileSync(devsFile,  'utf8'));

  const cache = existsSync(CACHE_FILE)
    ? JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
    : {};

  await processCollection(propsData.objects, cache, 'properties');
  await processCollection(devsData.objects,  cache, 'developments');

  writeFileSync(CACHE_FILE,  JSON.stringify(cache,     null, 2));
  writeFileSync(propsFile,   JSON.stringify(propsData, null, 2));
  writeFileSync(devsFile,    JSON.stringify(devsData,  null, 2));

  console.log(`[${new Date().toISOString()}] Enhancement complete.`);
}

run();
