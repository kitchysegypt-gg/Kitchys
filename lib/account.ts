import { useState } from 'react';

import { showAlert, showConfirm } from './alert';
import type { TranslationKey } from './i18n';
import { forgetThisPhone } from './notifications';
import { useSettings } from './settings';
import { isDemo, supabase } from './supabase';

/** Why the server refused (something still in progress). */
const BLOCKED: Record<string, TranslationKey> = {
  active_order: 'deleteBlockedOrder',
  kitchen_busy: 'deleteBlockedKitchen',
  rider_busy: 'deleteBlockedRider',
};

/**
 * "Delete my account": asks twice, then removes the account and personal data on the server
 * and signs out. Past orders stay only as anonymous records.
 */
export function useDeleteAccount(onDeleted?: () => void) {
  const { t } = useSettings();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      if (!isDemo) {
        const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
        let reason: string | undefined = data?.error;
        if (error) {
          const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
          reason = body?.error ?? error.message;
        }
        if (reason || !data?.deleted) {
          showAlert(t('deleteAccount'), BLOCKED[reason ?? ''] ? t(BLOCKED[reason!]) : t('deleteFailed'));
          return;
        }
      }
      onDeleted?.();
      await forgetThisPhone().catch(() => {});
      await supabase.auth.signOut();
      showAlert(t('deleteDoneTitle'), t('deleteDoneBody'));
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    showConfirm(t('deleteAccountTitle'), t('deleteAccountBody'), {
      label: t('deleteAccountConfirm'),
      cancelLabel: t('cancel'),
      onConfirm: run,
    });

  return { start, busy };
}
