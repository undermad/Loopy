import { useState } from 'react';
import { Plus } from 'lucide-react';
import { searchPresets, type PalettePreset } from '@renderer/lib/colour';
import { useTranslation } from '@renderer/lib/i18n';
import { createPalette } from '@renderer/lib/palettes';
import { Button, Input, Tag, useToast } from '@renderer/ui';
import styles from './ColoursEditor.module.scss';

export interface ExploreTabProps {
  onAdded: (paletteId: string) => void;
}

export function ExploreTab({ onAdded }: ExploreTabProps) {
  const { t } = useTranslation('colours');
  const toast = useToast();
  const [search, setSearch] = useState('');
  const presets = searchPresets(search);

  async function add(preset: PalettePreset) {
    const palette = await createPalette({
      name: preset.name,
      harmony: 'custom',
      source: 'preset',
      colours: preset.colours.map((hex) => ({ hex })),
    });
    toast.show({ title: t('explore.added', { name: preset.name }), variant: 'success' });
    onAdded(palette.id);
  }

  return (
    <div className={styles['tab']}>
      <div className={styles['toolbar']}>
        <Input
          size="sm"
          type="search"
          className={styles['search']}
          value={search}
          aria-label={t('explore.search')}
          placeholder={t('explore.search')}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />
      </div>
      {presets.length === 0 ? (
        <p className={styles['muted']}>{t('explore.noMatch')}</p>
      ) : (
        <div className={styles['grid']}>
          {presets.map((preset) => (
            <article key={preset.id} className={styles['card']} aria-label={preset.name}>
              <div className={styles['strip']} aria-hidden="true">
                {preset.colours.map((hex) => (
                  <span key={hex} style={{ background: hex }} />
                ))}
              </div>
              <div className={styles['cardTitle']}>
                <span>{preset.name}</span>
                <span className={styles['muted']}>{t(`harmony.${preset.harmony}`)}</span>
              </div>
              <div className={styles['tags']}>
                {preset.tags.map((tag) => (
                  <Tag key={tag} size="sm">
                    {tag}
                  </Tag>
                ))}
              </div>
              <Button size="sm" icon={<Plus aria-hidden="true" />} onClick={() => void add(preset)}>
                {t('explore.add')}
              </Button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
