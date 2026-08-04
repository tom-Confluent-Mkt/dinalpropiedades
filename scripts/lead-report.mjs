import 'dotenv/config';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Reporte semanal de leads por vendedor (cuenta Dinal).
//
// Datos base: API pública de Tokko (/api/v1/contact/) con la API key — expone
// agente, estado de oportunidad, tags de origen y fechas. Ojo: `deleted_at` en
// esta API funciona como "última actualización" (así ordena la columna
// «Actualizado» del tablero), y es filtrable → lo usamos para detectar
// oportunidades cerradas durante la semana aunque el lead sea viejo.
//
// Historial completo (notas, cambios de estado, reasignaciones): API interna
// de la web app (requiere TOKKO_USER / TOKKO_PASS en .env). Login Django →
// cookie de sesión → /timeline/api/v1/timeline_card/?contact_id=<id>.
// Si faltan credenciales, el reporte sale sin historial, motivo de cierre ni
// métrica de primera acción.
//
// «1ª acción»: horas hábiles (lun–vie 9–17, sáb 9–13, hora argentina) entre la
// asignación del lead a su vendedor actual (la última reasignación reinicia el
// reloj) y el primer evento del timeline hecho por ese vendedor.
//
// Uso:  npm run report:leads            → semana pasada (lun–dom)
//       node scripts/lead-report.mjs --from=2026-07-20 --to=2026-07-26

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'reports');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';

const argOf = (name) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : null;
};

// dos marcas, dos cuentas Tokko. `excluded` = cuentas que no son vendedores.
const BRANDS = {
  dinal: {
    label: 'Dinal Propiedades',
    slug: '',
    key: process.env.VITE_TOKKO_API_KEY,
    user: process.env.TOKKO_USER,
    pass: process.env.TOKKO_PASS,
    excluded: ['Belen Vitale', 'Tom'],
    propsFile: 'properties.json',
  },
  odm: {
    label: 'Obras de Mar',
    slug: 'odm-',
    key: process.env.VITE_ODM_TOKKO_API_KEY,
    user: process.env.ODM_TOKKO_USER,
    pass: process.env.ODM_TOKKO_PASS,
    excluded: [],
    propsFile: 'odm-properties.json',
  },
};
const BRAND = BRANDS[argOf('brand') ?? 'dinal'];
if (!BRAND) {
  console.error(`Unknown --brand. Options: ${Object.keys(BRANDS).join(', ')}`);
  process.exit(1);
}
const API_KEY = BRAND.key;
const WEB_USER = BRAND.user;
const WEB_PASS = BRAND.pass;
const EXCLUDED_AGENTS = new Set(BRAND.excluded);

if (!API_KEY) {
  console.error('Missing Tokko API key in environment for brand:', BRAND.label);
  process.exit(1);
}

// índice de propiedades del cache local del sitio → tipo de operación / emprendimiento
const PROP_INDEX = new Map();
try {
  const data = JSON.parse(readFileSync(join(__dirname, '..', 'public', 'data', BRAND.propsFile), 'utf8'));
  for (const p of data.objects ?? []) {
    PROP_INDEX.set(p.id, { dev: !!p.development, ops: (p.operations ?? []).map((o) => o.operation_type) });
  }
} catch {
  console.warn(`  (sin cache ${BRAND.propsFile} — clasificación de tipo solo por tags)`);
}

// ---------- rango de fechas (semana pasada lun–dom, hora argentina) ----------

const iso = (d) => d.toISOString().slice(0, 10);

function previousWeek() {
  const nowArt = new Date(Date.now() - 3 * 3600e3); // ART = UTC-3, sin DST
  const dow = (nowArt.getUTCDay() + 6) % 7; // lunes = 0
  const monThis = Date.UTC(nowArt.getUTCFullYear(), nowArt.getUTCMonth(), nowArt.getUTCDate() - dow);
  return [iso(new Date(monThis - 7 * 86400e3)), iso(new Date(monThis - 86400e3))];
}

let [FROM, TO] = previousWeek();
FROM = argOf('from') ?? FROM;
TO = argOf('to') ?? TO;
const TO_EXCL = iso(new Date(Date.parse(TO) + 86400e3));
const FROM_MS = Date.parse(`${FROM}T00:00:00-03:00`);
const TO_MS = Date.parse(`${TO_EXCL}T00:00:00-03:00`);

// ---------- horas hábiles (lun–vie 9–17, sáb 9–13, ART) ----------

function businessHoursBetween(startMs, endMs) {
  if (!(endMs > startMs)) return 0;
  let total = 0;
  let cur = startMs;
  while (cur < endMs) {
    const d = new Date(cur - 3 * 3600e3); // reloj ART leído con accessors UTC
    const dow = d.getUTCDay(); // 0 = domingo
    const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + 3 * 3600e3; // 00:00 ART
    let winStart = null, winEnd = null;
    if (dow >= 1 && dow <= 5) { winStart = dayStart + 9 * 3600e3; winEnd = dayStart + 17 * 3600e3; }
    else if (dow === 6) { winStart = dayStart + 9 * 3600e3; winEnd = dayStart + 13 * 3600e3; }
    if (winStart !== null) {
      const s = Math.max(cur, winStart);
      const e = Math.min(endMs, winEnd);
      if (e > s) total += e - s;
    }
    cur = dayStart + 86400e3;
  }
  return total / 3600e3;
}

// ---------- API pública (key) ----------

async function fetchContacts(filter) {
  const out = [];
  let url = `https://tokkobroker.com/api/v1/contact/?key=${API_KEY}&format=json&limit=50&${filter}`;
  while (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Tokko API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    out.push(...data.objects);
    url = data.meta.next ? `https://tokkobroker.com${data.meta.next}` : null;
  }
  return out;
}

// ---------- API interna (sesión web) — timeline completo ----------

const jar = new Map();
const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

function storeCookies(res) {
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(';');
    const eq = pair.indexOf('=');
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

async function webLogin() {
  let res = await fetch('https://www.tokkobroker.com/go/', { headers: { 'user-agent': UA } });
  storeCookies(res);
  res = await fetch('https://www.tokkobroker.com/login/?next=/home', {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'user-agent': UA,
      'content-type': 'application/x-www-form-urlencoded',
      referer: 'https://www.tokkobroker.com/go/',
      origin: 'https://www.tokkobroker.com',
      cookie: cookieHeader(),
    },
    body: new URLSearchParams({ csrfmiddlewaretoken: jar.get('csrftoken'), username: WEB_USER, password: WEB_PASS }),
  });
  storeCookies(res);
  if (!jar.has('sessionid')) throw new Error(`Web login failed (status ${res.status})`);
}

