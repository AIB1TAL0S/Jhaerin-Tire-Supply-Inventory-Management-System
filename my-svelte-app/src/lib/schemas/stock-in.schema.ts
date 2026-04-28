import { z } from 'zod';

export const stockInSchema = z.object({
  tireProductId: z.string().uuid(),
  deliveryProviderId: z.string().uuid().nullable(),
  quantity: z.number().int().positive({ message: 'Quantity must be greater than zero' }),
  transactionDate: z.string().datetime(),
  notes: z.string().max(500).nullable(),
});

export type StockInInput = z.infer<typeof stockInSchema>;
