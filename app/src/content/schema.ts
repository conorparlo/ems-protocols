/**
 * Content schema for structured Boulder County protocols.
 *
 * Inline rich text may contain link tokens:
 *   [[p:4050|hypoglycemia]]   -> link to protocol 4050
 *   [[m:naloxone|naloxone]]   -> link to medication card "naloxone"
 */
/* eslint-disable @typescript-eslint/no-redeclare -- zod schema + inferred type share a name */
import { z } from 'zod';

/** Certification scope, ordered lowest -> highest. "ALL" = no fill (EMR/OEC and up). */
export const LEVELS = ['ALL', 'EMT', 'AEMT', 'EMT-I', 'PARAMEDIC'] as const;
export const Level = z.enum(LEVELS);
export type Level = z.infer<typeof Level>;

export const LEVEL_LABELS: Record<Level, string> = {
  ALL: 'All levels',
  EMT: 'EMT / EMT-IV',
  AEMT: 'AEMT',
  'EMT-I': 'EMT-I',
  PARAMEDIC: 'Paramedic',
};

export const levelRank = (l: Level) => LEVELS.indexOf(l);
/** True if a step at `step` level is within scope for a provider at `provider` level. */
export const inScope = (step: Level, provider: Level) => levelRank(step) <= levelRank(provider);

const Id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'node ids are kebab-case');

/** One line inside a flowchart box. Boxes often mix levels (e.g. white header + yellow bullet). */
export const Item = z.strictObject({
  text: z.string().min(1),
  level: Level.default('ALL'),
  style: z.enum(['text', 'bullet', 'subbullet']).default('text'),
  /** Purple (pediatric) / green (geriatric) rows inside a box. */
  population: z.enum(['pediatric', 'geriatric']).optional(),
});
export type Item = z.infer<typeof Item>;

export const StepNode = z.strictObject({
  kind: z.literal('step'),
  items: z.array(Item).min(1),
  next: Id.optional(),
});

export const DecisionNode = z.strictObject({
  kind: z.literal('decision'),
  /** The question, e.g. "STEMI?" */
  text: z.string().min(1),
  level: Level.default('ALL'),
  /** Optional context shown with the question (e.g. criteria list). */
  items: z.array(Item).default([]),
  branches: z
    .array(z.strictObject({ label: z.string().min(1), next: Id }))
    .min(2),
});

/** Hand-off to another protocol. `next` is set when the flowchart returns to this algorithm afterwards. */
export const GotoNode = z.strictObject({
  kind: z.literal('goto'),
  level: Level.default('ALL'),
  protocolId: z.string().regex(/^\d{4}$/),
  text: z.string().min(1),
  next: Id.optional(),
});

export const Node = z.discriminatedUnion('kind', [StepNode, DecisionNode, GotoNode]);
export type Node = z.infer<typeof Node>;

export const SidebarKind = z.enum(['teaching', 'pediatric', 'geriatric', 'info']);
export type SidebarKind = z.infer<typeof SidebarKind>;

/** Boxes outside the main flow: teaching points, peds/geri boxes, contraindication lists. */
export const Sidebar = z.strictObject({
  kind: SidebarKind,
  title: z.string().optional(),
  items: z.array(Item).min(1),
});
export type Sidebar = z.infer<typeof Sidebar>;

export const Category = z.enum([
  'general',
  'procedure',
  'respiratory',
  'cardiac',
  'medical',
  'environmental',
  'behavioral',
  'obstetric',
  'trauma',
  'appendix',
  'medication',
]);
export type Category = z.infer<typeof Category>;

export const Protocol = z
  .strictObject({
    id: z.string().regex(/^\d{4}$/),
    title: z.string().min(1),
    category: Category,
    /** 1-based pages in the source PDF. */
    pages: z.array(z.number().int().positive()).min(1),
    sourceVersion: z.string(),
    /** Alternate names used by search ("CHF", "SOB", ...). */
    aliases: z.array(z.string()).default([]),
    /** Entry node of the algorithm. Omitted for text-only guideline protocols. */
    entry: Id.optional(),
    nodes: z.record(Id, Node).default({}),
    sidebars: z.array(Sidebar).default([]),
    /** Interpretation choices made during conversion that the reviewer must check against the PDF. */
    conversionNotes: z.array(z.string()).default([]),
    reviewed: z
      .strictObject({ by: z.string(), date: z.string() })
      .nullable()
      .default(null),
  })
  .refine((p) => !p.entry || p.entry in p.nodes, { message: 'entry must reference a node' });
export type Protocol = z.infer<typeof Protocol>;

/** Per-level authorization from the 0990 Quick Reference matrix. */
export const Authorization = z.enum(['S', 'P', 'W']); // standing order / physician order / waivered
export const MedicationDose = z.strictObject({
  indication: z.string(),
  population: z.enum(['adult', 'pediatric', 'all']),
  route: z.string(),
  dose: z.string(),
  notes: z.array(z.string()).default([]),
});

export const Medication = z.strictObject({
  id: Id,
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  pages: z.array(z.number().int().positive()).min(1),
  sourceVersion: z.string(),
  /** Keyed by level; absent = not authorized at that level. */
  scope: z.partialRecord(Level, Authorization).default({}),
  scopeNotes: z.array(z.string()).default([]),
  doses: z.array(MedicationDose).default([]),
  notes: z.array(z.string()).default([]),
  reviewed: z
    .strictObject({ by: z.string(), date: z.string() })
    .nullable()
    .default(null),
});
export type Medication = z.infer<typeof Medication>;

export const Complaint = z.strictObject({
  id: Id,
  label: z.string(),
  group: z.string(),
  keywords: z.array(z.string()).default([]),
  adult: z.array(z.string().regex(/^\d{4}$/)).default([]),
  pediatric: z.array(z.string().regex(/^\d{4}$/)).default([]),
});
export type Complaint = z.infer<typeof Complaint>;

/** Matches [[p:4050|label]] and [[m:naloxone|label]] tokens. */
export const LINK_TOKEN = /\[\[(p|m):([a-z0-9-]+)\|([^\]]+)\]\]/g;
