import type { LucideIcon } from 'lucide-react';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import { EmptyState } from '@renderer/ui';

export function createPlaceholderEditor(titleKey: string, Icon: LucideIcon) {
  return function PlaceholderEditor(_props: EditorProps) {
    const { t } = useTranslation('editors');
    return (
      <EmptyState
        icon={<Icon />}
        title={t('placeholder.title', { editor: t(titleKey as 'types.board') })}
        description={t('placeholder.hint')}
      />
    );
  };
}