async function fetchTimeline(contactId) {
  const events = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(
      `https://www.tokkobroker.com/timeline/api/v1/timeline_card/?contact_id=${contactId}&offset=${offset}`,
      { headers: { 'user-agent': UA, cookie: cookieHeader(), 'x-requested-with': 'XMLHttpRequest', referer: `https://www.tokkobroker.com/timeline/${contactId}/` } },
    );
    if (!res.ok) throw new Error(`timeline ${contactId} → ${res.status}`);
    const data = await res.json();
    events.push(...data.objects);
    if (!data.meta.next || events.length >= 300) break;
    offset += data.meta.limit;
  }
  return events;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]).catch((e) => { console.warn(`  ! ${e.message}`); return null; });
    }
  }));
  return out;
}

// eventos: "21/7/2026 11:06" → ms. Los eventos recientes vienen con fecha
// relativa ("Hoy 10:23" / "Ayer 17:55") — resolverlos contra la fecha ART actual.
function parseEvDate(s) {
  const str = (s ?? '').trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d{2}))?$/.exec(str);
  if (m) {
    return Date.parse(`${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}T${String(m[4] ?? 0).padStart(2, '0')}:${m[5] ?? '00'}:00-03:00`);
  }
  const rel = /^(hoy|ayer)\s+(\d{1,2}):(\d{2})$/i.exec(str);
  if (rel) {
    const nowArt = new Date(Date.now() - 3 * 3600e3);
    let dayUtc = Date.UTC(nowArt.getUTCFullYear(), nowArt.getUTCMonth(), nowArt.getUTCDate());
    if (/^ayer$/i.test(rel[1])) dayUtc -= 86400e3;
    return dayUtc + 3 * 3600e3 + (+rel[2]) * 3600e3 + (+rel[3]) * 60e3; // 00:00 ART + hh:mm
  }
  return NaN;
}

const inWeek = (ms) => ms >= FROM_MS && ms < TO_MS;
const isClosedName = (name) => /cerrad/i.test(name ?? '');
const looksLikeColor = (s) => /^[0-9A-F]{6}$/i.test(s ?? '');
const oneLine = (s) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// motivos de cierre de Tokko (enum interno) → etiqueta legible
const REASON_LABELS = {
  otro: 'Otro',
  no_responde: 'No responde',
  no_le_interesa: 'No le interesa',
  compro_con_otro: 'Compró con otro',
  no_llega_al_presupuesto: 'No llega al presupuesto',
  busqueda_suspendida: 'Búsqueda suspendida',
  compro_aqui: 'Compró aquí',
};
const prettyReason = (s) => {
  const raw = oneLine(s).toLowerCase();
  if (!raw) return '';
  return REASON_LABELS[raw] ?? (raw.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()));
};

// evento crudo → {date, actor, newAgent, icon, title, body}
function describeEvent(e) {
  const date = parseEvDate(e.create_date);
  const actor = oneLine(e.agent_name || e.assigned_to || '');
  switch (e.type) {
    case '4':
      return { date, actor, icon: '📝', title: `Nota — ${actor}`, body: oneLine(e.note_text) };
    case '3': {
      // `reason` viene en los cierres formales; `closing_excuse` es solo el color
      const reason = prettyReason(e.reason);
      const excuse = looksLikeColor(e.closing_excuse) ? '' : oneLine(e.closing_excuse);
      return { date, actor, reason, icon: '🔄', title: `Estado → ${oneLine(e.new_lead_status_name)}${actor ? ` — ${actor}` : ''}`, body: reason ? `Motivo: ${reason}` : excuse };
    }
    case '17':
      return { date, actor, newAgent: oneLine(e.new_agent), icon: '👤', title: `Reasignado: ${oneLine(e.old_agent)} → ${oneLine(e.new_agent)}`, body: '' };
    case '13': {
      const tags = (e.tags ?? []).map(oneLine).filter(Boolean).join(' · ');
      const props = (e.properties ?? []).map((p) => oneLine(p.address)).join(', ');
      return { date, actor, icon: '📩', title: `Nueva consulta${props ? ` por ${props}` : ''}`, body: [tags && `[${tags}]`, oneLine(e.text)].filter(Boolean).join(' — ') };
    }
    case '2':
      return { date, actor, icon: '📩', title: 'Nueva consulta', body: oneLine(e.text) };
    case '1':
      return { date, actor, icon: '✨', title: `Contacto creado${actor ? ` — ${actor}` : ''}`, body: '' };
    default:
      return { date, actor, icon: '•', title: `${oneLine(e.type_name) || `Evento ${e.type}`}${actor ? ` — ${actor}` : ''}`, body: oneLine(e.text || e.note_text || '') };
  }
}

function digestTimeline(rawEvents) {
  const events = rawEvents.map((e) => ({ ...describeEvent(e), type: e.type }))
    .filter((e) => !Number.isNaN(e.date))
    .sort((x, y) => x.date - y.date);
  const notes = events.filter((e) => e.type === '4').map((e) => ({ date: e.date, agent: e.actor, text: e.body }));
  const closeEvent = events.find((e) => e.type === '3' && isClosedName(e.title));
  // señales para clasificar el tipo de lead
  const propIds = [];
  const consultaTags = new Set();
  const propAddresses = [];
  for (const e of rawEvents) {
    if (e.type !== '13' && e.type !== '2') continue;
    for (const p of e.properties ?? []) { propIds.push(p.id); propAddresses.push(oneLine(p.address).toLowerCase()); }
    for (const t of e.tags ?? []) consultaTags.add(oneLine(t).toLowerCase());
  }
  return { events, notes, closeEvent, propIds, consultaTags, propAddresses };
}

