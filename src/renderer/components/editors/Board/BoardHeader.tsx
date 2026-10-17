import { useState } from 'react';
import { ChevronDown, Grid3x3, Magnet, Map, Maximize, PanelRight, Plus, ZoomIn, ZoomOut } from 'lucide-react';
import type { Board } from '@shared/board';
import { createBoard, deleteBoard, updateBoard } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { Button, ConfirmDialog, DropdownMenu, IconButton } from '@renderer/ui';
import { ProjectColourPicker } from '../../ProjectColourPicker/ProjectColourPicker';
import { PromptDialog } from '../../Shell/PromptDialog';
import styles from './BoardEditor.module.scss';

export interface BoardHeaderProps {
  boards: Board[];
  board: Board | null;
  grid: boolean;
  minimap: boolean;
  snap: boolean;
  properties: boolean;
  onSelect: (id: string) => void;
  onToggle: (key: 'grid' | 'minimap' | 'snap', value: boolean) => void;
  onToggleProperties: () => void;
  onZoom: (action: 'in' | 'out' | 'fit' | 'reset') => void;
}

export function BoardHeader({
  boards,
  board,
  grid,
  minimap,
  snap,
  properties,
  onSelect,
  onToggle,
  onToggleProperties,
  onZoom,
}: BoardHeaderProps) {
  const { t } = useTranslation('editors');
  const { t: tc } = useTranslation('common');
  const [dialog, setDialog] = useState<'new' | 'rename' | 'delete' | null>(null);

  async function create(name: string) {
    const created = await createBoard({ name });
    onSelect(created.id);
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button size="sm" variant="ghost" aria-label={t('board.select')}>
            {board?.name ?? t('board.boards')}
            <ChevronDown aria-hidden="true" className={styles['chevron']} />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start">
          <DropdownMenu.RadioGroup value={board?.id ?? ''} onValueChange={onSelect}>
            {boards.map((item) => (
              <DropdownMenu.RadioItem key={item.id} value={item.id}>
                {item.name}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          {boards.length > 0 ? <DropdownMenu.Separator /> : null}
          <DropdownMenu.Item
            onSelect={() => {
              setDialog('new');
            }}
          >
            {t('board.newBoard')}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={!board}
            onSelect={() => {
              setDialog('rename');
            }}
          >
            {t('board.rename')}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={!board}
            onSelect={() => {
              setDialog('delete');
            }}
          >
            {t('board.delete')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      {board ? (
        <>
          <ProjectColourPicker
            size="sm"
            value={{ hex: board.backgroundColor, ref: board.backgroundRef }}
            label={t('board.background')}
            onChange={(value) =>
              void updateBoard(board.id, { backgroundColor: value.hex, backgroundRef: value.ref })
            }
          />
          <ProjectColourPicker
            size="sm"
            value={{ hex: board.gridColor, ref: board.gridRef }}
            label={t('board.gridColor')}
            onChange={(value) => void updateBoard(board.id, { gridColor: value.hex, gridRef: value.ref })}
          />
          <IconButton
            label={t('board.zoomOut')}
            size="sm"
            onClick={() => {
              onZoom('out');
            }}
          >
            <ZoomOut aria-hidden="true" />
          </IconButton>
          <IconButton
            label={t('board.zoomIn')}
            size="sm"
            onClick={() => {
              onZoom('in');
            }}
          >
            <ZoomIn aria-hidden="true" />
          </IconButton>
          <IconButton
            label={t('board.fit')}
            size="sm"
            onClick={() => {
              onZoom('fit');
            }}
          >
            <Maximize aria-hidden="true" />
          </IconButton>
          <IconButton
            label={t('board.grid')}
            size="sm"
            active={grid}
            onClick={() => {
              onToggle('grid', !grid);
            }}
          >
            <Grid3x3 aria-hidden="true" />
          </IconButton>
          <IconButton
            label={t('board.snap')}
            size="sm"
            active={snap}
            onClick={() => {
              onToggle('snap', !snap);
            }}
          >
            <Magnet aria-hidden="true" />
          </IconButton>
          <IconButton
            label={t('board.minimap')}
            size="sm"
            active={minimap}
            onClick={() => {
              onToggle('minimap', !minimap);
            }}
          >
            <Map aria-hidden="true" />
          </IconButton>
          <IconButton
            label={t('board.properties')}
            size="sm"
            active={properties}
            onClick={onToggleProperties}
          >
            <PanelRight aria-hidden="true" />
          </IconButton>
        </>
      ) : (
        <Button
          size="sm"
          variant="primary"
          icon={<Plus aria-hidden="true" />}
          onClick={() => {
            setDialog('new');
          }}
        >
          {t('board.newBoard')}
        </Button>
      )}
      {dialog === 'new' || dialog === 'rename' ? (
        <PromptDialog
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          title={dialog === 'new' ? t('board.newBoard') : t('board.rename')}
          label={t('board.boardName')}
          initialValue={
            dialog === 'rename' ? (board?.name ?? '') : t('board.defaultName', { number: boards.length + 1 })
          }
          submitLabel={dialog === 'new' ? tc('actions.create') : tc('actions.rename')}
          onSubmit={(name) =>
            dialog === 'new' || !board ? create(name) : updateBoard(board.id, { name }).then(() => undefined)
          }
        />
      ) : null}
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={t('board.delete')}
        description={t('board.deleteConfirm', { name: board?.name ?? '' })}
        confirmLabel={tc('actions.delete')}
        cancelLabel={tc('actions.cancel')}
        closeLabel={tc('actions.close')}
        destructive
        onConfirm={async () => {
          if (!board) return;
          const remaining = await deleteBoard(board.id);
          onSelect(remaining[0]?.id ?? '');
        }}
      />
    </>
  );
}
