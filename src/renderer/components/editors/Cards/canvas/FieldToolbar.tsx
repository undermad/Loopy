import type { ReactNode } from 'react';
import {
  AArrowDown,
  AArrowUp,
  ArrowLeftRight,
  Bold,
  ChartNoAxesColumn,
  Copy,
  Dices,
  Eye,
  EyeOff,
  Hash,
  ListChecks,
  ListPlus,
  Lock,
  LockOpen,
  Minus,
  MoveVertical,
  Percent,
  Plus,
  Sigma,
  Star,
  TextQuote,
  Trash2,
} from 'lucide-react';
import { CARD_TEXT_SIZES, DATE_FORMATS, type CardField, type FieldOf } from '@shared/cards';
import { FIELD_KINDS } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { IconButton } from '@renderer/ui';
import { useCanvas } from './context';
import styles from './Canvas.module.scss';

const stop = (event: { stopPropagation: () => void }) => {
  event.stopPropagation();
};

const SEPARATOR_STEP = 8;

interface Toggle {
  key: string;
  label: string;
  icon: ReactNode;
  pressed?: boolean;
  next: CardField;
}

function sized(field: CardField, delta: -1 | 1): CardField {
  const at = CARD_TEXT_SIZES.indexOf(field.style.size ?? 'md');
  const size = CARD_TEXT_SIZES[Math.min(CARD_TEXT_SIZES.length - 1, Math.max(0, at + delta))];
  return { ...field, style: { ...field.style, size } };
}

function useOptions(field: CardField): Toggle[] {
  const { t } = useTranslation('editors');
  const toggles: Toggle[] = [];
  const add = (toggle: Toggle) => toggles.push(toggle);
  const icon = { 'aria-hidden': true } as const;
  switch (field.kind) {
    case 'text':
      add({
        key: 'lines',
        label: t('cards.lineKinds.multi'),
        icon: <TextQuote {...icon} />,
        pressed: field.lines === 'multi',
        next: { ...field, lines: field.lines === 'multi' ? 'single' : 'multi' },
      });
      break;
    case 'number':
      if (!field.range) {
        for (const [display, Icon] of [
          ['number', Hash],
          ['bar', ChartNoAxesColumn],
          ['symbols', Star],
        ] as const) {
          add({
            key: display,
            label: t(`cards.showAs.${display}`),
            icon: <Icon {...icon} />,
            pressed: field.display === display,
            next: { ...field, display },
          });
        }
      }
      add({
        key: 'range',
        label: t('cards.range'),
        icon: <ArrowLeftRight {...icon} />,
        pressed: field.range,
        next: { ...field, range: !field.range, display: 'number', defaultValue: null },
      });
      break;
    case 'choice':
      add({
        key: 'multiple',
        label: t('cards.multiple'),
        icon: <ListChecks {...icon} />,
        pressed: field.multiple,
        next: { ...field, multiple: !field.multiple, defaultValue: null },
      });
      add({
        key: 'allowNew',
        label: t('cards.allowNew'),
        icon: <ListPlus {...icon} />,
        pressed: field.allowNew,
        next: { ...field, allowNew: !field.allowNew },
      });
      break;
    case 'dice':
      add({
        key: 'mode',
        label: t('cards.diceBuilder'),
        icon: <Dices {...icon} />,
        pressed: field.mode === 'builder',
        next: { ...field, mode: field.mode === 'builder' ? 'free' : 'builder' },
      });
      add({
        key: 'roll',
        label: t('cards.rollButton'),
        icon: <Dices {...icon} />,
        pressed: field.roll,
        next: { ...field, roll: !field.roll },
      });
      add({
        key: 'odds',
        label: t('cards.showOdds'),
        icon: <Percent {...icon} />,
        pressed: field.showOdds,
        next: { ...field, showOdds: !field.showOdds },
      });
      break;
    case 'date':
      for (const format of DATE_FORMATS) {
        add({
          key: format,
          label: t(`cards.dateFormats.${format}`),
          icon: <span aria-hidden="true">{t(`cards.dateFormats.${format}`).charAt(0)}</span>,
          pressed: field.format === format,
          next: { ...field, format } satisfies FieldOf<'date'>,
        });
      }
      break;
    case 'checklist':
      add({
        key: 'progress',
        label: t('cards.showProgress'),
        icon: <ListChecks {...icon} />,
        pressed: field.showProgress,
        next: { ...field, showProgress: !field.showProgress },
      });
      break;
    case 'attributes':
      add({
        key: 'total',
        label: t('cards.showTotal'),
        icon: <Sigma {...icon} />,
        pressed: field.showTotal,
        next: { ...field, showTotal: !field.showTotal },
      });
      break;
    case 'separator':
      add({
        key: 'line',
        label: t('cards.line'),
        icon: <Minus {...icon} />,
        pressed: field.line,
        next: { ...field, line: !field.line },
      });
      add({
        key: 'less',
        label: t('cards.lessSpace'),
        icon: <MoveVertical {...icon} />,
        next: { ...field, size: Math.max(4, field.size - SEPARATOR_STEP) },
      });
      add({
        key: 'more',
        label: t('cards.moreSpace'),
        icon: <Plus {...icon} />,
        next: { ...field, size: Math.min(200, field.size + SEPARATOR_STEP) },
      });
      break;
    default:
      break;
  }
  if (FIELD_KINDS[field.kind].textStyle) {
    add({
      key: 'bold',
      label: t('cards.bold'),
      icon: <Bold {...icon} />,
      pressed: field.style.weight === 'bold',
      next: {
        ...field,
        style: { ...field.style, weight: field.style.weight === 'bold' ? 'normal' : 'bold' },
      },
    });
    add({
      key: 'smaller',
      label: t('cards.smallerText'),
      icon: <AArrowDown {...icon} />,
      next: sized(field, -1),
    });
    add({ key: 'larger', label: t('cards.largerText'), icon: <AArrowUp {...icon} />, next: sized(field, 1) });
  }
  if (field.kind !== 'separator') {
    add({
      key: 'label',
      label: field.showLabel ? t('cards.hideLabel') : t('cards.showLabelAction'),
      icon: field.showLabel ? <EyeOff {...icon} /> : <Eye {...icon} />,
      next: { ...field, showLabel: !field.showLabel },
    });
  }
  return toggles;
}

export function FieldToolbar({ field }: { field: CardField }) {
  const { t } = useTranslation('editors');
  const canvas = useCanvas();
  const options = useOptions(field);
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
      <div role="group" aria-label={t('cards.fieldOptions')} className={styles['toolGroup']}>
        {options.map((option) => (
          <IconButton
            key={option.key}
            {...button}
            label={option.label}
            {...(option.pressed === undefined
              ? {}
              : { active: option.pressed, 'aria-pressed': option.pressed })}
            onClick={() => {
              canvas.change(option.next);
            }}
          >
            {option.icon}
          </IconButton>
        ))}
      </div>
      <div role="group" aria-label={t('cards.fieldActions')} className={styles['toolGroup']}>
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
    </div>
  );
}
