import { act, render, screen } from '@testing-library/react';
import { ReactFlow, ReactFlowProvider, useStoreApi } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { Grid, linePositions } from '@renderer/components/editors/Board/Grid';

let api: ReturnType<typeof useStoreApi> | null = null;

function Probe() {
  api = useStoreApi();
  return null;
}

describe('Grid', () => {
  it('draws every level as lines in flow coordinates above the nodes', () => {
    render(
      <ReactFlowProvider>
        <ReactFlow nodes={[]} edges={[]}>
          <Probe />
          <Grid board={{ unit: 'm', unitScale: 100, gridColor: '#123456' }} />
        </ReactFlow>
      </ReactFlowProvider>,
    );
    act(() => {
      api?.setState({ width: 500, height: 300, transform: [-50, -20, 1] });
    });
    const svg = screen.getByTestId('board-grid');
    expect(svg.closest('.react-flow__viewport-portal')).not.toBeNull();
    expect(svg.getAttribute('viewBox')).toBe('50 20 500 300');
    const groups = Array.from(svg.querySelectorAll('g[data-level]')).map((group) =>
      group.getAttribute('data-level'),
    );
    expect(groups).toEqual(['100', '1000', '10000', 'axes']);
    const fine = svg.querySelectorAll('g[data-level="100"] line');
    expect(fine.length).toBeGreaterThan(8);
    expect(
      Array.from(fine).every((line) => line.getAttribute('vector-effect') === 'non-scaling-stroke'),
    ).toBe(true);
    expect(svg.querySelector('g[data-level="100"]')?.getAttribute('stroke')).toBe('#123456');
    expect(Number(fine[0]?.getAttribute('x1')) % 100).toBe(0);
  });

  it('lists the multiples of a gap that cover a range', () => {
    expect(linePositions(100, 10, 250)).toEqual([0, 100, 200, 300]);
    expect(linePositions(100, -150, -10)).toEqual([-200, -100, 0]);
    expect(linePositions(0, 10, 250)).toEqual([]);
    expect(linePositions(100, 250, 10)).toEqual([]);
  });
});
