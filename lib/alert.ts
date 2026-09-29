import { Alert, Platform } from 'react-native';

/** Alert.alert is a no-op on web, so fall back to the browser's alert there. */
export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}
