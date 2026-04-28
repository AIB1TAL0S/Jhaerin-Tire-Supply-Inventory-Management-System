# Implementation Plan: Jhaerin Tire Supply IMS

## Overview

Incremental implementation of the JTS-IMS SvelteKit + Tauri application. Each task builds on the previous, starting with the project foundation and platform abstraction, then layering in service interfaces, data models, UI routes, and finally analytics and sync. Property-based tests (fast-check) are placed immediately after the logic they validate to catch regressions early.

## Tasks

- [x] 1. Project foundation and platform abstraction
  - Install and configure dependencies: `@tauri-apps/plugin-sql`, `wa-sqlite`, `powersync-js`, `@supabase/supabase-js`, `sveltekit-superforms`, `zod`, `fast-check`, `vitest`
  - Create `src/lib/db/db.interface.ts` with the `DBAdapter` interface (`query`, `execute`, `transaction`)
  - Create `src/lib/db/tauri-sqlite.adapter.ts` implementing `DBAdapter` via the Tauri SQLite plugin
  - Create `src/lib/db/wa-sqlite.adapter.ts` implementing `DBAdapter` via wa-sqlite for the web target
  - Create `src/lib/db/index.ts` that detects `window.__TAURI__` and exports the correct adapter as `db`
  - Create `src/lib/db/schema.sql` with the full SQLite schema (all tables, constraints, indexes)
  - Create `src/lib/db/migrate.ts` that runs the schema SQL on first launch
  - _Requirements: 15.1, 20.3, 20.4_

- [x] 2. TypeScript types and Zod schemas
  - Create `src/lib/types/index.ts` with all TypeScript interfaces: `TireProduct`, `StockInTransaction`, `StockOutTransaction`, `SalesTransaction`, `Notification`, `Role`, `SyncState`, `Session`
  - Create `src/lib/schemas/tire-product.schema.ts` with `createProductSchema` and `updateProductSchema` (including `retailPrice >= unitCostPrice` refinement)
  - Create `src/lib/schemas/stock-in.schema.ts` with `stockInSchema`
  - Create `src/lib/schemas/stock-out.schema.ts` with `stockOutSchema`
  - Create `src/lib/schemas/sales.schema.ts` with `saleSchema`
  - Create `src/lib/schemas/user.schema.ts` with `registerSchema` and `loginSchema`
  - Create `src/lib/schemas/settings.schema.ts` with settings and delivery provider schemas
  - _Requirements: 18.1, 18.2_

  - [ ]* 2.1 Write property test for Zod schema round-trip validation
    - **Property 15: Zod schema round-trip validation**
    - Generate arbitrary valid `TireProduct`, `StockInTransaction`, `StockOutTransaction`, and `SalesTransaction` objects with fast-check; serialize to schema input shape and parse back; assert structural equivalence
    - **Validates: Requirements 18.1, 18.2**

- [x] 3. Auth service and session store
  - Create `src/lib/services/auth.service.ts` implementing `AuthService` (`login`, `logout`, `refreshSession`, `getSession`, `getRole`) backed by `@supabase/supabase-js`
  - Create `src/lib/stores/session.store.ts` as a Svelte store holding `Session | null` and `Role | null`; subscribe to `supabase.auth.onAuthStateChange` for silent refresh
  - Create `src/lib/stores/sync-state.store.ts` as a Svelte store holding `SyncState`
  - Implement JWT expiry auto-refresh; on refresh failure clear session and set redirect flag
  - _Requirements: 1.1, 1.3, 1.4, 4.1, 4.2, 4.3_

- [x] 4. Auth routes — login, register, reset-password
  - Create `src/routes/(auth)/login/+page.svelte` and `+page.server.ts` using Superforms + `loginSchema`; display inline field errors; progressive enhancement enabled
  - Create `src/routes/(auth)/register/+page.svelte` and `+page.server.ts` using Superforms + `registerSchema`; Owner-only guard; role selector (Owner / Staff)
  - Create `src/routes/(auth)/reset-password/+page.svelte` and `+page.server.ts`; show generic confirmation regardless of email existence
  - _Requirements: 1.2, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3_

