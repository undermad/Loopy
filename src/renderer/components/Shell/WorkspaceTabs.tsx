import { useState } from 'react';
import { Plus } from 'lucide-react';
import { workspaceTemplates } from '@shared/layout-presets';
import { useTranslation } from '@renderer/lib/i18n';
import {
  addWorkspace,
  deleteWorkspace,
  duplicateWorkspace,
  moveWorkspace,
  renameWorkspace,
  setActiveWorkspace,
  useActiveWorkspaceId,
  useWorkspaces,
} from '@renderer/lib/workspaces';
import { ContextMenu, DropdownMenu, IconButton, cx } from '@renderer/ui';
import { PromptDialog } from './PromptDialog';
import styles from './WorkspaceTabs.module.scss';

export function WorkspaceTabs() {
  const { t } = useTranslation('shell');
  const { t: tc } = useTranslation('common');
  const workspaces = useWorkspaces();
  const activeId = useActiveWorkspaceId();
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className={styles['tabs']} role="tablist" aria-label={t('workspace.tabs')}>
      {workspaces.map((workspace, index) => (
        <ContextMenu.Root key={workspace.id}>
          <ContextMenu.Trigger asChild>
            <button
              type="button"
              role="tab"
              aria-selected={workspace.id === activeId}
              className={cx(styles['tab'], workspace.id === activeId && styles['active'])}
              onClick={() => {
                setActiveWorkspace(workspace.id);
              }}
              onDoubleClick={() => {
                setRenaming({ id: workspace.id, name: workspace.name });
              }}
            >
              {workspace.name}
            </button>
          </ContextMenu.Trigger>
          <ContextMenu.Content>
            <ContextMenu.Item
              onSelect={() => {
                setRenaming({ id: workspace.id, name: workspace.name });
              }}
            >
              {t('workspace.rename')}
            </ContextMenu.Item>
            <ContextMenu.Item
              onSelect={() => {
                duplicateWorkspace(workspace.id);
              }}
            >
              {t('workspace.duplicate')}
            </ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item
              disabled={index === 0}
              onSelect={() => {
                moveWorkspace(workspace.id, -1);
              }}
            >
              {t('workspace.moveLeft')}
            </ContextMenu.Item>
            <ContextMenu.Item
              disabled={index === workspaces.length - 1}
              onSelect={() => {
                moveWorkspace(workspace.id, 1);
              }}
            >
              {t('workspace.moveRight')}
            </ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item
              disabled={workspaces.length <= 1}
              onSelect={() => {
                deleteWorkspace(workspace.id);
              }}
            >
              {t('workspace.delete')}
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Root>
      ))}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <IconButton label={t('workspace.add')} size="sm">
            <Plus aria-hidden="true" />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start">
          <DropdownMenu.Item
            onSelect={() => {
              duplicateWorkspace(activeId);
            }}
          >
            {t('workspace.duplicateCurrent')}
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Label>{t('workspace.fromPreset')}</DropdownMenu.Label>
          {workspaceTemplates.map((template) => (
            <DropdownMenu.Item
              key={template.id}
              onSelect={() => {
                addWorkspace(template.id, t(`workspace.templates.${template.id}`));
              }}
            >
              {t(`workspace.templates.${template.id}`)}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      {renaming ? (
        <PromptDialog
          key={renaming.id}
          open
          onOpenChange={(open) => {
            if (!open) setRenaming(null);
          }}
          title={t('workspace.rename')}
          label={t('workspace.name')}
          initialValue={renaming.name}
          submitLabel={tc('actions.rename')}
          onSubmit={(name) => {
            renameWorkspace(renaming.id, name);
          }}
        />
      ) : null}
    </div>
  );
}
