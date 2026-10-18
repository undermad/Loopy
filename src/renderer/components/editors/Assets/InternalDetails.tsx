import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { AssetFolder } from '@shared/assets';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, Field, Input, ScrollArea, Select } from '@renderer/ui';
import { InternalThumbnail } from './InternalGrid';
import { saveInternal } from './internalActions';
import { INTERNAL_SCOPES, folderIdOf, folderOptions, folderValue, type InternalItem } from './kinds';
import styles from './AssetDetails.module.scss';

export interface InternalDetailsProps {
  item: InternalItem;
  folders: AssetFolder[];
  onOpen: (item: InternalItem) => void;
}

function save(item: InternalItem, patch: { name?: string; folderId?: string | null }): Promise<unknown> {
  return saveInternal(item.kind, item.id, patch);
}

function Details({ item, folders, onOpen }: InternalDetailsProps) {
  const { t } = useTranslation('assets');
  const [name, setName] = useState(item.name);
  const scope = INTERNAL_SCOPES[item.kind];
  const scoped = folders.filter((folder) => folder.scope === scope);

  function commitName() {
    const next = name.trim();
    if (next.length === 0) {
      setName(item.name);
      return;
    }
    if (next !== item.name) void save(item, { name: next });
  }

  return (
    <>
      <div className={styles['previewBox']} role="img" aria-label={t('fields.preview', { name: item.name })}>
        <InternalThumbnail item={item} className={styles['preview']} />
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
        <dd>{t(`internalKinds.${item.kind}`)}</dd>
      </dl>
      <Field label={t('fields.folder')}>
        <Select
          size="sm"
          options={folderOptions(scoped, t(scope))}
          value={folderValue(item.folderId)}
          onValueChange={(value) => void save(item, { folderId: folderIdOf(value) })}
        />
      </Field>
      <div className={styles['actions']}>
        <Button
          size="sm"
          variant="primary"
          icon={<ExternalLink aria-hidden="true" />}
          onClick={() => {
            onOpen(item);
          }}
        >
          {t('open')}
        </Button>
      </div>
    </>
  );
}

export function InternalDetails(props: InternalDetailsProps) {
  const { t } = useTranslation('assets');
  return (
    <aside className={styles['panel']} aria-label={t('details')}>
      <ScrollArea className={styles['scroll']} viewportClassName={styles['viewport']}>
        <Details key={`${props.item.kind}:${props.item.id}`} {...props} />
      </ScrollArea>
    </aside>
  );
}
