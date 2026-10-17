import type { Palette, PaletteCluster } from '@shared/colours';

export interface PaletteGroup<T> {
  cluster: PaletteCluster | null;
  items: T[];
}

type Placement = Pick<Palette, 'clusterId' | 'clusterPosition'>;

export function groupByCluster<T>(
  items: T[],
  clusters: PaletteCluster[],
  placementOf: (item: T) => Placement,
): PaletteGroup<T>[] {
  const known = new Set(clusters.map((cluster) => cluster.id));
  const grouped = clusters.map((cluster) => ({
    cluster,
    items: items
      .filter((item) => placementOf(item).clusterId === cluster.id)
      .sort((a, b) => placementOf(a).clusterPosition - placementOf(b).clusterPosition),
  }));
  const loose = items.filter((item) => {
    const { clusterId } = placementOf(item);
    return !clusterId || !known.has(clusterId);
  });
  return [...grouped, { cluster: null, items: loose }];
}

export function groupPalettes(palettes: Palette[], clusters: PaletteCluster[]): PaletteGroup<Palette>[] {
  return groupByCluster(palettes, clusters, (palette) => palette).filter((group) => group.items.length > 0);
}
