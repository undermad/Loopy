import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_FOLDER_IDS, assetKindOf, assetMimeOf, formatBytes, resolveDropFolder } from '@shared/assets';
import {
  assetActions,
  assetsInFolder,
  assetsOfKind,
  buildFolderTree,
  descendantFolderIds,
  dropFolderFor,
  folderActions,
  folderCounts,
  folderPath,
  importFiles,
  kindCounts,
  matchesAssetSearch,
  pickFiles,
  useAsset,
  useAssetsLoaded,
  useAssetsSnapshot,
} from '@renderer/lib/assets';
import { closeProject } from '@renderer/lib/project';
import { bootTestApp, makeProject, type FakeApi } from '../helpers/api';

let api: FakeApi;

beforeEach(async () => {
  api = await bootTestApp();
  const project = makeProject('Space Game');
  api.current = project;
  api.emitProject();
  await act(async () => {
    await Promise.resolve();
  });
});

describe('asset helpers', () => {
  it('classifies files and formats sizes', () => {
    expect(assetKindOf('hero.PNG')).toBe('image');
    expect(assetKindOf('song.mp3')).toBe('audio');
    expect(assetKindOf('clip.mov')).toBe('video');
    expect(assetKindOf('notes.md')).toBe('document');
    expect(assetKindOf('font.woff2')).toBe('font');
    expect(assetKindOf('tree.glb')).toBe('model');
    expect(assetKindOf('pack.zip')).toBe('archive');
    expect(assetKindOf('weird', 'image/heic')).toBe('image');
    expect(assetKindOf('weird', 'text/x-custom')).toBe('document');
    expect(assetKindOf('weird')).toBe('other');
    expect(assetMimeOf('a.png')).toBe('image/png');
    expect(assetMimeOf('a.png', 'image/x-png')).toBe('image/x-png');
    expect(assetMimeOf('a.unknown')).toBe('application/octet-stream');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(15 * 1024 * 1024)).toBe('15 MB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.0 GB');
  });

  it('resolves drop folders from settings', () => {
    const ids = new Set(Object.values(DEFAULT_FOLDER_IDS));
    expect(resolveDropFolder({ dropTarget: 'root', kindFolders: {} }, 'image', ids)).toBeNull();
    expect(resolveDropFolder({ dropTarget: 'byKind', kindFolders: {} }, 'image', ids)).toBe('folder-images');
    expect(resolveDropFolder({ dropTarget: 'byKind', kindFolders: {} }, 'other', ids)).toBeNull();
    expect(
      resolveDropFolder({ dropTarget: 'byKind', kindFolders: { image: null } }, 'image', ids),
    ).toBeNull();
    expect(
      resolveDropFolder({ dropTarget: 'byKind', kindFolders: { image: 'folder-audio' } }, 'image', ids),
    ).toBe('folder-audio');
    expect(
      resolveDropFolder({ dropTarget: 'byKind', kindFolders: { image: 'gone' } }, 'image', ids),
    ).toBeNull();
    expect(resolveDropFolder({ dropTarget: 'folder-fonts', kindFolders: {} }, 'image', ids)).toBe(
      'folder-fonts',
    );
    expect(resolveDropFolder({ dropTarget: 'gone', kindFolders: {} }, 'image', ids)).toBeNull();
  });

  it('builds trees, paths, counts and filters', () => {
    const stamp = '2026-10-17T09:00:00.000Z';
    const folder = (id: string, parentId: string | null, name: string) => ({
      id,
      parentId,
      scope: 'files' as const,
      name,
      createdAt: stamp,
      updatedAt: stamp,
    });
    const folders = [
      folder('b', null, 'Beta'),
      folder('a', null, 'Alpha'),
      folder('c', 'a', 'Child'),
      folder('d', 'c', 'Deep'),
      folder('x', 'missing', 'Orphan'),
    ];
    const tree = buildFolderTree(folders);
    expect(tree.map((node) => node.folder.name)).toEqual(['Alpha', 'Beta', 'Orphan']);
    expect(tree[0]?.children[0]?.folder.id).toBe('c');
    expect(tree[0]?.children[0]?.children[0]?.depth).toBe(2);
    expect(folderPath(folders, 'd').map((item) => item.id)).toEqual(['a', 'c', 'd']);
    expect(folderPath(folders, null)).toEqual([]);
    expect([...descendantFolderIds(folders, 'a')].sort()).toEqual(['a', 'c', 'd']);

    const asset = (id: string, folderId: string | null, name: string, kind: 'image' | 'audio' = 'image') => ({
      id,
      folderId,
      name,
      kind,
      mime: 'image/png',
      size: 1,
      sha256: 'a'.repeat(64),
      width: null,
      height: null,
      tags: ['hero'],
      createdAt: stamp,
      updatedAt: stamp,
    });
    const assets = [
      asset('1', 'a', 'Knight.png'),
      asset('2', 'd', 'Song.mp3', 'audio'),
      asset('3', null, 'Loose.png'),
    ];
    expect(assetsInFolder(assets, 'a').map((item) => item.id)).toEqual(['1']);
    expect(assetsInFolder(assets, null, 'loose').map((item) => item.id)).toEqual(['3']);
    expect(assetsOfKind(assets, 'image').map((item) => item.id)).toEqual(['1', '3']);
    expect(assetsOfKind(assets, 'audio', 'nothing')).toEqual([]);
    expect(matchesAssetSearch(assets[0] as never, 'HERO')).toBe(true);
    expect(matchesAssetSearch(assets[0] as never, 'image')).toBe(true);
    expect(kindCounts(assets)).toMatchObject({ image: 2, audio: 1, video: 0 });
    const counts = folderCounts(folders, assets);
    expect(counts.get('a')).toBe(2);
    expect(counts.get('c')).toBe(1);
    expect(counts.get('b')).toBe(0);
    expect(counts.get(null)).toBe(1);
  });
});

