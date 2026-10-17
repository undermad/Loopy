import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { Grid } from '@renderer/components/editors/Board/Grid';

describe('Grid', () => {
  it('draws three line levels in the board grid colour plus the axes', () => {
    render(
      <ReactFlowProvider>
        <Grid board={{ unit: 'm', unitScale: 100, gridColor: '#123456' }} />
      </ReactFlowProvider>,
    );
    const svg = screen.getByTestId('board-grid');
    const patterns = svg.querySelectorAll('pattern');
    expect(patterns).toHaveLength(3);
    expect(Array.from(patterns).map((pattern) => pattern.getAttribute('width'))).toEqual([
      '100',
      '1000',
      '10000',
    ]);
    const paths = svg.querySelectorAll('path');
    expect(Array.from(paths).every((path) => path.getAttribute('stroke') === '#123456')).toBe(true);
    expect(svg.querySelectorAll('line')).toHaveLength(2);
    expect(svg.querySelectorAll('rect')).toHaveLength(3);
  });
});
