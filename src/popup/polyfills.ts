// Polyfills for Node.js compatibility (needed for viem/nexus-core)
// This file exports Buffer and process for use in the app
// The HTML file loads these polyfills FIRST before any other code

// Use dynamic import to avoid Bun's node:buffer resolution
// This will be executed immediately when the module loads
let BufferPolyfill: any;
let processPolyfill: any;

// Immediately execute async import
(async () => {
    try {
        // @ts-ignore - Use dynamic import to get the actual buffer package
        const bufferMod = await import('buffer');
        // @ts-ignore
        const processMod = await import('process');
        
        // Extract Buffer - handle different export formats
        BufferPolyfill = bufferMod.Buffer || bufferMod.default?.Buffer || (bufferMod.default && typeof bufferMod.default === 'function' ? bufferMod.default : null);
        processPolyfill = processMod.default || processMod;
        
        // Set globally immediately
        if (typeof window !== 'undefined') {
            (window as any).Buffer = BufferPolyfill;
            (window as any).process = processPolyfill;
            (globalThis as any).Buffer = BufferPolyfill;
            (globalThis as any).process = processPolyfill;
        }
        
        if (typeof self !== 'undefined') {
            (self as any).Buffer = BufferPolyfill;
            (self as any).process = processPolyfill;
        }
        
        console.log('[Polyfills] Buffer and process loaded:', {
            Buffer: typeof BufferPolyfill,
            hasFrom: typeof BufferPolyfill?.from === 'function',
            process: typeof processPolyfill
        });
    } catch (error) {
        console.error('[Polyfills] Failed to load:', error);
    }
})();

// Export getters that will return the loaded values
export const Buffer = new Proxy({} as any, {
    get(target, prop) {
        if (BufferPolyfill) {
            return BufferPolyfill[prop as keyof typeof BufferPolyfill];
        }
        // Fallback to global if available
        if (typeof window !== 'undefined' && (window as any).Buffer) {
            return (window as any).Buffer[prop];
        }
        throw new Error('Buffer not loaded yet');
    }
});

export const process = new Proxy({} as any, {
    get(target, prop) {
        if (processPolyfill) {
            return processPolyfill[prop as keyof typeof processPolyfill];
        }
        if (typeof window !== 'undefined' && (window as any).process) {
            return (window as any).process[prop];
        }
        return undefined;
    }
});

