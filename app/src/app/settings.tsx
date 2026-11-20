import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SectionTitle, Segmented } from '@/components/ui';
import { protocols, catalog, SOURCE_VERSION } from '@/content';
import { LEVEL_LABELS, LEVELS } from '@/content/schema';
import { useSettings, type TextScale, type ThemePref } from '@/settings';
import { LEVEL_COLORS, useAppTheme } from '@/theme';

export default function SettingsScreen() {
  const { c, fs } = useAppTheme();
  const s = useSettings();
  const structured = Object.keys(protocols).length;
  const reviewed = Object.values(protocols).filter((p) => p.reviewed).length;

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <SectionTitle>My certification level</SectionTitle>
      <Text style={{ color: c.textDim, fontSize: fs(13), marginBottom: 10 }}>
        Steps within your scope are shown at full strength. Steps above it are dimmed and labeled.
      </Text>
      <View style={{ gap: 8 }}>
        {LEVELS.map((l) => {
          const active = s.level === l;
          return (
            <Pressable
              key={l}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => s.update({ level: l })}
              style={[
                styles.option,
                {
                  backgroundColor: c.card,
                  borderColor: active ? c.accent : c.border,
                  borderWidth: active ? 2 : 1,
                },
              ]}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: l === 'ALL' ? c.card : LEVEL_COLORS[l], borderColor: c.border },
                ]}
              />
              <Text style={{ color: c.text, fontSize: fs(17), fontWeight: active ? '800' : '500', flex: 1 }}>
                {l === 'ALL' ? 'EMR / OEC' : LEVEL_LABELS[l]}
              </Text>
              {active && <Text style={{ color: c.accent, fontSize: 18 }}>✓</Text>}
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>Appearance</SectionTitle>
      <Segmented<ThemePref>
        value={s.theme}
        onChange={(theme) => s.update({ theme })}
        options={[
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
          { value: 'system', label: 'System' },
        ]}
      />
      <View style={{ height: 10 }} />
      <Segmented<'1' | '1.15' | '1.3'>
        value={String(s.textScale) as '1' | '1.15' | '1.3'}
        onChange={(v) => s.update({ textScale: Number(v) as TextScale })}
        options={[
          { value: '1', label: 'Text A' },
          { value: '1.15', label: 'Text A+' },
          { value: '1.3', label: 'Text A++' },
        ]}
      />

      <SectionTitle>About</SectionTitle>
      <View style={[styles.about, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={{ color: c.text, fontSize: fs(15), lineHeight: fs(21) }}>
          Boulder County EMS Protocols, released {SOURCE_VERSION}.{'\n'}
          {structured} of {Object.keys(catalog).length} protocols have a step-through ({reviewed} clinically
          reviewed). All others show the original PDF pages.
        </Text>
        <Text style={{ color: c.warnText, backgroundColor: c.warnBg, padding: 10, borderRadius: 8, marginTop: 12, fontSize: fs(14), lineHeight: fs(20) }}>
          Quick-reference only. The official Boulder County protocols and on-line medical direction take
          precedence. Verify against the PDF pages when in doubt.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 14, borderRadius: 12 },
  swatch: { width: 22, height: 22, borderRadius: 5, borderWidth: 1 },
  about: { padding: 14, borderRadius: 12, borderWidth: 1 },
});
