import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { HeaderToolbar, ProtocolRow, SectionTitle } from '@/components/ui';
import { catalog, complaints, search } from '@/content';
import { useSettings } from '@/settings';
import { useAppTheme } from '@/theme';

export default function Home() {
  const { c, fs } = useAppTheme();
  const { recents, favorites } = useSettings();
  const [query, setQuery] = useState('');
  const results = useMemo(() => search(query), [query]);

  const groups = useMemo(() => {
    const m = new Map<string, typeof complaints>();
    complaints.forEach((x) => m.set(x.group, [...(m.get(x.group) ?? []), x]));
    return [...m.entries()];
  }, []);

  return (
    <>
      <HeaderToolbar />
      <ScrollView
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search complaint, protocol, med, or #"
          placeholderTextColor={c.textDim}
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel="Search protocols"
          style={[styles.search, { backgroundColor: c.card, borderColor: c.border, color: c.text, fontSize: fs(17) }]}
        />

        {query.trim() ? (
          <View style={{ marginTop: 12 }}>
            {results.length === 0 && (
              <Text style={{ color: c.textDim, fontSize: fs(15) }}>No matches.</Text>
            )}
            {results.map((r) =>
              r.type === 'protocol' ? (
                <ProtocolRow key={`p${r.id}`} id={r.id} />
              ) : (
                <Pressable
                  key={`c${r.id}`}
                  onPress={() => router.push({ pathname: '/complaint/[id]', params: { id: r.id } })}
                  style={[styles.result, { backgroundColor: c.cardAlt, borderColor: c.accent }]}>
                  <Text style={{ color: c.text, fontSize: fs(17), fontWeight: '700' }}>{r.label}</Text>
                  <Text style={{ color: c.textDim, fontSize: fs(12) }}>Chief complaint · {r.sub}</Text>
                </Pressable>
              ),
            )}
          </View>
        ) : (
          <>
            {favorites.length > 0 && (
              <>
                <SectionTitle>Favorites</SectionTitle>
                {favorites.filter((id) => catalog[id]).map((id) => <ProtocolRow key={id} id={id} />)}
              </>
            )}
            {recents.length > 0 && (
              <>
                <SectionTitle>Recent</SectionTitle>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {recents.filter((id) => catalog[id]).map((id) => (
                    <Pressable
                      key={id}
                      onPress={() => router.push({ pathname: '/protocol/[id]', params: { id } })}
                      style={[styles.chip, { backgroundColor: c.card, borderColor: c.border }]}>
                      <Text style={{ color: c.text, fontSize: fs(14), fontWeight: '600' }} numberOfLines={1}>
                        {id} {catalog[id].title}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            {groups.map(([group, items]) => (
              <View key={group}>
                <SectionTitle>{group}</SectionTitle>
                <View style={styles.grid}>
                  {items.map((x) => (
                    <Pressable
                      key={x.id}
                      accessibilityRole="button"
                      onPress={() => router.push({ pathname: '/complaint/[id]', params: { id: x.id } })}
                      style={({ pressed }) => [
                        styles.tile,
                        { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.7 : 1 },
                      ]}>
                      <Text style={{ color: c.text, fontSize: fs(16), fontWeight: '700' }}>{x.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/browse')}
              style={[styles.browse, { borderColor: c.accent }]}>
                <Text style={{ color: c.accent, fontSize: fs(17), fontWeight: '700' }}>
                  Browse all protocols & medications
                </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  search: { minHeight: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  result: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8, gap: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 18, borderWidth: 1, maxWidth: 260 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    justifyContent: 'center',
  },
  browse: { marginTop: 24, minHeight: 52, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
