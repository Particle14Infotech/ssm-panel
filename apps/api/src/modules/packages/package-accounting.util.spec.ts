import { Decimal } from "decimal.js";
import { PackageExecutionStatus } from "@prisma/client";
import { calculatePackageAccounting } from "./package-accounting.util";

describe("PackageAccountingUtil", () => {
  it("settles 100% completed package with zero refund due", () => {
    const summary = calculatePackageAccounting(
      new Decimal("100.00"),
      [
        {
          id: "exec_1",
          status: PackageExecutionStatus.COMPLETED,
          quantity: 50,
          remainingQuantity: 0,
          allocatedCharge: "50.00",
        },
        {
          id: "exec_2",
          status: PackageExecutionStatus.COMPLETED,
          quantity: 50,
          remainingQuantity: 0,
          allocatedCharge: "50.00",
        },
      ],
      []
    );

    expect(summary.totalConsumed.toString()).toBe("100");
    expect(summary.totalAlreadyRefunded.toString()).toBe("0");
    expect(summary.netRefundDue.toString()).toBe("0");
    expect(summary.settled).toBe(true);
  });

  it("refunds 100% of reserve when all executions are cancelled/scheduled without dispatch", () => {
    const summary = calculatePackageAccounting(
      new Decimal("100.00"),
      [
        {
          id: "exec_1",
          status: PackageExecutionStatus.CANCELLED,
          quantity: 50,
          remainingQuantity: 50,
          allocatedCharge: "50.00",
        },
        {
          id: "exec_2",
          status: PackageExecutionStatus.SCHEDULED,
          quantity: 50,
          remainingQuantity: 50,
          allocatedCharge: "50.00",
        },
      ],
      []
    );

    expect(summary.totalConsumed.toString()).toBe("0");
    expect(summary.netRefundDue.toString()).toBe("100");
    expect(summary.settled).toBe(false);
  });

  it("ELIMINATES DOUBLE REFUND on partial fill followed by package cancellation", () => {
    // Scenario:
    // Total reserve = ₹100.00. Two runs of ₹50.00 each.
    // Run 1 was dispatched and partially delivered 50 of 100 units.
    // Worker issued a ₹25.00 partial refund on the child order.
    // User cancels the package.
    const summary = calculatePackageAccounting(
      new Decimal("100.00"),
      [
        {
          id: "exec_1",
          status: PackageExecutionStatus.PARTIAL,
          quantity: 100,
          remainingQuantity: 50, // 50 delivered, 50 remains
          allocatedCharge: "50.00",
        },
        {
          id: "exec_2",
          status: PackageExecutionStatus.SCHEDULED,
          quantity: 100,
          remainingQuantity: 100,
          allocatedCharge: "50.00",
        },
      ],
      [
        { amount: "25.00" }, // Prior refund issued by worker on child order
      ]
    );

    // Consumed: 50/100 * 50.00 = 25.00
    expect(summary.totalConsumed.toString()).toBe("25");
    expect(summary.totalAlreadyRefunded.toString()).toBe("25");
    // Net refund due for the unspent execution 2: 100 - 25 - 25 = 50.00
    expect(summary.netRefundDue.toString()).toBe("50");

    // Total refunded across all lifecycle = 25.00 (partial) + 50.00 (cancel) = 75.00
    const totalRefunds = summary.totalAlreadyRefunded.plus(summary.netRefundDue);
    expect(totalRefunds.toString()).toBe("75");
    // Accounting Invariant: consumed + refunds == reserveTotal
    expect(summary.totalConsumed.plus(totalRefunds).toString()).toBe("100");
  });

  it("is idempotent when cancellation or settlement is recalculated", () => {
    // When the ₹50.00 cancellation refund is executed, it is recorded in the refund table.
    // A second check has both the ₹25.00 partial refund AND the ₹50.00 cancel refund.
    const summary = calculatePackageAccounting(
      new Decimal("100.00"),
      [
        {
          id: "exec_1",
          status: PackageExecutionStatus.PARTIAL,
          quantity: 100,
          remainingQuantity: 50,
          allocatedCharge: "50.00",
        },
        {
          id: "exec_2",
          status: PackageExecutionStatus.CANCELLED,
          quantity: 100,
          remainingQuantity: 100,
          allocatedCharge: "50.00",
        },
      ],
      [
        { amount: "25.00" },
        { amount: "50.00" },
      ]
    );

    expect(summary.totalConsumed.toString()).toBe("25");
    expect(summary.totalAlreadyRefunded.toString()).toBe("75");
    expect(summary.netRefundDue.toString()).toBe("0");
    expect(summary.settled).toBe(true);
  });

  it("treats in-flight DISPATCHED runs as committed until terminal provider status", () => {
    const summary = calculatePackageAccounting(
      new Decimal("100.00"),
      [
        {
          id: "exec_1",
          status: PackageExecutionStatus.DISPATCHED,
          quantity: 100,
          remainingQuantity: 100,
          allocatedCharge: "50.00",
        },
        {
          id: "exec_2",
          status: PackageExecutionStatus.SCHEDULED,
          quantity: 100,
          remainingQuantity: 100,
          allocatedCharge: "50.00",
        },
      ],
      []
    );

    // Exec 1 is in-flight, so its 50.00 is committed. Only Exec 2 (50.00) is refunded.
    expect(summary.totalConsumed.toString()).toBe("50");
    expect(summary.netRefundDue.toString()).toBe("50");
  });
});
