import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { catalog, CATEGORY_LABELS, protocols } from '@/content';
import { LEVEL_LABELS } from '@/content/schema';
import { useSettings } from '@/settings';
import { LEVEL_COLORS, useAppTheme } from '@/theme';

/** Yellow/blue/... pill showing the provider's level; opens settings. */
function LevelPill() {
  const { level } = useSettings();
  const { c } = useAppTheme();
  const fg = level === 'ALL' ? c.text : '#111';
  return (
    <Pressable
      onPress={() => router.push('/settings')}
      accessibilityRole="button"
      accessibilityLabel={`Certification level ${LEVEL_LABELS[level]}. Open settings`}
      hitSlop={6}
      style={({ pressed }) => [
        styles.levelPill,
        { backgroundColor: level === 'ALL' ? c.cardAlt : LEVEL_COLORS[level], opacity: pressed ? 0.7 : 1 },
      ]}>
      <Text style={{ color: fg, fontWeight: '800', fontSize: 14 }}>{level === 'ALL' ? 'EMR' : level}</Text>
      <SymbolView name="gearshape.fill" size={13} tintColor={fg} />
    </Pressable>
  );
}

/**
 * Right side of the native header: optional native buttons (passed as `Stack.Toolbar.Button`
 * children), then the level pill. The pill opts out of the iOS 26 shared glass capsule so it
 * stands on its own instead of being squeezed into the capsule with the other buttons.
 */
export function HeaderToolbar({ children }: { children?: ReactNode }) {
  return (
    <Stack.Toolbar placement="right">
      {children}
      <Stack.Toolbar.View hidesSharedBackground>
        <LevelPill />
      </Stack.Toolbar.View>
    </Stack.Toolbar>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const { c, fs } = useAppTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{ color: c.textDim, fontSize: fs(13), fontWeight: '800', letterSpacing: 0.8, marginTop: 18, marginBottom: 8 }}>
      {String(children).toUpperCase()}
    </Text>
  );
}

/** Row linking to a protocol, showing whether a structured drill-down exists. */
export function ProtocolRow({ id, onPress }: { id: string; onPress?: () => void }) {
  const { c, fs } = useAppTheme();
  const e = catalog[id];
  if (!e) return null;
  const structured = !!protocols[id];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress ?? (() => router.push({ pathname: '/protocol/[id]', params: { id } }))}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Text style={{ color: c.textDim, fontSize: fs(14), fontWeight: '700', width: 46 }}>{id}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: fs(17), fontWeight: '600' }}>{e.title}</Text>
        <Text style={{ color: c.textDim, fontSize: fs(12), marginTop: 2 }}>
          {CATEGORY_LABELS[e.category]} · {structured ? 'Step-through' : `PDF p.${e.pages.join(', ')}`}
        </Text>
      </View>
      <Text style={{ color: c.textDim, fontSize: 22 }}>›</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { c, fs } = useAppTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.segmented, { backgroundColor: c.cardAlt, borderColor: c.border }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && { backgroundColor: c.accent }]}>
            <Text style={{ color: active ? c.accentText : c.text, fontWeight: '700', fontSize: fs(15) }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: 13,
    borderRadius: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  segmented: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 3 },
  segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
});
