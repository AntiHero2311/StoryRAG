# 💳 Payment API Documentation

**Endpoint Base:** `/api/payment`  
**Authentication:** Required (Bearer JWT)  
**Version:** 1.0

---

## 1. Create Payment

**Endpoint:** `POST /api/payment/create`

**Description:** Create a new payment record when user initiates a subscription purchase.

**Request Body:**
```json
{
  "planId": 2,
  "amount": 99000,
  "paymentMethod": "Card",
  "transactionId": null,
  "description": "Monthly subscription renewal"
}
```

**Request Fields:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `planId` | int | Yes | SubscriptionPlan ID (1=Free, 2=Basic, 3=Pro, 4=Enterprise) |
| `amount` | decimal | Yes | Amount to charge (VND). Must be > 0 |
| `paymentMethod` | string | Yes | Payment method (Card, BankTransfer, MoMo, ZaloPay, Manual) |
| `transactionId` | string | No | Optional transaction ID from payment gateway |
| `description` | string | No | Optional notes about payment |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user-uuid",
    "subscriptionId": null,
    "planId": 2,
    "planName": "Basic",
    "amount": 99000,
    "currency": "VND",
    "paymentMethod": "Card",
    "status": "Pending",
    "transactionId": null,
    "description": "Monthly subscription renewal",
    "paidAt": null,
    "refundedAt": null,
    "createdAt": "2026-03-13T03:49:00Z",
    "updatedAt": null
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Subscription Plan 5 not found"
}
```

---

## 2. Get Payment History

**Endpoint:** `GET /api/payment/history?page=1&pageSize=20`

**Description:** Retrieve paginated list of all payments for the current user, including status summary and total spent.

**Query Parameters:**
| Parameter | Type | Default | Notes |
|-----------|------|---------|-------|
| `page` | int | 1 | Page number (1-indexed) |
| `pageSize` | int | 20 | Items per page (max 100) |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "userId": "user-uuid",
        "subscriptionId": 5,
        "planId": 3,
        "planName": "Pro",
        "amount": 249000,
        "currency": "VND",
        "paymentMethod": "Card",
        "status": "Completed",
        "transactionId": "TXN_2026_001",
        "description": null,
        "paidAt": "2026-03-10T12:30:00Z",
        "refundedAt": null,
        "createdAt": "2026-03-10T12:00:00Z",
        "updatedAt": "2026-03-10T12:30:00Z"
      },
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "userId": "user-uuid",
        "subscriptionId": null,
        "planId": 2,
        "planName": "Basic",
        "amount": 99000,
        "currency": "VND",
        "paymentMethod": "Card",
        "status": "Pending",
        "transactionId": null,
        "description": null,
        "paidAt": null,
        "refundedAt": null,
        "createdAt": "2026-03-13T03:49:00Z",
        "updatedAt": null
      }
    ],
    "totalCount": 10,
    "totalSpent": 1485000,
    "statusSummary": {
      "Completed": 5,
      "Pending": 3,
      "Failed": 1,
      "Refunded": 1,
      "Cancelled": 0
    }
  }
}
```

---

## 3. Get Payment by ID

**Endpoint:** `GET /api/payment/{paymentId}`

**Description:** Get detailed information about a specific payment.

