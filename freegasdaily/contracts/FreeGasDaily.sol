// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FreeGasDaily - Claim 0.2 CELO per user per day
contract FreeGasDaily {
    address public owner;
    uint256 public claimAmount = 0.2 ether; // 0.2 CELO (since CELO uses same decimals as ETH)
    bool public paused;

    mapping(address => uint256) public lastClaim;

    event Claimed(address indexed user, uint256 amount, uint256 time);
    event Paused(bool status);
    event OwnerChanged(address indexed newOwner);
    event ClaimAmountChanged(uint256 newAmount);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() payable {
        owner = msg.sender;
    }

    function claim() external {
        require(!paused, "paused");
        require(
            block.timestamp > lastClaim[msg.sender] + 1 days,
            "already claimed today"
        );
        require(address(this).balance >= claimAmount, "insufficient contract balance");

        lastClaim[msg.sender] = block.timestamp;
        payable(msg.sender).transfer(claimAmount);

        emit Claimed(msg.sender, claimAmount, block.timestamp);
    }

    // --- Owner functions ---
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }

    function setClaimAmount(uint256 _newAmount) external onlyOwner {
        claimAmount = _newAmount;
        emit ClaimAmountChanged(_newAmount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
        emit OwnerChanged(newOwner);
    }

    // Allow contract to receive CELO
    receive() external payable {}
}