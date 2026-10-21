import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import type { CardValue } from '@shared/board';
import type { CardField, CardLayout } from '@shared/cards';
import { dropField, fitCardHeight, overflowingFields } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { Button } from '@renderer/ui';
import type { CardViewDesign } from '../CardView';
import { CardPreview } from '../CardPreview';
import { CanvasContext, type CanvasApi, type Resizing } from './context';
import { DesignZone } from './DesignZone';
import { collide } from './collision';
import { FieldFrame } from './FieldFrame';
import styles from './Canvas.module.scss';

const DESIGN: CardViewDesign = { Zone: DesignZone, Field: FieldFrame };

type Actions = Omit<CanvasApi, 'gap' | 'resizing' | 'setResizing' | 'overflowing' | 'showGrid'>;

export interface DesignCanvasProps {
  layout: CardLayout;
  values: Record<string, CardValue>;
  designing: boolean;
  showGrid: boolean;
  zoom: number;
  actions: Actions;
  canvasRef: RefObject<HTMLDivElement | null>;
  onValue: (fieldId: string, value: CardValue) => void;
  onFields: (fields: CardField[]) => void;
  onFitHeight: (height: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onClearSelection: () => void;
}

interface Overflow {
  extra: number;
  ids: string[];
}

function measure(root: HTMLElement | null, autoHeight: boolean): Overflow {
  const body = root?.querySelector<HTMLElement>('[data-zone="body"]');
  if (!body || autoHeight) return { extra: 0, ids: [] };
  const extra = Math.max(0, body.scrollHeight - body.clientHeight);
  const rects = [...body.querySelectorAll<HTMLElement>(':scope > [data-field-id]')].map((element) => ({
    id: element.dataset['fieldId'] ?? '',
    bottom: element.offsetTop + element.offsetHeight,
  }));
  return { extra, ids: extra > 0 ? overflowingFields(rects, body.clientHeight) : [] };
}

export function DesignCanvas({
  layout,
  values,
  designing,
  showGrid,
  zoom,
  actions,
  canvasRef,
  onValue,
  onFields,
  onFitHeight,
  onKeyDown,
  onClearSelection,
}: DesignCanvasProps) {
  const { t } = useTranslation('editors');
  const [resizing, setResizing] = useState<Resizing | null>(null);
  const [overflow, setOverflow] = useState<Overflow>({ extra: 0, ids: [] });
  const measured = useRef(overflow);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useLayoutEffect(() => {
    const next = measure(canvasRef.current, layout.autoHeight);
    const last = measured.current;
    if (next.extra !== last.extra || next.ids.join() !== last.ids.join()) {
      measured.current = next;
      setOverflow(next);
    }
  }, [canvasRef, layout, values, designing, zoom]);

  const api = useMemo<CanvasApi>(
    () => ({
      ...actions,
      gap: layout.gap,
      showGrid,
      resizing,
      setResizing,
      overflowing: overflow.ids,
    }),
    [actions, layout.gap, showGrid, resizing, overflow.ids],
  );

  function dragEnd(event: DragEndEvent) {
    const next = dropField(layout.fields, String(event.active.id), event.over ? String(event.over.id) : null);
    if (next !== layout.fields) onFields(next);
  }

  return (
    <>
      {overflow.extra > 0 ? (
        <div role="status" className={styles['overflowNote']}>
          <span>{t('cards.overflow')}</span>
          <Button
            size="sm"
            onClick={() => {
              const body = canvasRef.current?.querySelector<HTMLElement>('[data-zone="body"]');
              onFitHeight(fitCardHeight(layout.height, body?.scrollHeight ?? 0, body?.clientHeight ?? 0));
            }}
          >
            {t('cards.fitHeight')}
          </Button>
        </div>
      ) : null}
      <div
        ref={canvasRef}
        role="group"
        aria-label={t('cards.canvas')}
        tabIndex={0}
        className={styles['canvas']}
        style={{ zoom }}
        data-mode={designing ? 'design' : 'fill'}
        onKeyDown={onKeyDown}
        onClick={(event) => {
          if (designing && event.target === event.currentTarget) onClearSelection();
        }}
      >
        <CanvasContext.Provider value={api}>
          <DndContext sensors={sensors} collisionDetection={collide} onDragEnd={dragEnd}>
            <CardPreview
              layout={layout}
              values={values}
              selectedFieldId={null}
              onValue={onValue}
              showHidden={designing}
              design={designing ? DESIGN : undefined}
            />
          </DndContext>
        </CanvasContext.Provider>
      </div>
    </>
  );
}
