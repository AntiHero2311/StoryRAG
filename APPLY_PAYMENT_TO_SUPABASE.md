# 🚀 Apply Payment System to Supabase — Step-by-Step Guide

## ⏱️ Time: 5 minutes

---

## 🎯 What You'll Do

1. ✅ Open Supabase Console
2. ✅ Run SQL script to create Payment table
3. ✅ Verify table was created correctly
4. ✅ Test data insertion
5. ✅ Monitor with analytics

---

## 📍 Step 1: Login to Supabase

1. Go to **https://supabase.com/dashboard**
2. Login with your credentials
3. Select your **StoryRAG project**

---

## 📋 Step 2: Open SQL Editor

1. In left sidebar, click **"SQL Editor"**
2. Click **"New Query"** button (top right)
3. A new SQL editor tab will open

---

## 🔧 Step 3: Copy & Paste SQL Script

1. Open file: **`supabase_payments.sql`** (in project root)
2. Select all content (Ctrl+A)
3. Copy (Ctrl+C)
4. In Supabase SQL Editor, paste (Ctrl+V)

**Content should show:**
```sql
-- ============================================================================
-- StoryRAG — Payment Table Schema for Supabase
-- ============================================================================
```

---

## ▶️ Step 4: Execute Script

1. Click **"Run"** button (or Ctrl+Enter)
2. Wait for execution to complete (~5 seconds)
3. You should see: **"Query executed successfully"** message

**If you see errors:**
- ✅ "relation already exists" = OK, table was already created
- ❌ "Foreign key constraint" = Need to seed SubscriptionPlans first
- ❌ Other errors = See Troubleshooting below

---

## ✅ Step 5: Verify Table Creation

1. Click **"New Query"** again
2. Paste this verification script:

```sql
-- Quick verification
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_name = 'Payments';

SELECT COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'Payments';

SELECT COUNT(*) as index_count
FROM pg_indexes
WHERE tablename = 'Payments';
```

3. Click **"Run"**

**Expected Results:**
| table_count | column_count | index_count |
|---|---|---|
| 1 | 14 | 6 |

If any is 0, the table wasn't created. See Troubleshooting.

---

## 🧪 Step 6: Test Insert (Optional)

1. Click **"New Query"** again
2. Paste this test script:

```sql
-- Insert test payment
INSERT INTO "Payments" 
  ("UserId", "PlanId", "Amount", "PaymentMethod", "Status", "Description")
SELECT 
  id, 
  2, 
  99000, 
  'Card', 
  'Pending', 
  'Test payment'
FROM "Users" 
LIMIT 1;

-- Check it was inserted
SELECT * FROM "Payments" 
WHERE "Description" = 'Test payment' 
LIMIT 1;

-- Clean up
DELETE FROM "Payments" 
WHERE "Description" = 'Test payment';
```

3. Click **"Run"**

**Expected:** 1 row inserted and deleted successfully

---

## 📊 Step 7: Check Payment Statistics

1. Click **"New Query"** again
2. Paste:

```sql
-- Payment statistics
SELECT 
  COUNT(*) as total_payments,
  COUNT(CASE WHEN "Status" = 'Completed' THEN 1 END) as completed,
  COUNT(CASE WHEN "Status" = 'Pending' THEN 1 END) as pending,
  SUM("Amount") as total_amount
FROM "Payments";
```

3. Click **"Run"**

**Expected (initially):** All zeros = OK, no payments yet

---

## 🔐 Step 8: Optional - Enable Row Level Security

If you want users to only see their own payments:

1. Click **"New Query"**
2. Paste:

```sql
-- Enable RLS
ALTER TABLE "Payments" ENABLE ROW LEVEL SECURITY;

-- Users can view own payments
CREATE POLICY "Users can view own payments" 
    ON "Payments" 
    FOR SELECT 
    USING (auth.uid() = "UserId");

-- Prevent inserts from client
CREATE POLICY "Payments created via API" 
    ON "Payments" 
    FOR INSERT 
    WITH CHECK (false);
```

