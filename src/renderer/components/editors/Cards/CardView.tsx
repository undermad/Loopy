import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ImageOff, X } from 'lucide-react';
import { assetUrl } from '@shared/assets';
import type { BoardLink, CardValue } from '@shared/board';
import type { CardField, CardLayout, CardTextSize } from '@shared/cards';
import { assetDropZoneProps, useAssetDropZone, useAssetsSnapshot } from '@renderer/lib/assets';
import { coerceValue, fieldValue, linkTargets, statFraction } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { useResolvedColour } from '@renderer/lib/palettes';
import { openLinked, useWorkspaceNames } from '@renderer/lib/workspaces';
import { DropdownMenu, NumberInput, cx } from '@renderer/ui';
import { AssetLinkCard, useResolvedLink } from '../../AssetLinkCard/AssetLinkCard';
import styles from './CardView.module.scss';

export interface CardViewProps {
  layout: Pick<CardLayout, 'fields' | 'gap'>;
  values: Record<string, CardValue>;
  editable: boolean;
  onChange?: (fieldId: string, value: CardValue) => void;
  selectedFieldId?: string | null;
  onSelectField?: (fieldId: string) => void;
  className?: string | undefined;
}

const SIZES: Record<CardTextSize, string> = {
  xs: '0.75em',
  sm: '0.875em',
  md: '1em',
  lg: '1.25em',
  xl: '1.6em',
};

const WEIGHTS = { normal: 400, medium: 500, bold: 700 } as const;

const INTERACTIVE = 'nodrag nowheel nopan';

function stop(event: KeyboardEvent) {
  event.stopPropagation();
}

interface TextInputProps {
  value: string;
  placeholder: string;
  multiline: boolean;
  label: string;
  onCommit: (next: string) => void;
}

function TextInput({ value, placeholder, multiline, label, onCommit }: TextInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  if (multiline) {
    return (
      <textarea
        className={cx(INTERACTIVE, styles['input'], styles['area'])}
        value={shown}
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={stop}
      />
    );
  }
  return (
    <input
      className={cx(INTERACTIVE, styles['input'])}
      value={shown}
      placeholder={placeholder}
      aria-label={label}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

interface NumberValueProps {
  value: CardValue;
  label: string;
  onCommit: (next: number | null) => void;
}

function NumberValue({ value, label, onCommit }: NumberValueProps) {
  return (
    <NumberInput
      className={cx(INTERACTIVE, styles['input'], styles['number'])}
      size="sm"
      value={typeof value === 'number' ? value : null}
      nullable
      aria-label={label}
      onValueChange={onCommit}
      onKeyDown={(event) => {
        event.stopPropagation();
      }}
    />
  );
}

interface ListProps {
  value: CardValue;
  label: string;
  editable: boolean;
}

function Tags({ value, label, editable, onCommit }: ListProps & { onCommit: (next: string[]) => void }) {
  const { t } = useTranslation('editors');
  const tags = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  const [draft, setDraft] = useState('');
  return (
    <div className={styles['tags']} aria-label={label} role="list">
      {tags.map((tag) => (
        <span key={tag} className={styles['tag']} role="listitem">
          {tag}
          {editable ? (
            <button
              type="button"
              className={cx(INTERACTIVE, styles['tagRemove'])}
              aria-label={t('cards.removeTag', { tag })}
              onClick={() => {
                onCommit(tags.filter((item) => item !== tag));
              }}
            >
              <X aria-hidden="true" />
            </button>
          ) : null}
        </span>
      ))}
      {editable ? (
        <input
          className={cx(INTERACTIVE, styles['tagInput'])}
          value={draft}
          placeholder={t('cards.addTag')}
          aria-label={`${label}: ${t('cards.addTag')}`}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter' && draft.trim()) {
              event.preventDefault();
              if (!tags.includes(draft.trim())) onCommit([...tags, draft.trim()]);
              setDraft('');
            }
          }}
        />
      ) : null}
    </div>
  );
}

