import { ASSET_PROTOCOL } from '@shared/assets';
import { readAssetBytes } from './storage/assets-repository';
import type { ProjectDatabase } from './storage/project-database';

export const assetSchemePrivileges = {
  scheme: ASSET_PROTOCOL,
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
};

export function assetIdFromUrl(url: string): string | null {
  const match = new RegExp(`^${ASSET_PROTOCOL}://asset/([^/?#]+)$`).exec(url);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function handleAssetRequest(project: () => ProjectDatabase | null, request: Request): Response {
  const id = assetIdFromUrl(request.url);
  const current = project();
  if (!id || !current) return new Response(null, { status: 404 });
  const asset = readAssetBytes(current.db, id);
  if (!asset) return new Response(null, { status: 404 });
  return new Response(asset.bytes, {
    status: 200,
    headers: {
      'content-type': asset.mime,
      'content-length': String(asset.bytes.byteLength),
      'access-control-allow-origin': '*',
      'cache-control': 'no-cache',
    },
  });
}
