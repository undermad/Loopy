import { useState } from 'react';
import type { EditCommand } from '@shared/ipc';
import { findArea } from '@renderer/lib/layout';
import { useTranslation } from '@renderer/lib/i18n';
import {
  startCreatingProject,
  useCreatingProject,
  useCurrentProject,
  useWindowTitle,
} from '@renderer/lib/project';
import { useShortcuts } from '@renderer/lib/shortcuts';
import {
  areaActions,
  cycleWorkspace,
  saveCurrentLayout,
  toggleFullscreen,
  useActiveWorkspace,
  useHoveredAreaId,
  useStatusBarVisible,
} from '@renderer/lib/workspaces';
import { useToast } from '@renderer/ui';
import { useLanguageSync } from '../../bootstrap';
import { PreferencesDialog } from '../Preferences/PreferencesDialog';
import { QuickSwitcher } from '../editors/Notes/QuickSwitcher';
import { WelcomeScreen } from '../Welcome/WelcomeScreen';
import { AboutDialog } from './AboutDialog';
import { AreaTree } from './AreaTree';
import { FileDropCatcher } from './FileDropCatcher';
import { MenuBar, type ShellDialog } from './MenuBar';
import { ProjectSettingsDialog } from './ProjectSettingsDialog';
import { PromptDialog } from './PromptDialog';
import { ShortcutsDialog } from './ShortcutsDialog';
import { StatusBar } from './StatusBar';
import { useSaveCommands } from './useSaveCommands';
import styles from './AppShell.module.scss';

function WorkspaceView() {
  const workspace = useActiveWorkspace();
  if (!workspace) return null;
  const maximised = workspace.maximisedAreaId ? findArea(workspace.root, workspace.maximisedAreaId) : null;
  return (
    <div className={styles['workspace']} key={workspace.id}>
      <AreaTree node={maximised ?? workspace.root} />
    </div>
  );
}

export function AppShell({ editCommand }: { editCommand: (command: EditCommand) => void }) {
  const { t } = useTranslation('shell');
  const toast = useToast();
  const project = useCurrentProject();
  const creating = useCreatingProject();
  const { save, saveAs } = useSaveCommands();
  const statusBar = useStatusBarVisible();
  const hovered = useHoveredAreaId();
  const [dialog, setDialog] = useState<ShellDialog | null>(null);
  const [switcher, setSwitcher] = useState(false);
  useLanguageSync();
  useWindowTitle(t('window.title'));

  useShortcuts({
    newProject: startCreatingProject,
    save: () => void save(),
    saveAs: () => void saveAs(),
    preferences: () => {
      setDialog('preferences');
    },
    nextWorkspace: () => {
      cycleWorkspace(1);
    },
    previousWorkspace: () => {
      cycleWorkspace(-1);
    },
    maximiseArea: () => {
      if (hovered) areaActions.toggleMaximise(hovered);
    },
    fullscreen: () => void toggleFullscreen(),
    quickSwitcher: () => {
      if (project) setSwitcher(true);
    },
  });

  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };

  return (
    <div className={styles['shell']}>
      <MenuBar onDialog={setDialog} editCommand={editCommand} />
      <FileDropCatcher />
      <div className={styles['body']}>{project && !creating ? <WorkspaceView /> : <WelcomeScreen />}</div>
      {statusBar ? <StatusBar /> : null}
      <PreferencesDialog open={dialog === 'preferences'} onOpenChange={close} />
      {dialog === 'projectSettings' && project ? (
        <ProjectSettingsDialog project={project} onOpenChange={close} />
      ) : null}
      <ShortcutsDialog open={dialog === 'shortcuts'} onOpenChange={close} />
      <AboutDialog open={dialog === 'about'} onOpenChange={close} />
      {project ? <QuickSwitcher open={switcher} onOpenChange={setSwitcher} /> : null}
      {dialog === 'saveLayout' ? (
        <PromptDialog
          open
          onOpenChange={close}
          title={t('layout.saveTitle')}
          label={t('layout.name')}
          submitLabel={t('menu.saveLayout')}
          onSubmit={async (name) => {
            const saved = await saveCurrentLayout(name);
            toast.show({ title: t('layout.saved', { name: saved.name }), variant: 'success' });
          }}
        />
      ) : null}
    </div>
  );
}