// tipo de lead: Alquiler / Usados / Emprendimientos
function categoryOf(contact, tl) {
  // 1. la propiedad consultada (cache local del sitio)
  for (const id of tl?.propIds ?? []) {
    const p = PROP_INDEX.get(id);
    if (!p) continue;
    if (p.dev) return 'Emprendimientos';
    if (p.ops.includes('Alquiler')) return 'Alquiler';
    if (p.ops.includes('Venta')) return 'Usados';
  }
  // 2. interés detectado por el bot de WhatsApp
  const ai = (contact.tags ?? []).map((t) => (t.name ?? '').toLowerCase()).find((n) => n.startsWith('ai whatsapp'));
  if (ai) {
    if (ai.includes('pozo')) return 'Emprendimientos';
    if (ai.includes('usado')) return 'Usados';
    if (ai.includes('alquiler')) return 'Alquiler';
  }
  // 3. tags de la consulta del portal
  const ct = tl?.consultaTags ?? new Set();
  if (ct.has('alquiler')) return 'Alquiler';
  if (ct.has('venta')) return 'Usados';
  // 4. el título de la propiedad ("ALQUILER - ...")
  if ((tl?.propAddresses ?? []).some((a) => a.includes('alquiler'))) return 'Alquiler';
  return 'Sin clasificar';
}

// eventos entrantes/automáticos: no cuentan como acción del vendedor
// (1 contacto creado, 2/13 nueva consulta, 5 apertura de email, 17 reasignación)
const NON_ACTION_TYPES = new Set(['1', '2', '13', '5', '17']);

// asignación al vendedor actual + primera acción propia (en ms)
function responseInfo(events, agentName, createdMs) {
  let assignedAt = createdMs;
  for (const e of events) if (e.type === '17' && e.newAgent === agentName) assignedAt = e.date;
  // el timeline tiene precisión de minuto y created_at de segundo → redondear
  // para no perder los eventos de creación; lo del mismo minuto no cuenta como acción
  assignedAt = Math.floor(assignedAt / 60000) * 60000;
  const action = events.find((e) => e.date > assignedAt && e.actor === agentName && !NON_ACTION_TYPES.has(e.type));
  return {
    assignedAt,
    firstActionHours: action ? businessHoursBetween(assignedAt, action.date) : null,
    waitingHours: action ? null : businessHoursBetween(assignedAt, Date.now()),
  };
}

// ---------- clasificación ----------

const SOURCE_LABELS = [
  'WhatsApp (Bot IA)', 'MercadoLibre', 'Zonaprop', 'Argenprop',
  'Sitio web', 'Properati', 'Inmobusqueda', 'Otro / manual',
];
const PORTALS = [
  ['mercadolibre', 'MercadoLibre'], ['zonaprop', 'Zonaprop'],
  ['argenprop', 'Argenprop'], ['properati', 'Properati'], ['inmobusqueda', 'Inmobusqueda'],
];

function sourceOf(contact) {
  const tags = contact.tags ?? [];
  if (tags.some((t) => (t.name ?? '').toLowerCase().startsWith('ai whatsapp'))) return 'WhatsApp (Bot IA)';
  const origins = tags
    .filter((t) => t.group_name === 'Origen de contacto')
    .map((t) => (t.name ?? '').toLowerCase());
  for (const [needle, label] of PORTALS) if (origins.some((o) => o.includes(needle))) return label;
  if (origins.some((o) => o.includes('web') || o.includes('consulta'))) return 'Sitio web';
  return 'Otro / manual';
}

const UNATTENDED = new Set(['Pendiente contactar', 'Sin Contactar']);
const STATUS_ORDER = [
  'Sin Contactar', 'Pendiente contactar', 'Sin Seguimiento', 'Esperando respuesta',
  'Contactar Más Adelante', 'Evolucionando', 'Tomar Accion', 'Congelado',
  'Alquileres', 'Alquileres Cerrados', 'Cerrado',
];
const statusRank = (s) => { const i = STATUS_ORDER.indexOf(s); return i === -1 ? 99 : i; };
const statusKey = (name) => (name ?? '').trim();
const isClosedContact = (c) => c.opportunity_status?.is_closed_status || isClosedName(c.opportunity_status?.name);
const agentNameOf = (c) => c.agent?.name?.trim() || 'Sin asignar';

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// ---------- agregación ----------