3. Click **"Run"**

---

## 🎉 Success!

Your Supabase database now has:
✅ Payments table with 14 columns
✅ 6 indexes for fast queries
✅ 5 constraints for data integrity
✅ Foreign keys to Users, SubscriptionPlans, UserSubscriptions
✅ Ready for payment API integration

---

## 🔄 Integration with Backend

Your .NET backend will automatically use this table:

**The EF Core migration has already been applied:**
```bash
# Run this to confirm
cd Backend
dotnet ef database update --project Repository --startup-project Api
```

**API is ready to use:**
```bash
curl -X POST http://localhost:7259/api/payment/create \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": 2,
    "amount": 99000,
    "paymentMethod": "Card"
  }'
```

---

## 🐛 Troubleshooting

### ❌ Error: "Relation already exists"

**Meaning:** Table was already created (good!)  
**Action:** Continue to verification step

### ❌ Error: "Foreign key constraint fails"

**Meaning:** SubscriptionPlans table doesn't have data  
**Action:** Seed data:

```sql
INSERT INTO "SubscriptionPlans" 
  ("PlanName", "Price", "MaxAnalysisCount", "MaxTokenLimit", "Description", "IsActive")
VALUES 
  ('Free', 0, 3, 20000, 'Free tier', true),
  ('Basic', 99000, 20, 150000, 'Basic tier', true),
  ('Pro', 249000, 100, 500000, 'Pro tier', true),
  ('Enterprise', 699000, 9999, 2000000, 'Enterprise tier', true);
```

### ❌ Error: "Column doesn't exist"

**Meaning:** SQL script has a typo  
**Action:** Check column names are exact (case-sensitive)

### ❌ Error: "Cannot create unique index"

**Meaning:** Duplicate TransactionIds already exist  
**Action:** Clean up duplicates:

```sql
DELETE FROM "Payments" 
WHERE "TransactionId" IN (
  SELECT "TransactionId" 
  FROM "Payments" 
  GROUP BY "TransactionId" 
  HAVING COUNT(*) > 1
);
```

### ❌ Verification query returns zeros

**Meaning:** Table or columns not created  
**Action:** 
1. Check for error messages in SQL editor
2. Try running `supabase_payments.sql` again
3. Contact support with error message

---

## 📈 Monitoring Queries

After payments are created, use these queries:

### Revenue by Status
```sql
SELECT 
  "Status",
  COUNT(*) as count,
  SUM("Amount") as total
FROM "Payments"
GROUP BY "Status";
```

### Top Paying Users
```sql
SELECT 
  "UserId",
  COUNT(*) as payment_count,
  SUM("Amount") as total_spent
FROM "Payments"
WHERE "Status" = 'Completed'
GROUP BY "UserId"
ORDER BY total_spent DESC
LIMIT 10;
```

### Monthly Revenue
```sql
SELECT 
  DATE_TRUNC('month', "CreatedAt") as month,
  SUM("Amount") as revenue
FROM "Payments"
WHERE "Status" = 'Completed'
GROUP BY DATE_TRUNC('month', "CreatedAt")
ORDER BY month DESC;
```

---

## 📞 Next Steps

1. ✅ Payment table created in Supabase
2. ⬜ Test API endpoints with sample data
3. ⬜ Connect payment gateway webhook (Stripe, PayPal, etc.)
4. ⬜ Create admin dashboard to view payments
5. ⬜ Setup email receipts

---

## 📚 Reference Files

| File | Purpose |
|------|---------|
| `supabase_payments.sql` | SQL script to create table |
| `SUPABASE_VERIFY_PAYMENTS.sql` | Verify table exists |
| `SUPABASE_PAYMENT_SETUP.md` | Detailed setup guide |
| `API_PAYMENT_DOCS.md` | API endpoint reference |
| `Backend/API/Controllers/PaymentController.cs` | Backend code |

---

## ✨ That's It!

Your Payment system is now live in Supabase! 🎉

**Status:** ✅ Ready to process payments

Next: Integrate payment gateway webhook handlers
