import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  PanelsTopLeft,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react';
import { CARD_ZONES, type CardField } from '@shared/cards';
import { clampSpan } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { DropdownMenu, IconButton } from '@renderer/ui';
import { useCanvas } from './context';
import styles from './Canvas.module.scss';

const stop = (event: { stopPropagation: () => void }) => {
  event.stopPropagation();
};

export function FieldToolbar({ field }: { field: CardField }) {
  const { t } = useTranslation('editors');
  const canvas = useCanvas();
  const locked = field.locked;
  const button = { size: 'sm' as const, tooltip: false };
  return (
    <div
      role="toolbar"
      aria-label={t('cards.fieldTools')}
      className={styles['toolbar']}
      onPointerDown={stop}
      onClick={stop}
      onDoubleClick={stop}
    >
      <IconButton
        {...button}
        label={t('cards.narrower')}
        disabled={locked || field.span <= 1}
        onClick={() => {
          canvas.change({ ...field, span: clampSpan(field.span - 1) }, `span:${field.id}`);
        }}
      >
        <Minus aria-hidden="true" />
      </IconButton>
      <IconButton
        {...button}
        label={t('cards.wider')}
        disabled={locked || field.span >= 12}
        onClick={() => {
          canvas.change({ ...field, span: clampSpan(field.span + 1) }, `span:${field.id}`);
        }}
      >
        <Plus aria-hidden="true" />
      </IconButton>
      <IconButton
        {...button}
        label={t('cards.moveEarlier')}
        disabled={locked}
        onClick={() => {
          canvas.moveBy(field.id, -1);
        }}
      >
        <ArrowLeft aria-hidden="true" />
      </IconButton>
      <IconButton
        {...button}
        label={t('cards.moveLater')}
        disabled={locked}
        onClick={() => {
          canvas.moveBy(field.id, 1);
        }}
      >
        <ArrowRight aria-hidden="true" />
      </IconButton>
      <IconButton
        {...button}
        label={field.showLabel ? t('cards.hideLabel') : t('cards.showLabelAction')}
        onClick={() => {
          canvas.change({ ...field, showLabel: !field.showLabel });
        }}
      >
        {field.showLabel ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </IconButton>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <IconButton {...button} label={t('cards.zone')} disabled={locked}>
            <PanelsTopLeft aria-hidden="true" />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start">
          {CARD_ZONES.map((zone) => (
            <DropdownMenu.Item
              key={zone}
              disabled={zone === field.zone}
              onSelect={() => {
                canvas.moveToZone(field.id, zone);
              }}
            >
              {t(`cards.zones.${zone}`)}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <IconButton
        {...button}
        label={locked ? t('cards.unlock') : t('cards.lock')}
        active={locked}
        onClick={() => {
          canvas.change({ ...field, locked: !locked });
        }}
      >
        {locked ? <Lock aria-hidden="true" /> : <LockOpen aria-hidden="true" />}
      </IconButton>
      <IconButton
        {...button}
        label={t('cards.duplicateOne')}
        onClick={() => {
          canvas.duplicate(field.id);
        }}
      >
        <Copy aria-hidden="true" />
      </IconButton>
      <IconButton
        {...button}
        label={t('cards.deleteField')}
        disabled={locked}
        onClick={() => {
          canvas.remove(field.id);
        }}
      >
        <Trash2 aria-hidden="true" />
      </IconButton>
    </div>
  );
}
