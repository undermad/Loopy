import { Palette } from 'lucide-react';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import { EmptyState } from '@renderer/ui';

export function ColoursEditor(_props: EditorProps) {
  const { t } = useTranslation('editors');
  return <EmptyState icon={<Palette />} title={t('types.colours')} description={t('colours.soon')} />;
}
