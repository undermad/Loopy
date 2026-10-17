import type { EditCommand } from '@shared/ipc';
import { useTranslation } from '@renderer/lib/i18n';
import {
  closeProject,
  exportProject,
  importProject,
  openProject,
  useCurrentProject,
  useRecentProjects,
} from '@renderer/lib/project';
import { describeKeys, keymap } from '@renderer/lib/shortcuts';
import { Menubar } from '@renderer/ui';
import { LINKS } from './links';
import { WindowMenu } from './WindowMenu';
import { WorkspaceTabs } from './WorkspaceTabs';
import styles from './MenuBar.module.scss';

export type ShellDialog = 'preferences' | 'newProject' | 'saveLayout' | 'shortcuts' | 'about';

export interface MenuBarProps {
  onDialog: (dialog: ShellDialog) => void;
  editCommand: (command: EditCommand) => void;
}

export function MenuShortcut({ id }: { id: keyof typeof keymap }) {
  return <Menubar.Shortcut>{describeKeys(keymap[id].keys)}</Menubar.Shortcut>;
}

const EDIT_COMMANDS: EditCommand[] = ['undo', 'redo', 'cut', 'copy', 'paste', 'delete', 'selectAll'];

export function MenuBar({ onDialog, editCommand }: MenuBarProps) {
  const { t } = useTranslation('shell');
  const project = useCurrentProject();
  const recent = useRecentProjects();

  return (
    <div className={styles['bar']}>
      <Menubar.Root>
        <Menubar.Menu>
          <Menubar.Trigger>{t('menu.file')}</Menubar.Trigger>
          <Menubar.Content>
            <Menubar.Item
              onSelect={() => {
                onDialog('newProject');
              }}
            >
              {t('menu.newProject')}
              <MenuShortcut id="newProject" />
            </Menubar.Item>
            <Menubar.Item onSelect={() => void importProject()}>{t('menu.openProject')}</Menubar.Item>
            <Menubar.Sub>
              <Menubar.SubTrigger disabled={recent.length === 0}>{t('menu.openRecent')}</Menubar.SubTrigger>
              <Menubar.SubContent>
                {recent.map((entry) => (
                  <Menubar.Item key={entry.id} onSelect={() => void openProject(entry.id)}>
                    {entry.name}
                  </Menubar.Item>
                ))}
              </Menubar.SubContent>
            </Menubar.Sub>
            <Menubar.Separator />
            <Menubar.Item disabled={!project} onSelect={() => void closeProject()}>
              {t('menu.closeProject')}
            </Menubar.Item>
            <Menubar.Item disabled={!project} onSelect={() => void exportProject()}>
              {t('menu.exportProject')}
            </Menubar.Item>
            <Menubar.Separator />
            <Menubar.Item
              onSelect={() => {
                onDialog('preferences');
              }}
            >
              {t('menu.preferences')}
              <MenuShortcut id="preferences" />
            </Menubar.Item>
            <Menubar.Separator />
            <Menubar.Item
              onSelect={() => {
                window.close();
              }}
            >
              {t('menu.quit')}
            </Menubar.Item>
          </Menubar.Content>
        </Menubar.Menu>
        <Menubar.Menu>
          <Menubar.Trigger>{t('menu.edit')}</Menubar.Trigger>
          <Menubar.Content>
            {EDIT_COMMANDS.map((command, index) => (
              <Menubar.Group key={command}>
                {index === 2 || index === 6 ? <Menubar.Separator /> : null}
                <Menubar.Item
                  onSelect={() => {
                    editCommand(command);
                  }}
                >
                  {t(`menu.${command}`)}
                </Menubar.Item>
              </Menubar.Group>
            ))}
          </Menubar.Content>
        </Menubar.Menu>
        <WindowMenu onDialog={onDialog} />
        <Menubar.Menu>
          <Menubar.Trigger>{t('menu.help')}</Menubar.Trigger>
          <Menubar.Content>
            <Menubar.Item
              onSelect={() => {
                window.open(LINKS.docs);
              }}
            >
              {t('menu.documentation')}
            </Menubar.Item>
            <Menubar.Item
              onSelect={() => {
                onDialog('shortcuts');
              }}
            >
              {t('menu.shortcuts')}
            </Menubar.Item>
            <Menubar.Item
              onSelect={() => {
                window.open(LINKS.issues);
              }}
            >
              {t('menu.reportIssue')}
            </Menubar.Item>
            <Menubar.Separator />
            <Menubar.Item
              onSelect={() => {
                onDialog('about');
              }}
            >
              {t('menu.about')}
            </Menubar.Item>
          </Menubar.Content>
        </Menubar.Menu>
      </Menubar.Root>
      {project ? (
        <>
          <span className={styles['divider']} aria-hidden="true" />
          <WorkspaceTabs />
        </>
      ) : null}
    </div>
  );
}
