import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Circle,
  Copy,
  Diamond,
  Frame,
  Image,
  LayoutTemplate,
  Search,
  Square,
  StickyNote,
  Type,
} from 'lucide-react';
import type { Asset } from '@shared/assets';
import type { CardTemplate } from '@shared/cards';
import type { ItemPreset } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { cx } from '@renderer/ui';
import styles from './QuickCreateMenu.module.scss';

export type QuickChoice =
  | { kind: 'same' }
  | { kind: 'preset'; preset: ItemPreset }
  | { kind: 'card'; templateId: string }
  | { kind: 'image'; assetId: string | null };

interface Entry {
  key: string;
  label: string;
  icon: ReactNode;
  choice: QuickChoice;
}

interface Category {
  id: string;
  label: string;
  entries: Entry[];
}

export interface QuickCreateMenuProps {
  x: number;
  y: number;
  templates: CardTemplate[];
  images: Asset[];
  offerSame: boolean;
  onPick: (choice: QuickChoice) => void;
  onClose: () => void;
}

export const QUICK_MENU_SIZE = { width: 248, height: 360 };

export function QuickCreateMenu({
  x,
  y,
  templates,
  images,
  offerSame,
  onPick,
  onClose,
}: QuickCreateMenuProps) {
  const { t } = useTranslation('editors');
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const categories = useMemo<Category[]>(() => {
    const preset = (key: ItemPreset, label: string, icon: ReactNode): Entry => ({
      key,
      label,
      icon,
      choice: { kind: 'preset', preset: key },
    });
    const same: Entry[] = offerSame
      ? [
          {
            key: 'same',
            label: t('board.quickMenu.same'),
            icon: <Copy aria-hidden="true" />,
            choice: { kind: 'same' },
          },
        ]
      : [];
    const list: Category[] = [
      {
        id: 'basics',
        label: t('board.quickMenu.categories.basics'),
        entries: [
          ...same,
          preset('text', t('board.tools.text'), <Type aria-hidden="true" />),
          preset('sticky', t('board.tools.sticky'), <StickyNote aria-hidden="true" />),
        ],
      },
      {
        id: 'shapes',
        label: t('board.quickMenu.categories.shapes'),
        entries: [
          preset('rectangle', t('board.tools.rectangle'), <Square aria-hidden="true" />),
          preset('ellipse', t('board.tools.ellipse'), <Circle aria-hidden="true" />),
          preset('diamond', t('board.tools.diamond'), <Diamond aria-hidden="true" />),
        ],
      },
      {
        id: 'layout',
        label: t('board.quickMenu.categories.layout'),
        entries: [preset('container', t('board.tools.container'), <Frame aria-hidden="true" />)],
      },
      {
        id: 'cards',
        label: t('board.quickMenu.categories.cards'),
        entries: templates.map((template) => ({
          key: `card:${template.id}`,
          label: template.name,
          icon: <LayoutTemplate aria-hidden="true" />,
          choice: { kind: 'card', templateId: template.id },
        })),
      },
      {
        id: 'media',
        label: t('board.quickMenu.categories.media'),
        entries: [
          {
            key: 'image',
            label: t('board.quickMenu.emptyImage'),
            icon: <Image aria-hidden="true" />,
            choice: { kind: 'image', assetId: null },
          },
          ...images.map((asset): Entry => ({
            key: `image:${asset.id}`,
            label: asset.name,
            icon: <Image aria-hidden="true" />,
            choice: { kind: 'image', assetId: asset.id },
          })),
        ],
      },
    ];
    const needle = query.trim().toLowerCase();
    return list
      .map((category) => ({
        ...category,
        entries: needle
          ? category.entries.filter(
              (entry) =>
                entry.label.toLowerCase().includes(needle) || category.label.toLowerCase().includes(needle),
            )
          : category.entries,
      }))
      .filter((category) => category.entries.length > 0);
  }, [images, offerSame, query, t, templates]);

  const entries = categories.flatMap((category) => category.entries);
  const current = Math.min(active, Math.max(0, entries.length - 1));

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', close, true);
    return () => {
      window.removeEventListener('pointerdown', close, true);
    };
  }, [onClose]);

  return (
    <div
      ref={root}
      className={cx('nodrag nopan nowheel', styles['menu'])}
      style={{ left: x, top: y, width: QUICK_MENU_SIZE.width, maxHeight: QUICK_MENU_SIZE.height }}
      role="dialog"
      aria-label={t('board.quickMenu.label')}
    >
      <label className={styles['search']}>
        <Search aria-hidden="true" />
        <input
          autoFocus
          value={query}
          placeholder={t('board.quickMenu.search')}
          aria-label={t('board.quickMenu.search')}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((current + 1) % Math.max(1, entries.length));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((current - 1 + entries.length) % Math.max(1, entries.length));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const entry = entries[current];
              if (entry) onPick(entry.choice);
            }
          }}
        />
      </label>
      <div className={styles['list']} role="listbox" aria-label={t('board.quickMenu.label')}>
        {categories.length === 0 ? <p className={styles['empty']}>{t('board.quickMenu.empty')}</p> : null}
        {categories.map((category) => (
          <div key={category.id} role="group" aria-label={category.label}>
            <p className={styles['category']}>{category.label}</p>
            {category.entries.map((entry) => {
              const index = entries.indexOf(entry);
              return (
                <button
                  key={entry.key}
                  type="button"
                  role="option"
                  aria-selected={index === current}
                  className={cx(styles['entry'], index === current && styles['active'])}
                  onPointerEnter={() => {
                    setActive(index);
                  }}
                  onClick={() => {
                    onPick(entry.choice);
                  }}
                >
                  {entry.icon}
                  <span>{entry.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
