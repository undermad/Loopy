import { useState } from 'react';
import { Link2, Palette, PenTool, Unlink, X } from 'lucide-react';
import { assetUrl, type Asset } from '@shared/assets';
import type { TicketLink } from '@shared/tickets';
import { useAssetsSnapshot } from '@renderer/lib/assets';
import { useBoards } from '@renderer/lib/board';
import { useTranslation } from '@renderer/lib/i18n';
import { usePalettes } from '@renderer/lib/palettes';
import { ticketActions } from '@renderer/lib/tickets';
import { openLinked, useWorkspaceNames } from '@renderer/lib/workspaces';
import { Button, IconButton, Input, Popover, ScrollArea, Switch, cx } from '@renderer/ui';
import { KIND_ICONS } from '../Assets/kinds';
import styles from './LinkedAssets.module.scss';

interface Resolved {
  link: TicketLink;
  name: string;
  detail: string;
  colours: string[];
  asset: Asset | null;
  missing: boolean;
}

function sameLink(a: TicketLink, b: TicketLink): boolean {
  return a.kind === b.kind && a.id === b.id;
}

function LinkIcon({ item }: { item: Resolved }) {
  if (item.link.kind === 'palette' && item.colours.length > 0) {
    return (
      <span className={styles['swatches']} aria-hidden="true">
        {item.colours.slice(0, 5).map((hex, index) => (
          <span key={`${hex}-${String(index)}`} style={{ background: hex }} />
        ))}
      </span>
    );
  }
  if (item.asset?.kind === 'image') {
    return <img src={assetUrl(item.asset.id)} alt="" className={styles['image']} />;
  }
  const Icon =
    item.link.kind === 'board'
      ? PenTool
      : item.link.kind === 'palette'
        ? Palette
        : KIND_ICONS[item.asset?.kind ?? 'other'];
  return <Icon aria-hidden="true" />;
}

export function LinkedAssets({ ticketId, links }: { ticketId: string; links: TicketLink[] }) {
  const { t } = useTranslation('editors');
  const names = useWorkspaceNames();
  const boards = useBoards() ?? [];
  const palettes = usePalettes() ?? [];
  const { assets } = useAssetsSnapshot();
  const [query, setQuery] = useState('');

  function resolve(link: TicketLink): Resolved {
    if (link.kind === 'board') {
      const board = boards.find((item) => item.id === link.id);
      return {
        link,
        name: board?.name ?? t('ticket.links.missing'),
        detail: t('ticket.links.kinds.board'),
        colours: [],
        asset: null,
        missing: !board,
      };
    }
    if (link.kind === 'palette') {
      const palette = palettes.find((item) => item.id === link.id);
      return {
        link,
        name: palette?.name ?? t('ticket.links.missing'),
        detail: t('ticket.links.kinds.palette'),
        colours: palette?.colours.map((colour) => colour.hex) ?? [],
        asset: null,
        missing: !palette,
      };
    }
    const asset = assets.find((item) => item.id === link.id) ?? null;
    return {
      link,
      name: asset?.name ?? t('ticket.links.missing'),
      detail: t('ticket.links.kinds.asset'),
      colours: [],
      asset,
      missing: !asset,
    };
  }

  function save(next: TicketLink[]) {
    void ticketActions.update(ticketId, { links: next });
  }

  function toggle(link: TicketLink, on: boolean) {
    save(on ? [...links, link] : links.filter((item) => !sameLink(item, link)));
  }

  const needle = query.trim().toLowerCase();
  const matches = (name: string) => needle.length === 0 || name.toLowerCase().includes(needle);
  const groups: { title: string; links: { link: TicketLink; name: string }[] }[] = [
    {
      title: t('ticket.links.boards'),
      links: boards
        .filter((board) => matches(board.name))
        .map((board) => ({ link: { kind: 'board', id: board.id }, name: board.name })),
    },
    {
      title: t('ticket.links.palettes'),
      links: palettes
        .filter((palette) => matches(palette.name))
        .map((palette) => ({ link: { kind: 'palette', id: palette.id }, name: palette.name })),
    },
    {
      title: t('ticket.links.files'),
      links: assets
        .filter((asset) => matches(asset.name))
        .map((asset) => ({ link: { kind: 'asset', id: asset.id }, name: asset.name })),
    },
  ];

  return (
    <div className={styles['links']}>
      {links.length > 0 ? (
        <ul className={styles['list']} aria-label={t('ticket.links.title')}>
          {links.map(resolve).map((item) => (
            <li key={`${item.link.kind}:${item.link.id}`} className={styles['item']}>
              <button
                type="button"
                className={cx(styles['chip'], item.missing && styles['missing'])}
                data-kind={item.link.kind}
                disabled={item.missing}
                title={
                  item.missing ? t('ticket.links.missingHint') : t('ticket.links.open', { name: item.name })
                }
                onClick={() => {
                  openLinked(item.link, names);
                }}
              >
                <span className={styles['icon']}>
                  {item.missing ? <Unlink aria-hidden="true" /> : <LinkIcon item={item} />}
                </span>
                <span className={styles['text']}>
                  <span className={styles['name']}>{item.name}</span>
                  <span className={styles['detail']}>{item.detail}</span>
                </span>
              </button>
              <IconButton
                label={t('ticket.links.remove', { name: item.name })}
                size="sm"
                tooltip={false}
                className={styles['remove']}
                onClick={() => {
                  toggle(item.link, false);
                }}
              >
                <X aria-hidden="true" />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : null}
      <Popover.Root
        onOpenChange={(open) => {
          if (!open) setQuery('');
        }}
      >
        <Popover.Trigger asChild>
          <Button size="sm" variant="ghost" icon={<Link2 aria-hidden="true" />}>
            {t('ticket.links.add')}
          </Button>
        </Popover.Trigger>
        <Popover.Content align="start" className={styles['picker']}>
          <Input
            size="sm"
            type="search"
            value={query}
            aria-label={t('ticket.links.search')}
            placeholder={t('ticket.links.search')}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
          <ScrollArea className={styles['choices']}>
            {groups.map((group) =>
              group.links.length > 0 ? (
                <div key={group.title} role="group" aria-label={group.title} className={styles['group']}>
                  <div className={styles['groupTitle']}>{group.title}</div>
                  {group.links.map((choice) => (
                    <Switch
                      key={`${choice.link.kind}:${choice.link.id}`}
                      size="sm"
                      label={choice.name}
                      checked={links.some((link) => sameLink(link, choice.link))}
                      onCheckedChange={(checked) => {
                        toggle(choice.link, checked);
                      }}
                    />
                  ))}
                </div>
              ) : null,
            )}
            {groups.every((group) => group.links.length === 0) ? (
              <p className={styles['none']}>{t('ticket.links.none')}</p>
            ) : null}
          </ScrollArea>
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}
