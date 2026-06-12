// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract AtlasPool is Ownable {
    using SafeERC20 for IERC20;

    uint16 public constant MAX_FEE_BPS = 3_000;
    uint16 public constant BPS_DENOMINATOR = 10_000;

    IERC20 public immutable usdc;

    address public treasuryWallet;
    address public claimsContract;
    uint16 public feeBps;
    uint256 public poolBalance;
    uint256 public totalPremiumsDeposited;
    uint256 public totalTreasuryCollected;

    mapping(address => uint256) public premiumByMember;

    event ClaimsContractUpdated(address indexed newClaimsContract);
    event FeeBpsUpdated(uint16 newFeeBps);
    event PoolToppedUp(address indexed from, uint256 amount);
    event PremiumDeposited(
        address indexed member,
        address indexed payer,
        uint256 grossAmount,
        uint256 poolAmount,
        uint256 treasuryAmount
    );
    event PayoutExecuted(address indexed claimant, uint256 amount, uint256 remainingPoolBalance);
    event TreasuryWalletUpdated(address indexed newTreasuryWallet);

    error AtlasPool__AmountMustBePositive();
    error AtlasPool__ClaimsContractNotSet();
    error AtlasPool__FeeTooHigh();
    error AtlasPool__InsufficientPoolBalance();
    error AtlasPool__InvalidAddress();
    error AtlasPool__Unauthorized();

    modifier onlyClaimsContract() {
        if (msg.sender != claimsContract) {
            revert AtlasPool__Unauthorized();
        }
        _;
    }

    constructor(address usdcAddress, address initialTreasuryWallet, uint16 initialFeeBps)
        Ownable(msg.sender)
    {
        if (usdcAddress == address(0) || initialTreasuryWallet == address(0)) {
            revert AtlasPool__InvalidAddress();
        }
        if (initialFeeBps > MAX_FEE_BPS) {
            revert AtlasPool__FeeTooHigh();
        }

        usdc = IERC20(usdcAddress);
        treasuryWallet = initialTreasuryWallet;
        feeBps = initialFeeBps;
    }

    function depositPremium(address member, uint256 amount) external {
        if (member == address(0)) {
            revert AtlasPool__InvalidAddress();
        }
        if (amount == 0) {
            revert AtlasPool__AmountMustBePositive();
        }

        uint256 treasuryAmount = (amount * feeBps) / BPS_DENOMINATOR;
        uint256 communityAmount = amount - treasuryAmount;

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        if (treasuryAmount > 0) {
            usdc.safeTransfer(treasuryWallet, treasuryAmount);
            totalTreasuryCollected += treasuryAmount;
        }

        poolBalance += communityAmount;
        totalPremiumsDeposited += amount;
        premiumByMember[member] += amount;

        emit PremiumDeposited(member, msg.sender, amount, communityAmount, treasuryAmount);
    }

    function topUpReserve(uint256 amount) external onlyOwner {
        if (amount == 0) {
            revert AtlasPool__AmountMustBePositive();
        }

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        poolBalance += amount;
        emit PoolToppedUp(msg.sender, amount);
    }

    function executePayout(address claimant, uint256 amount) external onlyClaimsContract {
        if (claimsContract == address(0)) {
            revert AtlasPool__ClaimsContractNotSet();
        }
        if (claimant == address(0)) {
            revert AtlasPool__InvalidAddress();
        }
        if (amount == 0) {
            revert AtlasPool__AmountMustBePositive();
        }
        if (amount > poolBalance) {
            revert AtlasPool__InsufficientPoolBalance();
        }

        poolBalance -= amount;
        usdc.safeTransfer(claimant, amount);

        emit PayoutExecuted(claimant, amount, poolBalance);
    }

    function setClaimsContract(address newClaimsContract) external onlyOwner {
        if (newClaimsContract == address(0)) {
            revert AtlasPool__InvalidAddress();
        }

        claimsContract = newClaimsContract;
        emit ClaimsContractUpdated(newClaimsContract);
    }

    function setTreasuryWallet(address newTreasuryWallet) external onlyOwner {
        if (newTreasuryWallet == address(0)) {
            revert AtlasPool__InvalidAddress();
        }

        treasuryWallet = newTreasuryWallet;
        emit TreasuryWalletUpdated(newTreasuryWallet);
    }

    function setFeeBps(uint16 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) {
            revert AtlasPool__FeeTooHigh();
        }

        feeBps = newFeeBps;
        emit FeeBpsUpdated(newFeeBps);
    }

    function getPoolSnapshot()
        external
        view
        returns (
            address usdcAddress,
            address treasury,
            uint16 platformFeeBps,
            uint256 communityPoolBalance,
            uint256 treasuryCollected,
            address claims
        )
    {
        return (address(usdc), treasuryWallet, feeBps, poolBalance, totalTreasuryCollected, claimsContract);
    }
}
