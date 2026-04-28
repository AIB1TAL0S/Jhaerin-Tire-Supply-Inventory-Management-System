# Requirements Document

## Introduction

Jhaerin Tire Supply Inventory Management System (JTS-IMS) is a cross-platform offline-first desktop and web application for managing tire inventory, stock transactions, sales, and financial analytics. The system runs as a native desktop app via SvelteKit + Tauri and as a web app on Cloudflare Pages. SQLite serves as the local database with PowerSync providing bi-directional sync to Supabase PostgreSQL. All UI reads from local SQLite, ensuring zero-latency operation even when offline. Role-based access control separates Owner and Staff capabilities.

## Glossary

- **System**: The JTS-IMS application as a whole
- **Auth_Module**: The authentication and session management subsystem
- **User_Manager**: The user account management subsystem (Owner-only)
- **Dashboard**: The analytics overview and summary display subsystem
- **Inventory_Manager**: The tire product catalog and stock management subsystem
- **Stock_Manager**: The stock-in and stock-out transaction subsystem
- **Sales_Manager**: The sales transaction recording and tracking subsystem
- **Analytics_Engine**: The reporting and financial analytics subsystem
- **Notification_Service**: The alert and notification delivery subsystem
- **Data_Manager**: The backup, restore, and data integrity subsystem
- **Settings_Manager**: The system configuration subsystem
- **Sync_Engine**: The PowerSync-based bi-directional sync layer between SQLite and Supabase
- **SQLite_DB**: The local SQLite database used as the primary read/write store on the client
- **Supabase_DB**: The cloud PostgreSQL database hosted on Supabase
- **Owner**: A user with full administrative access to all modules
- **Staff**: A user with limited access scoped to inventory, stock, and sales operations
- **JWT**: JSON Web Token issued by Supabase Auth for session authentication
- **RLS**: Row Level Security policies enforced at the Supabase PostgreSQL level
- **PowerSync**: The offline-first sync engine that replicates data between SQLite_DB and Supabase_DB
- **Tire_Product**: A catalog entry representing a specific tire SKU with brand, size, pattern, pricing, and stock data
- **Stock_In_Transaction**: A record of incoming inventory for a Tire_Product from a delivery provider
- **Stock_Out_Transaction**: A record of outgoing inventory for a Tire_Product with a reason and timestamp
- **Sales_Transaction**: A record of a completed sale including product, quantity, revenue, cost, and gross profit
- **Low_Stock_Threshold**: A configurable minimum quantity below which a Tire_Product triggers a low stock alert
- **Dead_Stock**: A Tire_Product with no Stock_Out_Transaction or Sales_Transaction within a configurable number of days
- **Delivery_Provider**: A named supplier or logistics entity associated with Stock_In_Transactions
- **Superforms**: The SvelteKit form library used for server-side and client-side form handling
- **Zod_Schema**: A TypeScript-first schema validation library used to validate all form inputs

---

## Requirements

### Requirement 1: User Authentication

**User Story:** As a user, I want to log in with my email and password, so that I can securely access the system.

#### Acceptance Criteria

1. WHEN a user submits a login form with a valid email and password, THE Auth_Module SHALL authenticate the user via Supabase Auth and establish a JWT session.
2. WHEN a user submits a login form with an invalid email or password, THE Auth_Module SHALL display a descriptive inline validation error without revealing which field is incorrect.
3. WHEN a JWT session expires, THE Auth_Module SHALL automatically refresh the token without requiring the user to re-enter credentials.
4. IF the JWT refresh fails, THEN THE Auth_Module SHALL redirect the user to the login page and clear the expired session.
5. WHEN a user submits the login form, THE Auth_Module SHALL validate all fields using the Zod_Schema before submitting to Supabase Auth.
6. THE Auth_Module SHALL render the login form using Superforms with progressive enhancement enabled.

---

### Requirement 2: Account Registration

**User Story:** As an Owner, I want to register new user accounts with assigned roles, so that staff members can access the system with appropriate permissions.

#### Acceptance Criteria

1. WHEN an Owner submits a registration form with a valid email, password, and role, THE Auth_Module SHALL create the account in Supabase Auth and assign the specified role.
2. WHEN a registration form is submitted with an email that already exists, THE Auth_Module SHALL display an inline error indicating the email is already registered.
3. THE Auth_Module SHALL validate all registration fields using the Zod_Schema before submission.
4. THE Auth_Module SHALL support assigning exactly one of two roles — Owner or Staff — during registration.
5. WHEN a new account is successfully created, THE Auth_Module SHALL send a confirmation email via Supabase Auth email flow.

