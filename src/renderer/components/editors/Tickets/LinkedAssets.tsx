import { useState } from 'react';
import { Link2, X } from 'lucide-react';
import type { TicketLink } from '@shared/tickets';
import { useAssetsSnapshot } from '@renderer/lib/assets';
import { useBoards } from '@renderer/lib/board';
import { useSavedCards } from '@renderer/lib/cards';
import { useTranslation } from '@renderer/lib/i18n';
import { useNotes } from '@renderer/lib/notes';
import { usePalettes } from '@renderer/lib/palettes';
import { ticketActions } from '@renderer/lib/tickets';
import { openLinked, useWorkspaceNames, type WorkspaceNames } from '@renderer/lib/workspaces';
import { Button, IconButton, Input, Popover, ScrollArea, Switch } from '@renderer/ui';
import { AssetLinkCard, useResolvedLink } from '../../AssetLinkCard/AssetLinkCard';
import styles from './LinkedAssets.module.scss';

function sameLink(a: TicketLink, b: TicketLink): boolean {
  return a.kind === b.kind && a.id === b.id;
}

function LinkRow({
  link,
  names,
  onRemove,
}: {
  link: TicketLink;
  names: WorkspaceNames;
  onRemove: () => void;
}) {
  const { t } = useTranslation('editors');
  const { name } = useResolvedLink(link);
  return (
    <li className={styles['item']}>
      <AssetLinkCard
        link={link}
        className={styles['card']}
        onOpen={(target) => {
          openLinked(target, names);
        }}
      />
      <IconButton
        label={t('ticket.links.remove', { name })}
        size="sm"
        tooltip={false}
        className={styles['remove']}
        onClick={onRemove}
      >
        <X aria-hidden="true" />
      </IconButton>
    </li>
  );
}

export function LinkedAssets({ ticketId, links }: { ticketId: string; links: TicketLink[] }) {
  const { t } = useTranslation('editors');
  const names = useWorkspaceNames();
  const boards = useBoards() ?? [];
  const palettes = usePalettes() ?? [];
  const notes = useNotes();
  const cards = useSavedCards() ?? [];
  const { assets } = useAssetsSnapshot();
  const [query, setQuery] = useState('');

  function toggle(link: TicketLink, on: boolean) {
    const next = on ? [...links, link] : links.filter((item) => !sameLink(item, link));
    void ticketActions.update(ticketId, { links: next });
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
      title: t('ticket.links.notes'),
      links: notes
        .filter((note) => matches(note.title))
        .map((note) => ({ link: { kind: 'note', id: note.id }, name: note.title })),
    },
    {
      title: t('ticket.links.cards'),
      links: cards
        .filter((card) => matches(card.name))
        .map((card) => ({ link: { kind: 'card', id: card.id }, name: card.name })),
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
          {links.map((link) => (
            <LinkRow
              key={`${link.kind}:${link.id}`}
              link={link}
              names={names}
              onRemove={() => {
                toggle(link, false);
              }}
            />
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
