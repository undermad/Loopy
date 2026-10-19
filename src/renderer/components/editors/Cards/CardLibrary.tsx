import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { IdCard, LayoutTemplate, Plus } from 'lucide-react';
import type { BoardLink } from '@shared/board';
import { reportAssetDrag } from '@renderer/lib/assets';
import { useCardTemplates, useSavedCards } from '@renderer/lib/cards';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import { cardTarget, openInEditor, useWorkspaceNames } from '@renderer/lib/workspaces';
import { Button } from '@renderer/ui';
import styles from './CardLibrary.module.scss';

const DRAG_DISTANCE = 4;

function useLinkDrag() {
  const dragged = useRef(false);
  function start(event: ReactPointerEvent, link: BoardLink) {
    if (event.button !== 0) return;
    const originX = event.clientX;
    const originY = event.clientY;
    dragged.current = false;
    const move = (moved: PointerEvent) => {
      if (!dragged.current && Math.hypot(moved.clientX - originX, moved.clientY - originY) < DRAG_DISTANCE)
        return;
      dragged.current = true;
      reportAssetDrag([], moved.clientX, moved.clientY, 'move', [link]);
    };
    const end = (ended: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (!dragged.current) return;
      reportAssetDrag([], ended.clientX, ended.clientY, ended.type === 'pointerup' ? 'drop' : 'cancel', [
        link,
      ]);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }
  return { start, wasDragged: () => dragged.current };
}

export function CardLibrary(_props: EditorProps) {
  const { t } = useTranslation('editors');
  const names = useWorkspaceNames();
  const templates = useCardTemplates() ?? [];
  const cards = useSavedCards() ?? [];
  const drag = useLinkDrag();

  function open(target: { kind: 'template' | 'card'; id: string } | null) {
    openInEditor(cardTarget(target, names));
  }

  return (
    <div className={styles['library']}>
      <div className={styles['actions']}>
        <Button
          size="sm"
          icon={<Plus aria-hidden="true" />}
          onClick={() => {
            open(null);
          }}
        >
          {t('cards.newTemplate')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<Plus aria-hidden="true" />}
          onClick={() => {
            open(null);
          }}
        >
          {t('cards.newCard')}
        </Button>
      </div>
      <h3 className={styles['heading']}>{t('cards.templates')}</h3>
      {templates.length === 0 ? (
        <p className={styles['empty']}>{t('cards.noTemplates')}</p>
      ) : (
        <ul className={styles['list']} aria-label={t('cards.templates')}>
          {templates.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                className={styles['row']}
                onClick={() => {
                  open({ kind: 'template', id: template.id });
                }}
              >
                <LayoutTemplate aria-hidden="true" />
                <span className={styles['name']}>{template.name}</span>
                <span className={styles['detail']}>
                  {t('cards.fieldCount', { count: template.fields.length })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <h3 className={styles['heading']}>{t('cards.savedCards')}</h3>
      {cards.length === 0 ? (
        <p className={styles['empty']}>{t('cards.noCards')}</p>
      ) : (
        <ul className={styles['list']} aria-label={t('cards.savedCards')}>
          {cards.map((card) => (
            <li key={card.id}>
              <button
                type="button"
                className={styles['row']}
                title={t('cards.dragCard')}
                onPointerDown={(event) => {
                  drag.start(event, { kind: 'card', id: card.id });
                }}
                onClick={() => {
                  if (!drag.wasDragged()) open({ kind: 'card', id: card.id });
                }}
              >
                <IdCard aria-hidden="true" />
                <span className={styles['name']}>{card.name}</span>
                <span className={styles['detail']}>
                  {templates.find((template) => template.id === card.templateId)?.name ??
                    t('cards.noTemplate')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