- [x] 5. App layout — auth guard, role guard, nav, sync badge
  - Create `src/routes/(app)/+layout.svelte` that reads `session.store`; redirects unauthenticated users to `/login`; redirects Staff away from Owner-only routes with access-denied toast
  - Create `src/lib/components/RoleGuard.svelte` wrapper that conditionally renders children based on role
  - Create `src/lib/components/SyncStatusBadge.svelte` that reads `sync-state.store` and renders online/offline/syncing indicator with error tooltip
  - Create `src/lib/components/NotificationPanel.svelte` slide-over panel wired to notification store (populated in task 12)
  - _Requirements: 5.1, 5.2, 5.5, 15.5_

- [x] 6. Inventory service and product catalog
  - Create `src/lib/services/inventory.service.ts` implementing `InventoryService` (`listProducts`, `getProduct`, `createProduct`, `updateProduct`, `archiveProduct`) using the `db` adapter
  - `createProduct` and `updateProduct` MUST enforce `retailPrice >= unitCostPrice` at the service layer and throw a typed `ValidationError` on violation
  - `createProduct` MUST catch SQLite unique constraint violations on `(brand, size, pattern)` and throw a typed `DuplicateProductError`
  - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.8_

  - [~]* 6.1 Write property test for retail price ≥ cost price invariant
    - **Property 6: Retail price ≥ cost price invariant**
    - Generate arbitrary products where `retailPrice < unitCostPrice`; assert `createProduct` and `updateProduct` reject with `ValidationError`; generate valid products and assert they persist
    - **Validates: Requirements 8.8, 18.4**

  - [~]* 6.2 Write property test for duplicate product rejection
    - **Property 7: Duplicate product rejection**
    - Generate arbitrary `(brand, size, pattern)` tuples; create first product; attempt to create second with same tuple; assert `DuplicateProductError` is thrown and catalog count is unchanged
    - **Validates: Requirements 8.5, 18.4**

- [x] 7. Inventory UI — product list and product form
  - Create `src/routes/(app)/inventory/+page.svelte` with `ProductTable` component: searchable by brand/size/pattern, filterable by brand/size/pattern/delivery provider/stock level, paginated at 50 records
  - Create `src/lib/components/ProductTable.svelte` using shadcn-svelte Table with search input and filter controls
  - Create `src/routes/(app)/inventory/[id]/+page.svelte` for product detail and edit using Superforms + `updateProductSchema`
  - Create a new product modal/page using Superforms + `createProductSchema`; display inline Zod errors
  - _Requirements: 8.4, 8.6, 8.7, 19.3_

- [x] 8. Stock-In service and transactions
  - Create `src/lib/services/stock.service.ts` implementing `StockService` methods for stock-in: `createStockIn`, `updateStockIn`, `deleteStockIn`
  - `createStockIn` MUST increment `tire_products.quantity` by `transaction.quantity` in the same SQLite transaction
  - `updateStockIn` MUST apply the delta `(newQty − oldQty)` to `tire_products.quantity` in the same SQLite transaction
  - `deleteStockIn` MUST decrement `tire_products.quantity` by the deleted transaction's quantity; quantity MUST NOT go below zero (throw `InsufficientStockError` if it would)
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.7_

  - [~]* 8.1 Write property test for Stock-In quantity invariant
    - **Property 1: Stock-In quantity invariant**
    - Generate arbitrary product with quantity Q and stock-in with positive quantity N; assert post-save quantity equals Q + N
    - **Validates: Requirements 9.1**

  - [~]* 8.2 Write property test for Stock-In edit recalculation
    - **Property 8: Stock-In edit recalculation**
    - Generate existing stock-in with original quantity O; edit to new quantity N; assert product quantity equals pre-edit quantity + (N − O)
    - **Validates: Requirements 9.3**

  - [~]* 8.3 Write property test for Stock-In delete decrements quantity
    - **Property 11: Stock-In delete decrements quantity**
    - Generate product with quantity Q and stock-in with quantity N (N ≤ Q); delete the transaction; assert product quantity equals Q − N and is never negative
    - **Validates: Requirements 9.4**

