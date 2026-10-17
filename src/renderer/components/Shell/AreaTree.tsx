import { Fragment } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import type { LayoutNode } from '@shared/layout';
import { areaActions } from '@renderer/lib/workspaces';
import { Area } from './Area';
import styles from './AreaTree.module.scss';

export function AreaTree({ node }: { node: LayoutNode }) {
  if (node.kind === 'area') return <Area area={node} />;
  const layout = Object.fromEntries(
    node.children.map((child, index) => [child.id, (node.sizes[index] ?? 0) * 100]),
  );
  return (
    <Group
      key={node.children.map((child) => child.id).join('|')}
      orientation={node.direction === 'row' ? 'horizontal' : 'vertical'}
      defaultLayout={layout}
      onLayoutChanged={(next) => {
        areaActions.resize(
          node.id,
          node.children.map((child) => (next[child.id] ?? 0) / 100),
        );
      }}
      className={styles['group']}
    >
      {node.children.map((child, index) => (
        <Fragment key={child.id}>
          {index > 0 ? <Separator className={styles['separator']} /> : null}
          <Panel
            id={child.id}
            defaultSize={(node.sizes[index] ?? 0) * 100}
            minSize={8}
            className={styles['panel']}
          >
            <AreaTree node={child} />
          </Panel>
        </Fragment>
      ))}
    </Group>
  );
}
