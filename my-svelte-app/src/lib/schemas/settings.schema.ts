import { z } from 'zod';

export const settingsSchema = z.object({
  globalLowStockThreshold: z.number().int().nonnegative(),
  deadStockWindowDays: z.number().int().positive(),
  theme: z.enum(['light', 'dark']),
  dateFormat: z.string(),
  defaultDateRange: z.enum(['day', 'week', 'month']),
  powersyncEndpoint: z.string().url().optional(),
  powersyncToken: z.string().optional(),
});

export const deliveryProviderSchema = z.object({
  name: z.string().min(1).max(100),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
export type DeliveryProviderInput = z.infer<typeof deliveryProviderSchema>;
