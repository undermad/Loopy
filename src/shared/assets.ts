import { z } from 'zod';

export const ASSET_KINDS = [
  'image',
  'audio',
  'video',
  'document',
  'font',
  'model',
  'archive',
  'other',
] as const;

export const assetKindSchema = z.enum(ASSET_KINDS);

export const ASSET_PROTOCOL = 'loopy-asset';
export const ASSET_MAX_BYTES = 64 * 1024 * 1024;

export const DEFAULT_FOLDER_IDS: Record<Exclude<AssetKind, 'other'>, string> = {
  image: 'folder-images',
  audio: 'folder-audio',
  video: 'folder-video',
  document: 'folder-documents',
  font: 'folder-fonts',
  model: 'folder-models',
  archive: 'folder-archives',
};

export const assetFolderSchema = z.object({
  id: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  name: z.string().trim().min(1).max(80),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const assetSchema = z.object({
  id: z.string().min(1),
  folderId: z.string().min(1).nullable(),
  name: z.string().trim().min(1).max(255),
  kind: assetKindSchema,
  mime: z.string().min(1),
  size: z.number().int().nonnegative(),
  sha256: z.string().length(64),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const assetDropTargetSchema = z.union([z.literal('byKind'), z.literal('root'), z.string().min(1)]);

export const assetSettingsSchema = z.object({
  dropTarget: assetDropTargetSchema.default('byKind'),
  kindFolders: z.partialRecord(assetKindSchema, z.string().min(1).nullable()).default({}),
});

export const assetSettingsPatchSchema = assetSettingsSchema.partial();

export const assetsSnapshotSchema = z.object({
  folders: z.array(assetFolderSchema),
  assets: z.array(assetSchema),
  settings: assetSettingsSchema,
});

export const folderInputSchema = z.object({
  name: assetFolderSchema.shape.name,
  parentId: z.string().min(1).nullable().default(null),
});

export const folderPatchSchema = z
  .object({ name: assetFolderSchema.shape.name, parentId: z.string().min(1).nullable() })
  .partial();

export const assetTargetSchema = z.union([z.literal('auto'), z.string().min(1), z.null()]);

export const assetFileInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  mime: z.string().optional(),
  bytes: z.instanceof(Uint8Array).refine((bytes) => bytes.byteLength <= ASSET_MAX_BYTES, {
    message: 'File too large',
  }),
});

export const assetImportSchema = z.object({
  target: assetTargetSchema,
  files: z.array(assetFileInputSchema).min(1).max(500),
});

export const assetPatchSchema = z
  .object({
    name: assetSchema.shape.name,
    folderId: z.string().min(1).nullable(),
    tags: assetSchema.shape.tags,
  })
  .partial();

export const assetIdsSchema = z.array(z.string().min(1)).min(1);

export const assetPickResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('imported'), snapshot: assetsSnapshotSchema, ids: z.array(z.string()) }),
  z.object({ status: z.literal('cancelled') }),
]);

export type AssetKind = z.infer<typeof assetKindSchema>;
export type AssetFolder = z.infer<typeof assetFolderSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type AssetSettings = z.infer<typeof assetSettingsSchema>;
export type AssetSettingsPatch = z.infer<typeof assetSettingsPatchSchema>;
export type AssetsSnapshot = z.infer<typeof assetsSnapshotSchema>;
export type FolderInput = z.input<typeof folderInputSchema>;
export type FolderPatch = z.infer<typeof folderPatchSchema>;
export type AssetTarget = z.infer<typeof assetTargetSchema>;
export type AssetFileInput = z.input<typeof assetFileInputSchema>;
export type AssetImport = z.input<typeof assetImportSchema>;
export type AssetPatch = z.infer<typeof assetPatchSchema>;
export type AssetPickResult = z.infer<typeof assetPickResultSchema>;

const EXTENSION_KINDS: Record<string, AssetKind> = {
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  svg: 'image',
  avif: 'image',
  ico: 'image',
  tif: 'image',
  tiff: 'image',
  psd: 'image',
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  flac: 'audio',
  m4a: 'audio',
  aac: 'audio',
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  mkv: 'video',
  avi: 'video',
  pdf: 'document',
  txt: 'document',
  md: 'document',
  doc: 'document',
  docx: 'document',
  rtf: 'document',
  csv: 'document',
  json: 'document',
  xml: 'document',
  ttf: 'font',
  otf: 'font',
  woff: 'font',
  woff2: 'font',
  fbx: 'model',
  obj: 'model',
  gltf: 'model',
  glb: 'model',
  blend: 'model',
  stl: 'model',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',
};

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  ico: 'image/x-icon',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  zip: 'application/zip',
};

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function assetKindOf(name: string, mime?: string): AssetKind {
  const byExtension = EXTENSION_KINDS[extensionOf(name)];
  if (byExtension) return byExtension;
  const type = (mime ?? '').split('/')[0];
  if (type === 'image' || type === 'audio' || type === 'video' || type === 'font') return type;
  if (type === 'text') return 'document';
  return 'other';
}

export function assetMimeOf(name: string, mime?: string): string {
  if (mime && mime.length > 0) return mime;
  return MIME_BY_EXTENSION[extensionOf(name)] ?? 'application/octet-stream';
}

export function assetUrl(id: string): string {
  return `${ASSET_PROTOCOL}://asset/${encodeURIComponent(id)}`;
}

export function resolveDropFolder(
  settings: AssetSettings,
  kind: AssetKind,
  folderIds: ReadonlySet<string>,
): string | null {
  if (settings.dropTarget === 'root') return null;
  if (settings.dropTarget === 'byKind') {
    const configured = settings.kindFolders[kind];
    if (configured === null) return null;
    const folderId = configured ?? (kind === 'other' ? null : DEFAULT_FOLDER_IDS[kind]);
    return folderId !== null && folderIds.has(folderId) ? folderId : null;
  }
  return folderIds.has(settings.dropTarget) ? settings.dropTarget : null;
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${String(size)} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit] ?? 'GB'}`;
}
