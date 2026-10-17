import { useState } from 'react';
import { useTranslation } from '@renderer/lib/i18n';
import { ticketActions } from '@renderer/lib/tickets';
import { Input } from '@renderer/ui';

export function QuickAdd({ stateId, className }: { stateId: string | null; className?: string | undefined }) {
  const { t } = useTranslation('editors');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await ticketActions.create({ title: trimmed, stateId });
      setTitle('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Input
      size="sm"
      value={title}
      placeholder={t('tickets.quickAdd')}
      aria-label={t('tickets.add')}
      disabled={busy}
      className={className}
      onChange={(event) => {
        setTitle(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          void submit();
        }
      }}
    />
  );
}
