import { IdCard, LayoutTemplate } from 'lucide-react';
import { cardTemplateInputSchema } from '@shared/cards';
import { STARTER_TEMPLATES, blankTemplate, useCardTemplates, useSavedCards } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import type { Draft } from './draft';
import styles from '../CardDesigner.module.scss';

export function Starters({ onStart }: { onStart: (draft: Draft) => void }) {
  const { t } = useTranslation('editors');
  const templates = useCardTemplates() ?? [];
  const cards = useSavedCards() ?? [];
  const parse = (input: Parameters<typeof cardTemplateInputSchema.parse>[0]) => {
    const { name, ...layout } = cardTemplateInputSchema.parse(input);
    return { name, layout };
  };
  return (
    <div className={styles['starters']}>
      <h3 className={styles['heading']}>{t('cards.startFrom')}</h3>
      <div className={styles['starterGrid']}>
        <button
          type="button"
          className={styles['starter']}
          onClick={() => {
            const { name, layout } = parse(
              blankTemplate(t('cards.defaultName', { number: templates.length + 1 })),
            );
            onStart({ kind: 'template', name, templateId: null, layout, values: {} });
          }}
        >
          <LayoutTemplate aria-hidden="true" />
          {t('cards.blank')}
        </button>
        {STARTER_TEMPLATES.map((starter) => (
          <button
            key={starter.id}
            type="button"
            className={styles['starter']}
            onClick={() => {
              const { name, layout } = parse(structuredClone(starter.template));
              onStart({ kind: 'template', name, templateId: null, layout, values: {} });
            }}
          >
            <LayoutTemplate aria-hidden="true" />
            {starter.template.name}
          </button>
        ))}
      </div>
      <h3 className={styles['heading']}>{t('cards.newCard')}</h3>
      <div className={styles['starterGrid']}>
        <button
          type="button"
          className={styles['starter']}
          onClick={() => {
            const { name, layout } = parse(
              blankTemplate(t('cards.defaultName', { number: cards.length + 1 })),
            );
            onStart({ kind: 'card', name, templateId: null, layout, values: {} });
          }}
        >
          <IdCard aria-hidden="true" />
          {t('cards.blankCard')}
        </button>
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            className={styles['starter']}
            onClick={() => {
              onStart({
                kind: 'card',
                name: template.name,
                templateId: template.id,
                layout: null,
                values: {},
              });
            }}
          >
            <IdCard aria-hidden="true" />
            {t('cards.cardFrom', { name: template.name })}
          </button>
        ))}
      </div>
    </div>
  );
}
