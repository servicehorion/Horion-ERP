WITH ranked_quotes AS (
  SELECT
    id,
    "orderId",
    ROW_NUMBER() OVER (
      PARTITION BY "orderId"
      ORDER BY version DESC, "createdAt" DESC, id DESC
    ) AS rn
  FROM quotes
)
UPDATE quotes AS q
SET "isActive" = ranked_quotes.rn = 1
FROM ranked_quotes
WHERE ranked_quotes.id = q.id;

WITH ranked_quotes AS (
  SELECT
    id,
    "orderId",
    ROW_NUMBER() OVER (
      PARTITION BY "orderId"
      ORDER BY version DESC, "createdAt" DESC, id DESC
    ) AS rn
  FROM quotes
)
UPDATE orders AS o
SET "currentQuoteId" = ranked_quotes.id
FROM ranked_quotes
WHERE ranked_quotes."orderId" = o.id
  AND ranked_quotes.rn = 1;

UPDATE orders AS o
SET "currentQuoteId" = NULL
WHERE o."currentQuoteId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM quotes AS q
    WHERE q."orderId" = o.id
  );
