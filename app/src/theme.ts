import { useColorScheme } from 'react-native';

import type { Level } from '@/content/schema';
import { useSettings } from '@/settings';

const palettes = {
  light: {
    bg: '#F4F5F7',
    card: '#FFFFFF',
    cardAlt: '#EEF0F3',
    border: '#D5D8DE',
    text: '#111418',
    textDim: '#5B626C',
    accent: '#0B63CE',
    accentText: '#FFFFFF',
    warnBg: '#FFF4CC',
    warnText: '#5C4400',
    teachingBg: '#ECECEC',
    pedsBg: '#F1E4FF',
    geriBg: '#E6F4D9',
    danger: '#B42318',
  },
  dark: {
    bg: '#0B0D10',
    card: '#171A1F',
    cardAlt: '#1F242B',
    border: '#2E343D',
    text: '#F2F4F7',
    textDim: '#A0A8B4',
    accent: '#4C9AFF',
    accentText: '#0B0D10',
    warnBg: '#3A2F0A',
    warnText: '#FFE08A',
    teachingBg: '#22262C',
    pedsBg: '#2C2138',
    geriBg: '#1F2A18',
    danger: '#F97066',
  },
};
export type Palette = typeof palettes.dark;

/** Fill colors taken from the PDF's certification legend. */
export const LEVEL_COLORS: Record<Exclude<Level, 'ALL'>, string> = {
  EMT: '#FFFF00',
  AEMT: '#66FF66',
  'EMT-I': '#FFCC66',
  PARAMEDIC: '#66CCFF',
};
export const PEDS_COLOR = '#CC99FF';
export const GERI_COLOR = '#92D050';

export const LEVEL_SHORT: Record<Level, string> = {
  ALL: 'ALL',
  EMT: 'EMT',
  AEMT: 'AEMT',
  'EMT-I': 'EMT-I',
  PARAMEDIC: 'PARAMEDIC',
};

export function useAppTheme() {
  const system = useColorScheme();
  const { theme, textScale } = useSettings();
  const scheme = theme === 'system' ? (system === 'light' ? 'light' : 'dark') : theme;
  const c = palettes[scheme];
  const fs = (n: number) => Math.round(n * textScale);
  return { scheme, c, fs };
}
