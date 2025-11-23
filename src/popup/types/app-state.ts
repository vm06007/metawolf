import type { ConnectedDApp } from '../components/CurrentConnection';
import type { EthPriceData } from '../components/EthPricePanel';
import type { UnifiedBalanceData } from '../services/unified-balance-service';
import type { OctavTransaction, OctavPortfolio } from '../services/transactions-service';

export const TRANSACTIONS_PAGE_SIZE = 20;

export interface AppState {
    unlocked: boolean;
    accounts: any[];
    selectedAccount?: any;
    balance: string;
    networks: any[];
    selectedNetwork: number;
    loading: boolean;
    password: string;
    hasPassword: boolean;
    showAccountSelector: boolean;
    accountSelectorFirstRender: boolean;
    showNetworkSelector: boolean;
    showAddWalletModal: boolean;
    showCreateAccountForm: boolean;
    showImportAccountForm: boolean;
    showCreateMultisigForm: boolean;
    showParallelMultisigScan: boolean;
    parallelScanState?: {
        chip1: {
            status: 'pending' | 'scanning' | 'connected' | 'done' | 'error';
            qrCode?: string;
            execURL?: string;
            chipInfo?: any;
            gate?: any;
        };
        chip2: {
            status: 'pending' | 'scanning' | 'connected' | 'done' | 'error';
            qrCode?: string;
            execURL?: string;
            chipInfo?: any;
            gate?: any;
        };
    };
    showHaloChipNameForm: boolean;
    showFireflyNameForm: boolean;
    showSecurityConfirm: boolean;
    pendingHaloLink?: { deleteKey: boolean };
    connectedDApp: ConnectedDApp | null;
    showDeleteAccountModal: boolean;
    accountToDelete?: any;
    errorMessage?: string;
    showSettingsMenu: boolean;
    showChangePasswordModal: boolean;
    ethPriceData: EthPriceData | null;
    ethPriceLoading: boolean;
    sidebarCollapsed: boolean;
    showAddContactModal: boolean;
    showAccountDetailModal: boolean;
    accountToEdit?: any;
    accountDetailModalFirstRender: boolean;
    showPasswordModal: boolean;
    passwordModalConfig?: {
        title: string;
        message: string;
        onConfirm: (password: string) => void;
    };
    passwordModalFirstRender: boolean;
    showPrivateKeyModal: boolean;
    privateKeyToShow?: string;
    privateKeyRevealed: boolean;
    privateKeyModalFirstRender: boolean;
    unifiedBalanceData: UnifiedBalanceData | null;
    unifiedBalanceLoading: boolean;
    historicalBalanceData: any[] | null;
    historicalBalanceLoading: boolean;
    showReceiveScreen: boolean;
    receiveScreenHideBalance: boolean;
    showSendScreen: boolean;
    sendScreenHideBalance: boolean;
    delegationStatus: {
        isDelegated: boolean;
        delegateAddress: string | null;
        codeHash: string;
        chainId?: number; // Store which network the delegation is on
    } | null;
    delegationLoading: boolean;
    delegationTargetAddress: string | null;
    delegationStatusAddress: string | null;
    showDelegationModal: boolean;
    delegationModalIsUpgrade: boolean;
    delegationModalFirstRender: boolean;
    delegationContractAddress: string | null;
    delegationTransactionHash: string | null;
    delegationButtonToConfirm: boolean;
    showEip7702Modal: boolean;
    eip7702ModalFirstRender: boolean;
    eip7702ModalAccountAddress: string | null;
    showTransactionsScreen: boolean;
    transactions: OctavTransaction[];
    transactionsLoading: boolean;
    transactionsError?: string;
    transactionsOffset: number;
    transactionsHasMore: boolean;
    transactionsHideSpam: boolean;
    transactionsAccountAddress?: string;
    showSubscriptionsModal: boolean;
    subscriptionsModalFirstRender: boolean;
    subscriptionFlow: {
        serviceId: string | null;
        status: 'idle' | 'fetching' | 'signing' | 'processing' | 'success' | 'error';
        paymentRequirements: any | null;
        error?: string;
    };
    portfolioData: OctavPortfolio | null;
    portfolioLoading: boolean;
    defiSelectedChainId: number | null;
}

export function createInitialState(): AppState {
    return {
        unlocked: false,
        accounts: [],
        selectedAccount: undefined,
        balance: '0.00',
        networks: [],
        selectedNetwork: 1,
        loading: true,
        password: '',
        hasPassword: false,
        showAccountSelector: false,
        accountSelectorFirstRender: true,
        showNetworkSelector: false,
        showAddWalletModal: false,
        showCreateAccountForm: false,
        showImportAccountForm: false,
        showCreateMultisigForm: false,
        showParallelMultisigScan: false,
        parallelScanState: undefined,
        showHaloChipNameForm: false,
        showFireflyNameForm: false,
        showSecurityConfirm: false,
        pendingHaloLink: undefined,
        connectedDApp: null,
        showDeleteAccountModal: false,
        accountToDelete: undefined,
        errorMessage: undefined,
        showSettingsMenu: false,
        showChangePasswordModal: false,
        ethPriceData: null,
        ethPriceLoading: false,
        sidebarCollapsed: false,
        showAddContactModal: false,
        showAccountDetailModal: false,
        accountToEdit: undefined,
        accountDetailModalFirstRender: true,
        showPasswordModal: false,
        passwordModalConfig: undefined,
        passwordModalFirstRender: true,
        showPrivateKeyModal: false,
        privateKeyToShow: undefined,
        privateKeyRevealed: false,
        privateKeyModalFirstRender: true,
        unifiedBalanceData: null,
        unifiedBalanceLoading: false,
        historicalBalanceData: null,
        historicalBalanceLoading: false,
        showReceiveScreen: false,
        receiveScreenHideBalance: false,
        showSendScreen: false,
        sendScreenHideBalance: false,
        delegationStatus: null,
        delegationLoading: false,
        delegationTargetAddress: null,
        delegationStatusAddress: null,
        showDelegationModal: false,
        delegationModalIsUpgrade: true,
        delegationModalFirstRender: true,
        delegationContractAddress: null,
        delegationTransactionHash: null,
        delegationButtonToConfirm: false,
        showEip7702Modal: false,
        eip7702ModalFirstRender: true,
        eip7702ModalAccountAddress: null,
        showTransactionsScreen: false,
        transactions: [],
        transactionsLoading: false,
        transactionsError: undefined,
        transactionsOffset: 0,
        transactionsHasMore: false,
        transactionsHideSpam: true,
        transactionsAccountAddress: undefined,
        showSubscriptionsModal: false,
        subscriptionsModalFirstRender: true,
        subscriptionFlow: {
            serviceId: null,
            status: 'idle',
            paymentRequirements: null,
            error: undefined,
        },
        portfolioData: null,
        portfolioLoading: false,
        defiSelectedChainId: null,
    };
}

