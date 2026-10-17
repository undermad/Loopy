import { useLayoutEffect, type ReactNode } from 'react';
import { useSettings } from '@renderer/lib/settings';
import { applyTheme, applyTypography } from './apply';
import { useActiveTheme } from './hooks';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useActiveTheme();
  const { uiFont, fontSize } = useSettings();

  useLayoutEffect(() => {
    applyTheme(document.documentElement, theme);
  }, [theme]);

  useLayoutEffect(() => {
    applyTypography(document.documentElement, { uiFont, fontSize });
  }, [uiFont, fontSize]);

  return children;
}
