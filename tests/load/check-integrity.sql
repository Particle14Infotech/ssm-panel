-- Data Integrity Verification Script (PostgreSQL Compliant)
-- Invariants enforced:
-- 1. For every wallet, balance == sum of ledger entries
-- 2. No negative balances
-- 3. No duplicate orders per Idempotency-Key
-- 4. At most one REFUND per order
-- 5. Every PENDING order eventually leaves PENDING once worker drains

SELECT 
    '1. Wallet Balance vs Ledger Sum' AS test_name,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE 'FAIL' 
    END AS result,
    COUNT(*) AS violations_count
FROM (
    SELECT w.id, w.balance, sub.total
    FROM "Wallet" w
    INNER JOIN (
        SELECT "walletId", SUM(amount) AS total 
        FROM "LedgerEntry" 
        GROUP BY "walletId"
    ) sub ON w.id = sub."walletId"
    WHERE w.balance != sub.total
) discrepancies;

SELECT 
    '2. No Negative Balances' AS test_name,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE 'FAIL' 
    END AS result,
    COUNT(*) AS violations_count
FROM "Wallet"
WHERE balance < 0;

SELECT 
    '3. No Duplicate Orders Per Idempotency-Key' AS test_name,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE 'FAIL' 
    END AS result,
    COUNT(*) AS violations_count
FROM (
    SELECT o1.id
    FROM "Order" o1
    INNER JOIN "Order" o2 ON o1."idempotencyKey" = o2."idempotencyKey" AND o1.id != o2.id
    WHERE o1."idempotencyKey" IS NOT NULL
) duplicates;

SELECT 
    '4. At Most One REFUND Per Order' AS test_name,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE 'FAIL' 
    END AS result,
    COUNT(*) AS violations_count
FROM (
    SELECT l1.id
    FROM "LedgerEntry" l1
    INNER JOIN "LedgerEntry" l2 ON l1."orderId" = l2."orderId" AND l1.id != l2.id
    WHERE l1.type = 'REFUND' AND l2.type = 'REFUND'
) excessive_refunds;

SELECT 
    '5. Drained Orders Out of PENDING' AS test_name,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS' 
        ELSE 'FAIL' 
    END AS result,
    COUNT(*) AS violations_count
FROM "Order"
WHERE status = 'PENDING';
