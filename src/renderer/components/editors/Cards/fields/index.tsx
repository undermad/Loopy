import { createElement, type ComponentType, type ReactNode } from 'react';
import type { CardFieldKind, FieldOf } from '@shared/cards';
import styles from '../CardView.module.scss';
import { CheckboxField, ChecklistField, MultiSelectField, SelectField, TagsField } from './ChoiceFields';
import { LinkField } from './LinkField';
import { ColourField, IconField, ImageField } from './MediaFields';
import {
  AttributesField,
  DiceField,
  FormulaField,
  NumberKindField,
  RangeField,
  RatingField,
  StatField,
} from './NumberFields';
import { DateField, StaticTextField, TextKindField } from './TextFields';
import type { FieldViewProps } from './inputs';

function DividerField() {
  return <hr className={styles['divider']} />;
}

function SpacerField({ field }: FieldViewProps<FieldOf<'spacer'>>) {
  return <div data-spacer="" style={{ height: `${String(field.size)}px` }} />;
}

type FieldViews = { [K in CardFieldKind]: ComponentType<FieldViewProps<FieldOf<K>>> };

const FIELD_VIEWS: FieldViews = {
  heading: TextKindField,
  text: TextKindField,
  longText: TextKindField,
  staticText: StaticTextField,
  date: DateField,
  number: NumberKindField,
  stat: StatField,
  rating: RatingField,
  range: RangeField,
  attributes: AttributesField,
  formula: FormulaField,
  dice: DiceField,
  select: SelectField,
  multiSelect: MultiSelectField,
  checkbox: CheckboxField,
  tags: TagsField,
  checklist: ChecklistField,
  image: ImageField,
  icon: IconField,
  colour: ColourField,
  link: LinkField,
  divider: DividerField,
  spacer: SpacerField,
};

export function renderFieldView(props: FieldViewProps): ReactNode {
  return createElement(FIELD_VIEWS[props.field.kind] as ComponentType<FieldViewProps>, props);
}

export type { FieldViewProps } from './inputs';
