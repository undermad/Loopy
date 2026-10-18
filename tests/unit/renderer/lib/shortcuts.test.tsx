import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useShortcuts } from '@renderer/lib/shortcuts';

describe('useShortcuts', () => {
  it('fires handlers for bound keys and ignores typing in inputs', () => {
    const newProject = vi.fn();
    const preferences = vi.fn();
    renderHook(() => {
      useShortcuts({ newProject, preferences });
    });

    fireEvent.keyDown(window, { key: 'n', code: 'KeyN', ctrlKey: true });
    expect(newProject).toHaveBeenCalledTimes(1);

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'n', code: 'KeyN', ctrlKey: true });
    expect(newProject).toHaveBeenCalledTimes(1);
    input.remove();
    fireEvent.keyDown(window, { key: ',', code: 'Comma', ctrlKey: true });
    expect(preferences).toHaveBeenCalledTimes(1);
  });

  it('opens preferences and the quick switcher while typing', () => {
    const newProject = vi.fn();
    const preferences = vi.fn();
    const quickSwitcher = vi.fn();
    renderHook(() => {
      useShortcuts({ newProject, preferences, quickSwitcher });
    });
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: ',', code: 'Comma', ctrlKey: true });
    fireEvent.keyDown(input, { key: 'o', code: 'KeyO', ctrlKey: true });
    fireEvent.keyDown(input, { key: 'o', code: 'KeyO', ctrlKey: true, repeat: true });
    fireEvent.keyDown(input, { key: 'n', code: 'KeyN', ctrlKey: true });
    input.remove();
    expect(preferences).toHaveBeenCalledTimes(1);
    expect(quickSwitcher).toHaveBeenCalledTimes(1);
    expect(newProject).not.toHaveBeenCalled();
  });
});
