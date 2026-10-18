import { z } from 'zod';
import { hexColorSchema } from './theme';

export const stateCategorySchema = z.enum(['todo', 'doing', 'done']);
export const ticketTypeSchema = z.enum(['task', 'spike', 'bug']);
export const ticketPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export const sprintStatusSchema = z.enum(['planned', 'active', 'completed']);

export const ticketStateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  position: z.string().min(1),
  category: stateCategorySchema,
  color: hexColorSchema,
});

export const TICKET_LINK_KINDS = ['board', 'palette', 'asset', 'note'] as const;
export const ticketLinkSchema = z.object({ kind: z.enum(TICKET_LINK_KINDS), id: z.string().min(1) });
export type TicketLink = z.infer<typeof ticketLinkSchema>;
export const ticketLinksSchema = z.array(ticketLinkSchema).max(100);

export const ticketSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20_000),
  type: ticketTypeSchema,
  priority: ticketPrioritySchema,
  stateId: z.string().min(1).nullable(),
  sprintId: z.string().min(1).nullable(),
  estimate: z.number().nonnegative().max(1000).nullable(),
  dueAt: z.iso.date().nullable(),
  position: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
  links: ticketLinksSchema.default([]),
});

export const sprintSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  goal: z.string().max(2000),
  status: sprintStatusSchema,
  position: z.string().min(1),
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const commentSchema = z.object({
  id: z.string().min(1),
  ticketId: z.string().min(1),
  body: z.string().min(1).max(20_000),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const templateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  title: z.string().max(200),
  description: z.string().max(20_000),
  type: ticketTypeSchema,
  priority: ticketPrioritySchema,
  estimate: z.number().nonnegative().max(1000).nullable(),
  labelIds: z.array(z.string().min(1)),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
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
  sprints: z.array(sprintSchema),
  comments: z.array(commentSchema),
  templates: z.array(templateSchema),
});

export const ticketInputSchema = z.object({
  title: ticketSchema.shape.title,
  description: ticketSchema.shape.description.default(''),
  stateId: z.string().min(1).nullable().default(null),
  sprintId: z.string().min(1).nullable().default(null),
  type: ticketTypeSchema.default('task'),
  priority: ticketPrioritySchema.default('medium'),
  estimate: ticketSchema.shape.estimate.default(null),
  dueAt: ticketSchema.shape.dueAt.default(null),
  labelIds: z.array(z.string().min(1)).default([]),
});

export const ticketPatchSchema = z
  .object({
    title: ticketSchema.shape.title,
    description: ticketSchema.shape.description,
    type: ticketTypeSchema,
    priority: ticketPrioritySchema,
    stateId: z.string().min(1).nullable(),
    sprintId: z.string().min(1).nullable(),
    estimate: ticketSchema.shape.estimate,
    dueAt: ticketSchema.shape.dueAt,
    links: ticketLinksSchema,
  })
  .partial();

export const ticketMoveSchema = z.object({
  id: z.string().min(1),
  stateId: z.string().min(1).nullable(),
  sprintId: z.string().min(1).nullable().optional(),
  position: z.string().min(1),
});

export const sprintInputSchema = z.object({
  name: sprintSchema.shape.name,
  goal: sprintSchema.shape.goal.default(''),
});

export const sprintPatchSchema = z
  .object({ name: sprintSchema.shape.name, goal: sprintSchema.shape.goal })
  .partial();

export const sprintCompleteSchema = z.object({
  id: z.string().min(1),
  moveTo: z.string().min(1).nullable().default(null),
});

export const commentInputSchema = z.object({
  ticketId: z.string().min(1),
  body: commentSchema.shape.body,
});

export const templateInputSchema = z.object({
  name: templateSchema.shape.name,
  title: templateSchema.shape.title.default(''),
  description: templateSchema.shape.description.default(''),
  type: ticketTypeSchema.default('task'),
  priority: ticketPrioritySchema.default('medium'),
  estimate: templateSchema.shape.estimate.default(null),
  labelIds: templateSchema.shape.labelIds.default([]),
});

export const templatePatchSchema = templateInputSchema.partial();

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
export type Sprint = z.infer<typeof sprintSchema>;
export type Comment = z.infer<typeof commentSchema>;
export type TicketTemplate = z.infer<typeof templateSchema>;
export type SprintInput = z.input<typeof sprintInputSchema>;
export type SprintPatch = z.infer<typeof sprintPatchSchema>;
export type SprintComplete = z.input<typeof sprintCompleteSchema>;
export type CommentInput = z.infer<typeof commentInputSchema>;
export type TemplateInput = z.input<typeof templateInputSchema>;
export type TemplatePatch = z.infer<typeof templatePatchSchema>;
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