---

### Requirement 3: Password Reset

**User Story:** As a user, I want to reset my password via email, so that I can regain access if I forget my credentials.

#### Acceptance Criteria

1. WHEN a user submits a password reset request with a registered email, THE Auth_Module SHALL trigger the Supabase Auth password reset email flow.
2. WHEN a user submits a password reset request with an unregistered email, THE Auth_Module SHALL display a generic confirmation message without revealing whether the email exists.
3. WHEN a user follows the password reset link and submits a new password, THE Auth_Module SHALL update the password in Supabase Auth and invalidate all existing sessions for that account.

---

### Requirement 4: Logout and Session Termination

**User Story:** As a user, I want to log out securely, so that my session is terminated and my data is protected.

#### Acceptance Criteria

1. WHEN a user initiates logout, THE Auth_Module SHALL terminate the Supabase Auth session and clear all local JWT tokens.
2. WHEN a user initiates logout, THE Auth_Module SHALL redirect the user to the login page.
3. AFTER logout, THE Auth_Module SHALL reject any attempt to access protected routes until a new session is established.

---

### Requirement 5: Role-Based Access Control

**User Story:** As a system administrator, I want role-based access enforced at every layer, so that Staff cannot access Owner-only features.

#### Acceptance Criteria

1. WHILE a user session has the Staff role, THE System SHALL restrict access to User_Manager routes and UI controls.
2. WHILE a user session has the Owner role, THE System SHALL grant access to all modules including User_Manager.
3. THE Supabase_DB SHALL enforce RLS policies that scope data access per role on every table.
4. THE Sync_Engine SHALL validate the JWT role claim before accepting any sync session.
5. IF a Staff user attempts to access an Owner-only route, THEN THE System SHALL redirect the user to the dashboard with an access-denied notification.

---

### Requirement 6: User Management

**User Story:** As an Owner, I want to manage staff accounts, so that I can control who has access to the system.

#### Acceptance Criteria

1. WHEN an Owner creates a staff account, THE User_Manager SHALL persist the account to Supabase_DB with the assigned role and active status.
2. WHEN an Owner edits a staff account, THE User_Manager SHALL update the account fields in Supabase_DB and reflect changes in the UI within one sync cycle.
3. WHEN an Owner deactivates a staff account, THE User_Manager SHALL set the account status to inactive and prevent that user from establishing new sessions.
4. THE User_Manager SHALL display a searchable list of all accounts filterable by name, email, role, and active status.
5. THE User_Manager SHALL display a user activity log sourced from Supabase_DB for each account.
6. THE User_Manager SHALL validate all account forms using Superforms and Zod_Schema before submission.

---

### Requirement 7: Dashboard Overview

**User Story:** As a user, I want a dashboard with key metrics and charts, so that I can quickly assess the state of the business.

#### Acceptance Criteria

1. THE Dashboard SHALL display the total count of Tire_Products in the catalog.
2. THE Dashboard SHALL display a current stock level summary aggregated across all Tire_Products.
3. THE Dashboard SHALL display Stock_In and Stock_Out summary cards for the selected date range.
4. THE Dashboard SHALL display revenue and gross profit totals for the selected date range.
5. THE Dashboard SHALL display the peak sales month and lowest sales month indicators derived from Sales_Transactions.
6. THE Dashboard SHALL display a low stock alerts panel listing all Tire_Products where current quantity is at or below the Low_Stock_Threshold.
7. THE Dashboard SHALL display a dead stock alerts panel listing all Tire_Products meeting the Dead_Stock criteria.
8. THE Dashboard SHALL render a bar chart showing daily, weekly, or monthly sales volume using shadcn-svelte Charts.
9. THE Dashboard SHALL render a line chart showing revenue and gross profit trends using shadcn-svelte Charts.
10. THE Dashboard SHALL render a pie or donut chart showing sales breakdown by brand and category using shadcn-svelte Charts.
11. THE Dashboard SHALL support filtering all metrics and charts by date range, brand, and product.
12. THE Dashboard SHALL lazy-load all chart components to reduce initial render cost.
13. THE Dashboard SHALL read all metric data from SQLite_DB to ensure zero network latency.

