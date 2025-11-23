// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * Minimal Multisig Wallet
 * Requires N of M signatures to execute transactions
 */
contract MultisigWallet {
    event TransactionExecuted(address indexed to, uint256 value, bytes data);
    event OwnerAdded(address indexed owner);

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public threshold;
    uint256 public nonce;
    uint256 public acceptedWindowSeconds;

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 confirmations;
        uint256 timestamp;
    }

    mapping(uint256 => Transaction) public transactions;
    mapping(uint256 => mapping(address => uint256)) public confirmations;
    mapping(uint256 => uint256) public lastConfirmationTimestamp;

    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not an owner");
        _;
    }

    constructor(
        address[] memory _owners,
        uint256 _threshold,
        uint256 _acceptedWindowSeconds
    ) {
        require(_owners.length >= 2, "At least 2 owners required");
        require(_threshold > 0 && _threshold <= _owners.length, "Invalid threshold");

        for (uint256 i = 0; i < _owners.length; i++) {
            require(_owners[i] != address(0), "Invalid owner");
            require(!isOwner[_owners[i]], "Duplicate owner");
            isOwner[_owners[i]] = true;
            owners.push(_owners[i]);
            emit OwnerAdded(_owners[i]);
        }

        threshold = _threshold;
        acceptedWindowSeconds = _acceptedWindowSeconds;
    }

    /**
     * Submit a transaction for execution
     */
    function submitTransaction(
        address to,
        uint256 value,
        bytes calldata data
    ) external onlyOwner returns (uint256) {
        uint256 txNonce = nonce++;
        transactions[txNonce] = Transaction({
            to: to,
            value: value,
            data: data,
            executed: false,
            confirmations: 0,
            timestamp: block.timestamp
        });
        confirmTransaction(txNonce);
        return txNonce;
    }

    /**
     * Confirm a transaction
     */
    function confirmTransaction(uint256 txNonce) public onlyOwner {
        require(!transactions[txNonce].executed, "Transaction already executed");
        require(confirmations[txNonce][msg.sender] == 0, "Already confirmed");

        // Check if transaction has expired based on its creation timestamp
        require(
            block.timestamp <= transactions[txNonce].timestamp + acceptedWindowSeconds,
            "TransactionExpired"
        );

        // Enforce time window if this is not the first confirmation
        if (lastConfirmationTimestamp[txNonce] != 0) {
            require(
                block.timestamp - lastConfirmationTimestamp[txNonce] <= acceptedWindowSeconds,
                "TimeWindowExceeded"
            );
        }

        // Record confirmation timestamp
        confirmations[txNonce][msg.sender] = block.timestamp;
        lastConfirmationTimestamp[txNonce] = block.timestamp;
        transactions[txNonce].confirmations++;

        if (transactions[txNonce].confirmations >= threshold) {
            executeTransaction(txNonce);
        }
    }

    /**
     * Execute a transaction once threshold is met
     */
    function executeTransaction(uint256 txNonce) internal {
        Transaction storage txn = transactions[txNonce];
        require(!txn.executed, "Already executed");
        require(txn.confirmations >= threshold, "Insufficient confirmations");

        txn.executed = true;

        (bool success, ) = txn.to.call{value: txn.value}(txn.data);
        require(success, "Transaction failed");

        emit TransactionExecuted(txn.to, txn.value, txn.data);
    }

    /**
     * Get owners list
     */
    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    /**
     * Check if transaction is confirmed by owner
     */
    function isConfirmedBy(uint256 txNonce, address owner) external view returns (bool) {
        return confirmations[txNonce][owner] != 0;
    }

    receive() external payable {}
}




