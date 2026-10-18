import type { AssetFolder } from '@shared/assets';
import { useTranslation } from '@renderer/lib/i18n';
import { ContextMenu } from '@renderer/ui';
import { INTERNAL_SCOPES, ROOT_VALUE, folderOptions, type InternalKind } from './kinds';

export interface MenuEntry {
  key: string;
  kind: 'file' | InternalKind;
  id: string;
  name: string;
  folderId: string | null;
}

export interface AssetMenuActions {
  open: (entry: MenuEntry) => void;
  rename: (entry: MenuEntry) => void;
  move: (keys: string[], kind: MenuEntry['kind'], folderId: string | null) => void;
  exportFile: (id: string) => void;
  remove: (keys: string[]) => void;
}

export interface AssetMenuProps {
  entry: MenuEntry;
  group: string[];
  folders: AssetFolder[];
  actions: AssetMenuActions;
}

export function AssetMenuItems({ entry, group, folders, actions }: AssetMenuProps) {
  const { t } = useTranslation('assets');
  const file = entry.kind === 'file';
  const scope = file ? 'files' : INTERNAL_SCOPES[entry.kind as InternalKind];
  const scoped = folders.filter((folder) => folder.scope === scope);
  const many = group.length > 1;
  return (
    <>
      {file ? null : (
        <ContextMenu.Item
          onSelect={() => {
            actions.open(entry);
          }}
        >
          {t('item.open')}
        </ContextMenu.Item>
      )}
      <ContextMenu.Item
        disabled={many}
        onSelect={() => {
          actions.rename(entry);
        }}
      >
        {file ? t('asset.rename') : t('item.rename')}
      </ContextMenu.Item>
      <ContextMenu.Sub>
        <ContextMenu.SubTrigger>{t('asset.moveTo')}</ContextMenu.SubTrigger>
        <ContextMenu.SubContent>
          {folderOptions(scoped, file ? t('topLevel') : t(scope)).map((option) => (
            <ContextMenu.Item
              key={option.value}
              disabled={!many && (entry.folderId ?? ROOT_VALUE) === option.value}
              onSelect={() => {
                actions.move(group, entry.kind, option.value === ROOT_VALUE ? null : option.value);
              }}
            >
              {option.label}
            </ContextMenu.Item>
          ))}
        </ContextMenu.SubContent>
      </ContextMenu.Sub>
      {file ? (
        <ContextMenu.Item
          onSelect={() => {
            actions.exportFile(entry.id);
          }}
        >
          {t('asset.export')}
        </ContextMenu.Item>
      ) : null}
      <ContextMenu.Separator />
      <ContextMenu.Item
        onSelect={() => {
          actions.remove(group);
        }}
      >
        {many
          ? file
            ? t('asset.deleteMany', { count: group.length })
            : t('item.deleteMany', { count: group.length })
          : file
            ? t('asset.delete')
            : t(`item.delete.${entry.kind as InternalKind}`)}
      </ContextMenu.Item>
    </>
  );
}
