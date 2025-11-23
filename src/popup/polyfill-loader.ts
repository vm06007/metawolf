// Polyfill loader - loads Buffer before any other code runs
// This file is loaded FIRST in the HTML

// Use dynamic import to load buffer package (avoids Bun's node:buffer resolution)
(async function() {
    try {
        // Dynamic import of buffer package
        // @ts-ignore
        const bufferMod = await import('buffer');
        // @ts-ignore
        const processMod = await import('process');
        
        // Extract Buffer - handle different export formats
        const BufferPolyfill = bufferMod.Buffer || bufferMod.default?.Buffer || 
            (bufferMod.default && typeof bufferMod.default === 'function' ? bufferMod.default : null);
        const processPolyfill = processMod.default || processMod;
        
        if (BufferPolyfill && typeof BufferPolyfill === 'function') {
            // Set Buffer globally immediately
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
            
            console.log('[Polyfill Loader] Buffer and process loaded and set globally:', {
                Buffer: typeof BufferPolyfill,
                hasFrom: typeof BufferPolyfill?.from === 'function',
                process: typeof processPolyfill
            });
            
            // Load main app after Buffer is set
            loadMainApp();
        } else {
            throw new Error('Failed to extract Buffer from package');
        }
    } catch (error) {
        console.error('[Polyfill Loader] Failed to load Buffer:', error);
        // Still try to load app, but it may fail
        loadMainApp();
    }
})();

function loadMainApp() {
    // Determine which script to load based on the HTML file
    const scriptName = window.location.pathname.includes('expanded.html') ? 'expanded.js' : 'index.js';
    const script = document.createElement('script');
    script.type = 'module';
    script.src = scriptName;
    document.body.appendChild(script);
    console.log('[Polyfill Loader] Loading main app:', scriptName);
}

