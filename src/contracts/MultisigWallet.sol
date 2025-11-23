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

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 confirmations;
    }

    mapping(uint256 => Transaction) public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmations;

    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not an owner");
        _;
    }

    constructor(address[] memory _owners, uint256 _threshold) {
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
            confirmations: 0
        });
        confirmTransaction(txNonce);
        return txNonce;
    }

    /**
     * Confirm a transaction
     */
    function confirmTransaction(uint256 txNonce) public onlyOwner {
        require(!transactions[txNonce].executed, "Transaction already executed");
        require(!confirmations[txNonce][msg.sender], "Already confirmed");

        confirmations[txNonce][msg.sender] = true;
        transactions[txNonce].confirmations++;

        if (transactions[txNonce].confirmations >= threshold) {
            executeTransaction(txNonce);
        }
    }

    /**
     * Execute a transaction once threshold is met
     */
    function executeTransaction(uint256 txNonce) internal {
        Transaction storage tx = transactions[txNonce];
        require(!tx.executed, "Already executed");
        require(tx.confirmations >= threshold, "Insufficient confirmations");

        tx.executed = true;

        (bool success, ) = tx.to.call{value: tx.value}(tx.data);
        require(success, "Transaction failed");

        emit TransactionExecuted(tx.to, tx.value, tx.data);
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
        return confirmations[txNonce][owner];
    }

    receive() external payable {}
}




