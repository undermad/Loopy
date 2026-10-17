import { useState, type ReactNode } from 'react';
import { Settings, X } from 'lucide-react';
import { useTranslation } from '@renderer/lib/i18n';
import { closeProject, useCurrentProject } from '@renderer/lib/project';
import { ThemeProvider } from '@renderer/lib/theme';
import { Button, IconButton, ToastProvider, TooltipProvider } from '@renderer/ui';
import { useLanguageSync } from './bootstrap';
import { AppVersion } from './components/AppVersion/AppVersion';
import { PreferencesDialog } from './components/Preferences/PreferencesDialog';
import { WelcomeScreen } from './components/Welcome/WelcomeScreen';
import styles from './App.module.scss';

function Providers({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common');
  return (
    <ThemeProvider>
      <TooltipProvider>
        <ToastProvider closeLabel={t('actions.dismiss')} regionLabel={t('labels.notifications')}>
          {children}
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

function Frame() {
  const { t } = useTranslation('shell');
  const { t: ts } = useTranslation('settings');
  const project = useCurrentProject();
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  useLanguageSync();

  return (
    <div className={styles['frame']}>
      <header className={styles['bar']}>
        <span className={styles['status']}>
          {project ? t('status.project', { name: project.name }) : t('status.noProject')}
        </span>
        <span className={styles['spacer']} />
        {project ? (
          <IconButton label={t('menu.closeProject')} size="sm" onClick={() => void closeProject()}>
            <X aria-hidden="true" />
          </IconButton>
        ) : null}
        <IconButton
          label={ts('open')}
          size="sm"
          onClick={() => {
            setPreferencesOpen(true);
          }}
        >
          <Settings aria-hidden="true" />
        </IconButton>
        <AppVersion />
      </header>
      <main className={styles['main']}>
        {project ? (
          <div className={styles['placeholder']}>
            <h1 className={styles['title']}>{project.name}</h1>
            <Button onClick={() => void closeProject()}>{t('menu.closeProject')}</Button>
          </div>
        ) : (
          <WelcomeScreen />
        )}
      </main>
      <PreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen} />
    </div>
  );
}

export function App() {
  return (
    <Providers>
      <Frame />
    </Providers>
  );
}
