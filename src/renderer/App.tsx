import { useState, type ReactNode } from 'react';
import { Settings } from 'lucide-react';
import { useTranslation } from '@renderer/lib/i18n';
import { ThemeProvider } from '@renderer/lib/theme';
import { Button, ToastProvider, TooltipProvider } from '@renderer/ui';
import { useLanguageSync } from './bootstrap';
import { AppVersion } from './components/AppVersion/AppVersion';
import { PreferencesDialog } from './components/Preferences/PreferencesDialog';
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

function Home() {
  const { t } = useTranslation('common');
  const { t: ts } = useTranslation('settings');
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  useLanguageSync();

  return (
    <main className={styles['app']}>
      <h1 className={styles['title']}>{t('app.name')}</h1>
      <p className={styles['subtitle']}>{t('app.tagline')}</p>
      <div className={styles['actions']}>
        <AppVersion />
        <Button
          icon={<Settings aria-hidden="true" />}
          onClick={() => {
            setPreferencesOpen(true);
          }}
        >
          {ts('title')}
        </Button>
      </div>
      <PreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen} />
    </main>
  );
}

export function App() {
  return (
    <Providers>
      <Home />
    </Providers>
  );
}
