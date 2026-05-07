import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import RootNavigator from './src/navigation/RootNavigator';
import useAuthStore from './src/store/useAuthStore';
import useSettingsStore from './src/store/useSettingsStore';
import { database } from './src/db';
import { useSync } from './src/hooks/useSync';
import './src/i18n';
import i18n from './src/i18n';
import { queryClient } from './src/lib/queryClient';

function AppContent() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const initializeLanguage = useSettingsStore((s) => s.initializeLanguage);
  useSync();

  useEffect(() => {
    async function init() {
      const user = await hydrate();
      const lang = await initializeLanguage(user);
      i18n.changeLanguage(lang);
    }
    init();
  }, [hydrate, initializeLanguage]);

  return (
    <NavigationContainer>
      <StatusBar style='dark' />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DatabaseProvider database={database}>
        <QueryClientProvider client={queryClient}>
          <AppContent />
        </QueryClientProvider>
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
}
