import { useEffect, useState } from 'react';
import { IdCard, LayoutTemplate } from 'lucide-react';
import type { BoardNode, CardValue } from '@shared/board';
import { commitChanges, itemData, loadBoard, useBoardSnapshot, withData } from '@renderer/lib/board';
import { createSavedCard, useCardTemplates } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, Field, Input, Select, useToast } from '@renderer/ui';
import { CardPreview } from './CardPreview';
import styles from './CardDesigner.module.scss';

const NO_TEMPLATE = '__none';

interface ItemDraft {
  name: string;
  templateId: string | null;
  values: Record<string, CardValue>;
}

function draftOf(node: BoardNode): ItemDraft {
  const data = itemData({ type: 'card', data: node.data });
  return { name: data.name, templateId: data.templateId, values: structuredClone(data.values) };
}

function ItemEditor({
  node,
  boardName,
  onOpenTemplate,
  onSavedCard,
}: {
  node: BoardNode;
  boardName: string;
  onOpenTemplate: (templateId: string | null) => void;
  onSavedCard: (cardId: string) => void;
}) {
  const { t } = useTranslation('editors');
  const toast = useToast();
  const templates = useCardTemplates() ?? [];
  const initial = draftOf(node);
  const [draft, setDraft] = useState<ItemDraft>(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const template = templates.find((item) => item.id === draft.templateId) ?? null;

  async function save() {
    await commitChanges(node.boardId, { upsertNodes: [withData(node, { ...draft })] });
    toast.show({
      title: t('cards.cardSaved', { name: draft.name || (template?.name ?? t('properties.card')) }),
      variant: 'success',
    });
  }

  async function saveAsAsset() {
    if (!template || busy) return;
    setBusy(true);
    try {
      const card = await createSavedCard({
        name: draft.name.trim() || template.name,
        templateId: template.id,
        values: draft.values,
      });
      await commitChanges(node.boardId, { upsertNodes: [withData(node, { ...draft, cardId: card.id })] });
      onSavedCard(card.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles['designer']}>
      <div className={styles['top']}>
        <Field label={t('cards.cardName')}>
          <Input
            size="sm"
            value={draft.name}
            maxLength={80}
            onChange={(event) => {
              const name = event.target.value;
              setDraft((own) => ({ ...own, name }));
            }}
          />
        </Field>
        <Field label={t('cards.template')}>
          <Select
            size="sm"
            value={draft.templateId ?? NO_TEMPLATE}
            aria-label={t('cards.template')}
            options={[
              { value: NO_TEMPLATE, label: t('cards.noTemplate') },
              ...templates.map((item) => ({ value: item.id, label: item.name })),
            ]}
            onValueChange={(value) => {
              setDraft((own) => ({ ...own, templateId: value === NO_TEMPLATE ? null : value }));
            }}
          />
        </Field>
        <span className={styles['spacer']} />
        {dirty ? <span className={styles['unsaved']}>{t('cards.unsaved')}</span> : null}
      </div>
      <div className={styles['valuesLayout']}>
        <section className={styles['stage']} aria-label={t('cards.preview')}>
          {template ? (
            <CardPreview
              layout={template}
              values={draft.values}
              selectedFieldId={null}
              onValue={(fieldId, value) => {
                setDraft((own) => ({ ...own, values: { ...own.values, [fieldId]: value } }));
              }}
            />
          ) : (
            <p className={styles['muted']}>{t('cards.pickTemplate')}</p>
          )}
        </section>
        <aside className={styles['settings']} aria-label={t('cards.cardSettings')}>
          <p className={styles['muted']}>{t('cards.onBoard', { board: boardName })}</p>
          <Button
            size="sm"
            icon={<LayoutTemplate aria-hidden="true" />}
            disabled={dirty}
            onClick={() => {
              onOpenTemplate(draft.templateId);
            }}
          >
            {t('cards.editTemplate')}
          </Button>
        </aside>
      </div>
      <div className={styles['footer']}>
        {template ? (
          <Button
            size="sm"
            variant="ghost"
            icon={<IdCard aria-hidden="true" />}
            disabled={busy}
            onClick={() => void saveAsAsset()}
          >
            {t('properties.saveCardAsset')}
          </Button>
        ) : null}
        <span className={styles['spacer']} />
        {dirty ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(initial);
            }}
          >
            {t('cards.discard')}
          </Button>
        ) : null}
        <Button size="sm" variant="primary" disabled={!dirty} onClick={() => void save()}>
          {t('cards.saveCard')}
        </Button>
      </div>
    </div>
  );
}

export function BoardCardDesigner({
  boardId,
  nodeId,
  onOpenTemplate,
  onSavedCard,
}: {
  boardId: string;
  nodeId: string;
  onOpenTemplate: (templateId: string | null) => void;
  onSavedCard: (cardId: string) => void;
}) {
  const { t } = useTranslation('editors');
  const snapshot = useBoardSnapshot(boardId);
  useEffect(() => {
    if (!snapshot) void loadBoard(boardId).catch(() => undefined);
  }, [boardId, snapshot]);
  const node = snapshot?.nodes.find((item) => item.id === nodeId && item.type === 'card') ?? null;
  if (!snapshot || !node) {
    return (
      <div className={styles['designer']}>
        <p className={styles['muted']}>{t('cards.missingTarget')}</p>
      </div>
    );
  }
  return (
    <ItemEditor
      key={node.id}
      node={node}
      boardName={snapshot.board.name}
      onOpenTemplate={onOpenTemplate}
      onSavedCard={onSavedCard}
    />
  );
}