---

### Requirement 8: Tire Product Catalog Management

**User Story:** As a user, I want to manage tire products in the catalog, so that inventory records are accurate and up to date.

#### Acceptance Criteria

1. WHEN a user creates a Tire_Product, THE Inventory_Manager SHALL persist the product to SQLite_DB and queue the record for sync via the Sync_Engine.
2. WHEN a user edits a Tire_Product, THE Inventory_Manager SHALL apply an optimistic UI update to SQLite_DB immediately and queue the change for sync.
3. WHEN a user archives a Tire_Product, THE Inventory_Manager SHALL mark the product as archived in SQLite_DB and exclude it from active inventory views.
4. THE Inventory_Manager SHALL store the following fields per Tire_Product: Tire Brand, Tire Size, Tire Pattern, Quantity, Unit Cost Price, Retail Price, Delivery Provider, and Low_Stock_Threshold.
5. THE Inventory_Manager SHALL prevent duplicate Tire_Products using Supabase_DB unique constraints combined with Zod_Schema client-side validation.
6. THE Inventory_Manager SHALL display a searchable and filterable product list supporting search by brand, size, and pattern, and filtering by brand, size, pattern, Delivery_Provider, and stock level.
7. THE Inventory_Manager SHALL validate all product forms using Superforms and Zod_Schema before submission.
8. FOR ALL Tire_Product records, THE Inventory_Manager SHALL ensure that Retail Price is greater than or equal to Unit Cost Price.

---

### Requirement 9: Stock-In Transaction Management

**User Story:** As a user, I want to record incoming inventory, so that stock quantities are updated when new tires arrive.

#### Acceptance Criteria

1. WHEN a user saves a Stock_In_Transaction, THE Stock_Manager SHALL increment the associated Tire_Product quantity in SQLite_DB by the recorded quantity.
2. WHEN a user saves a Stock_In_Transaction, THE Stock_Manager SHALL persist the transaction record with Delivery_Provider, date, quantity, and product reference.
3. WHEN a user edits a Stock_In_Transaction, THE Stock_Manager SHALL recalculate and update the associated Tire_Product quantity to reflect the corrected value.
4. WHEN a user deletes a Stock_In_Transaction, THE Stock_Manager SHALL decrement the associated Tire_Product quantity by the deleted transaction's quantity.
5. THE Stock_Manager SHALL display a searchable and filterable list of Stock_In_Transactions supporting search and filter by product, date, and Delivery_Provider.
6. THE Stock_Manager SHALL validate all stock-in forms using Superforms and Zod_Schema before submission.
7. IF a Stock_In_Transaction quantity is zero or negative, THEN THE Stock_Manager SHALL reject the submission with a descriptive validation error.

---

### Requirement 10: Stock-Out Transaction Management

**User Story:** As a user, I want to record outgoing inventory, so that stock quantities reflect actual usage and removals.

#### Acceptance Criteria

1. WHEN a user saves a Stock_Out_Transaction, THE Stock_Manager SHALL decrement the associated Tire_Product quantity in SQLite_DB by the recorded quantity.
2. WHEN a user saves a Stock_Out_Transaction, THE Stock_Manager SHALL persist the transaction record with product reference, quantity, reason, and timestamp.
3. IF a Stock_Out_Transaction quantity exceeds the current Tire_Product quantity, THEN THE Stock_Manager SHALL reject the submission with a descriptive error indicating insufficient stock.
4. THE Stock_Manager SHALL display a transaction history log with timestamps for all Stock_Out_Transactions.
5. THE Stock_Manager SHALL display a searchable and filterable list of Stock_Out_Transactions supporting search and filter by product, date, and reason.
6. THE Stock_Manager SHALL validate all stock-out forms using Superforms and Zod_Schema before submission.

---

### Requirement 11: Sales Transaction Management

**User Story:** As a user, I want to record sales transactions, so that revenue, cost, and profit are tracked accurately.

#### Acceptance Criteria

