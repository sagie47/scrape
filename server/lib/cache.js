/**
 * Cache utility - Simple in-memory LRU cache for performance
 * 
 * Used for caching signed URLs and frequently accessed data.
 */

/**
 * Simple LRU cache implementation
 */
class LRUCache {
    constructor({ max = 100, ttl = Infinity } = {}) {
        this.max = max;
        this.ttl = ttl;
        this.cache = new Map();
    }

    /**
     * Get a value from cache
     * @param {string} key 
     * @returns {any} Cached value or undefined
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return undefined;

        // Check TTL
        if (this.ttl !== Infinity && Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return undefined;
        }

        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, entry);
        return entry.value;
    }

    /**
     * Set a value in cache
     * @param {string} key 
     * @param {any} value 
     */
    set(key, value) {
        // Delete existing entry to reset position
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        // Evict oldest if at capacity
        if (this.cache.size >= this.max) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, { value, timestamp: Date.now() });
    }

    /**
     * Check if key exists in cache
     * @param {string} key 
     * @returns {boolean}
     */
    has(key) {
        return this.get(key) !== undefined;
    }

    /**
     * Delete a key from cache
     * @param {string} key 
     */
    delete(key) {
        this.cache.delete(key);
    }

    /**
     * Clear all entries
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Get current cache size
     */
    get size() {
        return this.cache.size;
    }
}

// Signed URL cache (1 hour TTL to match Supabase)
export const signedUrlCache = new LRUCache({ max: 500, ttl: 1000 * 60 * 60 });

// Job status cache (10 second TTL for polling efficiency)
export const jobStatusCache = new LRUCache({ max: 100, ttl: 1000 * 10 });

export { LRUCache };
