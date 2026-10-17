import type { ReactNode } from 'react';
import { DropdownMenu } from '@renderer/ui';

export interface PaletteMenuGroupProps {
  label: string | null;
  separated: boolean;
  children: ReactNode;
}

export function PaletteMenuGroup({ label, separated, children }: PaletteMenuGroupProps) {
  return (
    <>
      {separated && label ? <DropdownMenu.Separator /> : null}
      <DropdownMenu.Group aria-label={label ?? undefined}>
        {label ? <DropdownMenu.Label>{label}</DropdownMenu.Label> : null}
        {children}
      </DropdownMenu.Group>
    </>
  );
}
