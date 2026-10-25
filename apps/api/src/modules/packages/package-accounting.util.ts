import { Decimal } from "decimal.js";
import { PackageExecutionStatus } from "@prisma/client";

export interface ExecutionAccountingInput {
  id: string;
  status: PackageExecutionStatus;
  quantity: number;
  remainingQuantity: number;
  allocatedCharge: Decimal | number | string;
}

export interface RefundAccountingInput {
  amount: Decimal | number | string;
}

export interface PackageAccountingSummary {
  reserveTotal: Decimal;
  totalConsumed: Decimal;
  totalAlreadyRefunded: Decimal;
  netRefundDue: Decimal;
  settled: boolean;
}

/**
 * Single auditable accounting engine for package debit, delivery, and refund reconciliation.
 *
 * Invariant:
 * reserveTotal = totalConsumed + totalAlreadyRefunded + netRefundDue
 *
 * Guarantees:
 * 1. Proportional consumed charge for PARTIAL deliveries (delivered / total * allocatedCharge).
 * 2. 100% consumed for COMPLETED runs.
 * 3. In-flight runs (DISPATCHED) are treated as committed until terminal outcome.
 * 4. All prior refunds (child order partial/failed refunds + package cancellations) are subtracted.
 * 5. netRefundDue is strictly clamped to [0, reserveTotal - totalConsumed - totalAlreadyRefunded].
 * 6. Under no circumstances can total refunds exceed (reserveTotal - totalConsumed).
 */
export function calculatePackageAccounting(
  reserveTotalInput: Decimal | number | string,
  executions: ExecutionAccountingInput[],
  existingRefunds: RefundAccountingInput[] = []
): PackageAccountingSummary {
  const reserveTotal = new Decimal(reserveTotalInput.toString());

  // 1. Calculate consumed funds per execution
  let totalConsumed = new Decimal(0);

  for (const exec of executions) {
    const charge = new Decimal(exec.allocatedCharge.toString());
    const qty = exec.quantity;
    const remains = Math.min(Math.max(exec.remainingQuantity || 0, 0), qty);

    switch (exec.status) {
      case PackageExecutionStatus.COMPLETED:
        totalConsumed = totalConsumed.plus(charge);
        break;

      case PackageExecutionStatus.PARTIAL: {
        const delivered = Math.max(0, qty - remains);
        if (qty > 0 && delivered > 0) {
          const consumedShare = charge
            .mul(delivered)
            .div(qty)
            .toDecimalPlaces(2, Decimal.ROUND_CEIL);
          totalConsumed = totalConsumed.plus(consumedShare);
        }
        break;
      }

      case PackageExecutionStatus.DISPATCHED:
        // In-flight execution at provider is committed until terminal outcome
        totalConsumed = totalConsumed.plus(charge);
        break;

      case PackageExecutionStatus.SCHEDULED:
      case PackageExecutionStatus.CANCELLED:
      case PackageExecutionStatus.FAILED:
      case PackageExecutionStatus.DETECTED:
      case PackageExecutionStatus.SKIPPED_PAUSED:
      case PackageExecutionStatus.SKIPPED_QUOTA:
      case PackageExecutionStatus.SKIPPED_TYPE:
      case PackageExecutionStatus.SKIPPED_DELETED:
      case PackageExecutionStatus.SKIPPED_LIMIT:
      default:
        // Zero delivery consumed
        break;
    }
  }

  // 2. Sum all existing refunds issued for this package and its child orders
  let totalAlreadyRefunded = new Decimal(0);
  for (const ref of existingRefunds) {
    totalAlreadyRefunded = totalAlreadyRefunded.plus(new Decimal(ref.amount.toString()));
  }

  // 3. Compute net refund due
  const remainingUnspent = Decimal.max(0, reserveTotal.minus(totalConsumed));
  const netRefundDue = Decimal.max(0, remainingUnspent.minus(totalAlreadyRefunded));

  return {
    reserveTotal,
    totalConsumed,
    totalAlreadyRefunded,
    netRefundDue,
    settled: netRefundDue.equals(0),
  };
}
