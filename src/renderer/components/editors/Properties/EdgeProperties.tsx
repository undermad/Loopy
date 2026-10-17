import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { EDGE_MARKERS, EDGE_PATHS, STROKE_STYLES, type BoardEdge, type EdgeData } from '@shared/board';
import { commitChanges, edgeData } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, Field, Input, Select, Switch } from '@renderer/ui';
import { ProjectColourPicker } from '../../ProjectColourPicker/ProjectColourPicker';
import { NumberField } from './NumberField';
import styles from './PropertiesEditor.module.scss';

function save(edge: BoardEdge, patch: Partial<EdgeData>) {
  void commitChanges(edge.boardId, { upsertEdges: [{ ...edge, data: { ...edge.data, ...patch } }] });
}

export function EdgeProperties({ edge }: { edge: BoardEdge }) {
  const { t } = useTranslation('editors');
  const style = edgeData(edge);
  const [label, setLabel] = useState<string | null>(null);

  return (
    <section className={styles['section']} aria-label={t('properties.edge')}>
      <h3 className={styles['heading']}>{t('properties.edge')}</h3>
      <Field label={t('properties.label')}>
        <Input
          size="sm"
          value={label ?? style.label}
          maxLength={200}
          onChange={(event) => {
            setLabel(event.target.value);
          }}
          onBlur={() => {
            if (label !== null && label !== style.label) save(edge, { label });
            setLabel(null);
          }}
        />
      </Field>
      <div className={styles['swatchRow']}>
        <ProjectColourPicker
          size="sm"
          value={style.colour ?? { hex: '#64748b', ref: null }}
          label={t('properties.colour')}
          onChange={(colour) => {
            save(edge, { colour });
          }}
        />
        <span>{t('properties.colour')}</span>
        {style.colour ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              save(edge, { colour: null });
            }}
          >
            {t('properties.resetFill')}
          </Button>
        ) : null}
      </div>
      <div className={styles['pair']}>
        <NumberField
          label={t('properties.width')}
          value={style.width}
          min={0.5}
          step={0.5}
          digits={1}
          onCommit={(width) => {
            save(edge, { width: Math.min(24, Math.max(0.5, width)) });
          }}
        />
        <Field label={t('properties.line')}>
          <Select
            size="sm"
            value={style.dash}
            aria-label={t('properties.line')}
            options={STROKE_STYLES.map((value) => ({ value, label: t(`properties.strokeStyles.${value}`) }))}
            onValueChange={(value) => {
              save(edge, { dash: value as EdgeData['dash'] });
            }}
          />
        </Field>
      </div>
      <Field label={t('properties.path')}>
        <Select
          size="sm"
          value={style.path}
          aria-label={t('properties.path')}
          options={EDGE_PATHS.map((value) => ({ value, label: t(`properties.paths.${value}`) }))}
          onValueChange={(value) => {
            save(edge, { path: value as EdgeData['path'] });
          }}
        />
      </Field>
      <div className={styles['pair']}>
        <Field label={t('properties.startMarker')}>
          <Select
            size="sm"
            value={style.startMarker}
            aria-label={t('properties.startMarker')}
            options={EDGE_MARKERS.map((value) => ({ value, label: t(`properties.markers.${value}`) }))}
            onValueChange={(value) => {
              save(edge, { startMarker: value as EdgeData['startMarker'] });
            }}
          />
        </Field>
        <Field label={t('properties.endMarker')}>
          <Select
            size="sm"
            value={style.endMarker}
            aria-label={t('properties.endMarker')}
            options={EDGE_MARKERS.map((value) => ({ value, label: t(`properties.markers.${value}`) }))}
            onValueChange={(value) => {
              save(edge, { endMarker: value as EdgeData['endMarker'] });
            }}
          />
        </Field>
      </div>
      <Switch
        size="sm"
        label={t('properties.animated')}
        checked={style.animated}
        onCheckedChange={(animated) => {
          save(edge, { animated });
        }}
      />
      <Button
        size="sm"
        icon={<ArrowLeftRight aria-hidden="true" />}
        onClick={() => {
          void commitChanges(edge.boardId, {
            upsertEdges: [
              {
                ...edge,
                sourceId: edge.targetId,
                targetId: edge.sourceId,
                data: { ...edge.data, sourceHandle: style.targetHandle, targetHandle: style.sourceHandle },
              },
            ],
          });
        }}
      >
        {t('properties.reverse')}
      </Button>
    </section>
  );
}
