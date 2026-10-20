import { createElement, type ComponentType, type ReactNode } from 'react';
import type { CardFieldKind, FieldOf } from '@shared/cards';
import styles from '../CardView.module.scss';
import { CheckboxField, ChecklistField, ChoiceField } from './ChoiceFields';
import { LinkField } from './LinkField';
import { ColourField, IconField, ImageField } from './MediaFields';
import { AttributesField, DiceField, FormulaField, NumberKindField } from './NumberFields';
import { DateField, TextKindField } from './TextFields';
import type { FieldViewProps } from './inputs';

function SeparatorField({ field }: FieldViewProps<FieldOf<'separator'>>) {
  return (
    <div data-spacer="" className={styles['separator']} style={{ height: `${String(field.size)}px` }}>
      {field.line ? <hr className={styles['divider']} /> : null}
    </div>
  );
}

type FieldViews = { [K in CardFieldKind]: ComponentType<FieldViewProps<FieldOf<K>>> };

const FIELD_VIEWS: FieldViews = {
  text: TextKindField,
  date: DateField,
  number: NumberKindField,
  attributes: AttributesField,
  formula: FormulaField,
  dice: DiceField,
  choice: ChoiceField,
  checkbox: CheckboxField,
  checklist: ChecklistField,
  image: ImageField,
  icon: IconField,
  colour: ColourField,
  link: LinkField,
  separator: SeparatorField,
};

export function renderFieldView(props: FieldViewProps): ReactNode {
  return createElement(FIELD_VIEWS[props.field.kind] as ComponentType<FieldViewProps>, props);
}

export type { FieldViewProps } from './inputs';
