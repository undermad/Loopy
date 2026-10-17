import { SlidersHorizontal } from 'lucide-react';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import { EmptyState } from '@renderer/ui';

export function PropertiesEditor(_props: EditorProps) {
  const { t } = useTranslation('editors');
  return <EmptyState icon={<SlidersHorizontal />} title={t('properties.nothing')} />;
}