function aggregate(newLeads, closedThisWeek, timelines) {
  const agents = new Map();
  const statusColors = new Map();
  const leadRows = [];
  const now = Date.now();

  const agentBucket = (name) => {
    if (!agents.has(name)) {
      agents.set(name, {
        name, total: 0, byStatus: new Map(), bySource: new Map(), byDay: Array.from({ length: 7 }, () => ({ att: 0, pend: 0 })),
        pendingCount: 0, closed: [], notesWritten: 0, faHours: [], noAction: 0,
      });
    }
    return agents.get(name);
  };

  for (const c of newLeads) {
    const status = statusKey(c.opportunity_status?.name) || 'Sin estado';
    if (c.opportunity_status?.color) statusColors.set(status, `#${c.opportunity_status.color}`);
    const agentName = agentNameOf(c);
    const a = agentBucket(agentName);
    const source = sourceOf(c);
    const createdMs = Date.parse(c.created_at + 'Z');
    a.total += 1;
    a.byStatus.set(status, (a.byStatus.get(status) ?? 0) + 1);
    a.bySource.set(source, (a.bySource.get(source) ?? 0) + 1);
    const unattended = UNATTENDED.has(status);
    if (unattended) a.pendingCount += 1;
    const dayIdx = Math.min(6, Math.max(0, Math.floor((createdMs - FROM_MS) / 86400e3)));
    a.byDay[dayIdx][unattended ? 'pend' : 'att'] += 1;

    const tl = timelines.get(c.id);
    const resp = tl ? responseInfo(tl.events, agentName, createdMs) : null;
    if (resp?.firstActionHours != null) a.faHours.push(resp.firstActionHours);
    else if (resp) a.noAction += 1;
    // el historial mostrado arranca en la asignación al vendedor actual
    const shownEvents = resp ? tl.events.filter((e) => e.date >= resp.assignedAt) : (tl?.events ?? []);

    leadRows.push({
      id: c.id,
      agent: agentName,
      name: c.name?.trim() || '(sin nombre)',
      phone: c.cellphone || c.phone || c.email || '—',
      source,
      category: categoryOf(c, tl),
      status,
      unattended,
      created: c.created_at,
      days: Math.floor((now - createdMs) / 86400e3),
      firstActionHours: resp?.firstActionHours ?? null,
      waitingHours: resp?.waitingHours ?? null,
      events: shownEvents,
    });
  }

  for (const c of closedThisWeek) {
    const agentName = agentNameOf(c);
    const a = agentBucket(agentName);
    const tl = timelines.get(c.id);
    const close = tl?.closeEvent;
    const notesSorted = tl?.notes ?? [];
    const resp = tl ? responseInfo(tl.events, agentName, Date.parse(c.created_at + 'Z')) : null;
    a.closed.push({
      id: c.id,
      name: c.name?.trim() || '(sin nombre)',
      status: statusKey(c.opportunity_status?.name),
      source: sourceOf(c),
      date: close?.date ?? Date.parse(c.deleted_at + 'Z'),
      reason: close?.reason || close?.body || notesSorted.at(-1)?.text || '',
      isNew: Date.parse(c.created_at + 'Z') >= FROM_MS,
      events: resp ? tl.events.filter((e) => e.date >= resp.assignedAt) : (tl?.events ?? []),
    });
  }

  // notas escritas durante la semana, atribuidas a su autor
  for (const tl of timelines.values()) {
    for (const n of tl.notes) {
      if (inWeek(n.date) && n.agent && !EXCLUDED_AGENTS.has(n.agent)) agentBucket(n.agent).notesWritten += 1;
    }
  }

  leadRows.sort((x, y) => statusRank(x.status) - statusRank(y.status) || y.days - x.days);

  const list = [...agents.values()].filter((a) => a.total || a.closed.length || a.notesWritten)
    .sort((x, y) => y.total - x.total);
  for (const a of list) {
    a.closed.sort((x, y) => y.date - x.date);
    a.faMedian = median(a.faHours);
  }

  // promedios del equipo
  const teamTotal = list.reduce((n, a) => n + a.total, 0);
  const team = {
    total: teamTotal,
    pendingPct: teamTotal ? list.reduce((n, a) => n + a.pendingCount, 0) / teamTotal * 100 : 0,
    faMedian: median(list.flatMap((a) => a.faHours)),
    statusShare: new Map(),
    dayAvg: Array.from({ length: 7 }, (_, i) => list.reduce((n, a) => n + a.byDay[i].att + a.byDay[i].pend, 0) / Math.max(list.filter((a) => a.total).length, 1)),
  };
  for (const a of list) for (const [s, n] of a.byStatus) team.statusShare.set(s, (team.statusShare.get(s) ?? 0) + n);
  for (const [s, n] of team.statusShare) team.statusShare.set(s, teamTotal ? n / teamTotal * 100 : 0);

  return { agents: list, statusColors, leadRows, team };
}

// ---------- HTML ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (v) => {
  // números = ms (ya en hora real); strings = ISO UTC de la API pública
  const d = new Date(typeof v === 'number' ? v : v + 'Z');
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d).replace(',', '');
};
const fmtRange = (from, to) => {
  const f = (s) => s.split('-').reverse().slice(0, 2).join('/');
  return `${f(from)} al ${f(to)} de ${from.slice(0, 4)}`;
};
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const fmtH = (h) => h == null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : `${h.toLocaleString('es-AR', { maximumFractionDigits: 1 })} h`;
const fmtPct = (p) => `${p.toLocaleString('es-AR', { maximumFractionDigits: 0 })}%`;
const tokkoLink = (id, label) => `<a class="tk" href="https://www.tokkobroker.com/timeline/${id}/" target="_blank" rel="noopener">${label}</a>`;
const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// paleta categórica (dataviz reference) — orden fijo por fuente; divergente azul/rojo
const SOURCE_COLOR_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
const SOURCE_COLOR_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const sourceSlot = (label) => Math.max(0, SOURCE_LABELS.indexOf(label));

// tipos de lead — orden y colores fijos
const CATEGORY_LABELS = ['Alquiler', 'Usados', 'Emprendimientos', 'Sin clasificar'];
const CATEGORY_COLOR_LIGHT = ['#1baf7a', '#eda100', '#4a3aa7', '#898781'];
const CATEGORY_COLOR_DARK = ['#199e70', '#c98500', '#9085e9', '#898781'];
const categorySlot = (label) => Math.max(0, CATEGORY_LABELS.indexOf(label));
const categoryChip = (label) => `<span class="cat"><span class="dot cat-${categorySlot(label)}"></span>${esc(label)}</span>`;

let tlSeq = 0;
function timelineToggle(events) {
  if (!events.length) return { btn: '<span class="none">—</span>', row: '' };
  const id = `tl-${++tlSeq}`;
  const items = events.map((e) => `
    <div class="ev">
      <span class="ev-date">${fmtDate(e.date)}</span>
      <span class="ev-ico">${e.icon}</span>
      <div class="ev-txt"><b>${esc(e.title)}</b>${e.body ? `<div class="ev-body">${esc(clip(e.body, 600))}</div>` : ''}</div>
    </div>`).join('');
  return {
    btn: `<button type="button" class="tl-btn" data-tl="${id}">${events.length} eventos</button>`,
    row: `<tr id="${id}" class="tl-row" hidden><td colspan="10"><div class="tlx">${items}</div></td></tr>`,
  };
}

function statusBarChart(byStatus, statusColors, total) {
  const orderedNames = [...STATUS_ORDER, ...[...byStatus.keys()].filter((s) => !STATUS_ORDER.includes(s))];
  const segs = orderedNames.filter((s) => byStatus.get(s)).map((s) =>
    `<span class="seg" style="flex-grow:${byStatus.get(s)};background:${statusColors.get(s) ?? '#c3c2b7'}" title="${esc(s)}: ${byStatus.get(s)}"></span>`);
  const legend = orderedNames.filter((s) => byStatus.get(s)).map((s) =>
    `<span class="lg"><span class="dot" style="background:${statusColors.get(s) ?? '#c3c2b7'}"></span>${esc(s)} <b>${byStatus.get(s)}</b></span>`);
  return `<div class="bar" role="img" aria-label="Distribución por estado (${total} leads)">${segs.join('')}</div><div class="legend">${legend.join('')}</div>`;
}

