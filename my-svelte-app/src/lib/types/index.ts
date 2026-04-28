export type Role = 'owner' | 'staff';
export type NotificationType = 'low_stock' | 'dead_stock' | 'sync_status' | 'report_ready';
export type NotificationStatus = 'unread' | 'read' | 'dismissed';
export type SyncState = 'online' | 'offline' | 'syncing';

export interface TireProduct {
  id: string;
  brand: string;
  size: string;
  pattern: string;
  quantity: number;
  unitCostPrice: number;
  retailPrice: number;
  deliveryProviderId: string | null;
  lowStockThreshold: number | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockInTransaction {
  id: string;
  tireProductId: string;
  deliveryProviderId: string | null;
  quantity: number;
  transactionDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockOutTransaction {
  id: string;
  tireProductId: string;
  quantity: number;
  reason: string;
  transactionDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalesTransaction {
  id: string;
  tireProductId: string;
  quantitySold: number;
  unitRetailPrice: number;
  unitCostPrice: number;
  revenue: number;
  grossProfit: number;
  transactionDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  status: NotificationStatus;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface Session {
  userId: string;
  email: string;
  role: Role;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
