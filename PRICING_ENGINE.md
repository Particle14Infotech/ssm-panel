# PRICING AND PROFIT ENGINE SPECIFICATION

## Executive Overview
The SMM Panel Pricing and Profit Engine establishes mathematical rigor, loss prevention guardrails, multi-currency conversion (USD/INR), and per-order financial snapshot tracking. Every active catalog service is guaranteed to be sold with a healthy margin over real upstream provider costs.

---

## 1. Core Mathematical Model

### A. Provider Cost Conversion to INR
Upstream costs per 1,000 units are converted from provider currency (e.g. USD) to INR using the admin-configured exchange rate:
$$\text{Cost INR} = \text{Provider Rate} \times \text{USD\_INR\_RATE}$$

### B. Tiered Margin Schedule by Cost Band
Default margin tiers apply progressively based on provider cost:
- **Band 1 (Low Cost < ₹100):** $+80\%$ margin
- **Band 2 (Mid Cost ₹100 - ₹500):** $+55\%$ margin
- **Band 3 (High Cost > ₹500):** $+35\%$ margin

### C. Floors and Guardrails
1. **Minimum Margin Floor ($\text{MIN\_MARGIN\_PERCENT}$):** $20\%$ default. Prevents thin margins from turning negative after payment gateway fees and partial refunds.
2. **Absolute Profit Floor ($\text{MIN\_PROFIT\_PER\_1K}$):** ₹5.00 default. Guarantees minimum absolute profit on micro-cost services.
3. **Selling Rate Rounding:** Rounded **UP** to the nearest ₹0.50 step:
   $$\text{Selling Rate} = \lceil \frac{\max(\text{Cost} \times (1 + \text{tierMargin}), \text{Cost} \times (1 + \text{minMargin}), \text{Cost} + \text{minProfit})}{\text{step}} \rceil \times \text{step}$$
4. **Minimum Order Charge:** ₹1.00 default. Any order resulting in a total charge below ₹1.00 is rejected at creation.

### D. Customer Order Charge Math
Customer charges are strictly calculated using `decimal.js` and rounded **UP** to two decimal places (`ceil2`):
$$\text{Total Units} = \text{quantityPerRun} \times \text{runs}$$
$$\text{Customer Charge} = \lceil \frac{\text{Selling Rate} \times \text{Total Units}}{1000} \rceil_{2}$$

For Drip-Feed orders with optional surcharge:
$$\text{Effective Rate} = \text{Selling Rate} \times (1 + \frac{\text{DRIPFEED\_SURCHARGE\_PERCENT}}{100})$$

---

## 2. Immutable Per-Order Financial Snapshot

Every order recorded in the database creates an immutable financial snapshot at the moment of creation:
- `sellRatePer1k`: Snapshot selling rate per 1,000
- `costRatePer1k`: Snapshot provider cost per 1,000 in INR
- `fxRateUsed`: Exchange rate applied during dispatch
- `providerCurrency`: Upstream currency (e.g. `USD`)
- `estimatedProviderCost`: $\frac{\text{costRatePer1k} \times \text{totalQuantity}}{1000}$
- `charge`: Customer debit amount
- `paymentFeeEstimate`: $\text{charge} \times \frac{\text{PAYMENT\_FEE\_PERCENT}}{100}$ (default 2.36%)
- `estimatedGrossProfit`: $\text{charge} - \text{estimatedProviderCost}$
- `estimatedNetProfit`: $\text{estimatedGrossProfit} - \text{paymentFeeEstimate}$

> **Security Rule:** All cost, margin, and profit snapshot fields are strictly **ADMIN-ONLY**. They are automatically stripped from all customer and reseller API responses.

---

## 3. Reconciliation & Partial / Cancellation Refunds

When the background worker receives an upstream order status update:
- If upstream returns a real `charge`, `actualProviderCost` is calculated as $\text{providerCharge} \times \text{fxRateUsed}$, and `actualProfit` is updated.
- On **PARTIAL** status:
  - Undelivered volume = `remains` of `totalQuantity`.
  - Customer refund = $\lfloor \frac{\text{charge} \times \text{remains}}{\text{totalQuantity}} \rfloor_{2}$.
  - Realized provider cost = $\text{estimatedProviderCost} \times \frac{\text{totalQuantity} - \text{remains}}{\text{totalQuantity}}$.
  - Realized profit accounts only for delivered volume.
- On **CANCELLED** or **FAILED** status:
  - Full refund issued to customer wallet via immutable ledger entry.
  - Realized profit is 0.

---

## 4. Admin Management & Price Change Inbox

- **Fluctuation Alert (>10%):** On catalog sync, if upstream provider cost moves by more than $\text{PRICE\_CHANGE\_ALERT\_PERCENT}$ (10%), the service is flagged as `PENDING_REVIEW` in the Admin Price Change Inbox instead of applying silently.
- **Below-Cost Deactivation:** Any service whose selling rate would fall below cost is automatically deactivated with `priceBelowCost = true`.
- **Quote = Charge Rule:** If catalog price changes between customer preview and submit, the server detects the mismatch (`expectedRate !== currentRate`) and returns HTTP 409 Conflict: *"Price updated, please confirm the new price before placing the order."*