function sourceRows(bySource, maxCount) {
  return [...bySource.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => {
      const slot = sourceSlot(label);
      return `<div class="srow" title="${esc(label)}: ${n}">
        <span class="sname">${esc(label)}</span>
        <span class="strack"><span class="sfill src-${slot}" style="width:${Math.round((n / maxCount) * 100)}%"></span></span>
        <span class="scount">${n}</span></div>`;
    }).join('');
}

// leads por día (lun–dom), apilado atendido/sin atender + tick del promedio del equipo
function dayChart(byDay, dayAvg) {
  const max = Math.max(...byDay.map((d) => d.att + d.pend), ...dayAvg, 1);
  const cols = byDay.map((d, i) => {
    const t = d.att + d.pend;
    const hAtt = Math.round((d.att / max) * 100);
    const hPend = Math.round((d.pend / max) * 100);
    const tick = Math.round((dayAvg[i] / max) * 100);
    return `<div class="dc-col" title="${DAY_NAMES[i]}: ${t} leads (${d.pend} sin atender) · promedio equipo ${dayAvg[i].toLocaleString('es-AR', { maximumFractionDigits: 1 })}">
      <div class="dc-stack">
        <span class="dc-tick" style="bottom:${tick}%"></span>
        ${d.pend ? `<span class="dc-seg dc-pend" style="height:${hPend}%"></span>` : ''}
        ${d.att ? `<span class="dc-seg dc-att" style="height:${hAtt}%"></span>` : ''}
      </div>
      <span class="dc-n">${t || ''}</span>
      <span class="dc-day">${DAY_NAMES[i]}</span>
    </div>`;
  }).join('');
  return `<div class="dc">${cols}</div>
  <div class="legend"><span class="lg"><span class="dot dc-att"></span>Atendido</span><span class="lg"><span class="dot dc-pend"></span>Sin atender</span><span class="lg"><span class="dot dc-tickdot"></span>Promedio por vendedor</span></div>`;
}

// desvío del mix de estados vs el equipo, en puntos porcentuales
function mixDeviation(a, team) {
  const rows = [];
  const names = [...new Set([...team.statusShare.keys()])].sort((x, y) => statusRank(x) - statusRank(y));
  for (const s of names) {
    const repShare = a.total ? (a.byStatus.get(s) ?? 0) / a.total * 100 : 0;
    const teamShare = team.statusShare.get(s) ?? 0;
    if (!repShare && !teamShare) continue;
    const dev = repShare - teamShare;
    const w = Math.min(Math.abs(dev), 50) * 2; // 50pp = ancho completo del brazo
    rows.push(`<div class="mx-row" title="${esc(s)}: ${fmtPct(repShare)} propio vs ${fmtPct(teamShare)} equipo">
      <span class="mx-name">${esc(s)}</span>
      <span class="mx-track">
        <span class="mx-arm mx-left">${dev < -0.5 ? `<span class="mx-fill mx-neg" style="width:${w}%"></span>` : ''}</span>
        <span class="mx-mid"></span>
        <span class="mx-arm">${dev > 0.5 ? `<span class="mx-fill mx-pos" style="width:${w}%"></span>` : ''}</span>
      </span>
      <span class="mx-val">${dev > 0 ? '+' : ''}${dev.toLocaleString('es-AR', { maximumFractionDigits: 1 })} pp</span>
    </div>`);
  }
  return rows.join('');
}

function narrative(a, team) {
  const bits = [];
  bits.push(`Recibió <b>${a.total}</b> leads (${fmtPct(team.total ? a.total / team.total * 100 : 0)} del equipo).`);
  if (a.pendingCount) {
    const pct = a.total ? a.pendingCount / a.total * 100 : 0;
    const cmp = pct > team.pendingPct + 5 ? 'peor que' : pct < team.pendingPct - 5 ? 'mejor que' : 'en línea con';
    bits.push(`<b>${a.pendingCount}</b> siguen sin atender (${fmtPct(pct)}, ${cmp} el ${fmtPct(team.pendingPct)} del equipo).`);
  } else if (a.total) {
    bits.push(`Atendió <b>todos</b> sus leads.`);
  }
  if (a.faMedian != null) {
    bits.push(`Primera acción: mediana <b>${fmtH(a.faMedian)}</b> hábiles${team.faMedian != null ? ` (equipo: ${fmtH(team.faMedian)})` : ''}.`);
  }
  if (a.noAction) bits.push(`<b>${a.noAction}</b> leads todavía sin ninguna acción propia.`);
  if (a.closed.length) bits.push(`Cerró <b>${a.closed.length}</b> oportunidades.`);
  if (a.notesWritten) bits.push(`Dejó <b>${a.notesWritten}</b> notas.`);
  return bits.join(' ');
}

