import Constants from 'expo-constants';

/**
 * True in the Kitchy's Rider app (built with APP_VARIANT=rider, see app.config.ts).
 * EXPO_PUBLIC_APP_VARIANT=rider does the same for a web test build.
 */
export const IS_RIDER =
  Constants.expoConfig?.extra?.appVariant === 'rider' || process.env.EXPO_PUBLIC_APP_VARIANT === 'rider';
