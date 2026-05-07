import type { AuthContext } from '@permifyjs/core';

export type ScopeMode = 'global' | 'tenant' | 'team' | 'tenant-team';

export const GLOBAL_SCOPE = '__permify_global__';

type ScopeField = 'tenantId' | 'teamId';
type ScopeRecord = Partial<Record<ScopeField, string>>;

function getEnabledScopeFields(
  scopeMode?: ScopeMode
): Array<'tenantId' | 'teamId'> {
  switch (scopeMode ?? 'tenant-team') {
    case 'global':
      return [];
    case 'tenant':
      return ['tenantId'];
    case 'team':
      return ['teamId'];
    default:
      return ['tenantId', 'teamId'];
  }
}

export function normalizeScope(
  scopeMode: ScopeMode | undefined,
  context?: AuthContext
): ScopeRecord {
  const scope: ScopeRecord = {};

  for (const field of getEnabledScopeFields(scopeMode)) {
    scope[field] = (context?.[field] as string | undefined) ?? GLOBAL_SCOPE;
  }

  return scope;
}

export function getScopedCompoundKeyName(
  prefix: string[],
  suffix: string[],
  scopeMode?: ScopeMode
): string {
  return [...prefix, ...getEnabledScopeFields(scopeMode), ...suffix].join('_');
}
