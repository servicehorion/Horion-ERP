const TOKEN_SPLIT_REGEX = /[^a-z0-9]+/g;

export function normalizeCatalogText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(TOKEN_SPLIT_REGEX, " ")
    .trim();
}

export function tokenizeCatalogText(value: string | null | undefined) {
  return normalizeCatalogText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

export function buildCatalogMatchingFingerprint(parts: Array<string | string[] | null | undefined>) {
  const tokens = new Set<string>();
  for (const part of parts) {
    const values = Array.isArray(part) ? part : [part];
    for (const value of values) {
      for (const token of tokenizeCatalogText(value)) {
        tokens.add(token);
      }
    }
  }
  return Array.from(tokens).join(" ");
}

function jaccardSimilarity(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

export function scoreCatalogSimilarity(params: {
  query: string;
  candidateName: string;
  candidateAliases?: string[];
  candidateKeywords?: string[];
  categoryName?: string | null;
  requestedCategory?: string | null;
  candidateWeightKg?: number | null;
  requestedWeightKg?: number | null;
}) {
  const queryNormalized = normalizeCatalogText(params.query);
  const queryTokens = tokenizeCatalogText(params.query);
  const candidateText = [
    params.candidateName,
    ...(params.candidateAliases ?? []),
    ...(params.candidateKeywords ?? []),
  ].join(" ");
  const candidateTokens = tokenizeCatalogText(candidateText);

  const tokenScore = jaccardSimilarity(queryTokens, candidateTokens) * 70;
  const candidateNormalized = normalizeCatalogText(candidateText);
  const containsScore =
    queryNormalized && candidateNormalized.includes(queryNormalized)
      ? 15
      : candidateTokens.some((token) => queryTokens.includes(token))
        ? 8
        : 0;

  const requestedCategory = normalizeCatalogText(params.requestedCategory || "");
  const candidateCategory = normalizeCatalogText(params.categoryName || "");
  const categoryScore =
    requestedCategory && candidateCategory && requestedCategory === candidateCategory
      ? 10
      : requestedCategory && candidateCategory && candidateCategory.includes(requestedCategory)
        ? 6
        : 0;

  let weightScore = 0;
  if (params.requestedWeightKg && params.requestedWeightKg > 0 && params.candidateWeightKg && params.candidateWeightKg > 0) {
    const delta = Math.abs(params.requestedWeightKg - params.candidateWeightKg);
    const ratio = delta / params.requestedWeightKg;
    if (ratio <= 0.1) weightScore = 5;
    else if (ratio <= 0.25) weightScore = 3;
  }

  return Math.max(0, Math.min(100, Math.round(tokenScore + containsScore + categoryScore + weightScore)));
}

