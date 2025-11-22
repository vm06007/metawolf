# How to Wake Up the Service Worker

## The Problem
Service worker shows as "(Inactive)" in chrome://extensions

## Why This Happens
Chrome service workers go to sleep to save resources. They wake up when:
1. A message is sent to them
2. An alarm fires
3. You click the extension icon

## Solution: Wake It Up Manually

### Step 1: Open Extensions Page
1. Go to `chrome://extensions/`
2. Find "Wolfy Wallet"

### Step 2: Wake Up Service Worker
1. Click **"Details"** on Wolfy Wallet
2. Look for **"service worker"** (it shows as "(Inactive)")
3. **Click the "service worker" link** - this wakes it up
4. It should change to show "(Active)" or open DevTools

### Step 3: Check Console
After clicking, the service worker console should open and show:
- `[Wolfy] Service worker WOKE UP at...`
- `[Wolfy] Wake-up listener registered successfully`
- `[Wolfy] All imports loaded successfully`

### Step 4: Test It
1. Go back to popup
2. Try creating an account
3. The PING message should keep it awake

## Automatic Wake-Up
The extension should automatically wake the service worker when you:
- Click "Create Account" (sends PING)
- Click "Import Account" (sends PING)
- Open the popup (sends PING during init)

But if it's crashed or has errors, you need to manually wake it first to see the errors.

## If Service Worker Won't Wake Up
If clicking the link doesn't wake it, or you see errors:

1. **Check for errors** in the service worker console
2. **Reload extension** completely:
   - Remove it from chrome://extensions
   - Re-add it with "Load unpacked"
3. **Check build** - make sure `bun run build` completed successfully

## Keep-Alive Mechanism
The service worker has:
- Keep-alive alarm (every 1 minute)
- Keep-alive interval (every 30 seconds)
- Wake-up listener for PING messages

If it keeps going inactive, there might be an error preventing it from staying active.

