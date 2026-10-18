import type { MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { extractSection, type LinkParts } from '@shared/markdown';
import { useTranslation } from '@renderer/lib/i18n';
import { findNote, resolveNote, useNoteIndex } from '@renderer/lib/notes';
import { NoteMarkdown } from './NoteMarkdown';
import { useLoopyItems } from './useLoopyItems';
import styles from './HoverPreview.module.scss';

export interface HoverPreviewProps {
  link: LinkParts;
  rect: DOMRect;
  sourceId: string | null;
  onEnter: () => void;
  onLeave: () => void;
  onLink: (link: LinkParts, event: MouseEvent) => void;
}

const WIDTH = 420;
const HEIGHT = 320;

export function HoverPreview({ link, rect, sourceId, onEnter, onLeave, onLink }: HoverPreviewProps) {
  const { t } = useTranslation('notes');
  const index = useNoteIndex();
  const loopy = useLoopyItems();
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - WIDTH - 8));
  const below = rect.bottom + HEIGHT + 8 < window.innerHeight;
  const top = below ? rect.bottom + 6 : Math.max(8, rect.top - HEIGHT - 6);

  let content;
  if (link.kind === 'note') {
    const note = link.target === '' ? findNote(sourceId) : resolveNote(index, link.target);
    content = note ? (
      <>
        <div className={styles['title']}>{note.title}</div>
        <NoteMarkdown
          body={extractSection(note.body, link.subpath)}
          noteId={note.id}
          depth={2}
          onLink={onLink}
          onTag={() => undefined}
        />
      </>
    ) : (
      <p className={styles['muted']}>{t('reading.createHint', { name: link.target })}</p>
    );
  } else {
    const item = loopy.find(link.kind, link.target);
    const image = loopy.imageUrl(item);
    content = item ? (
      <>
        <div className={styles['title']}>{item.kind === 'ticket' ? item.detail : item.name}</div>
        <div className={styles['muted']}>
          {t(`kinds.${item.kind}`)}
          {item.stateName ? ` · ${item.stateName}` : ''}
        </div>
        {image ? <img className={styles['image']} src={image} alt="" /> : null}
        {item.colours.length > 0 ? (
          <div className={styles['swatches']}>
            {item.colours.map((hex, position) => (
              <span key={`${hex}-${String(position)}`} style={{ background: hex }} title={hex} />
            ))}
          </div>
        ) : null}
      </>
    ) : (
      <p className={styles['muted']}>{t('reading.missing', { name: link.target })}</p>
    );
  }

  return createPortal(
    <div
      className={styles['preview']}
      role="tooltip"
      style={{ left, top, width: WIDTH, maxHeight: HEIGHT }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {content}
    </div>,
    document.body,
  );
}
