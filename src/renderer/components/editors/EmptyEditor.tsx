import { LayoutTemplate } from 'lucide-react';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import { EmptyState } from '@renderer/ui';

export function EmptyEditor(_props: EditorProps) {
  const { t } = useTranslation('editors');
  return <EmptyState icon={<LayoutTemplate />} title={t('empty.title')} description={t('empty.hint')} />;
}
