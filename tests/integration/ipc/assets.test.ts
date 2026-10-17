import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FOLDER_IDS, assetUrl, type AssetPickResult, type AssetsSnapshot } from '@shared/assets';
import { IpcChannel } from '@shared/ipc';
import { assetIdFromUrl, handleAssetRequest } from '../../../src/main/asset-protocol';
import { registerAssetsHandlers } from '../../../src/main/ipc/assets';
import { createProject, type ProjectDatabase } from '../../../src/main/storage';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

let directory: string;
let project: ProjectDatabase;

const PNG_1X2 = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00,
  0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x08, 0x06, 0x00, 0x00, 0x00,
]);

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'loopy-assets-'));
  project = await createProject(join(directory, 'demo.loopy'), 'Demo');
});

afterEach(async () => {
  project.close();
  await rm(directory, { recursive: true, force: true });
});

function setup(open = true, filePaths: string[] = [], savePath?: string) {
  const handlers = new Map<string, Handler>();
  const ipc = { handle: vi.fn((channel: string, handler: Handler) => handlers.set(channel, handler)) };
  const dialogs = {
    showOpenDialog: vi.fn(() => Promise.resolve({ canceled: filePaths.length === 0, filePaths })),
    showSaveDialog: vi.fn(() =>
      Promise.resolve(savePath ? { canceled: false, filePath: savePath } : { canceled: true }),
    ),
  };
  registerAssetsHandlers(ipc, { project: () => (open ? project : null), dialogs });
  const call = <T>(channel: string, ...args: unknown[]) =>
    Promise.resolve().then(() => handlers.get(channel)?.({}, ...args)) as Promise<T>;
  return { call, dialogs };
}

