import type { AppState } from '../types/app-state';

export interface ModalContext {
    state: AppState;
    render: () => void;
}

export function showAccountSelector(context: ModalContext): void {
    const { state, render } = context;
    const modalExists = document.getElementById('account-selector-overlay') !== null;
    state.showAccountSelector = true;
    state.accountSelectorFirstRender = !modalExists;
    render();
    if (state.accountSelectorFirstRender) {
        setTimeout(() => {
            state.accountSelectorFirstRender = false;
        }, 350);
    } else {
        state.accountSelectorFirstRender = false;
    }
}

export function hideAccountSelector(context: ModalContext): void {
    const { state, render } = context;
    state.showAccountSelector = false;
    state.accountSelectorFirstRender = true;
    render();
}

export function showAddWalletModal(context: ModalContext): void {
    const { state, render } = context;
    state.showAddWalletModal = true;
    render();
}

export function hideAddWalletModal(context: ModalContext): void {
    const { state, render } = context;
    state.showAddWalletModal = false;
    render();
}

export function showCreateAccountForm(context: ModalContext): void {
    const { state, render } = context;
    state.showCreateAccountForm = true;
    render();
}

export function hideCreateAccountForm(context: ModalContext): void {
    const { state, render } = context;
    state.showCreateAccountForm = false;
    render();
}

export function showImportAccountForm(context: ModalContext): void {
    const { state, render } = context;
    state.showImportAccountForm = true;
    render();
}

export function hideImportAccountForm(context: ModalContext): void {
    const { state, render } = context;
    state.showImportAccountForm = false;
    render();
}

export function showCreateMultisigForm(context: ModalContext): void {
    const { state, render } = context;
    state.showCreateMultisigForm = true;
    render();
}

export function hideCreateMultisigForm(context: ModalContext): void {
    const { state, render } = context;
    state.showCreateMultisigForm = false;
    render();
}

export function showHaloChipNameForm(context: ModalContext): void {
    const { state, render } = context;
    state.showHaloChipNameForm = true;
    render();
}

export function hideHaloChipNameForm(context: ModalContext): void {
    const { state, render } = context;
    state.showHaloChipNameForm = false;
    render();
}

export function showFireflyNameForm(context: ModalContext): void {
    const { state, render } = context;
    state.showFireflyNameForm = true;
    render();
}

export function hideFireflyNameForm(context: ModalContext): void {
    const { state, render } = context;
    state.showFireflyNameForm = false;
    render();
}

export function showAddContactModal(context: ModalContext): void {
    const { state, render } = context;
    state.showAddContactModal = true;
    render();
}

export function hideAddContactModal(context: ModalContext): void {
    const { state, render } = context;
    state.showAddContactModal = false;
    render();
}

export function showSecurityConfirm(context: ModalContext): void {
    const { state, render } = context;
    state.showSecurityConfirm = true;
    render();
}

export function hideSecurityConfirm(context: ModalContext): void {
    const { state, render } = context;
    state.showSecurityConfirm = false;
    state.pendingHaloLink = undefined;
    render();
}

export function hideSettingsMenu(context: ModalContext): void {
    const { state, render } = context;
    state.showSettingsMenu = false;
    render();
}

export function hideAccountDetailModal(context: ModalContext): void {
    const { state, render } = context;
    state.showAccountDetailModal = false;
    state.accountToEdit = undefined;
    state.accountDetailModalFirstRender = true;
    render();
}

export function showPrivateKeyModal(
    privateKey: string,
    shouldAnimate: boolean,
    context: ModalContext
): void {
    const { state, render } = context;
    const wasShowing = state.showPrivateKeyModal;
    const modalExists = document.getElementById('private-key-modal-overlay') !== null;
    const passwordModalWasShowing = state.showPasswordModal || document.getElementById('password-modal-overlay') !== null;

    state.privateKeyToShow = privateKey;
    state.showPrivateKeyModal = true;
    state.privateKeyRevealed = false;

    const actuallyAnimate = shouldAnimate && !passwordModalWasShowing;

    if (!wasShowing && !modalExists) {
        state.privateKeyModalFirstRender = actuallyAnimate;
        render();
        if (actuallyAnimate) {
            setTimeout(() => {
                state.privateKeyModalFirstRender = false;
            }, 350);
        } else {
            state.privateKeyModalFirstRender = false;
        }
    } else if (wasShowing || modalExists) {
        const showKeyBtn = document.getElementById('show-private-key-btn');
        const keyContainer = document.getElementById('private-key-container');
        const copyBtn = document.getElementById('private-key-copy-btn');
        const keyText = document.getElementById('private-key-text');

        if (showKeyBtn) showKeyBtn.style.display = 'block';
        if (keyContainer) keyContainer.style.display = 'none';
        if (copyBtn) copyBtn.style.display = 'none';
        if (keyText) keyText.textContent = '';

        state.privateKeyModalFirstRender = false;
    }
}

export function hidePrivateKeyModal(context: ModalContext): void {
    const { state, render } = context;
    state.showPrivateKeyModal = false;
    state.privateKeyToShow = undefined;
    state.privateKeyRevealed = false;
    state.privateKeyModalFirstRender = true;
    render();
}

export function showPasswordModal(
    title: string,
    message: string,
    onConfirm: (password: string) => void,
    context: ModalContext
): void {
    const { state, render } = context;
    const modalExists = document.getElementById('password-modal-overlay') !== null;
    const accountDetailModalShowing = state.showAccountDetailModal ||
        document.getElementById('account-detail-overlay') !== null;

    state.passwordModalConfig = { title, message, onConfirm };
    state.showPasswordModal = true;
    state.passwordModalFirstRender = !modalExists && !accountDetailModalShowing;
    render();
    if (state.passwordModalFirstRender) {
        setTimeout(() => {
            state.passwordModalFirstRender = false;
        }, 350);
    } else {
        state.passwordModalFirstRender = false;
    }
}

export function hidePasswordModal(context: ModalContext): void {
    const { state, render } = context;
    state.showPasswordModal = false;
    state.passwordModalConfig = undefined;
    state.passwordModalFirstRender = true;
    render();
}

export function hideDeleteAccountModal(context: ModalContext): void {
    const { state, render } = context;
    state.showDeleteAccountModal = false;
    state.accountToDelete = undefined;
    render();
}

export function hideNetworkSelector(context: ModalContext): void {
    const { state, render } = context;
    if (!state.showNetworkSelector) return;
    state.showNetworkSelector = false;
    render();
}

