import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const iosGoogleMapsApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY;
  const plugins = [...(config.plugins ?? [])];
  if (androidGoogleMapsApiKey || iosGoogleMapsApiKey) {
    plugins.push(['react-native-maps', { androidGoogleMapsApiKey, iosGoogleMapsApiKey }]);
  }
  return {
    ...config,
    name: config.name ?? 'Kisaan Mitra AI',
    slug: config.slug ?? 'kisaan-mitra-ai',
    plugins,
    extra: {
      ...config.extra,
      androidGoogleMapsConfigured: Boolean(androidGoogleMapsApiKey),
      iosGoogleMapsConfigured: Boolean(iosGoogleMapsApiKey),
    },
  };
};
