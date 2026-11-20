import { SectionList, Text } from 'react-native';

import { ProtocolRow } from '@/components/ui';
import { catalog, CATEGORY_LABELS } from '@/content';
import { useAppTheme } from '@/theme';

const sections = Object.entries(CATEGORY_LABELS)
  .map(([cat, title]) => ({
    title,
    data: Object.values(catalog)
      .filter((e) => e.category === cat)
      .map((e) => e.id),
  }))
  .filter((s) => s.data.length);

export default function Browse() {
  const { c, fs } = useAppTheme();
  return (
    <SectionList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      sections={sections}
      keyExtractor={(id) => id}
      stickySectionHeadersEnabled
      renderSectionHeader={({ section }) => (
        <Text
          accessibilityRole="header"
          style={{
            color: c.textDim,
            backgroundColor: c.bg,
            fontSize: fs(13),
            fontWeight: '800',
            letterSpacing: 0.8,
            paddingTop: 14,
            paddingBottom: 8,
          }}>
          {section.title.toUpperCase()}
        </Text>
      )}
      renderItem={({ item }) => <ProtocolRow id={item} />}
    />
  );
}
