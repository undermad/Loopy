import {
  ChartNoAxesColumn,
  Hash,
  Heading,
  Image,
  Link,
  Minus,
  Palette,
  SquareCheck,
  SquareChevronDown,
  Tags,
  TextQuote,
  Type,
  type LucideIcon,
} from 'lucide-react';
import type { CardFieldKind } from '@shared/cards';

export const FIELD_ICONS: Record<CardFieldKind, LucideIcon> = {
  heading: Heading,
  text: Type,
  longText: TextQuote,
  number: Hash,
  stat: ChartNoAxesColumn,
  select: SquareChevronDown,
  checkbox: SquareCheck,
  tags: Tags,
  image: Image,
  colour: Palette,
  link: Link,
  divider: Minus,
};