describe('assets IPC handlers', () => {
  it('ships default folders and settings', async () => {
    const { call } = setup();
    const snapshot = await call<AssetsSnapshot>(IpcChannel.assetsSnapshot);
    expect(snapshot.folders.map((folder) => folder.id)).toEqual(
      expect.arrayContaining(Object.values(DEFAULT_FOLDER_IDS)),
    );
    expect(snapshot.assets).toEqual([]);
    expect(snapshot.settings).toEqual({ dropTarget: 'byKind', kindFolders: {} });
  });

  it('imports files into the folder for their kind, reads image sizes and serves bytes', async () => {
    const { call } = setup();
    const result = await call<AssetPickResult>(IpcChannel.assetsImport, {
      target: 'auto',
      files: [
        { name: 'hero.png', mime: 'image/png', bytes: PNG_1X2 },
        { name: 'notes.txt', bytes: new TextEncoder().encode('hello') },
      ],
    });
    expect(result.status).toBe('imported');
    if (result.status !== 'imported') return;
    expect(result.ids).toHaveLength(2);
    const image = result.snapshot.assets.find((asset) => asset.name === 'hero.png');
    expect(image).toMatchObject({
      kind: 'image',
      mime: 'image/png',
      folderId: DEFAULT_FOLDER_IDS.image,
      width: 1,
      height: 2,
      size: PNG_1X2.byteLength,
      tags: [],
    });
    expect(image?.sha256).toHaveLength(64);
    const text = result.snapshot.assets.find((asset) => asset.name === 'notes.txt');
    expect(text).toMatchObject({
      kind: 'document',
      mime: 'text/plain',
      folderId: DEFAULT_FOLDER_IDS.document,
    });

    const response = handleAssetRequest(() => project, new Request(`loopy-asset://asset/${image?.id ?? ''}`));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG_1X2);
    expect(handleAssetRequest(() => project, new Request('loopy-asset://asset/missing')).status).toBe(404);
    expect(handleAssetRequest(() => null, new Request('loopy-asset://asset/x')).status).toBe(404);
    expect(assetIdFromUrl('loopy-asset://asset/abc')).toBe('abc');
    expect(assetIdFromUrl('loopy-asset://other/abc')).toBeNull();
    expect(assetIdFromUrl(assetUrl('a b<c>'))).toBe('a b<c>');
    expect(assetUrl('a b<c>')).toBe('loopy-asset://asset/a%20b%3Cc%3E');
    expect(assetIdFromUrl('loopy-asset://asset/%E0%A4%A')).toBeNull();
  });

  it('honours the drop target setting and explicit targets', async () => {
    const { call } = setup();
    let snapshot = await call<AssetsSnapshot>(IpcChannel.assetsSettings, { dropTarget: 'root' });
    expect(snapshot.settings.dropTarget).toBe('root');
    let result = await call<AssetPickResult>(IpcChannel.assetsImport, {
      target: 'auto',
      files: [{ name: 'a.png', bytes: PNG_1X2 }],
    });
    if (result.status !== 'imported') throw new Error('expected import');
    expect(result.snapshot.assets[0]?.folderId).toBeNull();

    snapshot = await call<AssetsSnapshot>(IpcChannel.assetsSettings, {
      dropTarget: 'byKind',
      kindFolders: { image: DEFAULT_FOLDER_IDS.audio },
    });
    expect(snapshot.settings.kindFolders).toEqual({ image: DEFAULT_FOLDER_IDS.audio });
    result = await call<AssetPickResult>(IpcChannel.assetsImport, {
      target: 'auto',
      files: [{ name: 'b.png', bytes: PNG_1X2 }],
    });
    if (result.status !== 'imported') throw new Error('expected import');
    expect(result.snapshot.assets.find((asset) => asset.name === 'b.png')?.folderId).toBe(
      DEFAULT_FOLDER_IDS.audio,
    );

    result = await call<AssetPickResult>(IpcChannel.assetsImport, {
      target: DEFAULT_FOLDER_IDS.font,
      files: [{ name: 'c.png', bytes: PNG_1X2 }],
    });
    if (result.status !== 'imported') throw new Error('expected import');
    expect(result.snapshot.assets.find((asset) => asset.name === 'c.png')?.folderId).toBe(
      DEFAULT_FOLDER_IDS.font,
    );
    await expect(
      call(IpcChannel.assetsImport, { target: 'nope', files: [{ name: 'd.png', bytes: PNG_1X2 }] }),
    ).rejects.toThrow(/Unknown folder/);
    await expect(call(IpcChannel.assetsImport, { target: 'auto', files: [] })).rejects.toThrow();
  });

  it('manages folders, moves and renames assets, and deletes without losing children', async () => {
    const { call } = setup();
    let snapshot = await call<AssetsSnapshot>(IpcChannel.assetsCreateFolder, {
      name: 'Characters',
      parentId: DEFAULT_FOLDER_IDS.image,
    });
    const characters = snapshot.folders.find((folder) => folder.name === 'Characters');
    expect(characters?.parentId).toBe(DEFAULT_FOLDER_IDS.image);
    if (!characters) throw new Error('missing folder');

    snapshot = await call<AssetsSnapshot>(IpcChannel.assetsCreateFolder, {
      name: 'Heroes',
      parentId: characters.id,
    });
    const heroes = snapshot.folders.find((folder) => folder.name === 'Heroes');
    if (!heroes) throw new Error('missing folder');

    await expect(call(IpcChannel.assetsUpdateFolder, characters.id, { parentId: heroes.id })).rejects.toThrow(
      /into itself/,
    );
    await expect(call(IpcChannel.assetsUpdateFolder, characters.id, { parentId: 'nope' })).rejects.toThrow(
      /Unknown folder/,
    );
    await expect(call(IpcChannel.assetsUpdateFolder, 'nope', { name: 'x' })).rejects.toThrow(
      /Unknown folder/,
    );
    snapshot = await call<AssetsSnapshot>(IpcChannel.assetsUpdateFolder, characters.id, { name: 'Cast' });
    expect(snapshot.folders.find((folder) => folder.id === characters.id)?.name).toBe('Cast');

    const imported = await call<AssetPickResult>(IpcChannel.assetsImport, {
      target: heroes.id,
      files: [{ name: 'knight.png', bytes: PNG_1X2 }],
    });
    if (imported.status !== 'imported') throw new Error('expected import');
    const knight = imported.ids[0] ?? '';

    snapshot = await call<AssetsSnapshot>(IpcChannel.assetsUpdate, knight, {
      name: 'Knight.png',
      tags: ['hero', 'hero', 'armour'],
    });
    expect(snapshot.assets[0]).toMatchObject({ name: 'Knight.png', tags: ['hero', 'armour'] });
    await expect(call(IpcChannel.assetsUpdate, knight, { folderId: 'nope' })).rejects.toThrow(
      /Unknown folder/,
    );
    await expect(call(IpcChannel.assetsUpdate, 'nope', { name: 'x' })).rejects.toThrow(/Unknown asset/);

    snapshot = await call<AssetsSnapshot>(IpcChannel.assetsDeleteFolder, heroes.id);
    expect(snapshot.folders.some((folder) => folder.id === heroes.id)).toBe(false);
    expect(snapshot.assets[0]?.folderId).toBe(characters.id);

    snapshot = await call<AssetsSnapshot>(IpcChannel.assetsDeleteFolder, characters.id);
    expect(snapshot.assets[0]?.folderId).toBe(DEFAULT_FOLDER_IDS.image);
    await expect(call(IpcChannel.assetsDeleteFolder, 'nope')).rejects.toThrow(/Unknown folder/);

    snapshot = await call<AssetsSnapshot>(IpcChannel.assetsMove, [knight], null);
    expect(snapshot.assets[0]?.folderId).toBeNull();
    snapshot = await call<AssetsSnapshot>(IpcChannel.assetsDelete, [knight]);
    expect(snapshot.assets).toEqual([]);
  });

  it('picks files through the open dialog and exports through the save dialog', async () => {
    const source = join(directory, 'pick.png');
    await writeFile(source, PNG_1X2);
    const target = join(directory, 'exported.png');
    const { call, dialogs } = setup(true, [source], target);

    const picked = await call<AssetPickResult>(IpcChannel.assetsPick, 'auto');
    expect(picked.status).toBe('imported');
    if (picked.status !== 'imported') return;
    expect(picked.snapshot.assets[0]).toMatchObject({ name: 'pick.png', folderId: DEFAULT_FOLDER_IDS.image });
    expect(dialogs.showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({ properties: ['openFile', 'multiSelections'] }),
    );

    await expect(call(IpcChannel.assetsExport, picked.ids[0])).resolves.toEqual({ status: 'exported' });
    expect(new Uint8Array(await readFile(target))).toEqual(PNG_1X2);
    await expect(call(IpcChannel.assetsExport, 'nope')).rejects.toThrow(/Unknown asset/);

    const cancelled = setup(true, []);
    await expect(cancelled.call(IpcChannel.assetsPick, null)).resolves.toEqual({ status: 'cancelled' });
    await expect(cancelled.call(IpcChannel.assetsExport, picked.ids[0])).resolves.toEqual({
      status: 'cancelled',
    });
  });

  it('refuses every channel when no project is open', async () => {
    const { call } = setup(false);
    await expect(call(IpcChannel.assetsSnapshot)).rejects.toThrow(/No project/);
  });
});
