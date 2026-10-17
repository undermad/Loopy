import { ArrowLeftRight, Check, Plus, Trash2, X } from 'lucide-react';
import { contrastLevels, readableTextColour } from '@renderer/lib/colour';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import { usePalettes } from '@renderer/lib/palettes';
import { Button, DropdownMenu, IconButton, cx } from '@renderer/ui';
import { ColourInput } from './ColourInput';
import editorStyles from './ColoursEditor.module.scss';
import styles from './ContrastTab.module.scss';

type Props = Pick<EditorProps, 'state' | 'setState'>;

interface ContrastState {
  source: string;
  draft: string;
  against: string[];
}

const DEFAULT_CONTRAST: ContrastState = { source: '#000000', draft: '#ffffff', against: ['#ffffff'] };

function readContrast(state: Record<string, unknown>): ContrastState {
  const raw = state['contrast'];
  if (typeof raw !== 'object' || raw === null) return DEFAULT_CONTRAST;
  const record = raw as Record<string, unknown>;
  const source = typeof record['source'] === 'string' ? record['source'] : DEFAULT_CONTRAST.source;
  const draft = typeof record['draft'] === 'string' ? record['draft'] : DEFAULT_CONTRAST.draft;
  const against = Array.isArray(record['against'])
    ? record['against'].filter((item): item is string => typeof item === 'string')
    : DEFAULT_CONTRAST.against;
  return { source, draft, against };
}

function Badge({ pass, label }: { pass: boolean; label: string }) {
  const { t } = useTranslation('colours');
  return (
    <span className={cx(styles['badge'], pass ? styles['pass'] : styles['fail'])}>
      {pass ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
      {label}: {pass ? t('contrast.pass') : t('contrast.fail')}
    </span>
  );
}

export function ContrastTab({ state, setState }: Props) {
  const { t } = useTranslation('colours');
  const palettes = usePalettes() ?? [];
  const contrast = readContrast(state);
  const update = (patch: Partial<ContrastState>) => {
    setState({ contrast: { ...contrast, ...patch } });
  };
  const add = (hexes: string[]) => {
    const next = [...contrast.against];
    for (const hex of hexes) if (!next.includes(hex)) next.push(hex);
    update({ against: next });
  };

  return (
    <div className={editorStyles['tab']}>
      <section className={styles['section']} aria-label={t('contrast.source')}>
        <h3 className={editorStyles['heading']}>{t('contrast.source')}</h3>
        <ColourInput
          value={contrast.source}
          label={t('contrast.source')}
          onChange={(source) => {
            update({ source });
          }}
        />
      </section>
      <section className={styles['section']} aria-label={t('contrast.against')}>
        <h3 className={editorStyles['heading']}>{t('contrast.against')}</h3>
        <div className={editorStyles['toolbar']}>
          <ColourInput
            value={contrast.draft}
            label={t('contrast.hex')}
            onChange={(draft) => {
              update({ draft });
            }}
          />
          <Button
            size="sm"
            variant="primary"
            icon={<Plus aria-hidden="true" />}
            onClick={() => {
              add([contrast.draft]);
            }}
          >
            {t('contrast.add')}
          </Button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button size="sm" disabled={palettes.length === 0}>
                {t('contrast.addPalette')}
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="start">
              {palettes.map((palette) => (
                <DropdownMenu.Item
                  key={palette.id}
                  onSelect={() => {
                    add(palette.colours.map((colour) => colour.hex));
                  }}
                >
                  {palette.name}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
          {contrast.against.length > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 aria-hidden="true" />}
              onClick={() => {
                update({ against: [] });
              }}
            >
              {t('contrast.clear')}
            </Button>
          ) : null}
        </div>
        {contrast.against.length === 0 ? (
          <p className={editorStyles['muted']}>
            {t('contrast.empty')} {t('contrast.emptyHint')}
          </p>
        ) : (
          <ul className={styles['results']} aria-label={t('contrast.against')}>
            {contrast.against.map((hex) => {
              const levels = contrastLevels(contrast.source, hex);
              return (
                <li key={hex} className={styles['result']}>
                  <div className={styles['preview']} style={{ background: hex, color: contrast.source }}>
                    <strong>{t('contrast.sample')}</strong>
                    <span>{t('contrast.sampleBody')}</span>
                  </div>
                  <div className={styles['preview']} style={{ background: contrast.source, color: hex }}>
                    <strong>{t('contrast.sample')}</strong>
                    <span>{t('contrast.sampleBody')}</span>
                  </div>
                  <div className={styles['details']}>
                    <div className={styles['ratioRow']}>
                      <span
                        className={styles['chip']}
                        style={{ background: hex, color: readableTextColour(hex) }}
                      >
                        {hex}
                      </span>
                      <span className={styles['ratio']}>
                        {t('contrast.ratio', { ratio: levels.ratio.toFixed(2) })}
                      </span>
                      <IconButton
                        label={t('contrast.swap')}
                        size="sm"
                        onClick={() => {
                          update({
                            source: hex,
                            against: contrast.against.map((item) => (item === hex ? contrast.source : item)),
                          });
                        }}
                      >
                        <ArrowLeftRight aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        label={t('contrast.remove', { hex })}
                        size="sm"
                        onClick={() => {
                          update({ against: contrast.against.filter((item) => item !== hex) });
                        }}
                      >
                        <X aria-hidden="true" />
                      </IconButton>
                    </div>
                    <div className={styles['badges']}>
                      <Badge pass={levels.aaNormal} label={t('contrast.aaNormal')} />
                      <Badge pass={levels.aaLarge} label={t('contrast.aaLarge')} />
                      <Badge pass={levels.aaaNormal} label={t('contrast.aaaNormal')} />
                      <Badge pass={levels.aaaLarge} label={t('contrast.aaaLarge')} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
