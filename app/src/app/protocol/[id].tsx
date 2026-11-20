import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { allHidden, countAboveScope, useScope } from '@/components/items';
import { FullView, PdfPages, Sidebars, StepThrough } from '@/components/protocol-views';
import { HeaderToolbar, Segmented } from '@/components/ui';
import { catalog, protocols } from '@/content';
import { useSettings } from '@/settings';
import { useAppTheme } from '@/theme';

type Tab = 'steps' | 'full' | 'pdf';

export default function ProtocolScreen() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, fs } = useAppTheme();
  const { addRecent, favorites, toggleFavorite, update } = useSettings();
  const { provider, hide, shows } = useScope();
  const entry = catalog[id];
  const protocol = protocols[id];
  const [tab, setTab] = useState<Tab>(protocol?.entry ? 'steps' : protocol ? 'full' : 'pdf');

  useEffect(() => {
    if (entry) addRecent(id);
  }, [id, entry, addRecent]);

  if (!entry) return <Text style={{ color: c.text, padding: 16 }}>Unknown protocol {id}.</Text>;
  const fav = favorites.includes(id);
  const aboveCount = protocol ? countAboveScope(protocol, provider) : 0;
  const levelName = provider === 'ALL' ? 'EMR' : provider;
  const hasSidebars = !!protocol?.sidebars.some((s) => !allHidden(s.items, shows));

  const tabs: { value: Tab; label: string }[] = protocol
    ? [
        ...(protocol.entry ? [{ value: 'steps' as const, label: 'Step-through' }] : []),
        { value: 'full', label: 'Full' },
        { value: 'pdf', label: 'PDF' },
      ]
    : [];

  return (
    <>
      <Stack.Screen options={{ title: id }} />
      <HeaderToolbar>
        <Stack.Toolbar.Button
          icon={fav ? 'star.fill' : 'star'}
          tintColor={fav ? '#F5B700' : undefined}
          accessibilityLabel={fav ? 'Remove from favorites' : 'Add to favorites'}
          onPress={() => toggleFavorite(id)}
        />
      </HeaderToolbar>
      <ScrollView
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic">
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: fs(24), fontWeight: '800' }}>
          {entry.title}
        </Text>
        <Text style={{ color: c.textDim, fontSize: fs(13), marginTop: 2 }}>
          {id} · PDF p.{entry.pages.join(', ')}
        </Text>

        {protocol && !protocol.reviewed && (
          <View style={[styles.banner, { backgroundColor: c.warnBg }]}>
            <Text style={{ color: c.warnText, fontSize: fs(13), fontWeight: '700' }}>
              Not yet reviewed against the PDF. Verify with the PDF tab.
            </Text>
          </View>
        )}
        {!protocol && (
          <View style={[styles.banner, { backgroundColor: c.cardAlt }]}>
            <Text style={{ color: c.textDim, fontSize: fs(13) }}>
              Step-through not available yet. Showing the original protocol pages.
            </Text>
          </View>
        )}

        {tabs.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <Segmented value={tab} onChange={setTab} options={tabs} />
          </View>
        )}

        {aboveCount > 0 && tab !== 'pdf' && (
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: !hide }}
            accessibilityLabel={`Show steps above ${levelName}`}
            hitSlop={8}
            onPress={() => update({ aboveScope: hide ? 'dim' : 'hide' })}
            style={({ pressed }) => [styles.scopeToggle, { borderColor: c.border, opacity: pressed ? 0.6 : 1 }]}>
            <Text style={{ color: c.textDim, fontSize: fs(13), flex: 1 }}>
              {hide
                ? `${aboveCount} line${aboveCount === 1 ? '' : 's'} above ${levelName} hidden`
                : `Lines above ${levelName} greyed out`}
            </Text>
            <Text style={{ color: c.accent, fontSize: fs(13), fontWeight: '700' }}>{hide ? 'Show' : 'Hide'}</Text>
          </Pressable>
        )}

        <View style={{ marginTop: 14 }}>
          {protocol && tab === 'steps' && <StepThrough key={id} protocol={protocol} />}
          {protocol && tab === 'full' && <FullView protocol={protocol} />}
          {tab === 'pdf' && <PdfPages pages={entry.pages} />}
        </View>

        {protocol && tab !== 'pdf' && hasSidebars && (
          <View style={{ marginTop: 24 }}>
            <Text style={{ color: c.textDim, fontSize: fs(13), fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>
              NOTES & TEACHING POINTS
            </Text>
            <Sidebars sidebars={protocol.sidebars} />
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 64 },
  banner: { marginTop: 12, padding: 10, borderRadius: 10 },
  scopeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
});
