import { StyleSheet, Text, View } from 'react-native';

import { RichText } from '@/components/rich-text';
import { inScope, type Item, type Level } from '@/content/schema';
import { useSettings } from '@/settings';
import { GERI_COLOR, LEVEL_COLORS, LEVEL_SHORT, PEDS_COLOR, useAppTheme } from '@/theme';

export function LevelBadge({ level, dim }: { level: Level; dim?: boolean }) {
  const { fs } = useAppTheme();
  if (level === 'ALL') return null;
  return (
    <View style={[styles.badge, { backgroundColor: LEVEL_COLORS[level], opacity: dim ? 0.85 : 1 }]}>
      <Text style={[styles.badgeText, { fontSize: fs(11) }]}>{LEVEL_SHORT[level]}</Text>
    </View>
  );
}

function PopulationBadge({ population }: { population: 'pediatric' | 'geriatric' }) {
  const { fs } = useAppTheme();
  return (
    <View style={[styles.badge, { backgroundColor: population === 'pediatric' ? PEDS_COLOR : GERI_COLOR }]}>
      <Text style={[styles.badgeText, { fontSize: fs(11) }]}>{population === 'pediatric' ? 'PEDS' : 'GERI'}</Text>
    </View>
  );
}

/**
 * Lines of a flowchart box. Each line carries its own scope level: in-scope lines render at full
 * strength with a colored edge; lines above the provider's level are dimmed and badged.
 */
export function ItemList({ items, size = 17 }: { items: Item[]; size?: number }) {
  const { c, fs } = useAppTheme();
  const { level: provider } = useSettings();

  return (
    <View style={{ gap: 6 }}>
      {items.map((item, i) => {
        const ok = inScope(item.level, provider);
        const edge =
          item.level !== 'ALL'
            ? LEVEL_COLORS[item.level]
            : item.population === 'pediatric'
              ? PEDS_COLOR
              : item.population === 'geriatric'
                ? GERI_COLOR
                : 'transparent';
        const indent = item.style === 'subbullet' ? 30 : item.style === 'bullet' ? 14 : 0;
        return (
          <View
            key={i}
            accessibilityLabel={ok ? undefined : `Above your scope: ${LEVEL_SHORT[item.level]}`}
            style={[styles.row, { borderLeftColor: edge, opacity: ok ? 1 : 0.42 }]}>
            <View style={{ flexDirection: 'row', paddingLeft: indent, flex: 1 }}>
              {item.style !== 'text' && (
                <Text style={{ color: c.text, fontSize: fs(size), lineHeight: fs(size) * 1.35, width: 16 }}>
                  {item.style === 'bullet' ? '•' : '◦'}
                </Text>
              )}
              <RichText
                text={item.text}
                style={{ color: c.text, fontSize: fs(size), lineHeight: fs(size) * 1.35, flex: 1 }}
              />
            </View>
            {(item.level !== 'ALL' || item.population) && (
              <View style={styles.badges}>
                <LevelBadge level={item.level} dim={!ok} />
                {item.population && <PopulationBadge population={item.population} />}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 5,
    paddingLeft: 10,
    gap: 8,
  },
  badges: { gap: 4, alignItems: 'flex-end', paddingTop: 2 },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#111', fontWeight: '800', letterSpacing: 0.3 },
});
