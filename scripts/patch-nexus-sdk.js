#!/usr/bin/env node
/**
 * Patch script for @avail-project/nexus-core
 * Replaces window.location.host with 'localhost' for browser extensions
 * to fix SIWE domain validation errors
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sdkPath = path.join(__dirname, '../node_modules/@avail-project/nexus-core/dist/index.esm.js');

if (!fs.existsSync(sdkPath)) {
    console.log('[Patch] SDK file not found, skipping patch');
    process.exit(0);
}

try {
    let content = fs.readFileSync(sdkPath, 'utf8');
    
    // Check if already patched
    if (content.includes('// Patch for browser extensions')) {
        console.log('[Patch] SDK already patched');
        process.exit(0);
    }
    
    // Apply patch: replace window.location.host with localhost for extensions
    const original = `        const scheme = window.location.protocol.slice(0, -1);
        const domain = window.location.host;
        const origin = window.location.origin;`;
    
    const patched = `        const scheme = window.location.protocol.slice(0, -1);
        // Patch for browser extensions: use 'localhost' instead of extension ID
        // Extension IDs are not RFC 3986 compliant, causing SIWE validation to fail
        const rawDomain = window.location.host;
        // Detect browser extension: chrome-extension:// or extension ID (32 chars, no dots)
        const isExtension = window.location.protocol === 'chrome-extension:' || 
                           (rawDomain && rawDomain.length >= 20 && !rawDomain.includes('.') && !rawDomain.includes('localhost'));
        const domain = isExtension ? 'localhost' : rawDomain;
        const origin = isExtension ? 'https://localhost' : window.location.origin;`;
    
    if (content.includes(original)) {
        content = content.replace(original, patched);
        fs.writeFileSync(sdkPath, content, 'utf8');
        console.log('[Patch] Successfully patched @avail-project/nexus-core');
    } else {
        console.log('[Patch] Could not find target code to patch');
        process.exit(1);
    }
} catch (error) {
    console.error('[Patch] Error patching SDK:', error);
    process.exit(1);
}

