import { useMemo, useState } from 'react';
import { Layers, RotateCcw } from 'lucide-react';
import { HARMONIES, PALETTE_CLUSTER_MAX_NEW, type Palette, type PaletteColour } from '@shared/colours';
import {
  CLUSTER_SCHEMES,
  clusterMember,
  clusterOffsets,
  dominantHue,
  hexToHsv,
  hueOffsetBetween,
  toWheelHue,
  type ClusterMember,
  type ClusterRules,
  type ClusterScheme,
  type ClusterStructure,
  type Hsv,
} from '@renderer/lib/colour';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import { createCluster, createPalette, usePaletteClusters, usePalettes } from '@renderer/lib/palettes';
import { Button, EmptyState, Field, IconButton, Input, Select, Switch, useToast } from '@renderer/ui';
import { ColourWheel } from './ColourWheel';
import editorStyles from './ColoursEditor.module.scss';
import styles from './ClusterTab.module.scss';

type Props = Pick<EditorProps, 'state' | 'setState'> & {
  seed: Palette | null;
  onCreated: (paletteId: string) => void;
};

type StoredRules = ClusterRules;

const STRUCTURES: ClusterStructure[] = [
  'keep',
  ...HARMONIES.filter((harmony): harmony is Exclude<ClusterStructure, 'keep'> => harmony !== 'custom'),
];

const DEFAULT_RULES: StoredRules = { scheme: 'auto', count: 2, structure: 'keep', balance: 60 };

function readRules(state: Record<string, unknown>): StoredRules {
  const raw = state['cluster'];
  if (typeof raw !== 'object' || raw === null) return DEFAULT_RULES;
  const record = raw as Record<string, unknown>;
  const scheme = CLUSTER_SCHEMES.find((item) => item === record['scheme']) ?? DEFAULT_RULES.scheme;
  const structure = STRUCTURES.find((item) => item === record['structure']) ?? DEFAULT_RULES.structure;
  const count =
    typeof record['count'] === 'number'
      ? Math.min(PALETTE_CLUSTER_MAX_NEW, Math.max(1, Math.round(record['count'])))
      : DEFAULT_RULES.count;
  const balance =
    typeof record['balance'] === 'number'
      ? Math.min(100, Math.max(0, Math.round(record['balance'])))
      : DEFAULT_RULES.balance;
  return { scheme, count, structure, balance };
}

interface Edit {
  nudge?: number;
  name?: string;
  included?: boolean;
}

interface Planned extends ClusterMember {
  name: string;
  included: boolean;
  nudge: number;
}

