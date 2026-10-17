import { act, render, screen } from '@testing-library/react';
import { ReactFlowProvider, useStoreApi } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { Grid, crisp, linePositions } from '@renderer/components/editors/Board/Grid';

let api: ReturnType<typeof useStoreApi> | null = null;

function Probe() {
  api = useStoreApi();
  return null;
}

describe('Grid', () => {
  it('draws the fine level as a pattern and the wider levels as pixel-aligned lines', () => {
    render(
      <ReactFlowProvider>
        <Probe />
        <Grid board={{ unit: 'm', unitScale: 100, gridColor: '#123456' }} />
      </ReactFlowProvider>,
    );
    const svg = screen.getByTestId('board-grid');
    expect(svg.querySelectorAll('pattern')).toHaveLength(1);
    expect(svg.querySelector('pattern')?.getAttribute('width')).toBe('100');
    expect(svg.querySelector('path')?.getAttribute('stroke')).toBe('#123456');
    expect(svg.querySelectorAll('line')).toHaveLength(2);

    act(() => {
      api?.setState({ width: 500, height: 300, transform: [10.4, 20.6, 1] });
    });
    const lines = Array.from(svg.querySelectorAll('g[data-level="lines"] line'));
    expect(lines.length).toBeGreaterThan(2);
    for (const line of lines) {
      const x = Number(line.getAttribute('x1'));
      const y = Number(line.getAttribute('y1'));
      expect(((x * 2) % 1) + ((y * 2) % 1)).toBe(0);
    }
    expect(lines.every((line) => line.parentElement?.getAttribute('stroke') === '#123456')).toBe(true);
  });

  it('positions lines across the viewport and snaps them to device pixels', () => {
    expect(linePositions(10, 100, 250)).toEqual([-90, 10, 110, 210, 310]);
    expect(linePositions(10, 0, 250)).toEqual([]);
    expect(linePositions(10, 100, 0)).toEqual([]);
    expect(crisp(10.4, 1)).toBe(9.5);
    expect(crisp(10.6, 2)).toBe(11);
    expect(crisp(-0.4, 3)).toBe(-0.5);
  });
});
