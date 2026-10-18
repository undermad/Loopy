import { ChevronDown, Maximize2, Minimize2, MoreHorizontal } from 'lucide-react';
import type { AreaNode } from '@shared/layout';
import { getEditor, listEditors } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import { neighbours, type Side } from '@renderer/lib/layout';
import { areaActions, detachArea, useActiveWorkspace } from '@renderer/lib/workspaces';
import { DropdownMenu, IconButton, ScrollStrip } from '@renderer/ui';
import { AreaMoveHandle } from './AreaMoveHandle';
import styles from './AreaHeader.module.scss';

export interface AreaHeaderProps {
  area: AreaNode;
  slotRef: (element: HTMLElement | null) => void;
}

const CATEGORIES = ['planning', 'design', 'palette', 'assets', 'general'] as const;

export function AreaHeader({ area, slotRef }: AreaHeaderProps) {
  const { t } = useTranslation('shell');
  const { t: te } = useTranslation('editors');
  const workspace = useActiveWorkspace();
  const definition = getEditor(area.editor) ?? getEditor('empty');
  const Icon = definition?.icon;
  const maximised = workspace?.maximisedAreaId === area.id;
  const sides = workspace ? neighbours(workspace.root, area.id) : {};
  const sideEntries = Object.entries(sides) as [Side, AreaNode][];
  const title = (key: string) => te(key as 'types.empty');

  return (
    <header className={styles['header']}>
      <AreaMoveHandle areaId={area.id} />
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" className={styles['switcher']} aria-label={t('area.editor')}>
            {Icon ? <Icon aria-hidden="true" /> : null}
            <ChevronDown aria-hidden="true" className={styles['chevron']} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start">
          {CATEGORIES.map((category, index) => (
            <DropdownMenu.Group key={category}>
              {index > 0 ? <DropdownMenu.Separator /> : null}
              <DropdownMenu.Label>
                {category === 'general' ? t('area.general') : t(`layout.presets.${category}`)}
              </DropdownMenu.Label>
              {listEditors()
                .filter((editor) => editor.category === category)
                .map((editor) => (
                  <DropdownMenu.Item
                    key={editor.id}
                    onSelect={() => {
                      areaActions.setEditor(area.id, editor.id, editor.defaultState?.() ?? {});
                    }}
                  >
                    <editor.icon aria-hidden="true" className={styles['itemIcon']} />
                    {title(editor.titleKey)}
                  </DropdownMenu.Item>
                ))}
            </DropdownMenu.Group>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <span className={styles['title']}>{definition ? title(definition.titleKey) : area.editor}</span>
      <ScrollStrip className={styles['slot']} ref={slotRef} />
      <IconButton
        label={maximised ? t('area.restore') : t('area.maximise')}
        size="sm"
        onClick={() => {
          areaActions.toggleMaximise(area.id);
        }}
      >
        {maximised ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
      </IconButton>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <IconButton label={t('area.menu')} size="sm" tooltip={false}>
            <MoreHorizontal aria-hidden="true" />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          <DropdownMenu.Item
            onSelect={() => {
              areaActions.split(area.id, 'row');
            }}
          >
            {t('area.splitVertical')}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => {
              areaActions.split(area.id, 'column');
            }}
          >
            {t('area.splitHorizontal')}
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger disabled={sideEntries.length === 0}>
              {t('area.join')}
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent>
              {sideEntries.map(([side, neighbour]) => (
                <DropdownMenu.Item
                  key={side}
                  onSelect={() => {
                    areaActions.join(area.id, neighbour.id);
                  }}
                >
                  {t(`area.joinDirection.${side}`)}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger disabled={sideEntries.length === 0}>
              {t('area.swapWith')}
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent>
              {sideEntries.map(([side, neighbour]) => (
                <DropdownMenu.Item
                  key={side}
                  onSelect={() => {
                    areaActions.swap(area.id, neighbour.id);
                  }}
                >
                  {t(`area.joinDirection.${side}`)}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
          <DropdownMenu.Item
            onSelect={() => {
              void detachArea(area.id, {
                x: window.screenX + 80,
                y: window.screenY + 80,
                width: 720,
                height: 520,
              });
            }}
          >
            {t('area.newWindow')}
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            onSelect={() => {
              areaActions.toggleMaximise(area.id);
            }}
          >
            {maximised ? t('area.restore') : t('area.maximise')}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => {
              areaActions.close(area.id);
            }}
          >
            {t('area.close')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </header>
  );
}
