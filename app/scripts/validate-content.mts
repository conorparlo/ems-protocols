/**
 * Validate structured protocol content.
 *
 *   node scripts/validate-content.mts            (from app/)
 *
 * Checks: schema, node graph integrity (targets exist, no unreachable nodes), link tokens resolve to
 * catalog entries, complaints reference real protocols. If ../content/source exists (PDF extraction
 * output), also checks every PDF hyperlink target on the page is represented, and reports PDF words
 * missing from the structured text (catches dropped lines).
 *
 * Exits non-zero on errors. Warnings do not fail.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Complaint, LINK_TOKEN, Protocol, type Node } from '../src/content/schema.ts';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = join(here, '..', 'content');
const sourceDir = join(here, '..', '..', 'content', 'source');

type CatalogEntry = { id: string; title: string; pages: number[]; category: string };
const catalog: Record<string, CatalogEntry> = JSON.parse(
  readFileSync(join(contentDir, 'catalog.json'), 'utf8'),
);

let errors = 0;
let warnings = 0;
const err = (where: string, msg: string) => {
  errors++;
  console.log(`  ✗ ${where}: ${msg}`);
};
const warn = (where: string, msg: string) => {
  warnings++;
  console.log(`  ! ${where}: ${msg}`);
};

/** All rich-text strings in a protocol, in reading order. */
function texts(p: Protocol): string[] {
  const out: string[] = [];
  const nodeText = (n: Node) => {
    if (n.kind === 'step') out.push(...n.items.map((i) => i.text));
    else if (n.kind === 'decision') out.push(n.text, ...n.items.map((i) => i.text), ...n.branches.map((b) => b.label));
    else out.push(n.text);
  };
  Object.values(p.nodes).forEach(nodeText);
  p.sidebars.forEach((s) => {
    if (s.title) out.push(s.title);
    out.push(...s.items.map((i) => i.text));
  });
  return out;
}

const pageIndex: Record<string, { id: string | null }> = existsSync(join(sourceDir, 'index.json'))
  ? JSON.parse(readFileSync(join(sourceDir, 'index.json'), 'utf8'))
  : {};

const STOP = new Set(
  'a an and or of the to in on for if is are be as by with at from per e.g. eg not no yes go see refer protocol'.split(' '),
);
const LEGEND = new Set(['emr', 'oec', 'emt', 'iv', 'i', 'aemt', 'paramedic']); // certification legend box
const norm = (w: string) =>
  w
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9<>%'-]/g, '');

function checkAgainstSource(p: Protocol, where: string) {
  const json = texts(p).join(' ').replace(LINK_TOKEN, '$3 $2').replace(/[*_]/g, '');
  const have = new Set(json.split(/[\s/–-]+/).map(norm).filter(Boolean));
  // ₂ subscripts are extracted as separate "2" tokens in the PDF
  have.add('2');
  const referenced = new Set<string>();
  for (const m of texts(p).join(' ').matchAll(LINK_TOKEN)) referenced.add(m[2]);
  Object.values(p.nodes).forEach((n) => n.kind === 'goto' && referenced.add(n.protocolId));

  for (const page of p.pages) {
    const file = join(sourceDir, 'pages', `${String(page).padStart(3, '0')}.json`);
    if (!existsSync(file)) continue;
    const src = JSON.parse(readFileSync(file, 'utf8'));
    for (const link of src.links as { target_page: number | null }[]) {
      const target = link.target_page && pageIndex[String(link.target_page)]?.id;
      if (target && target !== p.id && !referenced.has(target)) {
        warn(where, `PDF p${page} links to ${target} (${catalog[target]?.title ?? '?'}) but the JSON never references it`);
      }
    }
    const missing = new Set<string>();
    let total = 0;
    for (const line of src.lines as { words: { t: string }[] }[]) {
      const text = line.words.map((w) => w.t).join(' ');
      if (/^(Table of Contents|Boulder County Protocol Revision)/.test(text)) continue;
      if (text.startsWith(p.id + ' ')) continue; // page header
      for (const n of text.split(/[\s/–-]+/).map(norm)) {
        if (!n || n === 'o' || STOP.has(n) || LEGEND.has(n)) continue;
        total++;
        if (!have.has(n)) missing.add(n);
      }
    }
    const titleWords = new Set(p.title.split(/\s+/).map(norm));
    const real = [...missing].filter((w) => !titleWords.has(w));
    if (real.length) {
      warn(where, `p${page}: ${real.length}/${total} PDF words not found in JSON: ${real.slice(0, 25).join(', ')}`);
    }
  }
}

