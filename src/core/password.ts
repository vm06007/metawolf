/**
 * Password utility for hashing and verification
 * Uses Web Crypto API for secure password hashing
 */

const SALT_KEY = 'wallet_password_salt';
const HASH_KEY = 'wallet_password_hash';

/**
 * Generate a random salt
 */
async function generateSalt(): Promise<Uint8Array> {
    return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Hash a password with salt using PBKDF2
 */
async function hashPassword(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );

    return crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256',
        },
        passwordKey,
        256
    );
}

/**
 * Convert ArrayBuffer to hex string
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Convert hex string to ArrayBuffer
 */
function hexToArrayBuffer(hex: string): ArrayBuffer {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes.buffer;
}

/**
 * Set password for the wallet
 * This should be called when creating a new wallet or changing password
 */
export async function setPassword(password: string): Promise<void> {
    if (!password || password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
    }

    const salt = await generateSalt();
    const hash = await hashPassword(password, salt);

    // Store salt and hash
    await chrome.storage.local.set({
        [SALT_KEY]: Array.from(salt),
        [HASH_KEY]: arrayBufferToHex(hash),
    });
}

/**
 * Verify password
 */
export async function verifyPassword(password: string): Promise<boolean> {
    try {
        const stored = await chrome.storage.local.get([SALT_KEY, HASH_KEY]);

        if (!stored[SALT_KEY] || !stored[HASH_KEY]) {
            // No password set yet - return false (password must be set first)
            return false;
        }

        const salt = new Uint8Array(stored[SALT_KEY]);
        const storedHash = stored[HASH_KEY];

        const hash = await hashPassword(password, salt);
        const hashHex = arrayBufferToHex(hash);

        return hashHex === storedHash;
    } catch (error) {
        console.error('[Password] Error verifying password:', error);
        return false;
    }
}

/**
 * Check if password is set
 */
export async function hasPassword(): Promise<boolean> {
    try {
        const stored = await chrome.storage.local.get([HASH_KEY]);
        return !!stored[HASH_KEY];
    } catch (error) {
        return false;
    }
}

/**
 * Clear password (for testing/reset)
 */
export async function clearPassword(): Promise<void> {
    await chrome.storage.local.remove([SALT_KEY, HASH_KEY]);
}

