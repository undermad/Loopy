import type { AreaNode } from '@shared/layout';
import { getEditor } from '@renderer/lib/editors';
import { areaActions } from '@renderer/lib/workspaces';

export function EditorView({ area }: { area: AreaNode }) {
  const definition = getEditor(area.editor) ?? getEditor('empty');
  if (!definition) return null;
  const Editor = definition.component;
  return (
    <Editor
      areaId={area.id}
      state={area.state}
      setState={(patch) => {
        areaActions.patchState(area.id, patch);
      }}
    />
  );
}