- [x] 9. Stock-In UI — form and transaction list
  - Create `src/routes/(app)/stock/in/+page.svelte` with `StockInForm` (Superforms + `stockInSchema`) and a filterable/searchable transaction list
  - Create `src/lib/components/StockInForm.svelte` with product selector, delivery provider selector, quantity input, date picker, and notes field; display inline Zod errors
  - _Requirements: 9.5, 9.6_

- [x] 10. Stock-Out service and transactions
  - Add `createStockOut` and `listStockOut` to `stock.service.ts`
  - `createStockOut` MUST check `quantity <= product.quantity` before decrementing; throw `InsufficientStockError` if insufficient; decrement in the same SQLite transaction
  - _Requirements: 10.1, 10.2, 10.3_

  - [~]* 10.1 Write property test for Stock-Out quantity invariant
    - **Property 2: Stock-Out quantity invariant (valid case)**
    - Generate product with quantity Q and stock-out with quantity N where N ≤ Q; assert post-save quantity equals Q − N and is never negative
    - **Validates: Requirements 10.1, 10.3, 18.5**

  - [~]* 10.2 Write property test for Stock-Out rejection when insufficient
    - **Property 3: Stock-Out rejection when insufficient**
    - Generate product with quantity Q and stock-out with quantity N where N > Q; assert `InsufficientStockError` is thrown and product quantity remains Q
    - **Validates: Requirements 10.3, 18.5**

- [x] 11. Stock-Out UI — form and transaction list
  - Create `src/routes/(app)/stock/out/+page.svelte` with `StockOutForm` (Superforms + `stockOutSchema`) and a filterable/searchable transaction history log with timestamps
  - Create `src/lib/components/StockOutForm.svelte` with product selector, quantity input, reason field, and date picker; display `InsufficientStockError` as a form-level error
  - _Requirements: 10.4, 10.5, 10.6_

- [x] 12. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Sales service and transactions
  - Create `src/lib/services/sales.service.ts` implementing `SalesService` (`createSale`, `updateSale`, `deleteSale`, `listSales`)
  - `createSale` MUST auto-calculate `revenue = quantitySold × unitRetailPrice` and `grossProfit = revenue − (quantitySold × unitCostPrice)`; persist all fields; decrement product quantity in the same SQLite transaction
  - `createSale` MUST reject if `quantitySold > product.quantity` (throw `InsufficientStockError`)
  - `updateSale` MUST recalculate revenue and gross profit and apply quantity delta `(oldQty − newQty)` to the product
  - `deleteSale` MUST restore product quantity by `quantitySold`
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.7, 11.8_

  - [x]* 13.1 Write property test for Sales quantity decrement invariant
    - **Property 4: Sales quantity decrement invariant**
    - Generate product with quantity Q and sale with quantity_sold N where N ≤ Q; assert post-save product quantity equals Q − N
    - **Validates: Requirements 11.3, 11.4**

  - [x]* 13.2 Write property test for Sales revenue and gross profit calculation
    - **Property 5: Sales revenue and gross profit calculation**
    - Generate arbitrary quantity_sold Q, unit_retail_price P, unit_cost_price C (C ≤ P); assert persisted revenue = Q × P and gross_profit = (Q × P) − (Q × C)
    - **Validates: Requirements 11.2**

  - [x]* 13.3 Write property test for Sales edit recalculation
    - **Property 9: Sales edit recalculation**
    - Generate existing sale with original quantity_sold O; edit to new quantity_sold N; assert product quantity updated by (O − N) and revenue/gross_profit recalculated
    - **Validates: Requirements 11.7**

  - [x]* 13.4 Write property test for Sales delete restores quantity
    - **Property 10: Sales delete restores quantity**
    - Generate product with sale of quantity_sold N; delete the sale; assert product quantity increases by N
    - **Validates: Requirements 11.8**

- [x] 14. Sales UI — form and transaction list
  - Create `src/routes/(app)/sales/+page.svelte` with `SaleForm` (Superforms + `saleSchema`) and a filterable/searchable sales list (by product, brand, date, month)
  - Create `src/lib/components/SaleForm.svelte` with product selector (auto-fills unit prices from product), quantity input, and date picker; display `InsufficientStockError` as form-level error; show calculated revenue and gross profit preview
  - _Requirements: 11.5, 11.6_