1. WHEN a user saves a Sales_Transaction, THE Sales_Manager SHALL persist the transaction with product reference, quantity sold, unit retail price, unit cost price, revenue, and gross profit.
2. WHEN a user saves a Sales_Transaction, THE Sales_Manager SHALL automatically calculate revenue as quantity multiplied by unit retail price and gross profit as revenue minus total cost.
3. WHEN a user saves a Sales_Transaction, THE Sales_Manager SHALL decrement the associated Tire_Product quantity in SQLite_DB by the quantity sold.
4. IF a Sales_Transaction quantity exceeds the current Tire_Product quantity, THEN THE Sales_Manager SHALL reject the submission with a descriptive error indicating insufficient stock.
5. THE Sales_Manager SHALL display a searchable and filterable list of Sales_Transactions supporting search and filter by product, brand, date, and month.
6. THE Sales_Manager SHALL validate all sales forms using Superforms and Zod_Schema before submission.
7. WHEN a user edits a Sales_Transaction, THE Sales_Manager SHALL recalculate revenue and gross profit and update the associated Tire_Product quantity accordingly.
8. WHEN a user deletes a Sales_Transaction, THE Sales_Manager SHALL restore the associated Tire_Product quantity by the deleted transaction's quantity sold.

---

### Requirement 12: Analytics and Reporting

**User Story:** As an Owner, I want detailed reports on sales, inventory value, and profitability, so that I can make informed business decisions.

#### Acceptance Criteria

1. THE Analytics_Engine SHALL generate a top-selling products report ranked by total quantity sold within a selected time period.
2. THE Analytics_Engine SHALL generate a least-selling products report ranked by total quantity sold within a selected time period.
3. THE Analytics_Engine SHALL generate an inventory value report calculated as the sum of (Quantity × Unit Cost Price) for all active Tire_Products.
4. THE Analytics_Engine SHALL generate revenue and gross profit reports aggregated by day, week, and month.
5. THE Analytics_Engine SHALL render sales trend visualizations using shadcn-svelte Charts.
6. THE Analytics_Engine SHALL support exporting reports to PDF and storing the exported file in Supabase Storage.
7. THE Analytics_Engine SHALL support printing reports directly from the application.
8. THE Analytics_Engine SHALL support time-based filtering for all reports by daily, weekly, and monthly periods.

---

### Requirement 13: Financial Analytics

**User Story:** As an Owner, I want financial KPIs and forecasting, so that I can evaluate business performance and plan ahead.

#### Acceptance Criteria

1. THE Analytics_Engine SHALL calculate profit margin per Tire_Product as (Retail Price − Unit Cost Price) / Retail Price expressed as a percentage.
2. THE Analytics_Engine SHALL calculate inventory turnover ratio as total quantity sold divided by average inventory quantity for a selected period.
3. THE Analytics_Engine SHALL generate a monthly financial summary including total revenue, total cost, gross profit, and profit margin.
4. THE Analytics_Engine SHALL render a revenue versus profit comparison chart using shadcn-svelte Charts.
5. THE Analytics_Engine SHALL generate a sales forecast projection based on historical Sales_Transaction trends for the next 30 days.
6. WHERE the sales history contains fewer than 30 days of data, THE Analytics_Engine SHALL display a notice that the forecast has insufficient data and show available trend data only.

---

### Requirement 14: Notification and Alerts

**User Story:** As a user, I want to receive alerts for low stock, dead stock, and system events, so that I can act on critical inventory and sync conditions promptly.

#### Acceptance Criteria

1. WHEN a Tire_Product quantity reaches or falls below its Low_Stock_Threshold, THE Notification_Service SHALL create a low stock alert notification.
2. WHEN a Tire_Product has no Stock_Out_Transaction or Sales_Transaction for a configurable number of days, THE Notification_Service SHALL create a dead stock alert notification.
3. WHEN the Sync_Engine changes sync status, THE Notification_Service SHALL create a system notification reflecting the new status (online, offline, or syncing).
4. WHEN a report export is complete and stored in Supabase Storage, THE Notification_Service SHALL create a report availability notification.
5. THE Notification_Service SHALL support three notification states: Unread, Read, and Dismissed.
6. WHEN the application is running on a Tauri desktop target, THE Notification_Service SHALL deliver low stock and dead stock alerts as native desktop notifications via the Tauri notification plugin.
7. THE Notification_Service SHALL display all active notifications in a notification panel accessible from the main navigation.

---

### Requirement 15: Offline-First Sync

**User Story:** As a user, I want the application to work fully offline and sync automatically when connectivity is restored, so that I can continue working without interruption.

#### Acceptance Criteria

