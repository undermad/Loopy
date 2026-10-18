import {
  LAYOUT_SCHEMA_VERSION,
  type AreaNode,
  type LayoutNode,
  type LayoutPreset,
  type Workspace,
} from './layout';

export interface WorkspaceTemplate {
  id: 'planning' | 'design' | 'palette' | 'assets' | 'ideas' | 'empty';
  build: () => LayoutNode;
}

function area(editor: string, state: Record<string, unknown> = {}): AreaNode {
  return { kind: 'area', id: crypto.randomUUID(), editor, state };
}

function split(direction: 'row' | 'column', children: LayoutNode[], sizes: number[]): LayoutNode {
  return { kind: 'split', id: crypto.randomUUID(), direction, children, sizes };
}

export const workspaceTemplates: readonly WorkspaceTemplate[] = [
  { id: 'planning', build: () => split('row', [area('tickets'), area('ticket')], [0.7, 0.3]) },
  {
    id: 'design',
    build: () =>
      split(
        'row',
        [
          area('assets', { view: 'folders', search: '' }),
          area('board'),
          split('column', [area('properties'), area('layers')], [0.6, 0.4]),
        ],
        [0.24, 0.54, 0.22],
      ),
  },
  { id: 'palette', build: () => area('colours') },
  { id: 'assets', build: () => area('assets') },
  {
    id: 'ideas',
    build: () =>
      split(
        'row',
        [
          area('notes', { search: '' }),
          area('note'),
          split('column', [area('graph', { scope: 'local' }), area('backlinks')], [0.5, 0.5]),
        ],
        [0.2, 0.55, 0.25],
      ),
  },
  { id: 'empty', build: () => area('empty') },
];

export function buildWorkspace(templateId: WorkspaceTemplate['id'], name: string): Workspace {
  const template =
    workspaceTemplates.find((candidate) => candidate.id === templateId) ??
    workspaceTemplates.find((candidate) => candidate.id === 'empty');
  if (!template) throw new Error('No workspace templates');
  return { id: crypto.randomUUID(), name, root: template.build() };
}

export function cloneNode(node: LayoutNode): LayoutNode {
  if (node.kind === 'area') return { ...node, id: crypto.randomUUID(), state: { ...node.state } };
  return { ...node, id: crypto.randomUUID(), children: node.children.map(cloneNode), sizes: [...node.sizes] };
}

export function cloneWorkspace(workspace: Workspace, name = workspace.name): Workspace {
  const { maximisedAreaId: _maximised, ...rest } = workspace;
  return { ...rest, id: crypto.randomUUID(), name, root: cloneNode(workspace.root) };
}

export interface PresetNames {
  planning: string;
  design: string;
  palette: string;
  assets: string;
  ideas: string;
  default: string;
}

export function builtInLayoutPresets(names: PresetNames): LayoutPreset[] {
  const planning = () => buildWorkspace('planning', names.planning);
  const design = () => buildWorkspace('design', names.design);
  const palette = () => buildWorkspace('palette', names.palette);
  const assets = () => buildWorkspace('assets', names.assets);
  const ideas = () => buildWorkspace('ideas', names.ideas);
  const preset = (id: string, name: string, workspaces: Workspace[]): LayoutPreset => ({
    schemaVersion: LAYOUT_SCHEMA_VERSION,
    id,
    name,
    workspaces,
  });
  return [
    preset('default', names.default, [planning(), design(), palette(), assets(), ideas()]),
    preset('planning', names.planning, [planning()]),
    preset('design', names.design, [design()]),
    preset('palette', names.palette, [palette()]),
    preset('assets', names.assets, [assets()]),
    preset('ideas', names.ideas, [ideas()]),
  ];
}

export const BUILT_IN_LAYOUT_IDS = ['default', 'planning', 'design', 'palette', 'assets', 'ideas'] as const;

export function isBuiltInLayoutId(id: string): boolean {
  return (BUILT_IN_LAYOUT_IDS as readonly string[]).includes(id);
}
