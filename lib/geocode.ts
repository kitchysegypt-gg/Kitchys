import * as Location from 'expo-location';
import { Platform } from 'react-native';

import type { Language } from './i18n';

type Coordinate = { latitude: number; longitude: number };

/**
 * A readable street address for a map position. Phones use their own geocoder;
 * browsers don't have one (expo-location's reverse geocoding is Android/iOS only),
 * so the website, and phones whose geocoder comes back empty, use OpenStreetMap.
 */
export async function addressFor(c: Coordinate, language: Language): Promise<string | null> {
  if (Platform.OS !== 'web') {
    try {
      const [place] = await Location.reverseGeocodeAsync(c);
      if (place) {
        const street = [place.streetNumber, place.street].filter(Boolean).join(' ') || place.name;
        const text = [street, place.district ?? place.subregion, place.city].filter(Boolean).join(', ');
        if (text) return text;
      }
    } catch {
      // Fall through to OpenStreetMap.
    }
  }
  return openStreetMapAddress(c, language);
}

async function openStreetMapAddress(c: Coordinate, language: Language) {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1` +
      `&lat=${c.latitude}&lon=${c.longitude}&accept-language=${language},en`;
    const res = await fetch(url, Platform.OS === 'web' ? undefined : { headers: { 'User-Agent': 'KitchysApp/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data?.address ?? {};
    const street = [a.house_number, a.road ?? a.pedestrian ?? a.street].filter(Boolean).join(' ');
    const area = a.neighbourhood ?? a.suburb ?? a.quarter ?? a.city_district;
    const city = a.city ?? a.town ?? a.village ?? a.state;
    const text = [street, area, city].filter(Boolean).join(', ');
    return text || data?.display_name || null;
  } catch {
    return null;
  }
}
