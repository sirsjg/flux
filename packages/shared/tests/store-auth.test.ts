import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoreWithWebhooks } from '../src/types.js';
import {
  createApiKey,
  deleteApiKey,
  getApiKeys,
  getApiKey,
  hasApiKeys,
  validateApiKey,
  createCliAuthRequest,
  completeCliAuthRequest,
  pollCliAuthRequest,
  cleanupExpiredAuthRequests,
  initStore,
  setStorageAdapter,
  setAuthFunctions,
} from '../src/store.js';
import {
  generateKey,
  generateTempToken,
  validateKey,
  encrypt,
  decrypt,
} from '../src/auth.js';

type AdapterData = StoreWithWebhooks;

function createAdapter(initial?: Partial<AdapterData>) {
  const data: AdapterData = {
    projects: [],
    epics: [],
    tasks: [],
    api_keys: [],
    cli_auth_requests: [],
    ...initial,
  };

  return {
    data,
    read: vi.fn(),
    write: vi.fn(),
  };
}

describe('store auth', () => {
  beforeEach(() => {
    const adapter = createAdapter();
    setStorageAdapter(adapter);
    setAuthFunctions({ generateKey, generateTempToken, validateKey, encrypt, decrypt });
    initStore();
  });

  describe('API keys', () => {
    describe('createApiKey', () => {
      it('creates server-scoped key', () => {
        const { rawKey, apiKey } = createApiKey('Test Key', { type: 'server' });

        expect(rawKey.startsWith('flx_')).toBe(true);
        expect(apiKey.name).toBe('Test Key');
        expect(apiKey.scope).toEqual({ type: 'server' });
        expect(apiKey.prefix).toBe(rawKey.slice(0, 12));
        expect(apiKey.hash).toBeTruthy();
        expect(apiKey.created_at).toBeTruthy();
      });

      it('creates project-scoped key', () => {
        const { apiKey } = createApiKey('Project Key', {
          type: 'project',
          project_ids: ['proj-1', 'proj-2'],
        });

        expect(apiKey.scope).toEqual({
          type: 'project',
          project_ids: ['proj-1', 'proj-2'],
        });
      });

      it('generates unique IDs', () => {
        const { apiKey: key1 } = createApiKey('Key 1', { type: 'server' });
        const { apiKey: key2 } = createApiKey('Key 2', { type: 'server' });

        expect(key1.id).not.toBe(key2.id);
      });
    });

    describe('getApiKeys', () => {
      it('returns empty array when no keys', () => {
        expect(getApiKeys()).toEqual([]);
      });

      it('returns all keys', () => {
        createApiKey('Key 1', { type: 'server' });
        createApiKey('Key 2', { type: 'server' });

        const keys = getApiKeys();
        expect(keys.length).toBe(2);
        expect(keys.map(k => k.name)).toEqual(['Key 1', 'Key 2']);
      });
    });

    describe('getApiKey', () => {
      it('returns key by ID', () => {
        const { apiKey } = createApiKey('Test', { type: 'server' });
        const found = getApiKey(apiKey.id);

        expect(found).toEqual(apiKey);
      });

      it('returns undefined for non-existent ID', () => {
        expect(getApiKey('nonexistent')).toBeUndefined();
      });
    });

    describe('hasApiKeys', () => {
      it('returns false when no keys', () => {
        expect(hasApiKeys()).toBe(false);
      });

      it('returns true when keys exist', () => {
        createApiKey('Test', { type: 'server' });
        expect(hasApiKeys()).toBe(true);
      });
    });

    describe('deleteApiKey', () => {
      it('deletes existing key', () => {
        const { apiKey } = createApiKey('Test', { type: 'server' });
        expect(hasApiKeys()).toBe(true);

        const result = deleteApiKey(apiKey.id);
        expect(result).toBe(true);
        expect(hasApiKeys()).toBe(false);
      });

      it('returns false for non-existent key', () => {
        expect(deleteApiKey('nonexistent')).toBe(false);
      });
    });

    describe('validateApiKey', () => {
      it('validates correct key', () => {
        const { rawKey, apiKey } = createApiKey('Test', { type: 'server' });
        const validated = validateApiKey(rawKey);

        expect(validated).toBeTruthy();
        expect(validated?.id).toBe(apiKey.id);
      });

      it('rejects wrong key', () => {
        createApiKey('Test', { type: 'server' });
        const validated = validateApiKey('flx_wrongkey12345678901234567890');

        expect(validated).toBeUndefined();
      });

      it('updates last_used_at on validation', () => {
        const { rawKey, apiKey } = createApiKey('Test', { type: 'server' });
        expect(apiKey.last_used_at).toBeUndefined();

        validateApiKey(rawKey);
        const updated = getApiKey(apiKey.id);

        expect(updated?.last_used_at).toBeTruthy();
      });

      it('throttles last_used_at updates', () => {
        const { rawKey, apiKey } = createApiKey('Test', { type: 'server' });

        // First validation sets last_used_at
        validateApiKey(rawKey);
        const firstUpdate = getApiKey(apiKey.id)?.last_used_at;

        // Immediate second validation should not update
        validateApiKey(rawKey);
        const secondUpdate = getApiKey(apiKey.id)?.last_used_at;

        expect(secondUpdate).toBe(firstUpdate);
      });
    });
  });

  describe('CLI auth requests', () => {
    describe('createCliAuthRequest', () => {
      it('creates request with token and expiry', () => {
        const request = createCliAuthRequest();

        expect(request.token).toBeTruthy();
        expect(request.expires_at).toBeTruthy();
        expect(new Date(request.expires_at).getTime()).toBeGreaterThan(Date.now());
      });

      it('creates unique tokens', () => {
        const req1 = createCliAuthRequest();
        const req2 = createCliAuthRequest();

        expect(req1.token).not.toBe(req2.token);
      });
    });

    describe('pollCliAuthRequest', () => {
      it('returns pending for new request', () => {
        const request = createCliAuthRequest();
        const result = pollCliAuthRequest(request.token);

        expect(result.status).toBe('pending');
        expect(result.apiKey).toBeUndefined();
      });

      it('returns expired for non-existent token', () => {
        const result = pollCliAuthRequest('nonexistent');

        expect(result.status).toBe('expired');
      });
    });

    describe('completeCliAuthRequest', () => {
      it('completes request and creates key', () => {
        const request = createCliAuthRequest();
        const result = completeCliAuthRequest(
          request.token,
          'CLI Key',
          { type: 'server' }
        );

        expect(result).toBeTruthy();
        expect(result?.rawKey.startsWith('flx_')).toBe(true);
        expect(result?.apiKey.name).toBe('CLI Key');
      });

      it('allows polling after completion', () => {
        const request = createCliAuthRequest();
        completeCliAuthRequest(request.token, 'CLI Key', { type: 'server' });

        const pollResult = pollCliAuthRequest(request.token);

        expect(pollResult.status).toBe('completed');
        expect(pollResult.apiKey?.startsWith('flx_')).toBe(true);
      });

      it('returns undefined for non-existent token', () => {
        const result = completeCliAuthRequest(
          'nonexistent',
          'Key',
          { type: 'server' }
        );

        expect(result).toBeUndefined();
      });

      it('returns undefined for already completed request', () => {
        const request = createCliAuthRequest();
        completeCliAuthRequest(request.token, 'Key 1', { type: 'server' });

        const result = completeCliAuthRequest(
          request.token,
          'Key 2',
          { type: 'server' }
        );

        expect(result).toBeUndefined();
      });
    });

    describe('cleanupExpiredAuthRequests', () => {
      it('removes expired requests', () => {
        // Create adapter with expired request
        const adapter = createAdapter({
          cli_auth_requests: [{
            token: 'expired-token',
            expires_at: new Date(Date.now() - 10000).toISOString(),
          }],
        });
        setStorageAdapter(adapter);
        initStore();

        const removed = cleanupExpiredAuthRequests();

        expect(removed).toBe(1);
      });

      it('keeps valid requests', () => {
        const request = createCliAuthRequest();
        const removed = cleanupExpiredAuthRequests();

        expect(removed).toBe(0);
        expect(pollCliAuthRequest(request.token).status).toBe('pending');
      });
    });
  });
});
