import { Decimal } from "decimal.js";

export interface AllocationItem {
  id: string;
  weight: number;
}

export interface AllocatedResult {
  id: string;
  allocatedPaise: number;
  allocatedDecimal: Decimal;
}

/**
 * Distributes a fixed price (in integer paise) across multiple items using
 * the Hamilton / Hare-Niemeyer largest-remainder method.
 * Guarantees that sum(allocatedPaise) === totalPaise exactly.
 * Ties are broken deterministically by item ID sorting.
 */
export function allocateFixedPriceLargestRemainder(
  totalPricePaise: number,
  items: AllocationItem[]
): AllocatedResult[] {
  if (!Number.isSafeInteger(totalPricePaise) || totalPricePaise < 0) {
    throw new RangeError("totalPricePaise must be a non-negative integer.");
  }
  if (!items || items.length === 0) {
    return [];
  }
  if (items.length === 1) {
    return [
      {
        id: items[0].id,
        allocatedPaise: totalPricePaise,
        allocatedDecimal: new Decimal(totalPricePaise).dividedBy(100),
      },
    ];
  }

  const totalWeight = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (totalWeight <= 0) {
    // If all weights are 0, distribute equally
    const base = Math.floor(totalPricePaise / items.length);
    const rem = totalPricePaise % items.length;
    return items.map((item, idx) => {
      const paise = idx < rem ? base + 1 : base;
      return {
        id: item.id,
        allocatedPaise: paise,
        allocatedDecimal: new Decimal(paise).dividedBy(100),
      };
    });
  }

  // Step 1: Compute nominal shares, integer base, and fractional remainder
  const shares = items.map((item) => {
    const normWeight = Math.max(0, item.weight) / totalWeight;
    const nominal = totalPricePaise * normWeight;
    const basePaise = Math.floor(nominal);
    const remainder = nominal - basePaise;
    return {
      id: item.id,
      basePaise,
      remainder,
    };
  });

  const baseSum = shares.reduce((sum, s) => sum + s.basePaise, 0);
  let extraPaise = totalPricePaise - baseSum;

  // Step 2: Sort by remainder descending, tie-break by id string ascending
  shares.sort((a, b) => {
    if (Math.abs(b.remainder - a.remainder) > 1e-9) {
      return b.remainder - a.remainder;
    }
    return a.id.localeCompare(b.id);
  });

  // Step 3: Distribute extra paise one-by-one to largest remainders
  const allocatedMap = new Map<string, number>();
  for (const s of shares) {
    let add = 0;
    if (extraPaise > 0) {
      add = 1;
      extraPaise--;
    }
    allocatedMap.set(s.id, s.basePaise + add);
  }

  // Preserve original item order in output
  return items.map((item) => {
    const paise = allocatedMap.get(item.id) || 0;
    return {
      id: item.id,
      allocatedPaise: paise,
      allocatedDecimal: new Decimal(paise).dividedBy(100),
    };
  });
}

/**
 * Checks whether bundle price satisfies the minimum margin floor.
 * margin = (price - cost) / price
 */
export function checkMarginFloor(
  pricePaise: number,
  totalCostPaise: number,
  marginFloor: number = 0.15
): {
  isAcceptable: boolean;
  actualMargin: number;
  minPricePaise: number;
} {
  if (pricePaise <= 0) {
    return { isAcceptable: false, actualMargin: -1, minPricePaise: 0 };
  }

  const margin = (pricePaise - totalCostPaise) / pricePaise;
  const minPrice = Math.ceil(totalCostPaise / (1 - marginFloor));

  return {
    isAcceptable: margin >= marginFloor,
    actualMargin: Math.round(margin * 10000) / 10000,
    minPricePaise: minPrice,
  };
}

