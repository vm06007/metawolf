#!/usr/bin/env node
/**
 * Build script that loads .env and injects environment variables
 */

import { loadEnv } from './load-env.js';
import { spawn } from 'child_process';

const envVars = loadEnv();

// Merge with existing env
const buildEnv = { ...process.env, ...envVars };

// Get the command to run (everything after this script name)
const args = process.argv.slice(2);
const command = args[0];
const commandArgs = args.slice(1);

console.log('[build-with-env] Loaded environment variables:', Object.keys(envVars));

// Spawn the command with the merged environment
const child = spawn(command, commandArgs, {
    env: buildEnv,
    stdio: 'inherit',
    shell: true,
});

child.on('exit', (code) => {
    process.exit(code || 0);
});

