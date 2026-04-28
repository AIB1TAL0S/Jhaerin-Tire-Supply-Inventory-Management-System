import { z } from 'zod';

const productBaseSchema = z.object({
  brand: z.string().min(1).max(100),
  size: z.string().min(1).max(50),
  pattern: z.string().min(1).max(100),
  unitCostPrice: z.number().positive(),
  retailPrice: z.number().positive(),
  deliveryProviderId: z.string().uuid().nullable(),
  lowStockThreshold: z.number().int().nonnegative().nullable(),
});

export const createProductSchema = productBaseSchema.refine(
  (d) => d.retailPrice >= d.unitCostPrice,
  {
    message: 'Retail price must be >= unit cost price',
    path: ['retailPrice'],
  }
);

export const updateProductSchema = productBaseSchema
  .partial()
  .refine(
    (d) =>
      d.retailPrice === undefined ||
      d.unitCostPrice === undefined ||
      d.retailPrice >= d.unitCostPrice,
    {
      message: 'Retail price must be >= unit cost price',
      path: ['retailPrice'],
    }
  );

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
