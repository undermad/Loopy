import { createElement, useId } from 'react';
import { Plus } from 'lucide-react';
import type { CardFieldKind } from '@shared/cards';
import { fieldKindsByGroup } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, DropdownMenu } from '@renderer/ui';
import { FIELD_ICONS } from './fieldIcons';
import styles from './CardDesigner.module.scss';

export function FieldPicker({ label, onPick }: { label: string; onPick: (kind: CardFieldKind) => void }) {
  const { t } = useTranslation('editors');
  const id = useId();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button size="sm" icon={<Plus aria-hidden="true" />}>
          {label}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className={styles['picker']}>
        {fieldKindsByGroup().map(({ group, kinds }, index) => (
          <DropdownMenu.Group key={group} aria-labelledby={`${id}-${group}`}>
            {index > 0 ? <DropdownMenu.Separator /> : null}
            <DropdownMenu.Label id={`${id}-${group}`}>{t(`cards.groups.${group}`)}</DropdownMenu.Label>
            {kinds.map((kind) => (
              <DropdownMenu.Item
                key={kind}
                onSelect={() => {
                  onPick(kind);
                }}
              >
                {createElement(FIELD_ICONS[kind], { 'aria-hidden': true, className: styles['pickerIcon'] })}
                {t(`cards.kinds.${kind}`)}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Group>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
