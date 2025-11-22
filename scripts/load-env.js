#!/usr/bin/env node
/**
 * Load environment variables from .env file
 * Bun has native dotenv support, but we need to ensure it's loaded for build scripts
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export function loadEnv() {
    try {
        const envPath = join(process.cwd(), '.env');
        const envContent = readFileSync(envPath, 'utf-8');
        const envVars = {};
        
        envContent.split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0) {
                    const value = valueParts.join('=').trim();
                    // Remove quotes if present
                    const cleanValue = value.replace(/^["']|["']$/g, '');
                    envVars[key.trim()] = cleanValue;
                }
            }
        });
        
        return envVars;
    } catch (error) {
        console.warn('[load-env] Could not load .env file:', error.message);
        return {};
    }
}

// If run directly, export env vars
if (import.meta.url === `file://${process.argv[1]}`) {
    const envVars = loadEnv();
    Object.entries(envVars).forEach(([key, value]) => {
        process.env[key] = value;
    });
}

