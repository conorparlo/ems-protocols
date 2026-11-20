import type { Node, Protocol } from './schema';

export type WalkEntry = {
  id: string;
  node: Node;
  /** Index of the branch the user picked, for decisions already answered. */
  chosen?: number;
};

export type WalkResult = {
  entries: WalkEntry[];
  /** The decision awaiting an answer, if any. */
  pending: WalkEntry | null;
  /** True when the algorithm reached a node with no next step. */
  ended: boolean;
};

/**
 * Expand a protocol into the visible sequence of nodes given the user's branch choices.
 * Steps chain automatically until a decision; each decision consumes one choice.
 * Loops (e.g. repeated rhythm checks) are allowed because every cycle passes through a decision.
 */
export function walk(protocol: Protocol, choices: number[]): WalkResult {
  const entries: WalkEntry[] = [];
  if (!protocol.entry) return { entries, pending: null, ended: true };

  let cur: string | undefined = protocol.entry;
  let ci = 0;
  let sinceDecision = new Set<string>();

  while (cur) {
    const node: Node | undefined = protocol.nodes[cur];
    if (!node) break;
    if (sinceDecision.has(cur)) break; // guard against a step-only cycle in bad data
    sinceDecision.add(cur);

    if (node.kind === 'decision') {
      if (ci < choices.length && node.branches[choices[ci]]) {
        entries.push({ id: cur, node, chosen: choices[ci] });
        cur = node.branches[choices[ci]].next;
        ci++;
        sinceDecision = new Set();
        continue;
      }
      const pending = { id: cur, node };
      entries.push(pending);
      return { entries, pending, ended: false };
    }

    entries.push({ id: cur, node });
    cur = node.next;
  }
  return { entries, pending: null, ended: true };
}
