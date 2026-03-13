-- ============================================================================
-- Supabase Payment Table — Verification & Diagnostic Script
-- ============================================================================
-- Run this script in Supabase SQL Editor to verify Payment table setup
-- ============================================================================

-- 1. Check if Payments table exists
SELECT 
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name = 'Payments'
LIMIT 1;

-- If above returns 0 rows, table doesn't exist yet!

-- ============================================================================

-- 2. List all columns with data types
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns
WHERE table_name = 'Payments'
ORDER BY ordinal_position;

-- Expected: 14 columns

-- ============================================================================

-- 3. List all indexes on Payments table
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'Payments'
ORDER BY indexname;

-- Expected: 6 indexes (UserId, PlanId, SubscriptionId, TransactionId, Status, CreatedAt)

-- ============================================================================

-- 4. List all constraints
SELECT 
  constraint_name,
  constraint_type,
  table_name
FROM information_schema.table_constraints
WHERE table_name = 'Payments'
ORDER BY constraint_name;

-- Expected: 5 constraints (PK, 3 FK, 1 CHECK)

-- ============================================================================

-- 5. Check foreign key relationships
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name as referenced_table_name,
  ccu.column_name as referenced_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'Payments'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.constraint_name;

-- Expected: 3 foreign keys

-- ============================================================================

-- 6. Check CHECK constraints
SELECT 
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%Payment%'
  OR constraint_name LIKE '%Payment_Status%'
ORDER BY constraint_name;

-- Expected: 1 constraint for Status validation

-- ============================================================================

-- 7. Count payments (should be 0 initially)
SELECT 
  COUNT(*) as total_payments,
  COUNT(CASE WHEN "Status" = 'Completed' THEN 1 END) as completed_payments,
  COUNT(CASE WHEN "Status" = 'Pending' THEN 1 END) as pending_payments,
  COUNT(CASE WHEN "Status" = 'Failed' THEN 1 END) as failed_payments,
  COUNT(CASE WHEN "Status" = 'Refunded' THEN 1 END) as refunded_payments,
  SUM("Amount") as total_amount
FROM "Payments";

-- ============================================================================

-- 8. Check connection to related tables
SELECT 
  (SELECT COUNT(*) FROM "Users") as user_count,
  (SELECT COUNT(*) FROM "SubscriptionPlans") as subscription_plan_count,
  (SELECT COUNT(*) FROM "UserSubscriptions") as user_subscription_count,
  (SELECT COUNT(*) FROM "Payments") as payment_count;

-- Expected: Users > 0, SubscriptionPlans = 4, Payments = 0 (initially)

-- ============================================================================

-- 9. Verify SubscriptionPlans seeded data
SELECT * FROM "SubscriptionPlans" ORDER BY "Id";

-- Expected: 4 rows (Free, Basic, Pro, Enterprise)

-- ============================================================================

-- 10. Test insert (comment out if not needed)
-- This will fail if foreign keys don't exist, but that's OK - it's just a test

-- INSERT INTO "Payments" 
--   ("UserId", "PlanId", "Amount", "PaymentMethod", "Status", "Description")
-- VALUES 
--   ('550e8400-e29b-41d4-a716-446655440000', 2, 99000, 'Card', 'Pending', 'Test payment');

-- SELECT * FROM "Payments" WHERE "Description" = 'Test payment';

-- DELETE FROM "Payments" WHERE "Description" = 'Test payment';

-- ============================================================================

-- 11. Check migration history (if using EF Core)
SELECT * FROM "__EFMigrationsHistory" 
WHERE "MigrationId" LIKE '%Payment%' 
   OR "MigrationId" LIKE '%AddPaymentTable%'
ORDER BY "MigrationId" DESC;

-- Expected: 1 row with MigrationId = '20260313034928_AddPaymentTable'

-- ============================================================================
-- END OF VERIFICATION SCRIPT
-- ============================================================================
