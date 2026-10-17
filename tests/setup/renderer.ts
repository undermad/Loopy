import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

class ResizeObserverStub {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

globalThis.ResizeObserver = ResizeObserverStub;

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    toJSON: () => undefined,
  };
}

const emptyRects = () => [] as unknown as DOMRectList;

Object.assign(Range.prototype, {
  getClientRects: emptyRects,
  getBoundingClientRect: () => rect(0, 0, 0, 0),
});

Object.assign(Element.prototype, {
  getClientRects: emptyRects,
  hasPointerCapture: () => false,
  setPointerCapture: () => undefined,
  releasePointerCapture: () => undefined,
  scrollIntoView: () => undefined,
  getBoundingClientRect(this: Element) {
    return this.hasAttribute('data-separator') ? rect(10_000, 10_000, 4, 100) : rect(0, 0, 0, 0);
  },
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