**URL Parameters:**
| Parameter | Type | Notes |
|-----------|------|-------|
| `paymentId` | uuid | Payment ID to retrieve |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user-uuid",
    "subscriptionId": 5,
    "planId": 3,
    "planName": "Pro",
    "amount": 249000,
    "currency": "VND",
    "paymentMethod": "Card",
    "status": "Completed",
    "transactionId": "TXN_2026_001",
    "description": null,
    "paidAt": "2026-03-10T12:30:00Z",
    "refundedAt": null,
    "createdAt": "2026-03-10T12:00:00Z",
    "updatedAt": "2026-03-10T12:30:00Z"
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Payment 550e8400-e29b-41d4-a716-446655440000 not found"
}
```

---

## 4. Update Payment Status

**Endpoint:** `PATCH /api/payment/{paymentId}/status`

**Description:** Update payment status (e.g., Pending → Completed, Completed → Refunded, etc.)

**URL Parameters:**
| Parameter | Type | Notes |
|-----------|------|-------|
| `paymentId` | uuid | Payment ID to update |

**Request Body:**
```json
{
  "status": "Completed",
  "notes": "Payment verified from gateway callback"
}
```

**Request Fields:**
| Field | Type | Required | Valid Values |
|-------|------|----------|--------------|
| `status` | string | Yes | Pending, Completed, Failed, Refunded, Cancelled |
| `notes` | string | No | Optional notes |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "Completed",
    "paidAt": "2026-03-13T03:55:00Z",
    "updatedAt": "2026-03-13T03:55:00Z"
  }
}
```

---

## 5. Mark Payment as Completed

**Endpoint:** `PUT /api/payment/{paymentId}/mark-completed?transactionId=TXN_123`

**Description:** Mark payment as completed (typically called by payment gateway webhook). Sets `status` to "Completed" and `paidAt` to current time.

**URL Parameters:**
| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `paymentId` | uuid | Yes | Payment ID to mark completed |
| `transactionId` | string | No | Transaction ID from payment gateway (updates existing if provided) |

**Request Body:** Empty

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "Completed",
    "transactionId": "TXN_2026_001",
    "paidAt": "2026-03-13T03:55:00Z",
    "updatedAt": "2026-03-13T03:55:00Z"
  }
}
```

**Example Webhook Call:**
```bash
curl -X PUT "http://storyrag-backend.onrender.com/api/payment/550e8400-e29b-41d4-a716-446655440000/mark-completed?transactionId=TXN_2026_001" \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json"
```

---

## 6. Refund Payment

**Endpoint:** `POST /api/payment/{paymentId}/refund`

**Description:** Request refund for a completed payment. Can only refund "Completed" payments.

**URL Parameters:**
| Parameter | Type | Notes |
|-----------|------|-------|
| `paymentId` | uuid | Payment ID to refund |

**Request Body:** Empty

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "Refunded",
    "refundedAt": "2026-03-13T03:56:00Z",
    "updatedAt": "2026-03-13T03:56:00Z"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Can only refund completed payments. Current status: Pending"
}
```

---

## Status Values

| Status | Meaning | Next Possible States |
|--------|---------|---------------------|
| **Pending** | Payment created, awaiting completion | Completed, Failed, Cancelled |
| **Completed** | Payment successfully received | Refunded |
| **Failed** | Payment failed at gateway | Cancelled |
| **Refunded** | Money refunded to customer | (final state) |
| **Cancelled** | Payment cancelled by user or system | (final state) |

---

## Payment Methods

Supported payment methods:
- `Card` — Credit/Debit card
- `BankTransfer` — Direct bank transfer
- `MoMo` — MoMo mobile wallet (Vietnam)
- `ZaloPay` — ZaloPay e-wallet (Vietnam)
- `Manual` — Manual payment (cash, check, etc.)

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes:**
| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (missing/invalid JWT) |
| 404 | Payment not found |
| 500 | Server error |

---

## Rate Limiting

Payment endpoints have no specific rate limit, but general API rate limits apply:
- Auth: 10 req/min
- General: 100 req/min

---

## Example Integration: Payment Gateway Webhook

When payment gateway (Stripe, PayPal, etc.) confirms payment:

```javascript
// Webhook handler (backend)
app.post('/webhooks/payment-gateway', async (req, res) => {
  const { paymentId, status, transactionId } = req.body;
  
  if (status === 'success') {
    // Mark payment as completed
    await axios.put(
      `http://localhost:7259/api/payment/${paymentId}/mark-completed`,
      null,
      {
        params: { transactionId },
        headers: { 'Authorization': `Bearer ${SERVICE_TOKEN}` }
      }
    );
  }
});
```

---

**Last Updated:** March 13, 2026  
**API Version:** 1.0
