// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AtlasPool} from "./AtlasPool.sol";

contract AtlasClaims is Ownable {
    enum ClaimStatus {
        Submitted,
        QueuedForVerdict,
        Approved,
        Rejected,
        Paid
    }

    struct Claim {
        address member;
        string category;
        string evidenceUri;
        string description;
        uint256 requestedAmount;
        uint256 approvedAmount;
        ClaimStatus status;
        uint64 submittedAt;
        string verdictUri;
        string externalReference;
        string juryReference;
    }

    AtlasPool public immutable pool;
    address public genlayerRelayer;
    uint256 public nextClaimId = 1;
    uint256 public queuedClaims;

    mapping(uint256 => Claim) private _claims;

    event ClaimQueuedForVerdict(uint256 indexed claimId, string juryReference);
    event ClaimRelayerUpdated(address indexed newRelayer);
    event ClaimResolved(
        uint256 indexed claimId,
        address indexed member,
        bool approved,
        uint256 approvedAmount,
        string juryReference
    );
    event ClaimSubmitted(
        uint256 indexed claimId,
        address indexed member,
        string category,
        uint256 requestedAmount,
        string externalReference
    );

    error AtlasClaims__AlreadyResolved();
    error AtlasClaims__ClaimNotFound();
    error AtlasClaims__InvalidAddress();
    error AtlasClaims__InvalidClaimAmount();
    error AtlasClaims__InvalidStatus();
    error AtlasClaims__Unauthorized();

    modifier onlyRelayerOrOwner() {
        if (msg.sender != genlayerRelayer && msg.sender != owner()) {
            revert AtlasClaims__Unauthorized();
        }
        _;
    }

    constructor(address poolAddress, address initialRelayer) Ownable(msg.sender) {
        if (poolAddress == address(0)) {
            revert AtlasClaims__InvalidAddress();
        }

        pool = AtlasPool(poolAddress);
        genlayerRelayer = initialRelayer;
    }

    function submitClaim(
        string calldata category,
        string calldata evidenceUri,
        string calldata description,
        uint256 requestedAmount,
        string calldata externalReference
    ) external returns (uint256 claimId) {
        claimId = _submitClaim(
            msg.sender, category, evidenceUri, description, requestedAmount, externalReference
        );
    }

    function submitClaimFor(
        address member,
        string calldata category,
        string calldata evidenceUri,
        string calldata description,
        uint256 requestedAmount,
        string calldata externalReference
    ) external onlyRelayerOrOwner returns (uint256 claimId) {
        claimId = _submitClaim(member, category, evidenceUri, description, requestedAmount, externalReference);
    }

    function queueClaimForVerdict(uint256 claimId, string calldata juryReference) external onlyRelayerOrOwner {
        Claim storage claim = _requireClaim(claimId);
        if (claim.status != ClaimStatus.Submitted) {
            revert AtlasClaims__InvalidStatus();
        }

        claim.status = ClaimStatus.QueuedForVerdict;
        claim.juryReference = juryReference;
        queuedClaims += 1;

        emit ClaimQueuedForVerdict(claimId, juryReference);
    }

    function resolveAndPayClaim(
        uint256 claimId,
        bool approved,
        uint256 payoutAmount,
        string calldata verdictUri,
        string calldata juryReference
    ) external onlyRelayerOrOwner {
        Claim storage claim = _requireClaim(claimId);
        if (claim.status == ClaimStatus.Rejected || claim.status == ClaimStatus.Paid) {
            revert AtlasClaims__AlreadyResolved();
        }
        if (payoutAmount > claim.requestedAmount) {
            revert AtlasClaims__InvalidClaimAmount();
        }

        if (claim.status == ClaimStatus.QueuedForVerdict && queuedClaims > 0) {
            queuedClaims -= 1;
        }

        claim.verdictUri = verdictUri;
        claim.juryReference = juryReference;

        if (!approved || payoutAmount == 0) {
            claim.approvedAmount = 0;
            claim.status = ClaimStatus.Rejected;
            emit ClaimResolved(claimId, claim.member, false, 0, juryReference);
            return;
        }

        claim.approvedAmount = payoutAmount;
        claim.status = ClaimStatus.Approved;
        pool.executePayout(claim.member, payoutAmount);
        claim.status = ClaimStatus.Paid;

        emit ClaimResolved(claimId, claim.member, true, payoutAmount, juryReference);
    }

    function setGenlayerRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) {
            revert AtlasClaims__InvalidAddress();
        }

        genlayerRelayer = newRelayer;
        emit ClaimRelayerUpdated(newRelayer);
    }

    function claims(uint256 claimId)
        external
        view
        returns (
            address member,
            string memory category,
            string memory evidenceUri,
            string memory description,
            uint256 requestedAmount,
            uint256 approvedAmount,
            uint8 status,
            uint64 submittedAt,
            string memory verdictUri,
            string memory externalReference,
            string memory juryReference
        )
    {
        Claim storage claim = _requireClaim(claimId);
        return (
            claim.member,
            claim.category,
            claim.evidenceUri,
            claim.description,
            claim.requestedAmount,
            claim.approvedAmount,
            uint8(claim.status),
            claim.submittedAt,
            claim.verdictUri,
            claim.externalReference,
            claim.juryReference
        );
    }

    function getClaimSummary(uint256 claimId)
        external
        view
        returns (
            address member,
            uint8 status,
            uint256 requestedAmount,
            uint256 approvedAmount,
            string memory category,
            string memory juryReference
        )
    {
        Claim storage claim = _requireClaim(claimId);
        return (
            claim.member,
            uint8(claim.status),
            claim.requestedAmount,
            claim.approvedAmount,
            claim.category,
            claim.juryReference
        );
    }

    function _submitClaim(
        address member,
        string calldata category,
        string calldata evidenceUri,
        string calldata description,
        uint256 requestedAmount,
        string calldata externalReference
    ) internal returns (uint256 claimId) {
        if (member == address(0)) {
            revert AtlasClaims__InvalidAddress();
        }
        if (requestedAmount == 0) {
            revert AtlasClaims__InvalidClaimAmount();
        }

        claimId = nextClaimId++;

        _claims[claimId] = Claim({
            member: member,
            category: category,
            evidenceUri: evidenceUri,
            description: description,
            requestedAmount: requestedAmount,
            approvedAmount: 0,
            status: ClaimStatus.Submitted,
            submittedAt: uint64(block.timestamp),
            verdictUri: "",
            externalReference: externalReference,
            juryReference: ""
        });

        emit ClaimSubmitted(claimId, member, category, requestedAmount, externalReference);
    }

    function _requireClaim(uint256 claimId) internal view returns (Claim storage claim) {
        claim = _claims[claimId];
        if (claim.member == address(0)) {
            revert AtlasClaims__ClaimNotFound();
        }
    }
}
