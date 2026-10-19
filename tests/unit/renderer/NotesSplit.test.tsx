import { useState, type ComponentType } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorView } from '@codemirror/view';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SplitNoteEditor } from '@renderer/components/editors/Notes/SplitNoteEditor';
import type { EditorProps } from '@renderer/lib/editors';
import { createNote, findNote } from '@renderer/lib/notes';
import { ToastProvider, TooltipProvider } from '@renderer/ui';
import { bootTestApp, makeProject, type FakeApi } from './helpers/api';

let api: FakeApi;

function Stateful({
  editor: Editor,
  initial = {},
  onState,
}: {
  editor: ComponentType<EditorProps>;
  initial?: Record<string, unknown>;
  onState?: ((state: Record<string, unknown>) => void) | undefined;
}) {
  const [state, setState] = useState(initial);
  return (
    <TooltipProvider>
      <ToastProvider closeLabel="Dismiss" regionLabel="Notifications">
        <Editor
          areaId="test"
          state={state}
          setState={(patch) => {
            setState((current) => {
              const next = { ...current, ...patch };
              onState?.(next);
              return next;
            });
          }}
        />
      </ToastProvider>
    </TooltipProvider>
  );
}

function viewOf(container: HTMLElement): EditorView {
  const host = container.querySelector('.cm-editor');
  const view = host instanceof HTMLElement ? EditorView.findFromDOM(host) : null;
  if (!view) throw new Error('No editor view');
  return view;
}

async function mount(initial: Record<string, unknown>, onState?: (state: Record<string, unknown>) => void) {
  const result = render(<Stateful editor={SplitNoteEditor} initial={initial} onState={onState} />);
  await waitFor(() => {
    expect(result.container.querySelector('.cm-content')).toBeInTheDocument();
  });
  return { ...result, view: viewOf(result.container) };
}

beforeEach(async () => {
  api = await bootTestApp();
  api.current = makeProject('Space Game');
  api.emitProject();
  await waitFor(() => {
    expect(api.listNotes).toHaveBeenCalled();
  });
});