function ImageValue({
  value,
  label,
  editable,
  onCommit,
}: ListProps & { onCommit: (next: string | null) => void }) {
  const { t } = useTranslation('editors');
  const assets = useAssetsSnapshot().assets.filter((asset) => asset.kind === 'image');
  const id = typeof value === 'string' ? value : null;
  const picture = id ? (
    <img className={styles['picture']} src={assetUrl(id)} alt={label} draggable={false} />
  ) : (
    <span className={styles['noPicture']}>
      <ImageOff aria-hidden="true" />
      {t('cards.noImage')}
    </span>
  );
  if (!editable) return <div className={styles['pictureFrame']}>{picture}</div>;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cx(INTERACTIVE, styles['pictureFrame'], styles['pictureButton'])}
          aria-label={`${label}: ${t('cards.pickImage')}`}
        >
          {picture}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        {assets.length === 0 ? <DropdownMenu.Label>{t('board.tools.noImages')}</DropdownMenu.Label> : null}
        {assets.map((asset) => (
          <DropdownMenu.Item
            key={asset.id}
            onSelect={() => {
              onCommit(asset.id);
            }}
          >
            {asset.name}
          </DropdownMenu.Item>
        ))}
        {id ? (
          <>
            <DropdownMenu.Separator />
            <DropdownMenu.Item
              onSelect={() => {
                onCommit(null);
              }}
            >
              {t('cards.clearImage')}
            </DropdownMenu.Item>
          </>
        ) : null}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

interface FieldViewProps {
  field: CardField;
  value: CardValue;
  editable: boolean;
  onChange: (value: CardValue) => void;
}

function FieldView({ field, value, editable, onChange }: FieldViewProps) {
  const { t } = useTranslation('editors');
  const colour = useResolvedColour(field.style.colour ?? null);
  const label = field.label || t(`cards.kinds.${field.kind}`);
  const text = typeof value === 'string' ? value : '';
  const textStyle: CSSProperties = {
    fontSize: field.style.size ? SIZES[field.style.size] : field.kind === 'heading' ? SIZES.lg : undefined,
    fontWeight: field.style.weight ? WEIGHTS[field.style.weight] : field.kind === 'heading' ? 700 : undefined,
    color: colour ?? undefined,
    textAlign: field.style.align,
  };

  switch (field.kind) {
    case 'heading':
    case 'text':
    case 'longText':
      return editable ? (
        <div style={textStyle}>
          <TextInput
            value={text}
            placeholder={field.placeholder}
            multiline={field.kind === 'longText'}
            label={label}
            onCommit={onChange}
          />
        </div>
      ) : (
        <div className={cx(styles['static'], !text && styles['empty'])} style={textStyle}>
          {text || field.placeholder}
        </div>
      );
    case 'number':
      return editable ? (
        <div style={textStyle}>
          <NumberValue value={value} label={label} onCommit={onChange} />
        </div>
      ) : (
        <div className={styles['static']} style={textStyle}>
          {typeof value === 'number' ? value : '–'}
        </div>
      );
    case 'select':
      return editable ? (
        <select
          className={cx(INTERACTIVE, styles['input'], styles['select'])}
          style={textStyle}
          value={text}
          aria-label={label}
          onKeyDown={stop}
          onChange={(event) => {
            onChange(event.target.value || null);
          }}
        >
          <option value="">{field.placeholder || '–'}</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <span className={styles['badge']} style={textStyle}>
          {text || '–'}
        </span>
      );
    case 'checkbox':
      return (
        <label className={styles['check']} style={textStyle}>
          <input
            className={INTERACTIVE}
            type="checkbox"
            checked={value === true}
            disabled={!editable}
            aria-label={label}
            onChange={(event) => {
              onChange(event.target.checked);
            }}
          />
          <span>{value === true ? t('cards.yes') : t('cards.no')}</span>
        </label>
      );
    case 'tags':
      return <Tags value={value} label={label} editable={editable} onCommit={onChange} />;
    case 'image':
      return <ImageValue value={value} label={label} editable={editable} onCommit={onChange} />;
    case 'stat': {
      const fraction = statFraction(field, value);
      return (
        <div className={styles['stat']} style={textStyle}>
          <div
            className={styles['bar']}
            role="meter"
            aria-label={label}
            aria-valuenow={typeof value === 'number' ? value : 0}
            aria-valuemin={field.min ?? 0}
            aria-valuemax={field.max ?? 100}
          >
            <span style={{ width: `${String(fraction * 100)}%`, background: colour ?? undefined }} />
          </div>
          {editable ? (
            <NumberValue value={value} label={label} onCommit={onChange} />
          ) : (
            <span className={styles['statValue']}>{typeof value === 'number' ? value : 0}</span>
          )}
        </div>
      );
    }
    case 'colour':
      return (
        <div className={styles['colour']}>
          <span className={styles['swatch']} style={{ background: text || 'transparent' }} />
          {editable ? (
            <input
              className={cx(INTERACTIVE, styles['input'], styles['hex'])}
              type="color"
              value={text || '#000000'}
              aria-label={label}
              onChange={(event) => {
                onChange(event.target.value);
              }}
            />
          ) : (
            <span className={styles['static']}>{text || '–'}</span>
          )}
        </div>
      );
    case 'link':
      return <LinkValue field={field} value={value} label={label} editable={editable} onCommit={onChange} />;
    case 'divider':
      return <hr className={styles['divider']} />;
  }
}

