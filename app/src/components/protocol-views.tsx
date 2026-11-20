import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { allHidden, ItemList, LevelBadge, useScope } from '@/components/items';
import { plain, RichText } from '@/components/rich-text';
import { catalog, pageImage } from '@/content';
import { inScope, type Node, type Protocol, type Sidebar } from '@/content/schema';
import { walk } from '@/content/walker';
import { useSettings } from '@/settings';
import { useAppTheme } from '@/theme';

/* ---------------------------------------------------------------- node card */

function NodeCard({
  node,
  chosen,
  onChoose,
}: {
  node: Node;
  chosen?: number;
  onChoose?: (branch: number) => void;
}) {
  const { c, fs } = useAppTheme();
  const { level: provider } = useSettings();

  if (node.kind === 'step') {
    return (
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <ItemList items={node.items} />
      </View>
    );
  }

  if (node.kind === 'goto') {
    const target = catalog[node.protocolId];
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/protocol/[id]', params: { id: node.protocolId } })}
        style={({ pressed }) => [
          styles.card,
          styles.goto,
          { backgroundColor: c.cardAlt, borderColor: c.accent, opacity: pressed ? 0.7 : 1 },
        ]}>
        <Text style={{ color: c.textDim, fontSize: fs(13), fontWeight: '700' }}>GO TO PROTOCOL</Text>
        <Text style={{ color: c.accent, fontSize: fs(19), fontWeight: '700' }}>
          {node.protocolId} {target?.title ?? plain(node.text)} ›
        </Text>
        {node.next && (
          <Text style={{ color: c.textDim, fontSize: fs(13) }}>Then continue below</Text>
        )}
      </Pressable>
    );
  }

  // decision
  const dim = !inScope(node.level, provider);
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.card, borderColor: c.accent, borderWidth: 2, opacity: dim ? 0.6 : 1 },
      ]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <RichText
          text={node.text}
          style={{ color: c.text, fontSize: fs(20), fontWeight: '800', flex: 1 }}
        />
        <LevelBadge level={node.level} dim={dim} />
      </View>
      {node.items.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <ItemList items={node.items} size={15} />
        </View>
      )}
      <View style={{ marginTop: 12, gap: 8 }}>
        {node.branches.map((b, i) => {
          const isChosen = chosen === i;
          const decided = chosen !== undefined;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityState={{ selected: isChosen, disabled: decided && !onChoose }}
              disabled={!onChoose}
              onPress={() => onChoose?.(i)}
              style={({ pressed }) => [
                styles.branch,
                {
                  backgroundColor: isChosen ? c.accent : c.cardAlt,
                  borderColor: isChosen ? c.accent : c.border,
                  opacity: decided && !isChosen ? 0.45 : pressed ? 0.7 : 1,
                },
              ]}>
              <Text
                style={{
                  color: isChosen ? c.accentText : c.text,
                  fontSize: fs(18),
                  fontWeight: '700',
                  textAlign: 'center',
                }}>
                {b.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const Arrow = () => {
  const { c } = useAppTheme();
  return <Text style={{ color: c.textDim, textAlign: 'center', fontSize: 18, marginVertical: 2 }}>↓</Text>;
};

/* ------------------------------------------------------------- step-through */

export function StepThrough({ protocol }: { protocol: Protocol }) {
  const { c, fs } = useAppTheme();
  const [choices, setChoices] = useState<number[]>([]);
  const { entries, pending, ended } = walk(protocol, choices);
  const { shows } = useScope();
  const hidden = (n: Node) => n.kind === 'step' && allHidden(n.items, shows);
  const firstShown = entries.findIndex((e) => !hidden(e.node));

  return (
    <View>
      {entries.map((e, i) =>
        hidden(e.node) ? null : (
          <View key={`${i}-${e.id}`}>
            {i > firstShown && <Arrow />}
            <NodeCard
              node={e.node}
              chosen={e.chosen}
              onChoose={
                e === pending
                  ? (b) => setChoices([...choices, b])
                  : e.chosen !== undefined
                    ? (b) => {
                        // Re-answer an earlier decision: keep choices before it, replace this one.
                        const idx = entries.slice(0, i).filter((x) => x.chosen !== undefined).length;
                        setChoices([...choices.slice(0, idx), b]);
                      }
                    : undefined
              }
            />
          </View>
        ),
      )}
      {ended && (
        <Text style={{ color: c.textDim, textAlign: 'center', marginTop: 14, fontSize: fs(14) }}>
          — End of algorithm —
        </Text>
      )}
      {choices.length > 0 && (
        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setChoices(choices.slice(0, -1))}
            style={[styles.control, { borderColor: c.border, backgroundColor: c.card }]}>
            <Text style={{ color: c.text, fontSize: fs(16), fontWeight: '700' }}>↶ Undo</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setChoices([])}
            style={[styles.control, { borderColor: c.border, backgroundColor: c.card }]}>
            <Text style={{ color: c.text, fontSize: fs(16), fontWeight: '700' }}>⟲ Restart</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/* ---------------------------------------------------------------- full view */

export function FullView({ protocol }: { protocol: Protocol }) {
  const { c, fs } = useAppTheme();
  const { shows } = useScope();
  const hidden = (n: Node) => n.kind === 'step' && allHidden(n.items, shows);
  const label = (id: string): string => {
    const n = protocol.nodes[id];
    if (!n) return id;
    // Point past hidden steps to the next card that is actually shown.
    if (hidden(n)) return n.kind === 'step' && n.next ? label(n.next) : 'End';
    const t = n.kind === 'step' ? (n.items.find((i) => shows(i.level)) ?? n.items[0]).text : n.text;
    return plain(t).slice(0, 48);
  };
  return (
    <View style={{ gap: 10 }}>
      {Object.entries(protocol.nodes).map(([id, node]) =>
        hidden(node) ? null : (
          <View key={id}>
            <NodeCard node={node} />
            {node.kind !== 'decision' && node.next && (
              <Text style={{ color: c.textDim, fontSize: fs(12), marginTop: 4, marginLeft: 6 }}>
                → {label(node.next)}
              </Text>
            )}
            {node.kind === 'decision' && (
              <View style={{ marginTop: 4, marginLeft: 6 }}>
                {node.branches.map((b, i) => (
                  <Text key={i} style={{ color: c.textDim, fontSize: fs(12) }}>
                    {b.label} → {label(b.next)}
                  </Text>
                ))}
              </View>
            )}
          </View>
        ),
      )}
    </View>
  );
}

/* ----------------------------------------------------------------- sidebars */

export function Sidebars({ sidebars: all }: { sidebars: Sidebar[] }) {
  const { c, fs } = useAppTheme();
  const { shows } = useScope();
  const sidebars = all.filter((s) => !allHidden(s.items, shows));
  if (!sidebars.length) return null;
  const bg = (k: Sidebar['kind']) =>
    k === 'pediatric' ? c.pedsBg : k === 'geriatric' ? c.geriBg : k === 'teaching' ? c.teachingBg : c.cardAlt;
  return (
    <View style={{ gap: 10 }}>
      {sidebars.map((s, i) => (
        <View key={i} style={[styles.card, { backgroundColor: bg(s.kind), borderColor: c.border }]}>
          {s.title && (
            <Text style={{ color: c.text, fontSize: fs(16), fontWeight: '800', marginBottom: 8 }}>
              {s.title}
            </Text>
          )}
          <ItemList items={s.items} size={15} />
        </View>
      ))}
    </View>
  );
}

/* ---------------------------------------------------------------- PDF pages */

export function PdfPages({ pages }: { pages: number[] }) {
  const { width } = useWindowDimensions();
  const { c, fs } = useAppTheme();
  const [zoomPage, setZoomPage] = useState<number | null>(null);
  const w = Math.min(width - 24, 900);

  return (
    <View style={{ gap: 12, alignItems: 'center' }}>
      {pages.map((p) => {
        const src = pageImage(p);
        return (
          <Pressable key={p} onPress={() => setZoomPage(p)} accessibilityHint="Opens zoomable page">
            {src ? (
              <Image source={src} style={{ width: w, height: w * (11 / 8.5), backgroundColor: '#fff' }} contentFit="contain" />
            ) : (
              <Text style={{ color: c.danger }}>Page {p} image missing</Text>
            )}
            <Text style={{ color: c.textDim, fontSize: fs(12), textAlign: 'center', marginTop: 4 }}>
              PDF page {p} · tap to zoom
            </Text>
          </Pressable>
        );
      })}
      <Modal visible={zoomPage !== null} animationType="fade" onRequestClose={() => setZoomPage(null)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <ScrollView
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            {zoomPage !== null && pageImage(zoomPage) && (
              <Image
                source={pageImage(zoomPage)}
                style={{ width, height: width * (11 / 8.5) }}
                contentFit="contain"
              />
            )}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            onPress={() => setZoomPage(null)}
            style={[styles.closeZoom, { backgroundColor: c.card }]}>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 14 },
  goto: { gap: 4, borderWidth: 2 },
  branch: { minHeight: 52, borderRadius: 10, borderWidth: 1, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  controls: { flexDirection: 'row', gap: 10, marginTop: 18 },
  control: { flex: 1, minHeight: 50, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  closeZoom: { position: 'absolute', top: 60, right: 16, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
});
