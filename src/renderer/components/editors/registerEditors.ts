import { KanbanSquare, LayoutTemplate, Palette, PenTool, SlidersHorizontal, Ticket } from 'lucide-react';
import { registerEditor } from '@renderer/lib/editors';
import { ColoursEditor } from './ColoursEditor';
import { EmptyEditor } from './EmptyEditor';
import { createPlaceholderEditor } from './PlaceholderEditor';
import { PropertiesEditor } from './PropertiesEditor';

export function registerEditors(): void {
  registerEditor({
    id: 'empty',
    titleKey: 'types.empty',
    icon: LayoutTemplate,
    component: EmptyEditor,
    category: 'general',
  });
  registerEditor({
    id: 'properties',
    titleKey: 'types.properties',
    icon: SlidersHorizontal,
    component: PropertiesEditor,
    category: 'general',
  });
  registerEditor({
    id: 'colours',
    titleKey: 'types.colours',
    icon: Palette,
    component: ColoursEditor,
    category: 'design',
  });
  registerEditor({
    id: 'board',
    titleKey: 'types.board',
    icon: PenTool,
    component: createPlaceholderEditor('types.board', PenTool),
    category: 'design',
  });
  registerEditor({
    id: 'tickets',
    titleKey: 'types.tickets',
    icon: KanbanSquare,
    component: createPlaceholderEditor('types.tickets', KanbanSquare),
    category: 'planning',
  });
  registerEditor({
    id: 'ticket',
    titleKey: 'types.ticket',
    icon: Ticket,
    component: createPlaceholderEditor('types.ticket', Ticket),
    category: 'planning',
  });
}
