import { closestCenter, pointerWithin, type CollisionDetection } from '@dnd-kit/core';

const isZone = (id: unknown) => String(id).startsWith('zone:');

export const collide: CollisionDetection = (args) => {
  const fields = args.droppableContainers.filter((item) => !isZone(item.id));
  const onField = pointerWithin({ ...args, droppableContainers: fields });
  if (onField.length > 0) return onField;
  const zones = pointerWithin({
    ...args,
    droppableContainers: args.droppableContainers.filter((item) => isZone(item.id)),
  });
  const zone = zones[0];
  if (!zone) return closestCenter({ ...args, droppableContainers: fields });
  const name = String(zone.id).slice(5);
  const inZone = fields.filter((item) => {
    const sortable = (item.data.current as { sortable?: { containerId?: unknown } } | undefined)?.sortable;
    return sortable?.containerId === name;
  });
  return inZone.length > 0 ? closestCenter({ ...args, droppableContainers: inZone }) : zones;
};
