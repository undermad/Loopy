import type { EditCommand } from '@shared/ipc';
import { runEditCommand } from '@renderer/lib/commands';
import { useTranslation } from '@renderer/lib/i18n';
import {
  closeProject,
  openProject,
  openRecentProject,
  quitApp,
  startCreatingProject,
  useCurrentProject,
  useRecentProjects,
} from '@renderer/lib/project';
import { describeKeys, keymap } from '@renderer/lib/shortcuts';
import { Menubar, useToast } from '@renderer/ui';
import type { OpenProjectResult } from '@shared/ipc';
import { LINKS } from './links';
import { WindowMenu } from './WindowMenu';
import { useSaveCommands } from './useSaveCommands';
import { WorkspaceTabs } from './WorkspaceTabs';
import styles from './MenuBar.module.scss';

export type ShellDialog = 'preferences' | 'projectSettings' | 'saveLayout' | 'shortcuts' | 'about';

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
  const { t: tw } = useTranslation('welcome');
  const toast = useToast();
  const project = useCurrentProject();
  const recent = useRecentProjects();
  const { save, saveAs } = useSaveCommands();

  async function report(pending: Promise<OpenProjectResult>) {
    const result = await pending;
    if (result.status === 'failed')
      toast.show({ title: tw('openFailed'), description: result.code, variant: 'danger' });
  }

  return (
    <div className={styles['bar']}>
      <Menubar.Root>
        <Menubar.Menu>
          <Menubar.Trigger>{t('menu.file')}</Menubar.Trigger>
          <Menubar.Content>
            <Menubar.Item onSelect={startCreatingProject}>
              {t('menu.newProject')}
              <MenuShortcut id="newProject" />
            </Menubar.Item>
            <Menubar.Item onSelect={() => void report(openProject())}>{t('menu.openProject')}</Menubar.Item>
            <Menubar.Sub>
              <Menubar.SubTrigger disabled={recent.length === 0}>{t('menu.openRecent')}</Menubar.SubTrigger>
              <Menubar.SubContent>
                {recent.map((entry) => (
                  <Menubar.Item
                    key={entry.path}
                    disabled={entry.missing}
                    title={entry.path}
                    onSelect={() => void report(openRecentProject(entry.path))}
                  >
                    {entry.name}
                  </Menubar.Item>
                ))}
              </Menubar.SubContent>
            </Menubar.Sub>
            <Menubar.Separator />
            <Menubar.Item disabled={!project} onSelect={() => void save()}>
              {t('menu.save')}
              <MenuShortcut id="save" />
            </Menubar.Item>
            <Menubar.Item disabled={!project} onSelect={() => void saveAs()}>
              {t('menu.saveAs')}
              <MenuShortcut id="saveAs" />
            </Menubar.Item>
            <Menubar.Item
              disabled={!project}
              onSelect={() => {
                onDialog('projectSettings');
              }}
            >
              {t('menu.projectSettings')}
            </Menubar.Item>
            <Menubar.Separator />
            <Menubar.Item disabled={!project} onSelect={() => void closeProject()}>
              {t('menu.closeProject')}
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
            <Menubar.Item onSelect={() => void quitApp()}>{t('menu.quit')}</Menubar.Item>
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
                    if (!runEditCommand(command)) editCommand(command);
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