- [x] 15. Notification service
  - Create `src/lib/services/notification.service.ts` with methods: `createNotification`, `listNotifications`, `markRead`, `dismiss`
  - Implement low stock check: after every stock-decrement operation (stock-out, sale), query products where `quantity <= COALESCE(low_stock_threshold, global_threshold)`; create `low_stock` notifications for any matches
  - Implement dead stock check: query products with no stock-out or sale within the configured dead-stock window; create `dead_stock` notifications
  - Create `src/lib/stores/notifications.store.ts` as a reactive Svelte store; wire `NotificationPanel.svelte` to it
  - On Tauri desktop target, call the Tauri notification plugin for `low_stock` and `dead_stock` alerts
  - _Requirements: 14.1, 14.2, 14.3, 14.5, 14.6, 14.7_

  - [~]* 15.1 Write property test for low stock alert threshold
    - **Property 14: Low stock alert threshold**
    - Generate arbitrary products with various quantities and thresholds (product-specific and global); after a quantity-decrement operation, assert that every product at or below its effective threshold has a `low_stock` notification
    - **Validates: Requirements 14.1, 17.1, 17.2**

- [x] 16. Analytics service
  - Create `src/lib/services/analytics.service.ts` implementing `AnalyticsService`
  - Implement `getTopSelling` and `getLeastSelling` using SQL aggregation on `sales_transactions` grouped by `tire_product_id`
  - Implement `getInventoryValue` as `SUM(quantity * unit_cost_price)` over active products
  - Implement `getRevenueSummary` aggregated by day/week/month
  - Implement `getProfitMargins` as `(retail_price - unit_cost_price) / retail_price * 100` per product
  - Implement `getInventoryTurnover` as total quantity sold / average inventory for the period
  - Implement `getSalesForecast` using linear regression over historical daily sales; return notice object when fewer than 30 days of data exist
  - Implement `exportReport` that generates PDF and uploads to Supabase Storage; return storage URL; create `report_ready` notification on success
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.6, 12.7, 13.1, 13.2, 13.3, 13.5, 13.6_

  - [~]* 16.1 Write property test for inventory value calculation
    - **Property 12: Inventory value calculation**
    - Generate arbitrary sets of active products with random quantities and unit cost prices; assert `getInventoryValue()` equals the sum of `quantity × unit_cost_price` for every product in the set
    - **Validates: Requirements 12.3**

  - [~]* 16.2 Write property test for profit margin calculation
    - **Property 13: Profit margin calculation**
    - Generate arbitrary products where `retailPrice >= unitCostPrice`; assert calculated margin equals `(P − C) / P * 100` and is always in [0, 100]
    - **Validates: Requirements 13.1**

- [x] 17. Dashboard and analytics UI
  - Create `src/routes/(app)/dashboard/+page.svelte` reading all metrics from SQLite_DB via analytics and inventory services
  - Render `DashboardMetricCard` components for: total product count, stock level summary, stock-in/out summaries, revenue and gross profit totals, peak/lowest sales month
  - Lazy-load `SalesBarChart`, `RevenueTrendChart`, and `SalesBrandPieChart` using dynamic `import()` wrapped in `{#await}`
  - Create `src/lib/components/SalesBarChart.svelte`, `RevenueTrendChart.svelte`, `SalesBrandPieChart.svelte` using shadcn-svelte Charts (Recharts-based)
  - Add date range, brand, and product filter controls that reactively update all metrics and charts
  - Create `src/routes/(app)/analytics/+page.svelte` with full report views, export-to-PDF button, and print button
  - _Requirements: 7.1–7.13, 12.5, 12.7, 12.8, 13.4, 19.2_

- [x] 18. Settings and delivery providers
  - Create `src/routes/(app)/settings/+page.svelte` with Superforms forms for: global low-stock threshold, dead-stock window, theme/date format/default date range, PowerSync connection settings
  - Implement CRUD for Delivery_Providers in `src/routes/(app)/settings/+page.svelte` (or sub-route); persist to `delivery_providers` table
  - Persist all settings to the `settings` table as key-value pairs; read on app startup into a `settings.store.ts`
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

