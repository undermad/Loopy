import { createElement, type ComponentType, type ReactNode } from 'react';
import type { CardFieldKind, FieldOf } from '@shared/cards';
import styles from '../CardView.module.scss';
import { CheckboxField, SelectField, TagsField } from './ChoiceFields';
import { LinkField } from './LinkField';
import { ColourField, ImageField } from './MediaFields';
import { NumberKindField, StatField } from './NumberFields';
import { TextKindField } from './TextFields';
import type { FieldViewProps } from './inputs';

function DividerField() {
  return <hr className={styles['divider']} />;
}

type FieldViews = { [K in CardFieldKind]: ComponentType<FieldViewProps<FieldOf<K>>> };

const FIELD_VIEWS: FieldViews = {
  heading: TextKindField,
  text: TextKindField,
  longText: TextKindField,
  number: NumberKindField,
  stat: StatField,
  select: SelectField,
  checkbox: CheckboxField,
  tags: TagsField,
  image: ImageField,
  colour: ColourField,
  link: LinkField,
  divider: DividerField,
};

export function renderFieldView(props: FieldViewProps): ReactNode {
  return createElement(FIELD_VIEWS[props.field.kind] as ComponentType<FieldViewProps>, props);
}

export type { FieldViewProps } from './inputs';