describe('split note editor', () => {
  it('shows the syntax and the rendered note side by side by default', async () => {
    const note = await createNote({ title: 'Combat', body: '# Combat\n\nHits **hard**.' });
    const { container } = await mount({ noteId: note.id });

    const syntax = screen.getByRole('region', { name: 'Syntax' });
    const rendered = screen.getByRole('region', { name: 'Rendered' });
    expect(syntax).toBeVisible();
    expect(rendered).toBeVisible();
    expect(within(syntax).getByRole('textbox', { name: 'Note text' })).toHaveTextContent('# Combat');
    expect(within(rendered).getByRole('heading', { name: 'Combat', level: 1 })).toBeInTheDocument();
    expect(within(rendered).getByText('hard').tagName).toBe('STRONG');
    expect(container.querySelector('.cm-editor')).toHaveAttribute('data-mode', 'source');
    expect(screen.getByRole('radio', { name: 'Split' })).toBeChecked();
  });

  it('renders what is typed in the syntax pane', async () => {
    const note = await createNote({ title: 'Melee', body: 'Swing' });
    const { view } = await mount({ noteId: note.id });
    act(() => {
      view.dispatch({ changes: { from: view.state.doc.length, insert: '\n\n## Combo\n\n- [ ] Parry' } });
    });
    expect(findNote(note.id)?.body).toBe('Swing\n\n## Combo\n\n- [ ] Parry');
    const rendered = screen.getByRole('region', { name: 'Rendered' });
    await waitFor(() => {
      expect(within(rendered).getByRole('heading', { name: 'Combo', level: 2 })).toBeInTheDocument();
    });
    expect(within(rendered).getByRole('checkbox')).not.toBeChecked();
  });

  it('switches between syntax, split and rendered and keeps the choice in area state', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Views', body: '# Views' });
    const changes = vi.fn();
    await mount({ noteId: note.id }, changes);

    await user.click(screen.getByRole('radio', { name: 'Syntax' }));
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ view: 'syntax' }));
    expect(screen.getByRole('region', { name: 'Syntax' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Rendered' })).not.toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Rendered' }));
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ view: 'rendered' }));
    expect(screen.getByLabelText('Syntax', { selector: 'section' })).not.toBeVisible();
    expect(
      within(screen.getByRole('region', { name: 'Rendered' })).getByRole('heading', { name: 'Views' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Split' }));
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ view: 'split' }));
    expect(screen.getByRole('region', { name: 'Syntax' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Rendered' })).toBeVisible();
  });

  it('opens in the view saved in area state', async () => {
    const note = await createNote({ title: 'Saved', body: 'Text' });
    await mount({ noteId: note.id, view: 'rendered' });
    expect(screen.getByRole('radio', { name: 'Rendered' })).toBeChecked();
    expect(screen.getByLabelText('Syntax', { selector: 'section' })).not.toBeVisible();
  });

  it('resizes the panes from the keyboard within limits', async () => {
    const note = await createNote({ title: 'Sizes', body: 'Text' });
    const changes = vi.fn();
    await mount({ noteId: note.id }, changes);
    const divider = screen.getByRole('separator', { name: 'Resize panes' });
    expect(divider).toHaveAttribute('aria-valuenow', '50');

    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ ratio: 0.55 }));
    expect(divider).toHaveAttribute('aria-valuenow', '55');

    fireEvent.keyDown(divider, { key: 'Home' });
    expect(divider).toHaveAttribute('aria-valuenow', '20');
    fireEvent.keyDown(divider, { key: 'ArrowLeft' });
    expect(divider).toHaveAttribute('aria-valuenow', '20');

    fireEvent.keyDown(divider, { key: 'End' });
    expect(divider).toHaveAttribute('aria-valuenow', '80');
    fireEvent.keyDown(divider, { key: 'Enter' });
    expect(divider).toHaveAttribute('aria-valuenow', '80');
  });

  it('resizes the panes by dragging the divider', async () => {
    const note = await createNote({ title: 'Drag', body: 'Text' });
    const changes = vi.fn();
    await mount({ noteId: note.id, ratio: 0.5 }, changes);
    const divider = screen.getByRole('separator', { name: 'Resize panes' });
    const panes = divider.parentElement;
    if (!panes) throw new Error('No panes');
    vi.spyOn(panes, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ x: 100, width: 1000 }));

    fireEvent.pointerDown(divider, { clientX: 600, pointerId: 1 });
    fireEvent.pointerMove(divider, { clientX: 400, pointerId: 1 });
    expect(divider).toHaveAttribute('aria-valuenow', '30');
    fireEvent.pointerMove(divider, { clientX: 50, pointerId: 1 });
    expect(divider).toHaveAttribute('aria-valuenow', '20');
    fireEvent.pointerUp(divider, { clientX: 50, pointerId: 1 });
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ ratio: 0.2 }));

    fireEvent.pointerMove(divider, { clientX: 900, pointerId: 1 });
    expect(divider).toHaveAttribute('aria-valuenow', '20');
  });

  it('follows links clicked in the rendered pane within the same area', async () => {
    const user = userEvent.setup();
    const target = await createNote({ title: 'Arena', body: 'Sand' });
    const note = await createNote({ title: 'Boss', body: 'Fight in [[Arena]]' });
    const changes = vi.fn();
    await mount({ noteId: note.id }, changes);
    const rendered = screen.getByRole('region', { name: 'Rendered' });
    await user.click(within(rendered).getByRole('link', { name: 'Arena' }));
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ noteId: target.id }));
  });

  it('ticks a task from the rendered pane', async () => {
    const user = userEvent.setup();
    const note = await createNote({ title: 'Tasks', body: '- [ ] Blockout' });
    await mount({ noteId: note.id });
    await user.click(within(screen.getByRole('region', { name: 'Rendered' })).getByRole('checkbox'));
    await waitFor(() => {
      expect(findNote(note.id)?.body).toBe('- [x] Blockout');
    });
  });

  it('keeps the rendered pane at the same relative scroll as the syntax pane', async () => {
    const note = await createNote({ title: 'Long', body: 'Line\n'.repeat(40) });
    const { view } = await mount({ noteId: note.id });
    const rendered = screen.getByRole('region', { name: 'Rendered' });
    const size = (element: HTMLElement, scrollHeight: number, clientHeight: number) => {
      Object.defineProperty(element, 'scrollHeight', { configurable: true, value: scrollHeight });
      Object.defineProperty(element, 'clientHeight', { configurable: true, value: clientHeight });
    };
    size(view.scrollDOM, 1100, 100);
    size(rendered, 2100, 100);

    view.scrollDOM.scrollTop = 500;
    fireEvent.scroll(view.scrollDOM);
    expect(rendered.scrollTop).toBe(1000);

    size(view.scrollDOM, 100, 100);
    fireEvent.scroll(view.scrollDOM);
    expect(rendered.scrollTop).toBe(0);
  });

  it('shows the empty state without panes when no note is open', async () => {
    render(<Stateful editor={SplitNoteEditor} />);
    expect(await screen.findByText('No note open')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Rendered' })).not.toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });
});
