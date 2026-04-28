import { z } from 'zod';

export const stockOutSchema = z.object({
  tireProductId: z.string().uuid(),
  quantity: z.number().int().positive({ message: 'Quantity must be greater than zero' }),
  reason: z.string().min(1),
  transactionDate: z.string().datetime(),
});

export type StockOutInput = z.infer<typeof stockOutSchema>;
