import { useState } from 'react';
import { FIELD_PRESETS, type FieldPresetId } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, Dialog, Field, Select, TextArea } from '@renderer/ui';
import styles from '../CardDesigner.module.scss';

export function AddSeveralDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (text: string, preset: FieldPresetId) => void;
}) {
  const { t } = useTranslation('editors');
  const { t: tc } = useTranslation('common');
  const [text, setText] = useState('');
  const [preset, setPreset] = useState<FieldPresetId>('text');
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content title={t('cards.addSeveralTitle')} closeLabel={tc('actions.close')} size="sm">
        <div className={styles['settingsBody']}>
          <Field label={t('cards.addSeveralLabels')}>
            <TextArea
              rows={6}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
              }}
            />
          </Field>
          <Field label={t('cards.kind')}>
            <Select
              size="sm"
              value={preset}
              aria-label={t('cards.kind')}
              options={FIELD_PRESETS.map((item) => ({
                value: item.id,
                label: t(`cards.presets.${item.id}`),
              }))}
              onValueChange={(value) => {
                setPreset(value as FieldPresetId);
              }}
            />
          </Field>
        </div>
        <Dialog.Footer>
          <Button
            size="sm"
            variant="primary"
            disabled={text.trim() === ''}
            onClick={() => {
              onAdd(text, preset);
              setText('');
              onOpenChange(false);
            }}
          >
            {t('cards.addFields')}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
