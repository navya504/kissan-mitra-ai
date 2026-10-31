import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LanguageProvider } from '../i18n';
import { FarmProfileProvider } from '../farm-profile';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <FarmProfileProvider>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
        </SafeAreaProvider>
      </FarmProfileProvider>
    </LanguageProvider>
  );
}
