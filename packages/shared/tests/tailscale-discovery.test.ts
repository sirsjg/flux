import { beforeEach, describe, expect, it } from 'vitest';

import {
  discoverPeers,
  getTailscaleIP,
  getHostName,
  _invalidateCache,
} from '../src/tailscale-discovery.js';

describe('tailscale-discovery', () => {
  beforeEach(() => {
    // Clear any cached tailscale status between tests
    _invalidateCache();
  });

  // ============ discoverPeers ============

  describe('discoverPeers', () => {
    it('returns an array (empty or populated depending on environment)', async () => {
      const peers = await discoverPeers();
      // Should always return an array — gracefully empty if tailscale
      // is not installed, or populated if it is.
      expect(Array.isArray(peers)).toBe(true);
    });

    it('returns an array with custom options', async () => {
      const peers = await discoverPeers({ port: 4000, tag: 'test', timeout: 500 });
      expect(Array.isArray(peers)).toBe(true);
    });

    it('each peer has the required PeerState fields', async () => {
      const peers = await discoverPeers();
      for (const peer of peers) {
        expect(peer).toHaveProperty('nodeId');
        expect(peer).toHaveProperty('url');
        expect(peer).toHaveProperty('online');
        expect(peer).toHaveProperty('role');
        expect(typeof peer.nodeId).toBe('string');
        expect(typeof peer.url).toBe('string');
        expect(typeof peer.online).toBe('boolean');
      }
    });
  });

  // ============ _invalidateCache ============

  describe('_invalidateCache', () => {
    it('is callable and does not throw', () => {
      expect(() => _invalidateCache()).not.toThrow();
    });

    it('can be called multiple times without error', () => {
      _invalidateCache();
      _invalidateCache();
      _invalidateCache();
    });
  });

  // ============ getTailscaleIP ============

  describe('getTailscaleIP', () => {
    it('returns a string or null', () => {
      const ip = getTailscaleIP();
      expect(ip === null || typeof ip === 'string').toBe(true);
    });

    it('returns a valid IPv4 or IPv6 address when available', () => {
      const ip = getTailscaleIP();
      if (ip !== null) {
        // Tailscale IPs start with 100.x.x.x (CGNAT range) or fd7a: (IPv6)
        expect(ip.startsWith('100.') || ip.startsWith('fd7a:')).toBe(true);
      }
    });
  });

  // ============ getHostName ============

  describe('getHostName', () => {
    it('returns a string or null', () => {
      const hostname = getHostName();
      expect(hostname === null || typeof hostname === 'string').toBe(true);
    });

    it('returns a non-empty string when available', () => {
      const hostname = getHostName();
      if (hostname !== null) {
        expect(hostname.length).toBeGreaterThan(0);
      }
    });
  });
});
