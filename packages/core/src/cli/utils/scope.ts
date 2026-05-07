import type { AuthContext, ScopeMode } from '../../types';
import { normalizeScopeMode } from '../../scope';

export function validateCliScope(
  scopeMode: ScopeMode | undefined,
  context: AuthContext
): void {
  const mode = normalizeScopeMode(scopeMode);

  if (mode === 'global') {
    if (context.tenantId || context.teamId) {
      throw new Error(
        '[permifyjs] This project uses global scope. Do not pass --tenant-id or --team-id.'
      );
    }
    return;
  }

  if (mode === 'tenant' && context.teamId) {
    throw new Error(
      '[permifyjs] This project uses tenant scope. Do not pass --team-id.'
    );
  }

  if (mode === 'team' && context.tenantId) {
    throw new Error(
      '[permifyjs] This project uses team scope. Do not pass --tenant-id.'
    );
  }
}

export function getCliScopeContext(
  scopeMode: ScopeMode | undefined,
  opts: Record<string, string>
): AuthContext {
  const rawContext: AuthContext = {
    tenantId: opts.tenantId,
    teamId: opts.teamId,
  };
  const mode = normalizeScopeMode(scopeMode);

  validateCliScope(mode, rawContext);

  const context: AuthContext = {};

  if ((mode === 'tenant' || mode === 'tenant-team') && opts.tenantId) {
    context.tenantId = opts.tenantId;
  }

  if ((mode === 'team' || mode === 'tenant-team') && opts.teamId) {
    context.teamId = opts.teamId;
  }

  return context;
}

export function formatCliScope(
  scopeMode: ScopeMode | undefined,
  context: AuthContext
): string {
  const mode = normalizeScopeMode(scopeMode);

  if (mode === 'global') {
    return '';
  }

  const parts: string[] = [];

  if (context.tenantId) {
    parts.push(`tenant=${context.tenantId}`);
  }

  if (context.teamId) {
    parts.push(`team=${context.teamId}`);
  }

  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}
