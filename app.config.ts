import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * One codebase, two apps:
 *   - Kitchy's (customers and home chefs): the default.
 *   - Kitchy's Rider (our delivery riders): build or update with APP_VARIANT=rider.
 * Both talk to the same database. app.json holds the shared settings.
 */
const IS_RIDER = process.env.APP_VARIANT === 'rider';

export default ({ config }: ConfigContext): ExpoConfig => {
  if (!IS_RIDER) {
    return { ...config, extra: { ...config.extra, appVariant: 'customer' } } as ExpoConfig;
  }
  // The rider app has its own Android package, so it needs its own Firebase entry for push
  // notifications. Until that file exists, the rider app builds without it.
  const { googleServicesFile: _unused, ...android } = config.android ?? {};
  const riderGoogleServices = './google-services.rider.json';
  let hasRiderFirebase = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('fs').accessSync(riderGoogleServices);
    hasRiderFirebase = true;
  } catch {}

  return {
    ...config,
    name: "Kitchy's Rider",
    scheme: 'kitchysrider',
    ios: { ...config.ios, bundleIdentifier: 'com.kitchys.rider' },
    android: {
      ...android,
      package: 'com.kitchys.rider',
      ...(hasRiderFirebase ? { googleServicesFile: riderGoogleServices } : {}),
    },
    plugins: (config.plugins ?? []).map((plugin) =>
      Array.isArray(plugin) && plugin[0] === 'expo-location'
        ? [
            'expo-location',
            {
              locationWhenInUsePermission:
                "Kitchy's Rider uses your location to show nearby pickups and to let customers see their delivery coming.",
            },
          ]
        : plugin
    ),
    extra: { ...config.extra, appVariant: 'rider' },
  } as ExpoConfig;
};
