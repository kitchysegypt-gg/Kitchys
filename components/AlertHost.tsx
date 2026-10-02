import { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';

import { setAlertListener } from '@/lib/alert';
import { useSettings } from '@/lib/settings';
import { Button, Card, Txt } from './ui';

type Message = { title: string; message?: string };

/** Shows showAlert() messages on web, one at a time. */
export function AlertHost() {
  const { t } = useSettings();
  const [queue, setQueue] = useState<Message[]>([]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    setAlertListener((m) => setQueue((q) => [...q, m]));
    return () => setAlertListener(null);
  }, []);

  const current = queue[0];
  if (!current) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setQueue((q) => q.slice(1))}>
      <View style={styles.backdrop}>
        <Card style={styles.card}>
          <Txt variant="heading">{current.title}</Txt>
          {current.message ? <Txt muted>{current.message}</Txt> : null}
          <Button title={t('ok')} onPress={() => setQueue((q) => q.slice(1))} style={{ marginTop: 8 }} />
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  card: { padding: 22, gap: 8, maxWidth: 420, width: '100%', alignSelf: 'center' },
});