function LinkChip({
  link,
  editable,
  onOpen,
  onRemove,
}: {
  link: BoardLink;
  editable: boolean;
  onOpen: (link: BoardLink) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('editors');
  const item = useResolvedLink(link);
  return (
    <span className={styles['link']} role="listitem">
      <AssetLinkCard
        link={link}
        onOpen={() => {
          onOpen(link);
        }}
        className={cx(INTERACTIVE, styles['linkCard'])}
      />
      {editable ? (
        <button
          type="button"
          className={cx(INTERACTIVE, styles['tagRemove'])}
          aria-label={t('cards.removeLink', { name: item.name })}
          onClick={onRemove}
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}

function LinkValue({
  field,
  value,
  label,
  editable,
  onCommit,
}: ListProps & { field: CardField; onCommit: (next: CardValue) => void }) {
  const { t } = useTranslation('editors');
  const names = useWorkspaceNames();
  const zone = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  const links = linkTargets(value);
  useAssetDropZone(zone, (detail) => {
    if (!editable || detail.phase === 'leave') {
      setOver(false);
      return;
    }
    if (detail.phase === 'move') {
      setOver(true);
      return;
    }
    setOver(false);
    const next = coerceValue(field, field.multiple ? [...links, ...detail.links] : detail.links);
    if (next !== null) onCommit(next);
  });
  return (
    <div
      ref={zone}
      role="group"
      aria-label={label}
      className={cx(styles['links'], over && styles['linksOver'])}
      {...(editable ? assetDropZoneProps : {})}
    >
      {links.length > 0 ? (
        <span className={styles['linkList']} role="list">
          {links.map((link) => (
            <LinkChip
              key={`${link.kind}:${link.id}`}
              link={link}
              editable={editable}
              onOpen={(target) => {
                openLinked(target, names);
              }}
              onRemove={() => {
                onCommit(
                  coerceValue(
                    field,
                    links.filter((item) => item !== link),
                  ),
                );
              }}
            />
          ))}
        </span>
      ) : (
        <span className={cx(styles['static'], styles['empty'])}>{editable ? t('cards.linkHint') : '–'}</span>
      )}
    </div>
  );
}

export function CardView({
  layout,
  values,
  editable,
  onChange,
  selectedFieldId,
  onSelectField,
  className,
}: CardViewProps) {
  const { t } = useTranslation('editors');
  return (
    <div className={cx(styles['card'], className)} style={{ gap: layout.gap }}>
      {layout.fields.map((field) => {
        const label = field.label || t(`cards.kinds.${field.kind}`);
        return (
          <div
            key={field.id}
            className={cx(
              styles['field'],
              selectedFieldId === field.id && styles['fieldSelected'],
              onSelectField && styles['fieldPickable'],
            )}
            style={{ gridColumn: `span ${String(field.span)}` }}
            data-kind={field.kind}
            data-field-id={field.id}
            onClick={
              onSelectField
                ? () => {
                    onSelectField(field.id);
                  }
                : undefined
            }
          >
            {field.showLabel && field.kind !== 'divider' ? (
              <span className={styles['label']}>{label}</span>
            ) : null}
            <FieldView
              field={field}
              value={fieldValue(field, values)}
              editable={editable}
              onChange={(value) => onChange?.(field.id, value)}
            />
          </div>
        );
      })}
    </div>
  );
}
