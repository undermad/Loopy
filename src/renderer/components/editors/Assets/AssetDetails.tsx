import { useState } from 'react';
import { Download, FileQuestion, Trash2, X } from 'lucide-react';
import { assetUrl, formatBytes, type Asset, type AssetFolder } from '@shared/assets';
import { assetActions } from '@renderer/lib/assets';
import { useFormat, useTranslation } from '@renderer/lib/i18n';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  ScrollArea,
  Select,
  Tag,
} from '@renderer/ui';
import { AssetThumbnail } from './AssetGrid';
import { folderIdOf, folderOptions, folderValue } from './kinds';
import styles from './AssetDetails.module.scss';

export interface AssetDetailsProps {
  asset: Asset | null;
  folders: AssetFolder[];
}

function Preview({ asset }: { asset: Asset }) {
  if (asset.kind === 'audio') {
    return <audio controls src={assetUrl(asset.id)} className={styles['media']} aria-label={asset.name} />;
  }
  if (asset.kind === 'video') {
    return <video controls src={assetUrl(asset.id)} className={styles['media']} aria-label={asset.name} />;
  }
  return <AssetThumbnail asset={asset} className={styles['preview']} />;
}

function Details({ asset, folders }: { asset: Asset; folders: AssetFolder[] }) {
  const { t } = useTranslation('assets');
  const { t: tc } = useTranslation('common');
  const format = useFormat();
  const [name, setName] = useState(asset.name);
  const [tag, setTag] = useState('');
  const [confirming, setConfirming] = useState(false);

  function commitName() {
    const next = name.trim();
    if (next.length === 0) {
      setName(asset.name);
      return;
    }
    if (next !== asset.name) void assetActions.update(asset.id, { name: next });
  }

  function addTag() {
    const next = tag.trim();
    setTag('');
    if (next.length === 0 || asset.tags.includes(next)) return;
    void assetActions.update(asset.id, { tags: [...asset.tags, next] });
  }

  return (
    <>
      <div className={styles['previewBox']} role="img" aria-label={t('fields.preview', { name: asset.name })}>
        <Preview asset={asset} />
      </div>
      <Field label={t('fields.name')}>
        <Input
          size="sm"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitName();
            }
          }}
        />
      </Field>
      <dl className={styles['facts']}>
        <dt>{t('fields.kind')}</dt>
        <dd>{t(`kinds.${asset.kind}`)}</dd>
        <dt>{t('fields.mime')}</dt>
        <dd>{asset.mime}</dd>
        <dt>{t('fields.size')}</dt>
        <dd>{formatBytes(asset.size)}</dd>
        {asset.width !== null && asset.height !== null ? (
          <>
            <dt>{t('fields.dimensions')}</dt>
            <dd>{`${String(asset.width)} × ${String(asset.height)}`}</dd>
          </>
        ) : null}
        <dt>{t('fields.created')}</dt>
        <dd>{format.dateTime(asset.createdAt)}</dd>
        <dt>{t('fields.updated')}</dt>
        <dd>{format.dateTime(asset.updatedAt)}</dd>
      </dl>
      <Field label={t('fields.folder')}>
        <Select
          size="sm"
          options={folderOptions(folders, t('topLevel'))}
          value={folderValue(asset.folderId)}
          onValueChange={(value) => void assetActions.move([asset.id], folderIdOf(value))}
        />
      </Field>
      <Field label={t('fields.tags')}>
        <Input
          size="sm"
          value={tag}
          placeholder={t('fields.addTag')}
          onChange={(event) => {
            setTag(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addTag();
            }
          }}
        />
      </Field>
      {asset.tags.length > 0 ? (
        <div className={styles['tags']}>
          {asset.tags.map((item) => (
            <Tag key={item} size="sm" className={styles['tag']}>
              {item}
              <IconButton
                label={t('fields.removeTag', { tag: item })}
                size="sm"
                tooltip={false}
                className={styles['removeTag']}
                onClick={() =>
                  void assetActions.update(asset.id, { tags: asset.tags.filter((other) => other !== item) })
                }
              >
                <X aria-hidden="true" />
              </IconButton>
            </Tag>
          ))}
        </div>
      ) : null}
      <div className={styles['actions']}>
        <Button
          size="sm"
          icon={<Download aria-hidden="true" />}
          onClick={() => void assetActions.exportToDisk(asset.id)}
        >
          {t('asset.export')}
        </Button>
        <Button
          size="sm"
          variant="danger"
          icon={<Trash2 aria-hidden="true" />}
          onClick={() => {
            setConfirming(true);
          }}
        >
          {tc('actions.delete')}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('asset.delete')}
        description={t('asset.deleteConfirm', { name: asset.name })}
        confirmLabel={tc('actions.delete')}
        cancelLabel={tc('actions.cancel')}
        closeLabel={tc('actions.close')}
        destructive
        onConfirm={() => assetActions.remove([asset.id]).then(() => undefined)}
      />
    </>
  );
}

export function AssetDetails({ asset, folders }: AssetDetailsProps) {
  const { t } = useTranslation('assets');
  return (
    <aside className={styles['panel']} aria-label={t('details')}>
      <ScrollArea className={styles['scroll']} viewportClassName={styles['viewport']}>
        {asset ? (
          <Details key={asset.id} asset={asset} folders={folders} />
        ) : (
          <EmptyState
            icon={<FileQuestion />}
            title={t('empty.selection')}
            description={t('empty.selectionHint')}
          />
        )}
      </ScrollArea>
    </aside>
  );
}
