// Inline polyfills that must load BEFORE any other code
// This file will be injected into HTML as a script tag

(async function() {
    try {
        // Load buffer and process
        const bufferModule = await import(chrome.runtime.getURL('popup/polyfills-buffer.js'));
        const processModule = await import(chrome.runtime.getURL('popup/polyfills-process.js'));
        
        const BufferPolyfill = bufferModule.Buffer || bufferModule.default?.Buffer || bufferModule.default;
        const processPolyfill = processModule.default || processModule;
        
        // Set globally immediately
        if (typeof window !== 'undefined') {
            window.Buffer = BufferPolyfill;
            window.process = processPolyfill;
            globalThis.Buffer = BufferPolyfill;
            globalThis.process = processPolyfill;
        }
        
        console.log('[Polyfills] Buffer and process loaded:', {
            Buffer: typeof BufferPolyfill,
            hasFrom: typeof BufferPolyfill?.from === 'function'
        });
    } catch (error) {
        console.error('[Polyfills] Failed to load:', error);
    }
})();

