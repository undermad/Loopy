import { z } from 'zod';

export const exchangeKindSchema = z.enum(['theme', 'layout']);

export const exchangeEnvelopeSchema = z.object({
  loopy: z.object({
    kind: exchangeKindSchema,
    schemaVersion: z.number().int().positive(),
    app: z.string().min(1),
  }),
  data: z.unknown(),
});

export type ExchangeKind = z.infer<typeof exchangeKindSchema>;
export type ExchangeEnvelope = z.infer<typeof exchangeEnvelopeSchema>;

export function wrapExchange(
  kind: ExchangeKind,
  schemaVersion: number,
  app: string,
  data: unknown,
): ExchangeEnvelope {
  return { loopy: { kind, schemaVersion, app }, data };
}

export const EXCHANGE_FILE_EXTENSIONS: Record<ExchangeKind, string> = {
  theme: 'loopy-theme.json',
  layout: 'loopy-layout.json',
};
