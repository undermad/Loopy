import type { ReactNode } from 'react';
import type { EditCommand } from '@shared/ipc';
import { useTranslation } from '@renderer/lib/i18n';
import { ThemeProvider } from '@renderer/lib/theme';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { AppShell } from './components/Shell/AppShell';

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

export function App() {
  return (
    <Providers>
      <AppShell editCommand={(command: EditCommand) => void window.loopy.editCommand(command)} />
    </Providers>
  );
}
