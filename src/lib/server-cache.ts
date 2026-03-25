import { unstable_cache } from "next/cache";

export function getTenantCacheTags(namespace: string, tenantId: string) {
  return [namespace, `${namespace}:${tenantId}`];
}

export async function runTenantCached<T>(
  namespace: string,
  tenantId: string,
  loader: () => Promise<T>,
  revalidateSeconds = 30
) {
  return unstable_cache(loader, [namespace, tenantId], {
    revalidate: revalidateSeconds,
    tags: getTenantCacheTags(namespace, tenantId),
  })();
}
