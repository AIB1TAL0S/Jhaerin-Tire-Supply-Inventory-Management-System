import { z } from 'zod';

export const saleSchema = z.object({
  tireProductId: z.string().uuid(),
  quantitySold: z.number().int().positive(),
  transactionDate: z.string().datetime(),
});

export type SaleInput = z.infer<typeof saleSchema>;