function buildHtml({ agents, statusColors, leadRows, team }, newTotal, hasTimelines, excludedCount) {
  const closedAll = agents.flatMap((a) => a.closed.map((c) => ({ ...c, agent: a.name }))).sort((x, y) => y.date - x.date);
  const pendingCount = agents.reduce((n, a) => n + a.pendingCount, 0);
  const attendedPct = newTotal ? Math.round(((newTotal - pendingCount) / newTotal) * 100) : 0;
  const globalSources = new Map();
  for (const a of agents) for (const [s, n] of a.bySource) globalSources.set(s, (globalSources.get(s) ?? 0) + n);
  const topSource = [...globalSources.entries()].sort((x, y) => y[1] - x[1])[0] ?? ['—', 0];
  const maxSource = Math.max(...globalSources.values(), 1);

  const srcColorCss = SOURCE_COLOR_LIGHT.map((c, i) => `.src-${i}{background:${c}}`).join('')
    + CATEGORY_COLOR_LIGHT.map((c, i) => `.cat-${i}{background:${c}}`).join('');
  const srcColorCssDark = SOURCE_COLOR_DARK.map((c, i) => `.src-${i}{background:${c}}`).join('')
    + CATEGORY_COLOR_DARK.map((c, i) => `.cat-${i}{background:${c}}`).join('');

  // distribución global por tipo de lead
  const byCategory = new Map(CATEGORY_LABELS.map((l) => [l, 0]));
  for (const p of leadRows) byCategory.set(p.category, (byCategory.get(p.category) ?? 0) + 1);
  const maxCategory = Math.max(...byCategory.values(), 1);
  const categoryRows = [...byCategory.entries()].filter(([, n]) => n).map(([label, n]) => `
    <div class="srow" title="${esc(label)}: ${n} (${fmtPct(leadRows.length ? n / leadRows.length * 100 : 0)})">
      <span class="sname"><span class="dot cat-${categorySlot(label)}"></span>${esc(label)}</span>
      <span class="strack"><span class="sfill cat-${categorySlot(label)}" style="width:${Math.round((n / maxCategory) * 100)}%"></span></span>
      <span class="scount">${n}</span>
    </div>`).join('');

  const agentCards = agents.map((a) => `
    <section class="card">
      <header class="card-head">
        <h2>${esc(a.name)}</h2>
        <div class="mini-tiles">
          <span class="mini"><b>${a.total}</b> leads</span>
          <span class="mini ${a.pendingCount ? 'alert' : ''}"><b>${a.pendingCount}</b> sin atender</span>
          <span class="mini good"><b>${a.closed.length}</b> cerradas</span>
          ${hasTimelines ? `<span class="mini"><b>${a.notesWritten}</b> notas</span>
          <span class="mini"><b>${fmtH(a.faMedian)}</b> 1ª acción (mediana háb.)</span>` : ''}
        </div>
      </header>
      <p class="narr">${narrative(a, team)}</p>
      ${a.total ? statusBarChart(a.byStatus, statusColors, a.total) : '<p class="none">Sin leads nuevos esta semana.</p>'}
      ${a.total ? `<div class="two-col">
        <div><h3>Leads por día</h3>${dayChart(a.byDay, team.dayAvg)}</div>
        <div><h3>Mix de estados vs equipo</h3>${mixDeviation(a, team)}</div>
      </div>` : ''}
      ${a.bySource.size ? `<h3>Por fuente</h3>${sourceRows(a.bySource, Math.max(...a.bySource.values(), 1))}` : ''}
    </section>`).join('');

  const closedRows = closedAll.map((c) => {
    const tl = hasTimelines ? timelineToggle(c.events) : { btn: '', row: '' };
    return `<tr>
      <td>${esc(c.agent)}</td><td>${tokkoLink(c.id, esc(c.name))}</td>
      <td><span class="dot" style="background:${statusColors.get(c.status) ?? '#c3c2b7'}"></span>${esc(c.status)}${c.isNew ? '' : ' <span class="tag">lead previo</span>'}</td>
      <td>${esc(clip(c.reason || '—', 90))}</td>
      <td class="num">${fmtDate(c.date)}</td>
      ${hasTimelines ? `<td>${tl.btn}</td>` : ''}
    </tr>${tl.row}`;
  }).join('');

  const statusCounts = new Map();
  for (const p of leadRows) statusCounts.set(p.status, (statusCounts.get(p.status) ?? 0) + 1);
  let prevStatus = null;
  const leadTableRows = leadRows.map((p) => {
    const tl = hasTimelines ? timelineToggle(p.events) : { btn: '', row: '' };
    let group = '';
    if (p.status !== prevStatus) {
      prevStatus = p.status;
      group = `<tr class="grp"><td colspan="${hasTimelines ? 9 : 8}"><span class="dot" style="background:${statusColors.get(p.status) ?? '#c3c2b7'}"></span>${esc(p.status)} <b>(${statusCounts.get(p.status)})</b></td></tr>`;
    }
    const fa = p.firstActionHours != null
      ? `<span title="Horas hábiles desde la asignación hasta su primera acción">${fmtH(p.firstActionHours)}</span>`
      : p.waitingHours != null
        ? `<span class="overdue" title="Sin acción del vendedor — horas hábiles acumuladas">sin acción (${fmtH(p.waitingHours)})</span>`
        : '—';
    return `${group}<tr${p.unattended ? ' class="row-pending"' : ''}>
      <td>${esc(p.agent)}</td><td>${tokkoLink(p.id, esc(p.name))}</td>
      <td class="num">${esc(p.phone)}</td>
      <td><span class="dot src-${sourceSlot(p.source)}"></span>${esc(p.source)}</td>
      <td>${categoryChip(p.category)}</td>
      <td><span class="dot" style="background:${statusColors.get(p.status) ?? '#c3c2b7'}"></span>${esc(p.status)}</td>
      <td class="num">${fmtDate(p.created)}</td>
      <td class="num">${fa}</td>
      ${hasTimelines ? `<td>${tl.btn}</td>` : ''}
    </tr>${tl.row}`;
  }).join('');

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Leads ${esc(BRAND.label)} · ${esc(FROM)} a ${esc(TO)}</title>
<style>
  :root{color-scheme:light;
    --page:#f9f9f7;--surface:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--muted:#898781;
    --grid:#e1e0d9;--ring:rgba(11,11,11,.10);--crit:#d03b3b;--good:#006300;--link:#1c5cab;
    --div-neg:#2a78d6;--div-pos:#e34948;--div-mid:#c3c2b7}
  @media (prefers-color-scheme: dark){:root{color-scheme:dark;
    --page:#0d0d0d;--surface:#1a1a19;--ink:#ffffff;--ink2:#c3c2b7;--muted:#898781;
    --grid:#2c2c2a;--ring:rgba(255,255,255,.10);--crit:#e66767;--good:#0ca30c;--link:#86b6ef;
    --div-neg:#3987e5;--div-pos:#e66767;--div-mid:#383835}}
  *{box-sizing:border-box;margin:0}
  body{background:var(--page);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:32px 20px;max-width:1080px;margin:0 auto}
  h1{font-size:22px;font-weight:700}
  .sub{color:var(--ink2);margin:2px 0 24px}
  a.tk{color:var(--link);text-decoration:none;border-bottom:1px dotted var(--link)}
  a.tk:hover{border-bottom-style:solid}
  .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:28px}
  .tile{background:var(--surface);border:1px solid var(--ring);border-radius:10px;padding:14px 16px}
  .tile .v{font-size:28px;font-weight:700;line-height:1.2}
  .tile .l{color:var(--ink2);font-size:13px}
  .tile.warn .v{color:var(--crit)}
  .tile.ok .v{color:var(--good)}
  .card{background:var(--surface);border:1px solid var(--ring);border-radius:10px;padding:18px 20px;margin-bottom:16px}
  .card-head{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;margin-bottom:6px}
  h2{font-size:17px}
  h3{font-size:13px;color:var(--ink2);font-weight:600;margin:16px 0 8px}
  .narr{color:var(--ink2);font-size:13.5px;margin:0 0 12px;max-width:70ch}
  .narr b{color:var(--ink)}
  .mini-tiles{display:flex;gap:14px;color:var(--ink2);font-size:13px;flex-wrap:wrap}
  .mini b{color:var(--ink);font-size:15px}
  .mini.alert b{color:var(--crit)}
  .mini.good b{color:var(--good)}
  .none{color:var(--muted);font-size:13px}
  .two-col{display:grid;grid-template-columns:minmax(240px,1fr) minmax(260px,1.2fr);gap:8px 28px;align-items:start}
  @media(max-width:720px){.two-col{grid-template-columns:1fr}}
  .bar{display:flex;height:14px;border-radius:4px;overflow:hidden;gap:2px;background:var(--page)}
  .seg{display:block;min-width:4px}
  .legend{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:8px;font-size:12.5px;color:var(--ink2)}
  .lg b{color:var(--ink)}
  .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;border:1px solid var(--ring);vertical-align:baseline}
  .srow{display:grid;grid-template-columns:150px 1fr 30px;align-items:center;gap:10px;margin:4px 0;font-size:13px}
  .sname{color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .strack{background:var(--page);border-radius:4px;height:12px}
  .sfill{display:block;height:100%;border-radius:4px;min-width:3px}
  .scount{text-align:right;font-variant-numeric:tabular-nums}
  ${srcColorCss}
  @media (prefers-color-scheme: dark){${srcColorCssDark}}
  .dc{display:flex;gap:8px;align-items:flex-end;height:96px;padding-top:6px}
  .dc-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;height:100%}
  .dc-stack{position:relative;width:100%;max-width:34px;flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:2px;background:var(--page);border-radius:4px}
  .dc-seg{display:block;border-radius:4px;min-height:3px}
  .dc-att{background:#2a78d6}
  .dc-pend{background:var(--crit)}
  @media (prefers-color-scheme: dark){.dc-att{background:#3987e5}}
  .dc-tick{position:absolute;left:-3px;right:-3px;height:0;border-top:2px solid var(--ink);opacity:.55;z-index:1}
  .dc-tickdot{background:var(--ink);border-radius:2px}
  .dc-n{font-size:11.5px;color:var(--ink2);font-variant-numeric:tabular-nums;min-height:15px}
  .dc-day{font-size:11.5px;color:var(--muted)}
  .mx-row{display:grid;grid-template-columns:130px 1fr 62px;align-items:center;gap:8px;margin:5px 0;font-size:12.5px}
  .mx-name{color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mx-track{display:flex;align-items:center;height:12px}
  .mx-arm{flex:1;display:flex;height:100%}
  .mx-arm.mx-left{justify-content:flex-end}
  .mx-mid{width:2px;height:14px;background:var(--div-mid)}
  .mx-fill{display:block;height:100%;border-radius:4px;min-width:3px}
  .mx-neg{background:var(--div-neg)}
  .mx-pos{background:var(--div-pos)}
  .mx-val{text-align:right;color:var(--ink2);font-variant-numeric:tabular-nums;white-space:nowrap}
  .tbl-wrap{overflow-x:auto}
  table{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--ring);border-radius:10px;overflow:hidden;font-size:13.5px}
  th{text-align:left;color:var(--ink2);font-weight:600;font-size:12.5px}
  th,td{padding:8px 12px;border-bottom:1px solid var(--grid);vertical-align:top}
  tr:last-child td{border-bottom:none}
  .row-pending{background:color-mix(in srgb, var(--crit) 4%, transparent)}
  .num{font-variant-numeric:tabular-nums;white-space:nowrap}
  .overdue{color:var(--crit);font-weight:700}
  .tag{font-size:11px;color:var(--muted);border:1px solid var(--grid);border-radius:4px;padding:0 4px;white-space:nowrap}
  .hint{font-weight:400;color:var(--muted);font-size:11px;white-space:nowrap}
  .cat{white-space:nowrap}
  tr.grp td{background:color-mix(in srgb, var(--ink) 4%, var(--surface));font-weight:600;font-size:12.5px;padding:6px 12px}
  .tl-btn{background:none;border:1px solid var(--grid);border-radius:6px;color:var(--link);font-size:12.5px;padding:2px 8px;cursor:pointer;white-space:nowrap}
  .tl-btn::after{content:' ▾'}
  .tl-btn.open::after{content:' ▴'}
  .tl-row td{background:color-mix(in srgb, var(--link) 4%, transparent);padding:12px 16px}
  .tlx{display:flex;flex-direction:column;gap:0;max-width:860px}
  .ev{display:grid;grid-template-columns:86px 24px 1fr;gap:8px;padding:7px 0 7px 4px;border-left:2px solid var(--grid);margin-left:6px;position:relative}
  .ev::before{content:'';position:absolute;left:-5px;top:13px;width:8px;height:8px;border-radius:50%;background:var(--surface);border:2px solid var(--muted)}
  .ev-date{color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums;padding-top:1px}
  .ev-ico{font-size:13px}
  .ev-txt{font-size:13px;color:var(--ink)}
  .ev-txt b{font-weight:600}
  .ev-body{color:var(--ink2);margin-top:2px;line-height:1.45}
  .foot{color:var(--muted);font-size:12px;margin-top:24px}
  @media print{body{padding:0}.card,.tile,table{border-color:#ccc}.tl-row{display:table-row!important}}
</style></head><body>
<h1>Reporte de leads — ${esc(BRAND.label)}</h1>
<p class="sub">Período del ${esc(fmtRange(FROM, TO))} · generado el ${new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</p>

<div class="tiles">
  <div class="tile"><div class="v">${newTotal}</div><div class="l">Leads nuevos</div></div>
  <div class="tile ${pendingCount ? 'warn' : ''}"><div class="v">${pendingCount}</div><div class="l">Sin atender</div></div>
  <div class="tile"><div class="v">${attendedPct}%</div><div class="l">Atendidos</div></div>
  <div class="tile ok"><div class="v">${closedAll.length}</div><div class="l">Cerradas hasta hoy</div></div>
  ${hasTimelines ? `<div class="tile"><div class="v">${fmtH(team.faMedian)}</div><div class="l">1ª acción mediana (háb.)</div></div>` : ''}
  <div class="tile"><div class="v">${esc(topSource[0])}</div><div class="l">Fuente principal (${topSource[1]})</div></div>
</div>

<section class="card">
  <h2>Tipo de lead</h2>
  <div style="margin-top:10px">${categoryRows}</div>
</section>

${agentCards}

<section class="card">
  <h2>Fuentes — total semana</h2>
  <div style="margin-top:10px">${sourceRows(globalSources, maxSource)}</div>
</section>

<h2 style="margin:24px 0 10px">Oportunidades cerradas hasta hoy (${closedAll.length})</h2>
<div class="tbl-wrap"><table>
  <thead><tr><th>Vendedor</th><th>Contacto</th><th>Estado final</th><th>Motivo / última nota</th><th>Cierre</th>${hasTimelines ? '<th>Historial</th>' : ''}</tr></thead>
  <tbody>${closedRows || `<tr><td colspan="${hasTimelines ? 6 : 5}">No se cerraron oportunidades esta semana.</td></tr>`}</tbody>
</table></div>

<h2 style="margin:24px 0 10px">Todos los leads de la semana (${leadRows.length})</h2>
<p class="sub" style="margin-bottom:10px">Ordenados por estado del embudo; las filas rojas siguen sin atender. Click en el nombre abre el contacto en Tokko.</p>
<div class="tbl-wrap"><table>
  <thead><tr><th>Vendedor</th><th>Contacto</th><th>Teléfono</th><th>Fuente</th><th>Tipo</th><th>Estado</th><th>Ingresó</th><th title="Horas hábiles (lun–vie 9–17, sáb 9–13) desde la asignación al vendedor hasta su primera acción">1ª acción <span class="hint">(hs hábiles)</span></th>${hasTimelines ? '<th>Historial</th>' : ''}</tr></thead>
  <tbody>${leadTableRows || `<tr><td colspan="${hasTimelines ? 9 : 8}">Sin leads en el período.</td></tr>`}</tbody>
</table></div>

<p class="foot">Fuente: Tokko Broker (API /contact + timeline). «Sin atender» = estado del embudo aún en «Pendiente contactar» / «Sin Contactar» al momento de generar el reporte.
«1ª acción» = horas hábiles (lun–vie 9–17, sáb 9–13) entre la asignación al vendedor actual y su primer evento propio en el historial.
«Cerradas» = oportunidades cerradas entre el lunes reportado y la generación del reporte (leads anteriores a la semana marcados como «lead previo»; el estado de cada lead es el vigente al momento de generar).${excludedCount ? ` Se excluyen ${excludedCount} leads de cuentas no comerciales (${[...EXCLUDED_AGENTS].join(', ')}).` : ''}</p>

<script>
document.addEventListener('click', (e) => {
  const b = e.target.closest('.tl-btn');
  if (!b) return;
  const row = document.getElementById(b.dataset.tl);
  row.hidden = !row.hidden;
  b.classList.toggle('open', !row.hidden);
});
</script>
</body></html>`;
}

// ---------- main ----------

console.log(`Reporte de leads ${FROM} → ${TO}`);

// la API guarda las fechas en UTC → semana ART = [00:00 ART, 00:00 ART) = [T03:00Z, T03:00Z)
let newLeads = await fetchContacts(`created_at__gte=${FROM}T03:00:00&created_at__lt=${TO_EXCL}T03:00:00&order_by=-created_at`);
const excludedCount = newLeads.filter((c) => EXCLUDED_AGENTS.has(agentNameOf(c))).length;
newLeads = newLeads.filter((c) => !EXCLUDED_AGENTS.has(agentNameOf(c)));
console.log(`  ${newLeads.length} leads nuevos en el período (${excludedCount} excluidos)`);

// deleted_at ≈ última actualización → candidatos a cierre desde el inicio de la
// semana hasta ahora (excluye leads creados después de la semana reportada)
const activity = await fetchContacts(`deleted_at__gte=${FROM}T03:00:00`);
const closedCandidates = activity.filter((c) =>
  isClosedContact(c) && !EXCLUDED_AGENTS.has(agentNameOf(c)) && Date.parse(c.created_at + 'Z') < TO_MS);
console.log(`  ${activity.length} contactos con actividad · ${closedCandidates.length} en estado cerrado`);

// timelines completos vía sesión web, si hay credenciales
const timelines = new Map();
let hasTimelines = false;
let closedThisWeek = closedCandidates;

if (WEB_USER && WEB_PASS) {
  await webLogin();
  const ids = [...new Set([...newLeads, ...closedCandidates].map((c) => c.id))];
  console.log(`  bajando timeline de ${ids.length} contactos…`);
  const results = await mapLimit(ids, 6, async (id) => [id, digestTimeline(await fetchTimeline(id))]);
  for (const r of results) if (r) timelines.set(r[0], r[1]);
  hasTimelines = true;
  // cierre confirmado desde el lunes reportado hasta ahora; sin evento, cae al filtro por actividad
  closedThisWeek = closedCandidates.filter((c) => {
    const close = timelines.get(c.id)?.closeEvent;
    return close ? close.date >= FROM_MS : true;
  });
} else {
  console.warn('  (sin TOKKO_USER/TOKKO_PASS: el reporte sale sin historial, motivo de cierre ni 1ª acción)');
}

const agg = aggregate(newLeads, closedThisWeek, timelines);
for (const a of agg.agents) {
  console.log(`  ${a.name}: ${a.total} leads (${a.pendingCount} sin atender, ${a.closed.length} cerradas, ${a.notesWritten} notas, 1ª acción mediana ${a.faMedian == null ? '—' : a.faMedian.toFixed(1) + ' h háb'})`);
}

mkdirSync(OUT_DIR, { recursive: true });
const outFile = join(OUT_DIR, `reporte-leads-${BRAND.slug}${FROM}_a_${TO}.html`);
writeFileSync(outFile, buildHtml(agg, newLeads.length, hasTimelines, excludedCount));
console.log(`✔ Reporte generado: ${outFile}`);
