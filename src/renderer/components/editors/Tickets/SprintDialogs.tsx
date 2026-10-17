import { useState } from 'react';
import type { Sprint } from '@shared/tickets';
import { useTranslation } from '@renderer/lib/i18n';
import { openSprints, sprintActions, useTicketsSnapshot } from '@renderer/lib/tickets';
import { Button, Dialog, Field, Input, Select, TextArea } from '@renderer/ui';
import styles from './SprintDialogs.module.scss';

export function SprintDialog({
  sprint,
  onOpenChange,
}: {
  sprint: Sprint;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('editors');
  const { t: tc } = useTranslation('common');
  const [name, setName] = useState(sprint.name);
  const [goal, setGoal] = useState(sprint.goal);
  const valid = name.trim().length > 0;

  async function save() {
    if (!valid) return;
    await sprintActions.update(sprint.id, { name: name.trim(), goal: goal.trim() });
    onOpenChange(false);
  }

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Content title={t('tickets.editSprint')} closeLabel={tc('actions.close')}>
        <form
          className={styles['form']}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Field label={t('tickets.sprintName')} required>
            <Input
              value={name}
              autoFocus
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </Field>
          <Field label={t('tickets.sprintGoal')}>
            <TextArea
              rows={3}
              value={goal}
              onChange={(event) => {
                setGoal(event.target.value);
              }}
            />
          </Field>
          <Dialog.Footer>
            <Dialog.Close asChild>
              <Button variant="ghost">{tc('actions.cancel')}</Button>
            </Dialog.Close>
            <Button type="submit" variant="primary" disabled={!valid}>
              {tc('actions.save')}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

export function CompleteSprintDialog({
  sprint,
  openCount,
  onOpenChange,
}: {
  sprint: Sprint;
  openCount: number;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('editors');
  const { t: tc } = useTranslation('common');
  const snapshot = useTicketsSnapshot();
  const targets = openSprints(snapshot).filter((candidate) => candidate.status === 'planned');
  const [moveTo, setMoveTo] = useState('backlog');

  async function complete() {
    await sprintActions.complete(sprint.id, moveTo === 'backlog' ? null : moveTo);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Content
        title={t('tickets.completeSprintTitle', { name: sprint.name })}
        description={t('tickets.completeSprintHint', { count: openCount })}
        closeLabel={tc('actions.close')}
      >
        <div className={styles['form']}>
          <Field label={t('tickets.unfinishedMoveTo')}>
            <Select
              value={moveTo}
              onValueChange={setMoveTo}
              aria-label={t('tickets.unfinishedMoveTo')}
              options={[
                { value: 'backlog', label: t('tickets.moveToBacklog') },
                ...targets.map((candidate) => ({ value: candidate.id, label: candidate.name })),
              ]}
            />
          </Field>
          <Dialog.Footer>
            <Dialog.Close asChild>
              <Button variant="ghost">{tc('actions.cancel')}</Button>
            </Dialog.Close>
            <Button variant="primary" onClick={() => void complete()}>
              {t('tickets.completeSprint')}
            </Button>
          </Dialog.Footer>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