describe('assets library', () => {
  it('imports, picks, moves, renames, deletes and reloads on project change', async () => {
    const { result } = renderHook(() => ({
      snapshot: useAssetsSnapshot(),
      loaded: useAssetsLoaded(),
      first: useAsset('asset-1'),
    }));
    expect(result.current.loaded).toBe(true);
    expect(result.current.snapshot.folders.length).toBe(7);

    const file = new File([new Uint8Array([1, 2, 3])], 'hero.png', { type: 'image/png' });
    const outcome = await act(() => importFiles([file], 'auto'));
    expect(outcome.ids).toEqual(['asset-1']);
    expect(outcome.folderIds).toEqual(['folder-images']);
    expect(result.current.first?.name).toBe('hero.png');
    expect(await importFiles([], 'auto')).toEqual({ ids: [], folderIds: [] });
    expect(dropFolderFor('track.mp3')).toBe('folder-audio');

    api.assetsData.pickQueue.push([{ name: 'map.pdf', bytes: new Uint8Array([1]) }]);
    expect(await act(() => pickFiles(null))).toEqual(['asset-2']);
    expect(result.current.snapshot.assets.find((asset) => asset.id === 'asset-2')?.folderId).toBeNull();
    expect(await pickFiles(null)).toEqual([]);

    await act(() => folderActions.create({ name: 'Heroes', parentId: 'folder-images' }));
    const heroes = result.current.snapshot.folders.find((folder) => folder.name === 'Heroes');
    expect(heroes?.parentId).toBe('folder-images');
    await act(() => folderActions.update(heroes?.id ?? '', { name: 'Cast' }));
    expect(result.current.snapshot.folders.find((folder) => folder.id === heroes?.id)?.name).toBe('Cast');

    await act(() => assetActions.move(['asset-1'], heroes?.id ?? null));
    expect(result.current.first?.folderId).toBe(heroes?.id);
    await act(() => assetActions.update('asset-1', { name: 'Knight.png', tags: ['hero'] }));
    expect(result.current.first).toMatchObject({ name: 'Knight.png', tags: ['hero'] });
    await act(() => folderActions.remove(heroes?.id ?? ''));
    expect(result.current.first?.folderId).toBe('folder-images');

    await act(() => assetActions.setSettings({ dropTarget: 'root' }));
    expect(result.current.snapshot.settings.dropTarget).toBe('root');
    expect(dropFolderFor('x.png')).toBeNull();
    await expect(assetActions.exportToDisk('asset-1')).resolves.toEqual({ status: 'exported' });

    await act(() => assetActions.remove(['asset-1', 'asset-2']));
    expect(result.current.snapshot.assets).toEqual([]);

    await act(async () => {
      await closeProject();
    });
    expect(result.current.loaded).toBe(false);
    expect(result.current.snapshot.folders).toEqual([]);
  });
});
