import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CARD_MAX_OPTIONS, type ChoiceOption } from '@shared/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, IconButton, Input } from '@renderer/ui';
import { ProjectColourPicker } from '../../../ProjectColourPicker/ProjectColourPicker';
import styles from '../CardDesigner.module.scss';

function OptionRow({
  option,
  index,
  taken,
  onChange,
  onRemove,
}: {
  option: ChoiceOption;
  index: number;
  taken: string[];
  onChange: (next: ChoiceOption) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('editors');
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <li className={styles['option']}>
      <ProjectColourPicker
        size="sm"
        value={option.colour ?? { hex: '#94a3b8', ref: null }}
        label={t('cards.choiceColour', { name: option.value })}
        onChange={(colour) => {
          onChange({ ...option, colour });
        }}
      />
      <Input
        size="sm"
        aria-label={t('cards.choice', { number: index + 1 })}
        value={draft ?? option.value}
        maxLength={40}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={() => {
          const value = draft?.trim() ?? '';
          if (draft !== null && value !== '' && value !== option.value && !taken.includes(value)) {
            onChange({ ...option, value });
          }
          setDraft(null);
        }}
      />
      <IconButton
        size="sm"
        tooltip={false}
        label={t('cards.removeChoice', { name: option.value })}
        onClick={onRemove}
      >
        <Trash2 aria-hidden="true" />
      </IconButton>
    </li>
  );
}

export function OptionsEditor({
  options,
  onChange,
}: {
  options: ChoiceOption[];
  onChange: (next: ChoiceOption[]) => void;
}) {
  const { t } = useTranslation('editors');
  const values = options.map((option) => option.value);
  const add = () => {
    let number = options.length + 1;
    while (values.includes(t('cards.choice', { number }))) number += 1;
    onChange([...options, { value: t('cards.choice', { number }), colour: null }]);
  };
  return (
    <fieldset className={styles['options']}>
      <legend className={styles['heading']}>{t('cards.options')}</legend>
      <ul className={styles['optionList']}>
        {options.map((option, index) => (
          <OptionRow
            key={option.value}
            option={option}
            index={index}
            taken={values}
            onChange={(next) => {
              onChange(options.map((own, at) => (at === index ? next : own)));
            }}
            onRemove={() => {
              onChange(options.filter((_own, at) => at !== index));
            }}
          />
        ))}
      </ul>
      <Button
        size="sm"
        variant="ghost"
        icon={<Plus aria-hidden="true" />}
        disabled={options.length >= CARD_MAX_OPTIONS}
        onClick={add}
      >
        {t('cards.addChoice')}
      </Button>
    </fieldset>
  );
}
