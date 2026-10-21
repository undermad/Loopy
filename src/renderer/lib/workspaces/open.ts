import type { WorkspaceTemplate } from '@shared/layout-presets';
import type { TicketLink } from '@shared/tickets';
import { collectAreas, patchAreaState, setAreaEditor, splitArea } from '@renderer/lib/layout';
import { useTranslation } from '@renderer/lib/i18n';
import { addWorkspace, setActiveWorkspace, updateWorkspace, workspacesStore } from './store';

export interface OpenTarget {
  editor: string;
  alternates?: string[];
  state: Record<string, unknown>;
  template: WorkspaceTemplate['id'];
  workspaceName: string;
}

export type WorkspaceNames = Record<
  'planning' | 'design' | 'palette' | 'assets' | 'ideas' | 'cards' | 'tables',
  string
>;

export const noteAlternates = ['noteSplit'];

export function openInEditor(target: OpenTarget): string {
  const { workspaces, activeId } = workspacesStore.getState();
  const accepts = (editor: string) => editor === target.editor || !!target.alternates?.includes(editor);
  const ordered = [...workspaces].sort((a, b) => Number(b.id === activeId) - Number(a.id === activeId));
  for (const workspace of ordered) {
    const area = collectAreas(workspace.root).find((candidate) => accepts(candidate.editor));
    if (!area) continue;
    if (workspace.id !== activeId) setActiveWorkspace(workspace.id);
    updateWorkspace(workspace.id, (current) => ({
      ...current,
      root: patchAreaState(current.root, area.id, target.state),
    }));
    return area.id;
  }
  const home =
    workspaces.find((workspace) => workspace.name === target.workspaceName) ??
    addWorkspace(target.template, target.workspaceName);
  setActiveWorkspace(home.id);
  const areas = collectAreas(home.root);
  const existing = areas.find((area) => accepts(area.editor));
  if (existing) {
    updateWorkspace(home.id, (current) => ({
      ...current,
      root: patchAreaState(current.root, existing.id, target.state),
    }));
    return existing.id;
  }
  const empty = areas.find((area) => area.editor === 'empty');
  let areaId = empty?.id ?? '';
  updateWorkspace(home.id, (current) => {
    if (empty)
      return { ...current, root: setAreaEditor(current.root, empty.id, target.editor, target.state) };
    const anchor = collectAreas(current.root)[0];
    if (!anchor) return current;
    const result = splitArea(current.root, anchor.id, 'row', 0.5, target.editor);
    areaId = result.newAreaId;
    const { maximisedAreaId: _ignored, ...rest } = current;
    return { ...rest, root: patchAreaState(result.root, areaId, target.state) };
  });
  return areaId;
}

export function linkTarget(link: TicketLink, names: WorkspaceNames): OpenTarget {
  switch (link.kind) {
    case 'board':
      return {
        editor: 'board',
        state: { boardId: link.id },
        template: 'design',
        workspaceName: names.design,
      };
    case 'palette':
      return {
        editor: 'colours',
        state: { paletteId: link.id, clusterId: null, tab: 'wheel' },
        template: 'palette',
        workspaceName: names.palette,
      };
    case 'asset':
      return {
        editor: 'assets',
        state: { scope: 'files', selectedId: link.id, details: true, search: '' },
        template: 'assets',
        workspaceName: names.assets,
      };
    case 'note':
      return {
        editor: 'note',
        alternates: [...noteAlternates],
        state: { noteId: link.id },
        template: 'ideas',
        workspaceName: names.ideas,
      };
    case 'card':
      return cardTarget({ kind: 'card', id: link.id }, names);
    case 'table':
      return tableTarget(link.id, names);
  }
}

export type CardTarget =
  { kind: 'template' | 'card'; id: string } | { kind: 'item'; id: string; boardId: string };

export function cardTarget(target: CardTarget | null, names: WorkspaceNames): OpenTarget {
  return {
    editor: 'cardDesigner',
    state: { target },
    template: 'cards',
    workspaceName: names.cards,
  };
}

export function tableTarget(tableId: string | null, names: WorkspaceNames): OpenTarget {
  return {
    editor: 'table',
    state: { tableId },
    template: 'tables',
    workspaceName: names.tables,
  };
}

export function openLinked(link: TicketLink, names: WorkspaceNames): string {
  return openInEditor(linkTarget(link, names));
}

export function useWorkspaceNames(): WorkspaceNames {
  const { t } = useTranslation('shell');
  return {
    planning: t('layout.presets.planning'),
    design: t('layout.presets.design'),
    palette: t('layout.presets.palette'),
    assets: t('layout.presets.assets'),
    ideas: t('layout.presets.ideas'),
    cards: t('layout.presets.cards'),
    tables: t('layout.presets.tables'),
  };
}
