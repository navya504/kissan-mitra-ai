import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LanguageProvider } from '../i18n';
import { FarmProfileProvider } from '../farm-profile';
import { SpeechProvider } from '../speech-access';
import { VoiceCommandProvider } from '../voice-command-context';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <FarmProfileProvider>
        <SafeAreaProvider>
          <SpeechProvider>
            <VoiceCommandProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
            </VoiceCommandProvider>
          </SpeechProvider>
        </SafeAreaProvider>
      </FarmProfileProvider>
    </LanguageProvider>
  );
}
