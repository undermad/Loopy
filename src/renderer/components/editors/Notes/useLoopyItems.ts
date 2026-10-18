import { useMemo } from 'react';
import { assetUrl, type Asset } from '@shared/assets';
import type { LoopyLinkKind } from '@shared/markdown';
import { ticketKey } from '@shared/tickets';
import { useAssetsSnapshot } from '@renderer/lib/assets';
import { useBoards } from '@renderer/lib/board';
import { useSavedCards } from '@renderer/lib/cards';
import { usePalettes } from '@renderer/lib/palettes';
import { useCurrentProject } from '@renderer/lib/project';
import { useTicketsSnapshot } from '@renderer/lib/tickets';

export interface LoopyItem {
  kind: LoopyLinkKind;
  id: string;
  name: string;
  detail: string;
  colours: string[];
  asset: Asset | null;
  stateName: string | null;
  stateColour: string | null;
}

export interface LoopyItems {
  items: Record<LoopyLinkKind, LoopyItem[]>;
  find: (kind: LoopyLinkKind, target: string) => LoopyItem | null;
  imageUrl: (item: LoopyItem | null) => string | null;
}

function base(kind: LoopyLinkKind, id: string, name: string, detail = ''): LoopyItem {
  return { kind, id, name, detail, colours: [], asset: null, stateName: null, stateColour: null };
}

export function useLoopyItems(): LoopyItems {
  const boards = useBoards();
  const palettes = usePalettes();
  const { assets } = useAssetsSnapshot();
  const tickets = useTicketsSnapshot();
  const savedCards = useSavedCards();
  const project = useCurrentProject();
  const projectName = project?.name ?? '';

  return useMemo(() => {
    const states = new Map(tickets.states.map((state) => [state.id, state]));
    const items: Record<LoopyLinkKind, LoopyItem[]> = {
      board: (boards ?? []).map((board) => base('board', board.id, board.name)),
      palette: (palettes ?? []).map((palette) => ({
        ...base('palette', palette.id, palette.name),
        colours: palette.colours.map((colour) => colour.hex),
      })),
      asset: assets.map((asset) => ({ ...base('asset', asset.id, asset.name, asset.kind), asset })),
      ticket: tickets.tickets.map((ticket) => {
        const state = ticket.stateId ? states.get(ticket.stateId) : undefined;
        return {
          ...base(
            'ticket',
            ticket.id,
            String(ticket.number),
            `${ticketKey(projectName, ticket.number)} ${ticket.title}`,
          ),
          stateName: state?.name ?? null,
          stateColour: state?.color ?? null,
        };
      }),
      card: (savedCards ?? []).map((card) => base('card', card.id, card.name)),
    };
    const lookup = new Map<string, LoopyItem>();
    for (const list of Object.values(items)) {
      for (const item of list) {
        const key = `${item.kind}:${item.name.toLowerCase()}`;
        if (!lookup.has(key)) lookup.set(key, item);
      }
    }
    const find = (kind: LoopyLinkKind, target: string): LoopyItem | null => {
      const wanted = target.trim().toLowerCase();
      if (kind === 'ticket') {
        const number = /(\d+)\s*$/.exec(wanted)?.[1];
        return number ? (lookup.get(`ticket:${String(Number(number))}`) ?? null) : null;
      }
      return lookup.get(`${kind}:${wanted}`) ?? null;
    };
    const imageUrl = (item: LoopyItem | null) =>
      item?.asset?.kind === 'image' ? assetUrl(item.asset.id) : null;
    return { items, find, imageUrl };
  }, [boards, palettes, assets, tickets, projectName, savedCards]);
}
