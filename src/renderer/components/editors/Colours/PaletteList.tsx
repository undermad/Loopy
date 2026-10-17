import { useState } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import type { Palette } from '@shared/colours';
import { useTranslation } from '@renderer/lib/i18n';
import { deletePalette, duplicatePalette, updatePalette } from '@renderer/lib/palettes';
import { Button, ConfirmDialog, DropdownMenu, IconButton, Input, ScrollArea, Tag, cx } from '@renderer/ui';
import { PromptDialog } from '../../Shell/PromptDialog';
import styles from './PaletteList.module.scss';

export interface PaletteListItem {
  palette: Palette;
  unsaved: boolean;
  isNew: boolean;
}

export interface PaletteListProps {
  items: PaletteListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDiscardNew: () => void;
}

type Dialog = { kind: 'rename' | 'delete'; palette: Palette } | null;

export function PaletteList({ items, selectedId, onSelect, onNew, onDiscardNew }: PaletteListProps) {
  const { t } = useTranslation('colours');
  const { t: tc } = useTranslation('common');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const needle = search.trim().toLowerCase();
  const visible = items.filter(
    ({ palette }) =>
      !needle || palette.name.toLowerCase().includes(needle) || palette.harmony.includes(needle),
  );

  async function duplicate(palette: Palette) {
    const copy = await duplicatePalette(palette.id, t('library.copyName', { name: palette.name }));
    if (copy) onSelect(copy.id);
  }

  return (
    <div className={styles['list']}>
      <div className={styles['tools']}>
        <Input
          size="sm"
          type="search"
          value={search}
          aria-label={t('library.search')}
          placeholder={t('library.search')}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />
        <IconButton label={t('library.new')} size="sm" variant="secondary" onClick={onNew}>
          <Plus aria-hidden="true" />
        </IconButton>
      </div>
      <ScrollArea className={styles['scroll']}>
        {items.length === 0 ? (
          <div className={styles['empty']}>
            <p>{t('library.empty')}</p>
            <p className={styles['hint']}>{t('library.emptyHint')}</p>
            <Button size="sm" variant="primary" icon={<Plus aria-hidden="true" />} onClick={onNew}>
              {t('library.new')}
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <p className={styles['empty']}>{t('library.noMatch')}</p>
        ) : (
          <ul className={styles['items']} aria-label={t('library.title')}>
            {visible.map(({ palette, unsaved, isNew }) => {
              const shown = palette.name.trim() || t('library.untitled');
              return (
                <li
                  key={palette.id}
                  className={cx(styles['item'], palette.id === selectedId && styles['selected'])}
                >
                  <button
                    type="button"
                    className={styles['select']}
                    aria-label={t('library.select', { name: shown })}
                    aria-current={palette.id === selectedId ? 'true' : undefined}
                    onClick={() => {
                      onSelect(palette.id);
                    }}
                  >
                    <span className={styles['name']}>
                      <span className={styles['nameText']}>{shown}</span>
                      {unsaved ? (
                        <Tag size="sm" className={styles['unsaved']}>
                          {t('library.unsaved')}
                        </Tag>
                      ) : null}
                    </span>
                    <span className={styles['strip']} aria-hidden="true">
                      {palette.colours.map((colour) => (
                        <span key={colour.id} style={{ background: colour.hex }} />
                      ))}
                    </span>
                    <span className={styles['meta']}>
                      {t(`harmony.${palette.harmony}`)} ·{' '}
                      {t('library.colours', { count: palette.colours.length })}
                    </span>
                  </button>
                  {isNew ? (
                    <IconButton
                      label={t('library.discard')}
                      size="sm"
                      tooltip={false}
                      className={styles['menu']}
                      onClick={onDiscardNew}
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </IconButton>
                  ) : (
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <IconButton
                          label={t('library.menu')}
                          size="sm"
                          tooltip={false}
                          className={styles['menu']}
                        >
                          <MoreHorizontal aria-hidden="true" />
                        </IconButton>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content align="end">
                        <DropdownMenu.Item
                          onSelect={() => {
                            setDialog({ kind: 'rename', palette });
                          }}
                        >
                          {t('library.rename')}
                        </DropdownMenu.Item>
                        <DropdownMenu.Item onSelect={() => void duplicate(palette)}>
                          {t('library.duplicate')}
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item
                          onSelect={() => {
                            setDialog({ kind: 'delete', palette });
                          }}
                        >
                          {t('library.delete')}
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Root>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
      {dialog?.kind === 'rename' ? (
        <PromptDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          title={t('library.rename')}
          label={t('library.name')}
          initialValue={dialog.palette.name}
          submitLabel={tc('actions.rename')}
          onSubmit={(name) => updatePalette(dialog.palette.id, { name }).then(() => undefined)}
        />
      ) : null}
      <ConfirmDialog
        open={dialog?.kind === 'delete'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={t('library.delete')}
        description={t('library.deleteConfirm', { name: dialog?.palette.name ?? '' })}
        confirmLabel={tc('actions.delete')}
        cancelLabel={tc('actions.cancel')}
        closeLabel={tc('actions.close')}
        destructive
        onConfirm={async () => {
          if (dialog?.kind !== 'delete') return;
          const remaining = await deletePalette(dialog.palette.id);
          const next = remaining[0];
          if (next && dialog.palette.id === selectedId) onSelect(next.id);
        }}
      />
    </div>
  );
}
