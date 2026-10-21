import {
  Brush,
  Columns2,
  FolderOpen,
  IdCard,
  KanbanSquare,
  Layers,
  LayoutTemplate,
  Library,
  Link2,
  Network,
  NotebookPen,
  NotebookTabs,
  Palette,
  PenTool,
  Sheet,
  SlidersHorizontal,
  Table2,
  Ticket,
} from 'lucide-react';
import { registerEditor } from '@renderer/lib/editors';
import { AssetsEditor } from './Assets/AssetsEditor';
import { BoardEditor } from './Board/BoardEditor';
import { BrushesEditor } from './Brushes/BrushesEditor';
import { CardDesigner } from './Cards/CardDesigner';
import { CardLibrary } from './Cards/CardLibrary';
import { ColoursEditor } from './Colours/ColoursEditor';
import { EmptyEditor } from './EmptyEditor';
import { LayersEditor } from './Layers/LayersEditor';
import { GraphView } from './Notes/GraphView';
import { NoteDetails } from './Notes/NoteDetails';
import { NoteEditor } from './Notes/NoteEditor';
import { NotesExplorer } from './Notes/NotesExplorer';
import { SplitNoteEditor } from './Notes/SplitNoteEditor';
import { PropertiesEditor } from './Properties/PropertiesEditor';
import { TableEditor } from './Tables/TableEditor';
import { TableLibrary } from './Tables/TableLibrary';
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
    category: 'design',
  });
  registerEditor({
    id: 'layers',
    titleKey: 'types.layers',
    icon: Layers,
    component: LayersEditor,
    category: 'design',
  });
  registerEditor({
    id: 'brushes',
    titleKey: 'types.brushes',
    icon: Brush,
    component: BrushesEditor,
    category: 'design',
    defaultState: () => ({ tool: 'brush' }),
  });
  registerEditor({
    id: 'colours',
    titleKey: 'types.colours',
    icon: Palette,
    component: ColoursEditor,
    category: 'palette',
    defaultState: () => ({ tab: 'wheel' }),
  });
  registerEditor({
    id: 'assets',
    titleKey: 'types.assets',
    icon: FolderOpen,
    component: AssetsEditor,
    category: 'assets',
    defaultState: () => ({ view: 'folders', search: '' }),
  });
  registerEditor({
    id: 'board',
    titleKey: 'types.board',
    icon: PenTool,
    component: BoardEditor,
    category: 'design',
    defaultState: () => ({}),
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
    id: 'notes',
    titleKey: 'types.notes',
    icon: NotebookTabs,
    component: NotesExplorer,
    category: 'ideas',
    defaultState: () => ({ search: '' }),
  });
  registerEditor({
    id: 'note',
    titleKey: 'types.note',
    icon: NotebookPen,
    component: NoteEditor,
    category: 'ideas',
    defaultState: () => ({ mode: 'live' }),
  });
  registerEditor({
    id: 'noteSplit',
    titleKey: 'types.noteSplit',
    icon: Columns2,
    component: SplitNoteEditor,
    category: 'ideas',
    defaultState: () => ({ view: 'split', ratio: 0.5 }),
  });
  registerEditor({
    id: 'graph',
    titleKey: 'types.graph',
    icon: Network,
    component: GraphView,
    category: 'ideas',
    defaultState: () => ({ scope: 'global' }),
  });
  registerEditor({
    id: 'backlinks',
    titleKey: 'types.backlinks',
    icon: Link2,
    component: NoteDetails,
    category: 'ideas',
    defaultState: () => ({ tab: 'links' }),
  });
  registerEditor({
    id: 'ticket',
    titleKey: 'types.ticket',
    icon: Ticket,
    component: TicketEditor,
    category: 'planning',
  });
  registerEditor({
    id: 'cardLibrary',
    titleKey: 'types.cardLibrary',
    icon: Library,
    component: CardLibrary,
    category: 'cards',
  });
  registerEditor({
    id: 'cardDesigner',
    titleKey: 'types.cardDesigner',
    icon: IdCard,
    component: CardDesigner,
    category: 'cards',
    defaultState: () => ({ target: null }),
  });
  registerEditor({
    id: 'tableLibrary',
    titleKey: 'tables:types.tableLibrary',
    icon: Table2,
    component: TableLibrary,
    category: 'tables',
    defaultState: () => ({ search: '' }),
  });
  registerEditor({
    id: 'table',
    titleKey: 'tables:types.table',
    icon: Sheet,
    component: TableEditor,
    category: 'tables',
    defaultState: () => ({ tableId: null }),
  });
}