- [x] 19. User management (Owner-only)
  - Create `src/routes/(app)/users/+page.svelte` with a searchable/filterable user list (name, email, role, active status) guarded by `RoleGuard` (Owner only)
  - Implement create, edit, and deactivate user actions using Superforms + `registerSchema`; call `auth.service` for Supabase Auth operations
  - Display per-user activity log sourced from Supabase_DB
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 20. PowerSync integration and sync engine
  - Create `src/lib/services/sync.service.ts` that initialises the PowerSync client with the Supabase JWT, registers the sync rules schema, and exposes `connect()` / `disconnect()`
  - Wire `sync.service` into the app layout: connect on session start, disconnect on logout
  - Update `sync-state.store.ts` to subscribe to PowerSync status events and reflect `online` / `offline` / `syncing`
  - On sync error after retries, call `notification.service.createNotification` with type `sync_status`
  - _Requirements: 15.2, 15.3, 15.4, 15.6, 14.3_

- [x] 21. Supabase PostgreSQL schema, RLS, and PowerSync rules
  - Create `supabase/migrations/001_initial_schema.sql` mirroring the SQLite schema with UUID PKs, `ON DELETE RESTRICT` FKs, `updated_at` triggers, and all check/unique constraints
  - Create RLS policies for each table scoped by `auth.uid()` and role claim: Staff read/write own-scope tables; Owner full access; block Staff from `users` table writes
  - Create `powersync/sync-rules.yaml` with the bucket definitions from the design
  - _Requirements: 5.3, 5.4, 18.3, 18.6_

- [x] 22. Tauri desktop integration
  - Configure `src-tauri/tauri.conf.json` with app name, window settings, and required plugin permissions (`sql`, `notification`)
  - Create `src-tauri/src/main.rs` registering the SQLite and notification plugins
  - Add system tray integration and native desktop notification calls in `notification.service.ts` behind the `window.__TAURI__` guard
  - _Requirements: 20.1, 20.3, 20.5, 14.6_

- [x] 23. Cloudflare Pages deployment configuration
  - Configure `svelte.config.js` to use `@sveltejs/adapter-cloudflare`
  - Create `wrangler.toml` with Pages project settings
  - Ensure `wa-sqlite` WASM assets are included in the Cloudflare build output
  - _Requirements: 20.2, 20.4_

- [x] 24. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 25. Red & Black theme and global styles
  - Apply the shadcn-svelte Red & Black theme tokens in `src/app.css` (CSS custom properties for primary red, background black, foreground, muted, border)
  - Verify all shadcn-svelte components inherit the theme correctly; adjust component-level overrides as needed
  - _Requirements: 7.8, 7.9, 7.10_

- [x] 26. Pagination, search, and performance
  - Add `LIMIT`/`OFFSET` pagination to all `list*` service methods; wire page controls in all list UI components (inventory, stock-in, stock-out, sales)
  - Verify all list views cap at 50 records per page
  - Add reactive store subscriptions so PowerSync remote changes trigger UI re-renders without manual refresh
  - _Requirements: 19.3, 19.4_

- [x] 27. Data backup and restore (Owner-only)
  - Create `src/routes/(app)/settings/backup/+page.svelte` with backup schedule configuration and restore UI (Owner-only, guarded by `RoleGuard`)
  - Implement `data.service.ts` with `triggerBackup()` and `restoreBackup(backupId)` methods; validate restored data against Zod schemas before applying; abort and display error on validation failure
  - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [x] 28. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use fast-check with a minimum of 100 iterations each; tag each test with `// Feature: jhaerin-tire-supply-ims, Property N: <title>`
- Unit tests and property tests are complementary — unit tests cover concrete examples and edge cases, property tests validate universal invariants
- All service methods that mutate quantity MUST use SQLite transactions to keep product quantity and transaction records atomic
- The `db` interface abstraction is the single most critical foundation — all services depend on it
