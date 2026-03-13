-- ============================================================================
-- StoryRAG — Payment Table Schema for Supabase
-- ============================================================================
-- This script creates the Payments table and all necessary indexes/constraints
-- to be applied to Supabase PostgreSQL database.
--
-- Instructions:
-- 1. Go to Supabase Console → SQL Editor
-- 2. Create new query
-- 3. Copy and paste this entire script
-- 4. Click "Run"
-- ============================================================================

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PAYMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Payments" (
    "Id" uuid NOT NULL DEFAULT (uuid_generate_v4()),
    "UserId" uuid NOT NULL,
    "SubscriptionId" integer NULL,
    "PlanId" integer NOT NULL,
    "Amount" numeric(18,2) NOT NULL,
    "Currency" character varying(10) NOT NULL DEFAULT 'VND',
    "PaymentMethod" character varying(50) NOT NULL DEFAULT 'Card',
    "Status" character varying(20) NOT NULL DEFAULT 'Pending',
    "TransactionId" character varying(255) NULL,
    "Description" text NULL,
    "PaidAt" timestamp with time zone NULL,
    "RefundedAt" timestamp with time zone NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT (NOW()),
    "UpdatedAt" timestamp with time zone NULL,
    
    -- Primary Key
    CONSTRAINT "PK_Payments" PRIMARY KEY ("Id"),
    
    -- Status Constraint (enum-like validation)
    CONSTRAINT "CK_Payment_Status" 
        CHECK ("Status" IN ('Pending','Completed','Failed','Refunded','Cancelled')),
    
    -- Foreign Keys
    CONSTRAINT "FK_Payments_Users_UserId" 
        FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
    
    CONSTRAINT "FK_Payments_SubscriptionPlans_PlanId" 
        FOREIGN KEY ("PlanId") REFERENCES "SubscriptionPlans" ("Id") ON DELETE RESTRICT,
    
    CONSTRAINT "FK_Payments_UserSubscriptions_SubscriptionId" 
        FOREIGN KEY ("SubscriptionId") REFERENCES "UserSubscriptions" ("Id") ON DELETE SET NULL
);

-- ============================================================================
-- INDEXES (for query performance)
-- ============================================================================

-- Index for user payment history queries
CREATE INDEX IF NOT EXISTS "IX_Payments_UserId" 
    ON "Payments" ("UserId");

-- Index for subscription plan lookups
CREATE INDEX IF NOT EXISTS "IX_Payments_PlanId" 
    ON "Payments" ("PlanId");

-- Index for subscription relationship queries
CREATE INDEX IF NOT EXISTS "IX_Payments_SubscriptionId" 
    ON "Payments" ("SubscriptionId");

-- Unique index for payment gateway transaction IDs
-- This ensures no duplicate transactions are created
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Payments_TransactionId" 
    ON "Payments" ("TransactionId") 
    WHERE "TransactionId" IS NOT NULL;

-- Index for payment status queries (e.g., find all completed payments)
CREATE INDEX IF NOT EXISTS "IX_Payments_Status" 
    ON "Payments" ("Status");

-- Index for date-based queries (payment history filtering)
CREATE INDEX IF NOT EXISTS "IX_Payments_CreatedAt" 
    ON "Payments" ("CreatedAt" DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Optional but recommended
-- ============================================================================
-- Uncomment below to enable RLS policies for multi-tenancy

-- ALTER TABLE "Payments" ENABLE ROW LEVEL SECURITY;

-- -- Policy: Users can only view their own payments
-- CREATE POLICY "Users can view own payments" 
--     ON "Payments" 
--     FOR SELECT 
--     USING (auth.uid() = "UserId");

-- -- Policy: Users cannot insert payments directly (only via API)
-- CREATE POLICY "Prevent user inserts" 
--     ON "Payments" 
--     FOR INSERT 
--     WITH CHECK (false);

-- -- Policy: Only system can update payments
-- CREATE POLICY "Prevent direct updates" 
--     ON "Payments" 
--     FOR UPDATE 
--     USING (false);

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================
-- Uncomment to insert test payment records:

-- INSERT INTO "Payments" ("UserId", "PlanId", "Amount", "Currency", "PaymentMethod", "Status", "Description")
-- VALUES 
--     ('user-uuid-1', 2, 99000, 'VND', 'Card', 'Completed', 'Monthly subscription'),
--     ('user-uuid-2', 3, 249000, 'VND', 'Card', 'Pending', 'Pro plan trial'),
--     ('user-uuid-1', 4, 699000, 'VND', 'BankTransfer', 'Completed', 'Enterprise annual');

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the table was created correctly:

-- Check table structure:
-- SELECT * FROM information_schema.columns 
-- WHERE table_name = 'Payments' 
-- ORDER BY ordinal_position;

-- Check indexes:
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'Payments';

-- Check constraints:
-- SELECT constraint_name, constraint_type 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'Payments';

-- ============================================================================
-- END OF PAYMENT TABLE SCHEMA
-- ============================================================================
