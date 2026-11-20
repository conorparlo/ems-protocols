import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { HeaderToolbar, ProtocolRow, Segmented } from '@/components/ui';
import { complaints } from '@/content';
import { useAppTheme } from '@/theme';

export default function ComplaintScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c, fs } = useAppTheme();
  const complaint = complaints.find((x) => x.id === id);
  const [pop, setPop] = useState<'adult' | 'pediatric'>('adult');

  if (!complaint) {
    return <Text style={{ color: c.text, padding: 16 }}>Unknown complaint.</Text>;
  }
  const hasPeds = complaint.pediatric.length > 0;
  const list = pop === 'pediatric' && hasPeds ? complaint.pediatric : complaint.adult;

  return (
    <>
      <Stack.Screen options={{ title: complaint.label }} />
      <HeaderToolbar />
      <ScrollView
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        contentInsetAdjustmentBehavior="automatic">
        {hasPeds && (
          <View style={{ marginBottom: 14 }}>
            <Segmented
              value={pop}
              onChange={setPop}
              options={[
                { value: 'adult', label: 'Adult (≥12)' },
                { value: 'pediatric', label: 'Pediatric (<12)' },
              ]}
            />
          </View>
        )}
        <Text style={{ color: c.textDim, fontSize: fs(13), marginBottom: 10 }}>
          Start with the first protocol; the others are commonly related.
        </Text>
        {list.map((pid) => (
          <ProtocolRow key={pid} id={pid} />
        ))}
      </ScrollView>
    </>
  );
}