function signed(degrees: number): number {
  const wrapped = ((Math.round(degrees) % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

function baseHex(member: Pick<ClusterMember, 'hexes' | 'baseIndex'>): string {
  return member.hexes[member.baseIndex] ?? member.hexes[0] ?? '#808080';
}

export function ClusterTab({ seed, state, setState, onCreated }: Props) {
  const { t } = useTranslation('colours');
  if (!seed) {
    return (
      <div className={editorStyles['tab']}>
        <EmptyState icon={<Layers />} title={t('cluster.noSeed')} description={t('cluster.seedHint')} />
      </div>
    );
  }
  const rules = readRules(state);
  return (
    <ClusterPlanner
      key={`${seed.id}:${rules.scheme}:${rules.structure}`}
      seed={seed}
      rules={rules}
      onRules={(patch) => {
        setState({ cluster: { ...rules, ...patch } });
      }}
      onCreated={onCreated}
    />
  );
}

interface PlannerProps {
  seed: Palette;
  rules: StoredRules;
  onRules: (patch: Partial<StoredRules>) => void;
  onCreated: (paletteId: string) => void;
}

function ClusterPlanner({ seed, rules, onRules, onCreated }: PlannerProps) {
  const { t } = useTranslation('colours');
  const toast = useToast();
  const palettes = usePalettes();
  const clusters = usePaletteClusters();
  const [edits, setEdits] = useState<Record<number, Edit>>({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const cluster = seed.clusterId ? (clusters?.find((item) => item.id === seed.clusterId) ?? null) : null;
  const [clusterName, setClusterName] = useState(() => t('cluster.defaultName', { name: seed.name }));
  const seedHexes = useMemo(() => seed.colours.map((colour) => colour.hex), [seed]);
  const seedBase = hexToHsv(seed.colours[seed.baseIndex]?.hex ?? seedHexes[0] ?? '#808080');
  const chromatic = dominantHue(seedHexes).chromatic;

  const members = useMemo(
    () =>
      cluster
        ? (palettes ?? [])
            .filter((palette) => palette.clusterId === cluster.id && palette.id !== seed.id)
            .sort((a, b) => a.clusterPosition - b.clusterPosition)
        : [],
    [cluster, palettes, seed.id],
  );

  const planned = useMemo<Planned[]>(() => {
    const existing = members.map((member) =>
      hueOffsetBetween(
        seedHexes,
        member.colours.map((colour) => colour.hex),
      ),
    );
    const offsets = clusterOffsets(rules.scheme, rules.count, existing);
    const used = new Set([seed.name, ...members.map((member) => member.name)]);
    return offsets.map((offset, index) => {
      const edit = edits[index] ?? {};
      const nudge = edit.nudge ?? 0;
      const member = clusterMember(seed, offset + nudge, { ...rules, balance: rules.balance / 100 });
      let name = edit.name;
      if (name === undefined) {
        const family = t(`cluster.family.${member.family}`);
        name = family;
        for (let suffix = 2; used.has(name); suffix += 1) name = `${family} ${String(suffix)}`;
      }
      used.add(name);
      return { ...member, name, nudge, included: edit.included ?? true };
    });
  }, [edits, members, rules, seed, seedHexes, t]);

  const markers: PaletteColour[] = [
    { id: seed.id, name: seed.name, hex: baseHex({ hexes: seedHexes, baseIndex: seed.baseIndex }) },
    ...members.map((member) => ({
      id: member.id,
      name: member.name,
      hex: baseHex({ hexes: member.colours.map((colour) => colour.hex), baseIndex: member.baseIndex }),
    })),
    ...planned.map((member, index) => ({
      id: `planned-${String(index)}`,
      name: member.name,
      hex: baseHex(member),
    })),
  ];
  const firstPlanned = 1 + members.length;
  const included = planned.filter((member) => member.included);

  function edit(index: number, patch: Edit) {
    setEdits((current) => ({ ...current, [index]: { ...current[index], ...patch } }));
  }

  function turn(markerIndex: number, hsv: Hsv) {
    const index = markerIndex - firstPlanned;
    const member = planned[index];
    if (!member) return;
    const target = chromatic ? toWheelHue(hsv.h) - toWheelHue(seedBase.h) : toWheelHue(hsv.h);
    edit(index, { nudge: signed(target - (member.offset - member.nudge)) });
  }

  async function create() {
    if (included.length === 0 || busy) return;
    setBusy(true);
    try {
      const inputs = included.map((member) => ({
        name: member.name.trim() || t(`cluster.family.${member.family}`),
        harmony: member.harmony,
        baseIndex: member.baseIndex,
        source: 'wheel' as const,
        colours: member.hexes.map((hex, index) => ({
          hex,
          name: rules.structure === 'keep' ? (seed.colours[index]?.name ?? '') : '',
        })),
      }));
      if (cluster) {
        let first: Palette | null = null;
        for (const input of inputs) {
          const palette = await createPalette({ ...input, clusterId: cluster.id });
          first ??= palette;
        }
        toast.show({
          title: t('cluster.extended', { count: inputs.length, name: cluster.name }),
          variant: 'success',
        });
        onCreated(first?.id ?? seed.id);
        return;
      }
      const name = clusterName.trim() || t('cluster.defaultName', { name: seed.name });
      await createCluster({ name, paletteIds: [seed.id], palettes: inputs });
      toast.show({ title: t('cluster.created', { count: inputs.length + 1, name }), variant: 'success' });
      onCreated(seed.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={editorStyles['tab']}>
      <div className={styles['header']}>
        <h2 className={styles['title']}>{t('cluster.title')}</h2>
        <p className={editorStyles['muted']}>{t('cluster.intro')}</p>
      </div>
      <div className={styles['layout']}>
        <div className={styles['rules']}>
          {cluster ? (
            <p className={styles['context']}>{t('cluster.inCluster', { name: cluster.name })}</p>
          ) : (
            <Field label={t('library.clusterName')}>
              <Input
                size="sm"
                value={clusterName}
                maxLength={80}
                onChange={(event) => {
                  setClusterName(event.target.value);
                }}
              />
            </Field>
          )}
          <Field label={t('cluster.count')}>
            <Input
              size="sm"
              type="number"
              min={1}
              max={PALETTE_CLUSTER_MAX_NEW}
              value={rules.count}
              onChange={(event) => {
                const count = Number(event.target.value);
                if (Number.isFinite(count) && count >= 1) {
                  onRules({ count: Math.min(PALETTE_CLUSTER_MAX_NEW, Math.round(count)) });
                }
              }}
            />
          </Field>
          <Field label={t('cluster.scheme')} hint={t(`cluster.schemeHints.${rules.scheme}`)}>
            <Select
              size="sm"
              value={rules.scheme}
              aria-label={t('cluster.scheme')}
              options={CLUSTER_SCHEMES.map((scheme) => ({
                value: scheme,
                label: t(`cluster.schemes.${scheme}`),
              }))}
              onValueChange={(value) => {
                onRules({ scheme: value as ClusterScheme });
              }}
            />
          </Field>
          <Field label={t('cluster.structure')} hint={t('cluster.structureHint')}>
            <Select
              size="sm"
              value={rules.structure}
              aria-label={t('cluster.structure')}
              options={STRUCTURES.map((structure) => ({
                value: structure,
                label: structure === 'keep' ? t('cluster.keep') : t(`harmony.${structure}`),
              }))}
              onValueChange={(value) => {
                onRules({ structure: value as ClusterStructure });
              }}
            />
          </Field>
          <label className={styles['slider']}>
            <span>
              {t('cluster.balance')} · {rules.balance}%
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={rules.balance}
              aria-label={t('cluster.balance')}
              onChange={(event) => {
                onRules({ balance: Number(event.target.value) });
              }}
            />
            <span className={editorStyles['muted']}>{t('cluster.balanceHint')}</span>
          </label>
        </div>
        <div className={styles['wheel']} role="group" aria-label={t('cluster.wheel')}>
          <ColourWheel
            colours={markers}
            selectedIndex={Math.min(selectedIndex, markers.length - 1)}
            baseIndex={0}
            onSelect={setSelectedIndex}
            onChange={turn}
          />
        </div>
      </div>
      <section className={styles['members']} aria-label={t('cluster.title')}>
        <div className={styles['member']}>
          <span className={styles['role']}>{t('cluster.seed')}</span>
          <span className={styles['memberName']}>{seed.name}</span>
          <Strip hexes={seedHexes} />
        </div>
        {members.length > 0 ? <h3 className={editorStyles['heading']}>{t('cluster.existing')}</h3> : null}
        {members.map((member) => (
          <div key={member.id} className={styles['member']}>
            <span className={styles['role']} />
            <span className={styles['memberName']}>{member.name}</span>
            <Strip hexes={member.colours.map((colour) => colour.hex)} />
          </div>
        ))}
        {planned.map((member, index) => (
          <div key={index} className={styles['member']} data-excluded={member.included ? undefined : 'true'}>
            <Switch
              size="sm"
              checked={member.included}
              aria-label={t('cluster.include', { name: member.name })}
              onCheckedChange={(checked) => {
                edit(index, { included: checked });
              }}
            />
            <Input
              size="sm"
              className={styles['memberName']}
              value={member.name}
              maxLength={80}
              aria-label={t('cluster.name', { index: index + 1 })}
              onChange={(event) => {
                edit(index, { name: event.target.value });
              }}
            />
            <Strip hexes={member.hexes} />
            <span className={styles['shift']}>{t('cluster.shift', { degrees: signed(member.offset) })}</span>
            <IconButton
              label={t('cluster.reset')}
              size="sm"
              disabled={member.nudge === 0}
              onClick={() => {
                edit(index, { nudge: 0 });
              }}
            >
              <RotateCcw aria-hidden="true" />
            </IconButton>
          </div>
        ))}
      </section>
      <div className={editorStyles['toolbar']}>
        <Button
          variant="primary"
          size="sm"
          icon={<Layers aria-hidden="true" />}
          disabled={included.length === 0 || busy}
          onClick={() => void create()}
        >
          {cluster ? t('cluster.extend') : t('cluster.create')}
        </Button>
        {included.length === 0 ? <span className={editorStyles['muted']}>{t('cluster.nothing')}</span> : null}
      </div>
    </div>
  );
}

function Strip({ hexes }: { hexes: string[] }) {
  return (
    <span className={styles['strip']} aria-hidden="true">
      {hexes.map((hex, index) => (
        <span key={`${hex}-${String(index)}`} style={{ background: hex }} title={hex} />
      ))}
    </span>
  );
}
