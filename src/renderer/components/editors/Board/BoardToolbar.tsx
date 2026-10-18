import type { ReactNode } from 'react';
import {
  Brush,
  Circle,
  Diamond,
  Eraser,
  Frame,
  Hand,
  ImagePlus,
  LayoutTemplate,
  MousePointer2,
  Spline,
  Square,
  StickyNote,
  Type,
} from 'lucide-react';
import type { Asset } from '@shared/assets';
import type { CardTemplate } from '@shared/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { DropdownMenu, IconButton, Tooltip, cx, ScrollStrip } from '@renderer/ui';
import { SHAPE_TOOLS, TOOL_KEYS, type BoardTool, type ShapeTool } from './tools';
import styles from './BoardToolbar.module.scss';

export interface BoardToolbarProps {
  tool: BoardTool;
  shape: ShapeTool;
  templates: CardTemplate[];
  templateId: string | null;
  images: Asset[];
  onTool: (tool: BoardTool) => void;
  onShape: (shape: ShapeTool) => void;
  onTemplate: (templateId: string) => void;
  onPlaceImage: (asset: Asset) => void;
  onImportImages: () => void;
  onNewTemplate: () => void;
  onEditTemplates: () => void;
}

const SHAPE_ICONS: Record<ShapeTool, ReactNode> = {
  rectangle: <Square aria-hidden="true" />,
  ellipse: <Circle aria-hidden="true" />,
  diamond: <Diamond aria-hidden="true" />,
};

export function BoardToolbar({
  tool,
  shape,
  templates,
  templateId,
  images,
  onTool,
  onShape,
  onTemplate,
  onPlaceImage,
  onImportImages,
  onNewTemplate,
  onEditTemplates,
}: BoardToolbarProps) {
  const { t } = useTranslation('editors');
  const label = (key: BoardTool, name: string) =>
    t('board.tools.shortcut', { tool: name, key: TOOL_KEYS[key] });
  const button = (key: BoardTool, name: string, icon: ReactNode) => (
    <IconButton
      key={key}
      label={label(key, name)}
      size="sm"
      active={tool === key}
      onClick={() => {
        onTool(key);
      }}
    >
      {icon}
    </IconButton>
  );
  const shapeActive = (SHAPE_TOOLS as readonly string[]).includes(tool);

  return (
    <ScrollStrip
      orientation="vertical"
      className={styles['toolbar']}
      role="toolbar"
      aria-label={t('board.tools.label')}
      aria-orientation="vertical"
    >
      {button('select', t('board.tools.select'), <MousePointer2 aria-hidden="true" />)}
      {button('hand', t('board.tools.hand'), <Hand aria-hidden="true" />)}
      <span className={styles['separator']} />
      {button('text', t('board.tools.text'), <Type aria-hidden="true" />)}
      {button('sticky', t('board.tools.sticky'), <StickyNote aria-hidden="true" />)}
      <DropdownMenu.Root>
        <Tooltip content={t('board.tools.shape')}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className={cx(styles['menuButton'], shapeActive && styles['active'])}
              aria-label={t('board.tools.shape')}
              aria-pressed={shapeActive || undefined}
            >
              {SHAPE_ICONS[shapeActive ? (tool as ShapeTool) : shape]}
              <span className={styles['corner']} aria-hidden="true" />
            </button>
          </DropdownMenu.Trigger>
        </Tooltip>
        <DropdownMenu.Content side="right" align="start">
          {SHAPE_TOOLS.map((item) => (
            <DropdownMenu.Item
              key={item}
              onSelect={() => {
                onShape(item);
                onTool(item);
              }}
            >
              {SHAPE_ICONS[item]}
              {label(item, t(`board.tools.${item}`))}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <DropdownMenu.Root>
        <Tooltip content={t('board.tools.image')}>
          <DropdownMenu.Trigger asChild>
            <button type="button" className={styles['menuButton']} aria-label={t('board.tools.image')}>
              <ImagePlus aria-hidden="true" />
              <span className={styles['corner']} aria-hidden="true" />
            </button>
          </DropdownMenu.Trigger>
        </Tooltip>
        <DropdownMenu.Content side="right" align="start" className={styles['menu']}>
          <DropdownMenu.Item onSelect={onImportImages}>{t('board.tools.imageFile')}</DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Label>{t('board.tools.imageAssets')}</DropdownMenu.Label>
          {images.length === 0 ? <DropdownMenu.Label>{t('board.tools.noImages')}</DropdownMenu.Label> : null}
          {images.map((asset) => (
            <DropdownMenu.Item
              key={asset.id}
              onSelect={() => {
                onPlaceImage(asset);
              }}
            >
              {asset.name}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      {button('container', t('board.tools.container'), <Frame aria-hidden="true" />)}
      <DropdownMenu.Root>
        <Tooltip content={label('card', t('board.tools.card'))}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className={cx(styles['menuButton'], tool === 'card' && styles['active'])}
              aria-label={t('board.tools.card')}
              aria-pressed={tool === 'card' || undefined}
            >
              <LayoutTemplate aria-hidden="true" />
              <span className={styles['corner']} aria-hidden="true" />
            </button>
          </DropdownMenu.Trigger>
        </Tooltip>
        <DropdownMenu.Content side="right" align="start" className={styles['menu']}>
          {templates.length === 0 ? (
            <DropdownMenu.Label>{t('board.tools.noTemplates')}</DropdownMenu.Label>
          ) : null}
          <DropdownMenu.RadioGroup value={tool === 'card' ? (templateId ?? '') : ''}>
            {templates.map((template) => (
              <DropdownMenu.RadioItem
                key={template.id}
                value={template.id}
                onSelect={() => {
                  onTemplate(template.id);
                  onTool('card');
                }}
              >
                {template.name}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator />
          <DropdownMenu.Item onSelect={onNewTemplate}>{t('board.tools.newTemplate')}</DropdownMenu.Item>
          {templates.length > 0 ? (
            <DropdownMenu.Item onSelect={onEditTemplates}>{t('board.tools.editTemplates')}</DropdownMenu.Item>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <span className={styles['separator']} />
      {button('arrow', t('board.tools.arrow'), <Spline aria-hidden="true" />)}
      <span className={styles['separator']} />
      {button('brush', t('board.tools.brush'), <Brush aria-hidden="true" />)}
      {button('eraser', t('board.tools.eraser'), <Eraser aria-hidden="true" />)}
    </ScrollStrip>
  );
}
