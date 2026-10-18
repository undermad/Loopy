import { useRef, useState } from 'react';
import { Check, Layers, Pencil, X } from 'lucide-react';
import type { Palette, PaletteCluster, PaletteColour } from '@shared/colours';
import { useTranslation } from '@renderer/lib/i18n';
import { createPalette, moveToCluster, renameCluster } from '@renderer/lib/palettes';
import { Button, EmptyState, Field, Input, Switch, useToast } from '@renderer/ui';
import { ClusterPlanner, Strip, readRules, type PlannerHandle } from './ClusterTab';
import { ColourWheel } from './ColourWheel';
import editorStyles from './ColoursEditor.module.scss';
import styles from './ClusterTab.module.scss';

export interface ClusterDetailsProps {
  cluster: PaletteCluster;
  members: Palette[];
  editing: boolean;
  state: Record<string, unknown>;
  setState: (patch: Record<string, unknown>) => void;
  onModify: () => void;
  onDone: () => void;
  onOpenPalette: (paletteId: string) => void;
}

function marker(palette: Palette): PaletteColour {
  const base = palette.colours[palette.baseIndex] ?? palette.colours[0];
  return { id: palette.id, name: palette.name, hex: base?.hex ?? '#808080' };
}

export function ClusterDetails({
  cluster,
  members,
  editing,
  state,
  setState,
  onModify,
  onDone,
  onOpenPalette,
}: ClusterDetailsProps) {
  const { t } = useTranslation('colours');
  const toast = useToast();
  const planner = useRef<PlannerHandle>(null);
  const [name, setName] = useState(cluster.name);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const seed = members.find((member) => !removed.has(member.id)) ?? null;
  const rules = readRules(state);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const trimmed = name.trim();
      if (trimmed && trimmed !== cluster.name) await renameCluster(cluster.id, trimmed);
      for (const id of removed) await moveToCluster(id, null);
      const inputs = planner.current?.inputs() ?? [];
      for (const input of inputs) await createPalette({ ...input, clusterId: cluster.id });
      toast.show({ title: t('cluster.saved', { name: trimmed || cluster.name }), variant: 'success' });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const toolbar = (
    <div className={styles['detailsBar']}>
      <h2 className={styles['title']}>
        <Layers aria-hidden="true" />
        {cluster.name}
      </h2>
      <span className={editorStyles['muted']}>{t('library.clusterPalettes', { count: members.length })}</span>
      <span className={styles['grow']} />
      {editing ? (
        <>
          <Button size="sm" variant="ghost" icon={<X aria-hidden="true" />} onClick={onDone}>
            {t('edit.cancel')}
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Check aria-hidden="true" />}
            disabled={busy}
            onClick={() => void save()}
          >
            {t('edit.saveChanges')}
          </Button>
        </>
      ) : (
        <Button size="sm" variant="primary" icon={<Pencil aria-hidden="true" />} onClick={onModify}>
          {t('edit.modify')}
        </Button>
      )}
    </div>
  );

  if (!editing) {
    return (
      <div className={editorStyles['tab']}>
        {toolbar}
        <p className={editorStyles['muted']}>{t('cluster.readOnlyHint')}</p>
        {members.length === 0 ? (
          <EmptyState icon={<Layers />} title={t('library.clusterEmpty')} />
        ) : (
          <div className={styles['layout']}>
            <section className={styles['members']} aria-label={cluster.name}>
              {members.map((member) => (
                <div key={member.id} className={styles['member']}>
                  <span className={styles['memberName']}>{member.name}</span>
                  <Strip hexes={member.colours.map((colour) => colour.hex)} />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onOpenPalette(member.id);
                    }}
                  >
                    {t('cluster.open')}
                  </Button>
                </div>
              ))}
            </section>
            <div className={styles['wheel']} role="group" aria-label={t('cluster.wheel')}>
              <ColourWheel
                colours={members.map(marker)}
                selectedIndex={Math.min(selectedIndex, members.length - 1)}
                baseIndex={0}
                disabled
                onSelect={setSelectedIndex}
                onChange={() => undefined}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={editorStyles['tab']}>
      {toolbar}
      <Field label={t('library.clusterName')}>
        <Input
          size="sm"
          value={name}
          maxLength={80}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </Field>
      <section className={styles['members']} aria-label={t('cluster.keepTitle')}>
        <h3 className={editorStyles['heading']}>{t('cluster.keepTitle')}</h3>
        {members.map((member) => (
          <div
            key={member.id}
            className={styles['member']}
            data-excluded={removed.has(member.id) ? 'true' : undefined}
          >
            <Switch
              size="sm"
              checked={!removed.has(member.id)}
              aria-label={t('cluster.keepMember', { name: member.name })}
              onCheckedChange={(keep) => {
                setRemoved((current) => {
                  const next = new Set(current);
                  if (keep) next.delete(member.id);
                  else next.add(member.id);
                  return next;
                });
              }}
            />
            <span className={styles['memberName']}>{member.name}</span>
            <Strip hexes={member.colours.map((colour) => colour.hex)} />
          </div>
        ))}
      </section>
      <h3 className={editorStyles['heading']}>{t('cluster.addTitle')}</h3>
      {seed ? (
        <ClusterPlanner
          key={`${seed.id}:${rules.scheme}:${rules.structure}`}
          ref={planner}
          seed={seed}
          rules={rules}
          embedded
          onRules={(patch) => {
            setState({ cluster: { ...rules, ...patch } });
          }}
          onCreated={() => undefined}
        />
      ) : (
        <p className={editorStyles['muted']}>{t('cluster.noSeedInCluster')}</p>
      )}
    </div>
  );
}
