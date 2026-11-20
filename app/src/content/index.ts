import Fuse from 'fuse.js';

import catalogJson from '../../content/catalog.json';
import complaintsJson from '../../content/complaints.json';
import { PAGE_IMAGES, PROTOCOL_DATA } from './generated';
import { Complaint, Protocol } from './schema';

export type CatalogEntry = {
  id: string;
  title: string;
  pages: number[];
  category: string;
};

export const SOURCE_VERSION = 'April 22, 2026';

export const catalog = catalogJson as Record<string, CatalogEntry>;
export const complaints: Complaint[] = (complaintsJson as unknown[]).map((c) => Complaint.parse(c));

/** Structured protocols, validated at load. A bad file is logged and falls back to PDF view. */
export const protocols: Record<string, Protocol> = {};
for (const [id, raw] of Object.entries(PROTOCOL_DATA)) {
  const parsed = Protocol.safeParse(raw);
  if (parsed.success) protocols[id] = parsed.data;
  else console.warn(`Protocol ${id} failed validation`, parsed.error.issues);
}

export const pageImage = (page: number): number | undefined => PAGE_IMAGES[page];

export const isMedication = (id: string) => catalog[id]?.category === 'medication';

export const CATEGORY_LABELS: Record<string, string> = {
  general: 'General Guidelines',
  procedure: 'Procedures',
  respiratory: 'Respiratory',
  cardiac: 'Cardiac',
  medical: 'General Medical',
  environmental: 'Environmental',
  behavioral: 'Behavioral',
  obstetric: 'Obstetric',
  trauma: 'Trauma',
  medication: 'Medications',
};

export type SearchResult =
  | { type: 'complaint'; id: string; label: string; sub: string }
  | { type: 'protocol'; id: string; label: string; sub: string };

const searchDocs: (SearchResult & { keywords: string[] })[] = [
  ...complaints.map((c) => ({
    type: 'complaint' as const,
    id: c.id,
    label: c.label,
    sub: c.group,
    keywords: c.keywords,
  })),
  ...Object.values(catalog).map((e) => ({
    type: 'protocol' as const,
    id: e.id,
    label: e.title,
    sub: `${e.id} · ${CATEGORY_LABELS[e.category] ?? e.category}`,
    keywords: protocols[e.id]?.aliases ?? [],
  })),
];

const fuse = new Fuse(searchDocs, {
  keys: [
    { name: 'label', weight: 3 },
    { name: 'keywords', weight: 2 },
    { name: 'id', weight: 2 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
});

export function search(query: string): SearchResult[] {
  const q = query.trim();
  if (!q) return [];
  // Exact protocol number jumps straight to it.
  if (/^\d{4}$/.test(q) && catalog[q]) {
    const e = catalog[q];
    return [{ type: 'protocol', id: e.id, label: e.title, sub: `${e.id} · ${CATEGORY_LABELS[e.category]}` }];
  }
  return fuse.search(q, { limit: 25 }).map(({ item: { keywords: _k, ...rest } }) => rest);
}
