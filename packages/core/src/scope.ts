import type { ScopeMode } from './types';

export const DEFAULT_SCOPE_MODE: ScopeMode = 'tenant-team';
export const INIT_DEFAULT_SCOPE_MODE: ScopeMode = 'global';

export function normalizeScopeMode(scopeMode?: ScopeMode): ScopeMode {
  return scopeMode ?? DEFAULT_SCOPE_MODE;
}

export function hasTenantScope(scopeMode?: ScopeMode): boolean {
  const mode = normalizeScopeMode(scopeMode);
  return mode === 'tenant' || mode === 'tenant-team';
}

export function hasTeamScope(scopeMode?: ScopeMode): boolean {
  const mode = normalizeScopeMode(scopeMode);
  return mode === 'team' || mode === 'tenant-team';
}

export function getEnabledScopeFields(
  scopeMode?: ScopeMode
): Array<'tenantId' | 'teamId'> {
  const fields: Array<'tenantId' | 'teamId'> = [];

  if (hasTenantScope(scopeMode)) {
    fields.push('tenantId');
  }

  if (hasTeamScope(scopeMode)) {
    fields.push('teamId');
  }

  return fields;
}
