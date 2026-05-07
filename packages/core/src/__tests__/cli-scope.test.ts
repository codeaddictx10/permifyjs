import { describe, expect, it } from 'vitest';
import {
  formatCliScope,
  getCliScopeContext,
  validateCliScope,
} from '../cli/utils/scope';

describe('CLI scope utilities', () => {
  it('returns an empty context for global scope', () => {
    expect(getCliScopeContext('global', {} as Record<string, string>)).toEqual({});
  });

  it('keeps only the tenant field for tenant scope', () => {
    expect(
      getCliScopeContext('tenant', {
        tenantId: 'acme',
      })
    ).toEqual({ tenantId: 'acme' });
  });

  it('keeps only the team field for team scope', () => {
    expect(
      getCliScopeContext('team', {
        teamId: 'design',
      })
    ).toEqual({ teamId: 'design' });
  });

  it('rejects scope flags that are invalid for the configured mode', () => {
    expect(() => validateCliScope('global', { tenantId: 'acme' })).toThrow(
      /global scope/
    );
    expect(() => validateCliScope('tenant', { teamId: 'design' })).toThrow(
      /tenant scope/
    );
    expect(() => validateCliScope('team', { tenantId: 'acme' })).toThrow(
      /team scope/
    );
  });

  it('formats a readable scope suffix', () => {
    expect(formatCliScope('global', {})).toBe('');
    expect(formatCliScope('tenant-team', { tenantId: 'acme', teamId: 'design' })).toBe(
      ' (tenant=acme, team=design)'
    );
  });
});
