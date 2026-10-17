import { KanbanSquare, LayoutTemplate, Palette, PenTool, SlidersHorizontal, Ticket } from 'lucide-react';
import { registerEditor } from '@renderer/lib/editors';
import { BoardEditor } from './Board/BoardEditor';
import { ColoursEditor } from './ColoursEditor';
import { EmptyEditor } from './EmptyEditor';
import { PropertiesEditor } from './PropertiesEditor';
import { TicketEditor } from './Tickets/TicketEditor';
import { TicketsEditor } from './Tickets/TicketsEditor';

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
    component: BoardEditor,
    category: 'design',
    defaultState: () => ({ grid: true, minimap: false }),
  });
  registerEditor({
    id: 'tickets',
    titleKey: 'types.tickets',
    icon: KanbanSquare,
    component: TicketsEditor,
    category: 'planning',
    defaultState: () => ({ mode: 'board', search: '' }),
  });
  registerEditor({
    id: 'ticket',
    titleKey: 'types.ticket',
    icon: Ticket,
    component: TicketEditor,
    category: 'planning',
  });
}
