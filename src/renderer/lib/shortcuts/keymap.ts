export interface Shortcut {
  id: string;
  keys: string;
  labelKey: string;
}

export type ShortcutId =
  | 'newProject'
  | 'preferences'
  | 'nextWorkspace'
  | 'previousWorkspace'
  | 'maximiseArea'
  | 'fullscreen'
  | 'quickSwitcher';

export const keymap: Record<ShortcutId, Shortcut> = {
  newProject: { id: 'newProject', keys: '$mod+N', labelKey: 'menu.newProject' },
  preferences: { id: 'preferences', keys: '$mod+Comma', labelKey: 'menu.preferences' },
  nextWorkspace: { id: 'nextWorkspace', keys: '$mod+PageDown', labelKey: 'workspace.next' },
  previousWorkspace: { id: 'previousWorkspace', keys: '$mod+PageUp', labelKey: 'workspace.previous' },
  maximiseArea: { id: 'maximiseArea', keys: '$mod+Space', labelKey: 'area.maximise' },
  fullscreen: { id: 'fullscreen', keys: 'F11', labelKey: 'menu.toggleFullscreen' },
  quickSwitcher: { id: 'quickSwitcher', keys: '$mod+O', labelKey: 'menu.quickSwitcher' },
};

export const SHORTCUT_IDS = Object.keys(keymap) as ShortcutId[];

export function describeKeys(keys: string, platform = navigator.platform): string {
  const mod = /mac/i.test(platform) ? '⌘' : 'Ctrl';
  return keys.replace('$mod', mod).replace('Comma', ',').replaceAll('+', ' + ');
}
