import { createElement, useId, type ReactNode } from 'react';
import { LayoutGrid, Plus } from 'lucide-react';
import { FIELD_BLOCKS, fieldPresetsByGroup, type FieldPresetId } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, DropdownMenu } from '@renderer/ui';
import { FIELD_ICONS } from './fieldIcons';
import styles from './CardDesigner.module.scss';

export type FieldBlockId = (typeof FIELD_BLOCKS)[number]['id'];

export interface FieldPickerProps {
  label: string;
  onPick: (preset: FieldPresetId) => void;
  onPickBlock?: (block: FieldBlockId) => void;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function FieldPicker({ label, onPick, onPickBlock, trigger, open, onOpenChange }: FieldPickerProps) {
  const { t } = useTranslation('editors');
  const id = useId();
  return (
    <DropdownMenu.Root {...(open === undefined ? {} : { open })} {...(onOpenChange ? { onOpenChange } : {})}>
      <DropdownMenu.Trigger asChild>
        {trigger ?? (
          <Button size="sm" icon={<Plus aria-hidden="true" />}>
            {label}
          </Button>
        )}
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
        {onPickBlock ? (
          <DropdownMenu.Group aria-labelledby={`${id}-blocks`}>
            <DropdownMenu.Separator />
            <DropdownMenu.Label id={`${id}-blocks`}>{t('cards.groups.blocks')}</DropdownMenu.Label>
            {FIELD_BLOCKS.map((block) => (
              <DropdownMenu.Item
                key={block.id}
                onSelect={() => {
                  onPickBlock(block.id);
                }}
              >
                <LayoutGrid aria-hidden="true" className={styles['pickerIcon']} />
                {t(`cards.blocks.${block.id}`)}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Group>
        ) : null}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
