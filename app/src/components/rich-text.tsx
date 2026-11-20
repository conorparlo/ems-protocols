import { router } from 'expo-router';
import { Text, type TextStyle } from 'react-native';

import { catalog } from '@/content';
import { LINK_TOKEN } from '@/content/schema';
import { useAppTheme } from '@/theme';

type Segment =
  | { kind: 'text'; text: string; bold?: boolean; italic?: boolean }
  | { kind: 'link'; text: string; target: string; med: boolean };

/** Parse `[[p:4050|label]]`, `[[m:9120|label]]`, `**bold**`, `*italic*`. */
export function parseRich(input: string): Segment[] {
  const out: Segment[] = [];
  const pushFormatted = (s: string) => {
    for (const part of s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)) {
      if (!part) continue;
      if (part.startsWith('**')) out.push({ kind: 'text', text: part.slice(2, -2), bold: true });
      else if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
        out.push({ kind: 'text', text: part.slice(1, -1), italic: true });
      else out.push({ kind: 'text', text: part });
    }
  };
  let last = 0;
  for (const m of input.matchAll(LINK_TOKEN)) {
    pushFormatted(input.slice(last, m.index));
    out.push({ kind: 'link', text: m[3].replace(/\*/g, ''), target: m[2], med: m[1] === 'm' });
    last = m.index! + m[0].length;
  }
  pushFormatted(input.slice(last));
  return out;
}

/** Strip markup for plain display (titles, accessibility labels). */
export const plain = (s: string) => parseRich(s).map((seg) => seg.text).join('');

export function RichText({ text, style }: { text: string; style?: TextStyle | TextStyle[] }) {
  const { c } = useAppTheme();
  return (
    <Text style={style}>
      {parseRich(text).map((seg, i) =>
        seg.kind === 'link' ? (
          <Text
            key={i}
            accessibilityRole="link"
            accessibilityHint={`Opens ${catalog[seg.target]?.title ?? seg.target}`}
            onPress={() => router.push({ pathname: '/protocol/[id]', params: { id: seg.target } })}
            style={{ color: c.accent, textDecorationLine: 'underline', fontWeight: '600' }}>
            {seg.text}
          </Text>
        ) : (
          <Text
            key={i}
            style={{
              fontWeight: seg.bold ? '700' : undefined,
              fontStyle: seg.italic ? 'italic' : undefined,
            }}>
            {seg.text}
          </Text>
        ),
      )}
    </Text>
  );
}
