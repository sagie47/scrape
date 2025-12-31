/**
 * Cache utility tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LRUCache } from '../lib/cache.js';

describe('LRUCache', () => {
    let cache;

    beforeEach(() => {
        cache = new LRUCache({ max: 3, ttl: 1000 });
    });

    it('should store and retrieve values', () => {
        cache.set('key1', 'value1');
        expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for missing keys', () => {
        expect(cache.get('missing')).toBeUndefined();
    });

    it('should evict oldest entries when at capacity', () => {
        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('c', 3);
        cache.set('d', 4); // Should evict 'a'

        expect(cache.get('a')).toBeUndefined();
        expect(cache.get('b')).toBe(2);
        expect(cache.get('c')).toBe(3);
        expect(cache.get('d')).toBe(4);
    });

    it('should update LRU order on get', () => {
        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('c', 3);
        cache.get('a'); // Access 'a' to make it recent
        cache.set('d', 4); // Should evict 'b' (now oldest)

        expect(cache.get('a')).toBe(1);
        expect(cache.get('b')).toBeUndefined();
    });

    it('should expire entries after TTL', async () => {
        const shortCache = new LRUCache({ max: 10, ttl: 50 });
        shortCache.set('temp', 'data');

        expect(shortCache.get('temp')).toBe('data');

        await new Promise(r => setTimeout(r, 100));

        expect(shortCache.get('temp')).toBeUndefined();
    });

    it('should track size correctly', () => {
        expect(cache.size).toBe(0);
        cache.set('a', 1);
        expect(cache.size).toBe(1);
        cache.set('b', 2);
        expect(cache.size).toBe(2);
        cache.delete('a');
        expect(cache.size).toBe(1);
    });

    it('should clear all entries', () => {
        cache.set('a', 1);
        cache.set('b', 2);
        cache.clear();
        expect(cache.size).toBe(0);
        expect(cache.get('a')).toBeUndefined();
    });
});
