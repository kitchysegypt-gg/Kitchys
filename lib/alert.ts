import { Alert, Platform } from 'react-native';

export type AlertMessage = {
  title: string;
  message?: string;
  /** Set for a question: the confirm button's label and what it does. */
  confirm?: { label: string; cancelLabel: string; onConfirm: () => void };
};
type Listener = (message: AlertMessage) => void;

let listener: Listener | null = null;
const queued: AlertMessage[] = [];

/** Lets <AlertHost /> show messages on web. */
export function setAlertListener(next: Listener | null) {
  listener = next;
  if (next) queued.splice(0).forEach(next);
}

function showOnWeb(message: AlertMessage) {
  if (listener) listener(message);
  else queued.push(message);
}

/**
 * Native uses the system alert. On web, browser pop-ups can be blocked (for
 * example inside an embedded page), so the message is shown in the app instead.
 */
export function showAlert(title: string, message?: string) {
  if (Platform.OS !== 'web') return Alert.alert(title, message);
  showOnWeb({ title, message });
}

/** A yes/no question; `onConfirm` runs only when the confirm button is tapped. */
export function showConfirm(
  title: string,
  message: string,
  confirm: { label: string; cancelLabel: string; onConfirm: () => void }
) {
  if (Platform.OS !== 'web') {
    return Alert.alert(title, message, [
      { text: confirm.cancelLabel, style: 'cancel' },
      { text: confirm.label, style: 'destructive', onPress: confirm.onConfirm },
    ]);
  }
  showOnWeb({ title, message, confirm });
}