1. THE System SHALL read all data from SQLite_DB regardless of network connectivity status.
2. WHEN a user creates, updates, or deletes any record while offline, THE Sync_Engine SHALL queue the mutation in the PowerSync upload queue.
3. WHEN network connectivity is restored, THE Sync_Engine SHALL replay all queued mutations to Supabase_DB in the order they were recorded.
4. WHEN a remote change arrives from Supabase_DB, THE Sync_Engine SHALL apply the change to SQLite_DB using last-write-wins conflict resolution based on record timestamps.
5. THE System SHALL display a persistent sync status indicator showing the current state as online, offline, or syncing.
6. THE Sync_Engine SHALL validate the user JWT before accepting or initiating any sync session.

---

### Requirement 16: Data Backup and Restore

**User Story:** As an Owner, I want automatic backups and the ability to restore data, so that business data is protected against loss.

#### Acceptance Criteria

1. THE Data_Manager SHALL trigger automatic database backups via Supabase scheduled database dumps on a configurable schedule.
2. WHEN an Owner initiates a restore, THE Data_Manager SHALL retrieve the selected backup from Supabase Storage and apply it to Supabase_DB.
3. THE Data_Manager SHALL validate all restored data against Zod_Schema constraints before applying the restore.
4. IF a restore operation fails validation, THEN THE Data_Manager SHALL abort the restore and display a descriptive error without modifying the current database state.

---

### Requirement 17: Settings and Configuration

**User Story:** As an Owner, I want to configure system settings, so that the application behaves according to business preferences.

#### Acceptance Criteria

1. THE Settings_Manager SHALL allow an Owner to configure a global Low_Stock_Threshold applied to all Tire_Products that do not have a product-specific threshold.
2. THE Settings_Manager SHALL allow an Owner to configure a product-specific Low_Stock_Threshold that overrides the global threshold for that Tire_Product.
3. THE Settings_Manager SHALL provide CRUD operations for Delivery_Providers.
4. THE Settings_Manager SHALL allow configuration of system preferences including theme, date format, and default report date range.
5. THE Settings_Manager SHALL allow configuration of PowerSync connection settings including endpoint and credentials.
6. THE Settings_Manager SHALL validate all settings forms using Superforms and Zod_Schema before saving.

---

### Requirement 18: Data Integrity and Validation

**User Story:** As a system, I want all data to be validated at every layer, so that corrupt or inconsistent records never enter the database.

#### Acceptance Criteria

1. THE System SHALL validate all user inputs using Zod_Schema on the client side before any form submission.
2. THE System SHALL validate all form submissions using Superforms server-side actions before writing to SQLite_DB or Supabase_DB.
3. THE Supabase_DB SHALL enforce unique constraints, foreign key constraints, and check constraints at the database level.
4. THE System SHALL prevent duplicate Tire_Products by enforcing a unique constraint on the combination of Tire Brand, Tire Size, and Tire Pattern.
5. FOR ALL Stock_In_Transactions and Stock_Out_Transactions, THE Stock_Manager SHALL ensure that the resulting Tire_Product quantity is never negative.
6. THE System SHALL apply PostgreSQL indexes on all frequently queried columns including product brand, size, pattern, and transaction date fields.

---

### Requirement 19: Performance

**User Story:** As a user, I want the application to respond quickly, so that I can work efficiently without waiting for data to load.

#### Acceptance Criteria

1. THE System SHALL serve all list and detail views from SQLite_DB to achieve sub-100ms UI response times under normal operating conditions.
2. THE Dashboard SHALL lazy-load chart components so that the initial page render completes before chart data is fetched.
3. THE System SHALL apply pagination to all list views displaying more than 50 records.
4. WHEN the Sync_Engine receives remote changes, THE System SHALL update reactive UI components automatically without requiring a manual page refresh.

---

### Requirement 20: Cross-Platform Deployment

**User Story:** As a business owner, I want the application available on both desktop and web, so that staff can use it from any supported device.

#### Acceptance Criteria

1. THE System SHALL build as a native desktop application for Windows and macOS using Tauri wrapping the SvelteKit frontend.
2. THE System SHALL deploy as a web application to Cloudflare Pages using the SvelteKit Cloudflare adapter.
3. WHERE the application is running on the Tauri desktop target, THE System SHALL use the Tauri SQLite plugin for local database access.
4. THE System SHALL share a single SvelteKit codebase across both the desktop and web deployment targets.
5. WHERE the application is running on the Tauri desktop target, THE System SHALL support system tray integration and native desktop notifications via Tauri plugins.
