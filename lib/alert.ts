import { Alert, Platform } from 'react-native';

type Message = { title: string; message?: string };
type Listener = (message: Message) => void;

let listener: Listener | null = null;
const queued: Message[] = [];

/** Lets <AlertHost /> show messages on web. */
export function setAlertListener(next: Listener | null) {
  listener = next;
  if (next) queued.splice(0).forEach(next);
}

/**
 * Native uses the system alert. On web, browser pop-ups can be blocked (for
 * example inside an embedded page), so the message is shown in the app instead.
 */
export function showAlert(title: string, message?: string) {
  if (Platform.OS !== 'web') return Alert.alert(title, message);
  if (listener) listener({ title, message });
  else queued.push({ title, message });
}
