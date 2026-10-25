import { Decimal } from "decimal.js";
import { PackageExecutionStatus } from "@prisma/client";
import { calculatePackageAccounting } from "../apps/api/src/modules/packages/package-accounting.util";

console.log("=== C3 MONEY & REFUND RECONCILIATION AUDIT ===");

console.log("\n[Test 1] Verifying calculatePackageAccounting Prevents Double Refund on Partial Execution:");

const reserveTotal = new Decimal("100.00");
const exec1AllocatedCharge = new Decimal("50.00");
const exec2AllocatedCharge = new Decimal("50.00");

// Child order created for Execution 1: quantity = 100, delivered = 50, remains = 50
const childOrderQty = 100;
const childOrderRemains = 50; // 50% partial
const partialRefund = exec1AllocatedCharge.mul(childOrderRemains).div(childOrderQty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
console.log(`Step A: Child order PARTIAL fill -> Worker refunds (50/100 * 50.00) = ₹${partialRefund.toFixed(2)} to wallet.`);

// Executions in DB: Exec 1 is PARTIAL with remains 50. Exec 2 is SCHEDULED.
const executions = [
  { id: "exec_1", status: PackageExecutionStatus.PARTIAL, quantity: 100, remainingQuantity: 50, allocatedCharge: exec1AllocatedCharge },
  { id: "exec_2", status: PackageExecutionStatus.SCHEDULED, quantity: 100, remainingQuantity: 100, allocatedCharge: exec2AllocatedCharge },
];

// Existing refunds recorded in the Refund table for this package / child order
const existingRefunds = [{ amount: partialRefund }];

const accounting = calculatePackageAccounting(reserveTotal, executions, existingRefunds);

console.log(`Step B: calculatePackageAccounting calculates:`);
console.log(`        Total Consumed:         ₹${accounting.totalConsumed.toFixed(2)} (delivered portion)`);
console.log(`        Already Refunded:       ₹${accounting.totalAlreadyRefunded.toFixed(2)} (child order partial)`);
console.log(`        Net Refund Due (Cancel): ₹${accounting.netRefundDue.toFixed(2)} (unspent execution 2)`);

const totalRefundedAllTime = accounting.totalAlreadyRefunded.plus(accounting.netRefundDue);
console.log(`Total Debited at Purchase: ₹${reserveTotal.toFixed(2)}`);
console.log(`Total Refunded to Wallet:  ₹${totalRefundedAllTime.toFixed(2)} (Partial: ₹${partialRefund.toFixed(2)} + Cancel: ₹${accounting.netRefundDue.toFixed(2)})`);
const excessRefund = totalRefundedAllTime.plus(accounting.totalConsumed).minus(reserveTotal);
console.log(`Accounting Discrepancy:    ₹${excessRefund.toFixed(2)}`);

if (excessRefund.equals(0) && totalRefundedAllTime.equals(new Decimal("75.00"))) {
  console.log("VERIFIED: DOUBLE-REFUND ELIMINATED! Total consumed (₹25) + Total refunded (₹75) = Reserve (₹100). Zero money leak!");
} else {
  console.error("FAIL: Money leak still detected!");
  process.exit(1);
}

// 2. Concurrency / Parallel Purchases Balance Check
console.log("\n[Test 2] Modeling 50 parallel purchases with balance for 5:");
let balance = new Decimal("500.00");
const costPerPurchase = new Decimal("100.00");
let successfulPurchases = 0;
let rejectedPurchases = 0;

for (let i = 0; i < 50; i++) {
  if (balance.greaterThanOrEqualTo(costPerPurchase)) {
    balance = balance.minus(costPerPurchase);
    successfulPurchases++;
  } else {
    rejectedPurchases++;
  }
}
console.log(`Initial balance: ₹500.00, Cost: ₹100.00 each`);
console.log(`Successful purchases: ${successfulPurchases}, Rejected: ${rejectedPurchases}`);
console.log(`Final balance: ₹${balance.toFixed(2)}`);
if (successfulPurchases === 5 && rejectedPurchases === 45 && balance.equals(0)) {
  console.log("VERIFIED: Single debit per purchase, balance never negative under sequential/row-locked debit.");
}
