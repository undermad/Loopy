import { z } from 'zod';
import { hexColorSchema } from './theme';

export const stateCategorySchema = z.enum(['todo', 'doing', 'done']);
export const ticketTypeSchema = z.enum(['task', 'bug', 'idea']);
export const ticketPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export const ticketStateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  position: z.string().min(1),
  category: stateCategorySchema,
  color: hexColorSchema,
});

export const ticketSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20_000),
  type: ticketTypeSchema,
  priority: ticketPrioritySchema,
  stateId: z.string().min(1).nullable(),
  position: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
});

export const labelSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  color: hexColorSchema,
});

export const ticketLabelSchema = z.object({ ticketId: z.string().min(1), labelId: z.string().min(1) });

export const ticketsSnapshotSchema = z.object({
  states: z.array(ticketStateSchema),
  tickets: z.array(ticketSchema),
  labels: z.array(labelSchema),
  ticketLabels: z.array(ticketLabelSchema),
});

export const ticketInputSchema = z.object({
  title: ticketSchema.shape.title,
  stateId: z.string().min(1).nullable().default(null),
  type: ticketTypeSchema.default('task'),
  priority: ticketPrioritySchema.default('medium'),
});

export const ticketPatchSchema = z
  .object({
    title: ticketSchema.shape.title,
    description: ticketSchema.shape.description,
    type: ticketTypeSchema,
    priority: ticketPrioritySchema,
    stateId: z.string().min(1).nullable(),
  })
  .partial();

export const ticketMoveSchema = z.object({
  id: z.string().min(1),
  stateId: z.string().min(1).nullable(),
  position: z.string().min(1),
});

export const stateInputSchema = z.object({
  name: ticketStateSchema.shape.name,
  category: stateCategorySchema.default('doing'),
  color: hexColorSchema.optional(),
});

export const statePatchSchema = z
  .object({ name: ticketStateSchema.shape.name, category: stateCategorySchema, color: hexColorSchema })
  .partial();

export const labelInputSchema = z.object({ name: labelSchema.shape.name, color: hexColorSchema });
export const labelPatchSchema = labelInputSchema.partial();

export const STATE_COLORS = [
  '#64748b',
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#9333ea',
  '#db2777',
  '#0891b2',
  '#dc2626',
];

export type StateCategory = z.infer<typeof stateCategorySchema>;
export type TicketType = z.infer<typeof ticketTypeSchema>;
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;
export type TicketState = z.infer<typeof ticketStateSchema>;
export type Ticket = z.infer<typeof ticketSchema>;
export type Label = z.infer<typeof labelSchema>;
export type TicketsSnapshot = z.infer<typeof ticketsSnapshotSchema>;
export type TicketInput = z.input<typeof ticketInputSchema>;
export type TicketPatch = z.infer<typeof ticketPatchSchema>;
export type TicketMove = z.infer<typeof ticketMoveSchema>;
export type StateInput = z.input<typeof stateInputSchema>;
export type StatePatch = z.infer<typeof statePatchSchema>;
export type LabelInput = z.infer<typeof labelInputSchema>;
export type LabelPatch = z.infer<typeof labelPatchSchema>;

export function ticketKey(projectName: string, number: number): string {
  const letters =
    projectName
      .replace(/[^\p{L}\p{N}]/gu, '')
      .slice(0, 3)
      .toUpperCase() || 'LPY';
  return `${letters}-${String(number)}`;
}
