import { useState } from 'react';
import { Plus, Tags } from 'lucide-react';
import { STATE_COLORS, type Label } from '@shared/tickets';
import { useTranslation } from '@renderer/lib/i18n';
import { labelActions, ticketActions, useTicketsSnapshot } from '@renderer/lib/tickets';
import { Button, ColorPicker, Input, Popover, Switch, Tag } from '@renderer/ui';
import styles from './LabelPicker.module.scss';

export function LabelPicker({ ticketId, selected }: { ticketId: string; selected: Label[] }) {
  const { t } = useTranslation('editors');
  const snapshot = useTicketsSnapshot();
  const [name, setName] = useState('');
  const [color, setColor] = useState(STATE_COLORS[4] ?? '#9333ea');
  const selectedIds = new Set(selected.map((label) => label.id));

  function toggle(label: Label, checked: boolean) {
    const next = checked ? [...selectedIds, label.id] : [...selectedIds].filter((id) => id !== label.id);
    void ticketActions.setLabels(ticketId, next);
  }

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const result = await labelActions.create({ name: trimmed, color });
    const created = result.labels.find((label) => label.name === trimmed);
    if (created) await ticketActions.setLabels(ticketId, [...selectedIds, created.id]);
    setName('');
  }

  return (
    <div className={styles['picker']}>
      {selected.map((label) => (
        <Tag key={label.id} color={label.color}>
          {label.name}
        </Tag>
      ))}
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button size="sm" variant="ghost" icon={<Tags aria-hidden="true" />}>
            {t('ticket.addLabel')}
          </Button>
        </Popover.Trigger>
        <Popover.Content align="start">
          {snapshot.labels.map((label) => (
            <Switch
              key={label.id}
              size="sm"
              label={
                <Tag color={label.color} size="sm">
                  {label.name}
                </Tag>
              }
              checked={selectedIds.has(label.id)}
              onCheckedChange={(checked) => {
                toggle(label, checked);
              }}
            />
          ))}
          <form
            className={styles['create']}
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
          >
            <ColorPicker size="sm" value={color} onChange={setColor} label={t('ticket.labelName')} />
            <Input
              size="sm"
              value={name}
              placeholder={t('ticket.newLabel')}
              aria-label={t('ticket.labelName')}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
            <Button
              type="submit"
              size="sm"
              variant="primary"
              disabled={!name.trim()}
              icon={<Plus aria-hidden="true" />}
            >
              {t('ticket.addLabel')}
            </Button>
          </form>
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}
