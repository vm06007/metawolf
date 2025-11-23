export interface Message {
    type: string;
    [key: string]: any;
}

export interface MessageResponse {
    success?: boolean;
    [key: string]: any;
}

export async function sendMessageWithRetry(
    message: Message,
    retries = 5,
    timeoutMs = 5000
): Promise<MessageResponse> {
    if (message.type !== 'PING') {
        try {
            await Promise.race([
                chrome.runtime.sendMessage({ type: 'PING' }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
            ]);
        } catch (error) {
            console.warn('[sendMessage] Could not wake service worker with PING');
        }
    }

    for (let i = 0; i < retries; i++) {
        try {
            const response = await Promise.race([
                chrome.runtime.sendMessage(message),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Message timeout')), timeoutMs)
                )
            ]);

            if (chrome.runtime.lastError) {
                if (i < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
                    continue;
                }
                throw new Error(chrome.runtime.lastError.message);
            }

            if (response !== undefined) {
                return response as MessageResponse;
            }

            if (i < retries - 1) {
                console.warn(`[sendMessage] No response, retrying (${i + 1}/${retries})...`);
                await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
                continue;
            }
        } catch (error: any) {
            console.warn(`[sendMessage] Message attempt ${i + 1} failed:`, error.message);
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
                continue;
            }
            throw error;
        }
    }

    throw new Error('No response after all retries');
}
