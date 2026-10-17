import { useState } from 'react';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, Dialog, Field, Input } from '@renderer/ui';

export interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  initialValue?: string;
  submitLabel: string;
  onSubmit: (value: string) => void | Promise<void>;
}

export function PromptDialog({
  open,
  onOpenChange,
  title,
  label,
  initialValue = '',
  submitLabel,
  onSubmit,
}: PromptDialogProps) {
  const { t } = useTranslation('common');
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const valid = value.trim().length > 0;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onSubmit(value.trim());
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content title={title} closeLabel={t('actions.close')} size="sm">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field label={label} required>
            <Input
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
              }}
              autoFocus
              maxLength={60}
            />
          </Field>
          <Dialog.Footer>
            <Dialog.Close asChild>
              <Button variant="ghost">{t('actions.cancel')}</Button>
            </Dialog.Close>
            <Button type="submit" variant="primary" disabled={!valid} loading={busy}>
              {submitLabel}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
