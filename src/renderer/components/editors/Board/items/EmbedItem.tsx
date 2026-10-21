import type { NodeProps } from '@xyflow/react';
import { ExternalLink } from 'lucide-react';
import type { BoardLink } from '@shared/board';
import { itemData } from '@renderer/lib/board';
import { resolveCardLayout, useCardTemplates, useSavedCard } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { useNote } from '@renderer/lib/notes';
import { IconButton, cx } from '@renderer/ui';
import { useResolvedLink } from '../../../AssetLinkCard/AssetLinkCard';
import { CardFace } from '../../Cards/CardFace';
import { TablePreview } from '../../Tables/TablePreview';
import { useBoardActions } from '../BoardContext';
import { ItemFrame } from './ItemFrame';
import type { ItemFlowNode } from './TextItem';
import styles from './items.module.scss';

const EXCERPT = 400;

function plain(markdown: string): string {
  return markdown
    .replace(/[#>*_`~]+/g, '')
    .replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, EXCERPT);
}

function NotePreview({ id }: { id: string }) {
  const note = useNote(id);
  return <p className={styles['embedText']}>{note ? plain(note.body) : ''}</p>;
}

function CardPreview({ id }: { id: string }) {
  const card = useSavedCard(id);
  const templates = useCardTemplates();
  const layout = card ? resolveCardLayout(card, templates) : null;
  if (!card || !layout) return null;
  return <CardFace layout={layout} values={card.values} editable={false} className={styles['embedCard']} />;
}

function Preview({ link, colours }: { link: BoardLink; colours: string[] }) {
  if (link.kind === 'note') return <NotePreview id={link.id} />;
  if (link.kind === 'card') return <CardPreview id={link.id} />;
  if (link.kind === 'table') return <TablePreview tableId={link.id} className={styles['embedTable']} />;
  if (link.kind === 'palette') {
    return (
      <div className={styles['embedSwatches']}>
        {colours.map((colour, index) => (
          <span key={`${colour}-${String(index)}`} data-swatch="" style={{ backgroundColor: colour }} />
        ))}
      </div>
    );
  }
  return null;
}

function Embed({ link, selected }: { link: BoardLink; selected: boolean }) {
  const { t } = useTranslation('editors');
  const actions = useBoardActions();
  const resolved = useResolvedLink(link);
  return (
    <div className={cx(styles['embed'], 'nowheel', !selected && styles['cardInert'])}>
      <div className={styles['embedHeader']}>
        <span className={styles['embedTitle']}>
          <strong>{resolved.name}</strong>
          <span>{resolved.detail}</span>
        </span>
        {resolved.missing ? null : (
          <IconButton
            size="sm"
            className="nodrag"
            label={t('board.openEmbed', { name: resolved.name })}
            onClick={() => {
              actions.openLink(link);
            }}
          >
            <ExternalLink aria-hidden="true" />
          </IconButton>
        )}
      </div>
      {resolved.missing ? null : <Preview link={link} colours={resolved.colours} />}
    </div>
  );
}

export function EmbedItem({ data, selected, dragging, width, height }: NodeProps<ItemFlowNode>) {
  const { t } = useTranslation('editors');
  const { node } = data;
  const content = itemData({ type: 'embed', data: node.data });
  return (
    <ItemFrame
      node={node}
      label={content.name || t('properties.embed')}
      selected={selected}
      dragging={dragging}
      width={width ?? node.width}
      height={height ?? node.height}
    >
      {() =>
        content.target ? (
          <Embed link={content.target} selected={selected} />
        ) : (
          <span className={styles['linkEmpty']}>{t('board.embedEmpty')}</span>
        )
      }
    </ItemFrame>
  );
}
