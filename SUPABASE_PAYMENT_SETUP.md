# 🗄️ Payment Table — Supabase Setup Guide

**Last Updated:** March 13, 2026

---

## 📋 Table of Contents

1. [Quick Setup (2 minutes)](#quick-setup)
2. [Manual Setup (if auto-migration fails)](#manual-setup)
3. [Verification](#verification)
4. [Troubleshooting](#troubleshooting)

---

## ⚡ Quick Setup

### Option 1: Using EF Core Migration (Recommended)

If your backend is connected to Supabase:

```bash
cd Backend
dotnet ef database update --project Repository --startup-project Api
```

This automatically applies all pending migrations, including the Payment table.

**Status:** ✅ Already applied in your database (migration: `20260313034928_AddPaymentTable`)

---

### Option 2: Manual SQL Script

If you need to manually apply the schema:

1. **Open Supabase Console**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Go to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Copy and Paste Script**
   - Open file: `supabase_payments.sql`
   - Copy all content
   - Paste into SQL Editor

4. **Execute**
   - Click "Run" button
   - Wait for success message

5. **Verify**
   - See "Verification" section below

---

## 📝 Manual Setup

If auto-migration isn't possible, here's what to do:

### Step 1: Create Payments Table

```sql
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
    
    CONSTRAINT "PK_Payments" PRIMARY KEY ("Id"),
    CONSTRAINT "CK_Payment_Status" 
        CHECK ("Status" IN ('Pending','Completed','Failed','Refunded','Cancelled')),
    CONSTRAINT "FK_Payments_Users_UserId" 
        FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Payments_SubscriptionPlans_PlanId" 
        FOREIGN KEY ("PlanId") REFERENCES "SubscriptionPlans" ("Id") ON DELETE RESTRICT,
    CONSTRAINT "FK_Payments_UserSubscriptions_SubscriptionId" 
        FOREIGN KEY ("SubscriptionId") REFERENCES "UserSubscriptions" ("Id") ON DELETE SET NULL
);
```

### Step 2: Create Indexes

```sql
CREATE INDEX "IX_Payments_UserId" ON "Payments" ("UserId");
CREATE INDEX "IX_Payments_PlanId" ON "Payments" ("PlanId");
CREATE INDEX "IX_Payments_SubscriptionId" ON "Payments" ("SubscriptionId");
CREATE UNIQUE INDEX "IX_Payments_TransactionId" ON "Payments" ("TransactionId") 
    WHERE "TransactionId" IS NOT NULL;
CREATE INDEX "IX_Payments_Status" ON "Payments" ("Status");
CREATE INDEX "IX_Payments_CreatedAt" ON "Payments" ("CreatedAt" DESC);
```

---

## ✅ Verification

### Check Table Exists

```sql
SELECT * FROM information_schema.tables 
WHERE table_name = 'Payments';
```

**Expected Result:**
- 1 row with table_name = 'Payments'

### Check Columns

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Payments' 
ORDER BY ordinal_position;
```

**Expected Result:** 14 columns

| column_name | data_type |
|---|---|
| Id | uuid |
| UserId | uuid |
| SubscriptionId | integer |
| PlanId | integer |
| Amount | numeric |
| Currency | character varying |
| PaymentMethod | character varying |
| Status | character varying |
| TransactionId | character varying |
| Description | text |
| PaidAt | timestamp with time zone |
| RefundedAt | timestamp with time zone |
| CreatedAt | timestamp with time zone |
| UpdatedAt | timestamp with time zone |

### Check Indexes

```sql
SELECT indexname FROM pg_indexes 
WHERE tablename = 'Payments' 
ORDER BY indexname;
```

**Expected Result:** 6 indexes

- IX_Payments_CreatedAt
- IX_Payments_PlanId
- IX_Payments_Status
- IX_Payments_SubscriptionId
- IX_Payments_TransactionId
- IX_Payments_UserId

### Check Constraints

```sql
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'Payments' 
ORDER BY constraint_name;
```

**Expected Result:** 5 constraints

- CK_Payment_Status (CHECK)
- FK_Payments_SubscriptionPlans_PlanId (FOREIGN KEY)
- FK_Payments_Users_UserId (FOREIGN KEY)
- FK_Payments_UserSubscriptions_SubscriptionId (FOREIGN KEY)
- PK_Payments (PRIMARY KEY)

### Test Insert

```sql
-- Insert test payment (replace with real UUIDs from your database)
INSERT INTO "Payments" 
  ("UserId", "PlanId", "Amount", "PaymentMethod", "Status", "Description")
VALUES 
  ('00000000-0000-0000-0000-000000000001', 2, 99000, 'Card', 'Pending', 'Test payment');

-- Check it was inserted
SELECT * FROM "Payments" LIMIT 1;

-- Clean up
DELETE FROM "Payments" WHERE "Description" = 'Test payment';
```

---

## 🔍 Troubleshooting

### Error: "Relation 'Payments' already exists"

**Cause:** Table was already created  
**Solution:** This is fine! Your table is ready to use.

### Error: "Foreign key constraint fails"

**Cause:** PlanId doesn't exist in SubscriptionPlans table  
**Solution:** Ensure SubscriptionPlans table exists with seeded data (Free, Basic, Pro, Enterprise)

```sql
-- Check subscription plans exist
SELECT * FROM "SubscriptionPlans";

-- Should return 4 rows
```

### Error: "Cannot create index, column doesn't exist"

**Cause:** Column name is wrong  
**Solution:** Verify column names are exactly as defined (case-sensitive)

```sql
-- List all columns in Payments table
\d "Payments"
```

### Error: "Unique constraint violation on TransactionId"

**Cause:** Duplicate transaction IDs  
**Solution:** This is expected behavior! The unique constraint prevents duplicates. If you need to retry a transaction, use a different TransactionId.

### Table exists but backend queries fail

**Cause:** EF Core context not updated  
**Solution:** Rebuild the project:

```bash
cd Backend
dotnet clean
dotnet build
dotnet ef database update
```

---

## 📊 Database Diagram

```
Users
├─ Payments (many)
│  ├─ PlanId → SubscriptionPlans (one)
│  ├─ SubscriptionId → UserSubscriptions (optional one)
│  └─ UserId → Users (many) [FK]
│
SubscriptionPlans (seeded: 4 rows)
├─ Free (Id=1)
├─ Basic (Id=2)
├─ Pro (Id=3)
└─ Enterprise (Id=4)

UserSubscriptions
├─ UserId → Users
├─ PlanId → SubscriptionPlans
└─ Payments (many optional)
```

---

## 🔐 Security Notes

### Current Setup

- ✅ Payments table has foreign keys (referential integrity)
- ✅ Status is validated with CHECK constraint
- ✅ TransactionId is unique (prevents duplicate charges)
- ✅ Amount uses decimal(18,2) for precision (no float rounding errors)

### Optional: Enable Row-Level Security (RLS)

If you want users to only see their own payments:

```sql
ALTER TABLE "Payments" ENABLE ROW LEVEL SECURITY;

-- Users can only view their own payments
CREATE POLICY "Users can view own payments" 
    ON "Payments" 
    FOR SELECT 
    USING (auth.uid() = "UserId");

-- Prevent direct inserts (must use API)
CREATE POLICY "Payments are created via API" 
    ON "Payments" 
    FOR INSERT 
    WITH CHECK (false);

-- Prevent direct updates (must use API)
CREATE POLICY "Payments are updated via API" 
    ON "Payments" 
    FOR UPDATE 
    USING (false);
```

---

## 📈 Monitoring & Analytics

### Revenue Query (All Completed Payments)

```sql
SELECT 
  SUM("Amount") as total_revenue,
  COUNT(*) as payment_count,
  AVG("Amount") as avg_payment,
  DATE(MIN("PaidAt")) as earliest_payment,
  DATE(MAX("PaidAt")) as latest_payment
FROM "Payments"
WHERE "Status" = 'Completed';
```

### Payments by Status

```sql
SELECT 
  "Status", 
  COUNT(*) as count,
  SUM("Amount") as total_amount
FROM "Payments"
GROUP BY "Status"
ORDER BY count DESC;
```

### Payment Methods Distribution

```sql
SELECT 
  "PaymentMethod", 
  COUNT(*) as count,
  SUM("Amount") as total_amount
FROM "Payments"
WHERE "Status" = 'Completed'
GROUP BY "PaymentMethod"
ORDER BY total_amount DESC;
```

### Monthly Revenue

```sql
SELECT 
  DATE_TRUNC('month', "PaidAt") as month,
  COUNT(*) as payment_count,
  SUM("Amount") as monthly_revenue
FROM "Payments"
WHERE "Status" = 'Completed'
GROUP BY DATE_TRUNC('month', "PaidAt")
ORDER BY month DESC;
```

---

## 🎯 Next Steps

1. ✅ Payment table created in Supabase
2. ⬜ Test with sample payments via API
3. ⬜ Connect payment gateway webhook
4. ⬜ Add frontend payment history page
5. ⬜ Setup email receipts

---

## 📞 Support

**Problem:** Schema is different from what's shown  
**Solution:** Check that migrations are in order. Run:
```bash
dotnet ef migrations list --project Repository
```

**Problem:** Can't connect from backend  
**Solution:** Verify connection string in `appsettings.json`:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=aws-0-ap-southeast-1.pooler.supabase.com;Port=6543;Database=postgres;Username=postgres;Password=***;SslMode=Require;"
  }
}
```

---

**Last Updated:** March 13, 2026  
**Status:** ✅ Ready for Production
