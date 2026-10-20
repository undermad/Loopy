import { createElement, useId } from 'react';
import { Plus } from 'lucide-react';
import { fieldPresetsByGroup, type FieldPresetId } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, DropdownMenu } from '@renderer/ui';
import { FIELD_ICONS } from './fieldIcons';
import styles from './CardDesigner.module.scss';

export function FieldPicker({ label, onPick }: { label: string; onPick: (preset: FieldPresetId) => void }) {
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
        {fieldPresetsByGroup().map(({ group, presets }, index) => (
          <DropdownMenu.Group key={group} aria-labelledby={`${id}-${group}`}>
            {index > 0 ? <DropdownMenu.Separator /> : null}
            <DropdownMenu.Label id={`${id}-${group}`}>{t(`cards.groups.${group}`)}</DropdownMenu.Label>
            {presets.map(({ id: preset }) => (
              <DropdownMenu.Item
                key={preset}
                onSelect={() => {
                  onPick(preset);
                }}
              >
                {createElement(FIELD_ICONS[preset], { 'aria-hidden': true, className: styles['pickerIcon'] })}
                {t(`cards.presets.${preset}`)}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Group>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