function checkProtocol(file: string) {
  const where = `protocols/${file}`;
  const raw = JSON.parse(readFileSync(join(contentDir, 'protocols', file), 'utf8'));
  const parsed = Protocol.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) err(where, `${issue.path.join('.')}: ${issue.message}`);
    return;
  }
  const p = parsed.data;
  if (file !== `${p.id}.json`) err(where, `file name must be ${p.id}.json`);
  if (!catalog[p.id]) err(where, `id ${p.id} not in catalog`);

  const ids = new Set(Object.keys(p.nodes));
  const edges = (n: Node): string[] =>
    n.kind === 'decision' ? n.branches.map((b) => b.next) : n.next ? [n.next] : [];
  for (const [id, n] of Object.entries(p.nodes)) {
    for (const t of edges(n)) if (!ids.has(t)) err(where, `node ${id} -> missing node "${t}"`);
    if (n.kind === 'goto' && !catalog[n.protocolId]) err(where, `node ${id} goto unknown protocol ${n.protocolId}`);
  }
  if (p.entry) {
    const seen = new Set<string>();
    const stack = [p.entry];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id) || !p.nodes[id]) continue;
      seen.add(id);
      stack.push(...edges(p.nodes[id]));
    }
    for (const id of ids) if (!seen.has(id)) err(where, `node ${id} is unreachable from entry`);
  } else if (ids.size) {
    err(where, 'has nodes but no entry');
  }

  for (const t of texts(p)) {
    for (const m of t.matchAll(LINK_TOKEN)) {
      if (!catalog[m[2]]) err(where, `link token ${m[0]} targets unknown id ${m[2]}`);
    }
    if (/\[\[(?![pm]:)/.test(t)) err(where, `malformed link token in: ${t}`);
  }
  if (!p.reviewed) warn(where, 'not yet clinically reviewed');
  if (p.conversionNotes.length) warn(where, `${p.conversionNotes.length} conversion note(s) for the reviewer`);
  if (existsSync(sourceDir)) checkAgainstSource(p, where);
}

console.log('Validating protocols…');
const protocolFiles = readdirSync(join(contentDir, 'protocols')).filter((f) => f.endsWith('.json'));
protocolFiles.sort().forEach(checkProtocol);

const complaintsFile = join(contentDir, 'complaints.json');
if (existsSync(complaintsFile)) {
  console.log('Validating complaints…');
  const list = JSON.parse(readFileSync(complaintsFile, 'utf8'));
  const seen = new Set<string>();
  for (const [i, c] of list.entries()) {
    const parsed = Complaint.safeParse(c);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => err(`complaints[${i}]`, `${issue.path.join('.')}: ${issue.message}`));
      continue;
    }
    if (seen.has(parsed.data.id)) err(`complaints[${i}]`, `duplicate id ${parsed.data.id}`);
    seen.add(parsed.data.id);
    for (const pid of [...parsed.data.adult, ...parsed.data.pediatric]) {
      if (!catalog[pid]) err(`complaints/${parsed.data.id}`, `unknown protocol ${pid}`);
    }
  }
}

console.log(
  `\n${protocolFiles.length} protocols structured of ${Object.keys(catalog).length} in catalog. ` +
    `${errors} error(s), ${warnings} warning(s).`,
);
process.exit(errors ? 1 : 0);
