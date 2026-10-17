import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RichContent, RichText, TooltipProvider, isEmptyRichText, toRichText } from '@renderer/ui';

const labels = {
  editor: 'Text editor',
  bold: 'Bold',
  italic: 'Italic',
  strike: 'Strikethrough',
  code: 'Inline code',
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  bulletList: 'Bullet list',
  orderedList: 'Numbered list',
  taskList: 'Checklist',
  blockquote: 'Quote',
  codeBlock: 'Code block',
  horizontalRule: 'Divider',
  link: 'Link',
  linkUrl: 'Link URL',
  linkApply: 'Apply',
  linkRemove: 'Remove link',
  undo: 'Undo',
  redo: 'Redo',
};

function editable(): HTMLElement {
  const element = screen
    .getAllByLabelText('Text editor')
    .find((candidate) => candidate.getAttribute('contenteditable') === 'true');
  if (!element) throw new Error('Missing editor');
  return element;
}

async function typeInto(element: HTMLElement, text: string) {
  const paragraph = element.querySelector('p');
  if (!paragraph) throw new Error('Missing paragraph');
  await act(async () => {
    paragraph.textContent = text;
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('RichText', () => {
  it('reports changes, formats blocks from the toolbar and submits with Ctrl+Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const onBlur = vi.fn();
    render(
      <TooltipProvider>
        <RichText
          value=""
          labels={labels}
          placeholder="Say it"
          onChange={onChange}
          onSubmit={onSubmit}
          onBlur={onBlur}
        />
      </TooltipProvider>,
    );
    const element = editable();
    expect(screen.getByRole('toolbar', { name: 'Text editor' })).toBeInTheDocument();
    await typeInto(element, 'Hello');
    expect(onChange).toHaveBeenLastCalledWith('<p>Hello</p>');

    await user.click(screen.getByRole('button', { name: 'Bullet list' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('<ul>') as string);
    await user.click(screen.getByRole('button', { name: 'Checklist' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('data-type="taskList"') as string);
    await user.click(screen.getByRole('button', { name: 'Heading 1' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('<h1>') as string);
    await user.click(screen.getByRole('button', { name: 'Quote' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('<blockquote>') as string);
    await user.click(screen.getByRole('button', { name: 'Divider' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('<hr>') as string);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.not.stringContaining('<hr>') as string);
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('<hr>') as string);

    await user.click(screen.getByRole('button', { name: 'Link' }));
    await user.type(await screen.findByRole('textbox', { name: 'Link URL' }), 'https://example.com');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    fireEvent.keyDown(element, { key: 'Enter', ctrlKey: true });
    expect(onSubmit).toHaveBeenCalled();
    fireEvent.blur(element);
    expect(onBlur).toHaveBeenCalled();
  });

  it('follows an external value, renders read-only content safely and detects empty text', () => {
    const { rerender } = render(
      <TooltipProvider>
        <RichText value="<p>One</p>" labels={labels} />
      </TooltipProvider>,
    );
    expect(editable()).toHaveTextContent('One');
    rerender(
      <TooltipProvider>
        <RichText value="<p>Two</p>" labels={labels} />
      </TooltipProvider>,
    );
    expect(editable()).toHaveTextContent('Two');

    render(<RichContent html={'<p>Safe</p><script>alert(1)</script><img src=x onerror="alert(1)">'} />);
    expect(screen.getByText('Safe')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('img')).toBeNull();

    expect(isEmptyRichText('')).toBe(true);
    expect(isEmptyRichText('<p></p>')).toBe(true);
    expect(isEmptyRichText('<p><br></p>')).toBe(true);
    expect(isEmptyRichText('<p>x</p>')).toBe(false);
    expect(toRichText('')).toBe('');
    expect(toRichText('<p>kept</p>')).toBe('<p>kept</p>');
    expect(toRichText('a < b\nc\n\nd')).toBe('<p>a &lt; b<br>c</p><p>d</p>');
  });
});
