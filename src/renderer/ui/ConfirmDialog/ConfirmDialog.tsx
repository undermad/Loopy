import { useState, type ReactNode } from 'react';
import { Button } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  closeLabel,
  destructive = false,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content title={title} description={description} closeLabel={closeLabel} size="sm">
        {children}
        <Dialog.Footer>
          <Dialog.Close asChild>
            <Button variant="ghost" disabled={busy}>
              {cancelLabel}
            </Button>
          </Dialog.Close>
          <Button variant={destructive ? 'danger' : 'primary'} loading={busy} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
