import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { SettingsProvider, useSettings } from '@/settings';
import { useAppTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { loaded } = useSettings();
  const { scheme, c } = useAppTheme();

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: { ...base.colors, background: c.bg, card: c.card, text: c.text, border: c.border, primary: c.accent },
      }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerTintColor: c.accent, headerTitleStyle: { color: c.text } }}>
        <Stack.Screen name="index" options={{ title: 'BoCo Protocols' }} />
        <Stack.Screen name="complaint/[id]" options={{ title: '' }} />
        <Stack.Screen name="protocol/[id]" options={{ title: '' }} />
        <Stack.Screen name="browse" options={{ title: 'All Protocols' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings', presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <RootStack />
    </SettingsProvider>
  );
}
