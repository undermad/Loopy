import { keymap } from './keymap';

export interface ShortcutEntry {
  id: string;
  keys: string;
}

export interface ShortcutCategory {
  id: string;
  entries: ShortcutEntry[];
}

const entry = (id: string, keys: string): ShortcutEntry => ({ id, keys });

export const SHORTCUT_CATEGORIES: readonly ShortcutCategory[] = [
  {
    id: 'app',
    entries: [
      entry('newProject', keymap.newProject.keys),
      entry('save', keymap.save.keys),
      entry('saveAs', keymap.saveAs.keys),
      entry('preferences', keymap.preferences.keys),
      entry('fullscreen', keymap.fullscreen.keys),
    ],
  },
  {
    id: 'workspaces',
    entries: [
      entry('nextWorkspace', keymap.nextWorkspace.keys),
      entry('previousWorkspace', keymap.previousWorkspace.keys),
      entry('maximiseArea', keymap.maximiseArea.keys),
    ],
  },
  {
    id: 'notes',
    entries: [
      entry('quickSwitcher', keymap.quickSwitcher.keys),
      entry('noteLink', '[['),
      entry('noteSearch', '$mod+F'),
      entry('noteFollow', '$mod+Click'),
    ],
  },
  {
    id: 'edit',
    entries: [
      entry('undo', '$mod+Z'),
      entry('redo', '$mod+Shift+Z'),
      entry('redoAlt', '$mod+Y'),
      entry('cut', '$mod+X'),
      entry('copy', '$mod+C'),
      entry('paste', '$mod+V'),
      entry('selectAll', '$mod+A'),
      entry('delete', 'Delete'),
    ],
  },
  {
    id: 'boardTools',
    entries: [
      entry('select', 'V'),
      entry('hand', 'H'),
      entry('text', 'T'),
      entry('sticky', 'N'),
      entry('shapes', 'R / O / D'),
      entry('container', 'F'),
      entry('card', 'C'),
      entry('arrow', 'A'),
      entry('quickCreate', 'Space'),
      entry('cancelTool', 'Escape'),
    ],
  },
  {
    id: 'boardItems',
    entries: [
      entry('duplicate', '$mod+D'),
      entry('lock', '$mod+L'),
      entry('copyStyle', '$mod+Alt+C'),
      entry('pasteStyle', '$mod+Alt+V'),
      entry('front', ']'),
      entry('back', '['),
      entry('stepIn', 'Enter'),
      entry('stepOut', 'Escape'),
      entry('deepSelect', '$mod+Click'),
      entry('addSelect', 'Shift+Click'),
      entry('drill', 'Double-click'),
    ],
  },
  {
    id: 'boardArrange',
    entries: [
      entry('alignLeft', 'Alt+A'),
      entry('alignRight', 'Alt+D'),
      entry('alignTop', 'Alt+W'),
      entry('alignBottom', 'Alt+S'),
      entry('alignCentre', 'Alt+H'),
      entry('alignMiddle', 'Alt+V'),
      entry('distributeHorizontal', 'Alt+Shift+H'),
      entry('distributeVertical', 'Alt+Shift+V'),
    ],
  },
  {
    id: 'boardPointer',
    entries: [
      entry('zoom', 'Wheel'),
      entry('pan', 'Middle drag'),
      entry('snapDrag', '$mod+Drag'),
      entry('detachDrag', 'Alt+Drag'),
      entry('keepRatio', 'Shift+Resize'),
      entry('snapRotate', '$mod+Rotate'),
    ],
  },
  {
    id: 'cardDesigner',
    entries: [
      entry('cardMode', '$mod+E'),
      entry('cardSelect', 'Arrow keys'),
      entry('cardMove', 'Alt+Arrow keys'),
      entry('cardWidth', '[ / ]'),
      entry('cardDuplicate', '$mod+D'),
      entry('cardClipboard', '$mod+C / $mod+X / $mod+V'),
      entry('cardAdd', '/'),
      entry('cardRename', 'Enter'),
      entry('cardMultiSelect', 'Shift+Click'),
    ],
  },
  {
    id: 'fields',
    entries: [
      entry('scrub', 'Drag'),
      entry('scrubFine', 'Shift+Drag'),
      entry('scrollToolbar', 'Wheel'),
      entry('panToolbar', 'Middle drag'),
    ],
  },
];
