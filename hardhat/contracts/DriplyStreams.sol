// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract DriplyStreams is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum ConditionType { NONE, LOCATION }
    enum StreamStatus { ACTIVE, PAUSED, CANCELLED, COMPLETED }

    struct Stream {
        address sender;
        address receiver;
        address token;
        uint256 totalAmount;
        uint256 startTime;
        uint256 endTime;
        uint256 interval;
        uint256 amountClaimed;
        uint256 pausedAt;
        uint256 totalPausedTime;
        StreamStatus status;
        ConditionType conditionType;
        bytes conditionData;
    }

    uint256 public nextStreamId;
    mapping(uint256 => Stream) public streams;
    address public backendSigner;
    mapping(uint256 => uint256) public claimNonces;

    event StreamCreated(uint256 indexed streamId, address indexed sender, address indexed receiver, uint256 totalAmount, uint256 startTime, uint256 endTime, ConditionType conditionType);
    event FundsClaimed(uint256 indexed streamId, address indexed receiver, uint256 amount);
    event StreamPaused(uint256 indexed streamId);
    event StreamResumed(uint256 indexed streamId);
    event StreamCancelled(uint256 indexed streamId, uint256 refundToSender, uint256 keptByReceiver);
    event EmergencyUnlocked(uint256 indexed streamId, uint256 amount, uint256 percentage);

    constructor(address _backendSigner) {
        backendSigner = _backendSigner;
    }

    function createStream(
        address receiver,
        address token,
        uint256 totalAmount,
        uint256 duration,
        uint256 interval,
        ConditionType conditionType,
        bytes calldata conditionData
    ) external nonReentrant returns (uint256 streamId) {
        require(receiver != address(0) && receiver != msg.sender, "Invalid receiver");
        require(totalAmount > 0, "Amount must be > 0");
        require(duration > 0 && interval > 0, "Invalid duration/interval");
        require(interval <= duration, "Interval cannot exceed duration");

        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);

        streamId = nextStreamId++;
        streams[streamId] = Stream({
            sender: msg.sender,
            receiver: receiver,
            token: token,
            totalAmount: totalAmount,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            interval: interval,
            amountClaimed: 0,
            pausedAt: 0,
            totalPausedTime: 0,
            status: StreamStatus.ACTIVE,
            conditionType: conditionType,
            conditionData: conditionData
        });

        emit StreamCreated(streamId, msg.sender, receiver, totalAmount, block.timestamp, block.timestamp + duration, conditionType);
    }

    function claimFunds(uint256 streamId, bytes calldata signature) external nonReentrant {
        Stream storage s = streams[streamId];
        require(msg.sender == s.receiver, "Not the receiver");
        require(s.status == StreamStatus.ACTIVE, "Stream not active");

        uint256 claimable = _unlockedAmount(s) - s.amountClaimed;
        require(claimable > 0, "Nothing to claim yet");

        if (s.conditionType == ConditionType.LOCATION) {
            uint256 nonce = claimNonces[streamId];
            bytes32 hash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(streamId, s.receiver, nonce, block.chainid))));
            address signer = _recoverSigner(hash, signature);
            require(signer == backendSigner, "Invalid location permit");
            claimNonces[streamId]++;
        }

        s.amountClaimed += claimable;
        if (s.amountClaimed >= s.totalAmount) s.status = StreamStatus.COMPLETED;

        IERC20(s.token).safeTransfer(s.receiver, claimable);
        emit FundsClaimed(streamId, s.receiver, claimable);
    }

    /**
     * @notice Sender approves an emergency unlock for a percentage of remaining locked funds.
     * @param streamId The stream to unlock.
     * @param percentage Percentage of REMAINING locked funds to release (1-100).
     */
    function emergencyUnlock(uint256 streamId, uint256 percentage) external nonReentrant {
        Stream storage s = streams[streamId];
        require(msg.sender == s.sender, "Not the sender");
        require(s.status == StreamStatus.ACTIVE || s.status == StreamStatus.PAUSED, "Stream not active");
        require(percentage > 0 && percentage <= 100, "Invalid percentage");

        // Calculate remaining locked funds (total - already claimed - already unlocked)
        uint256 unlocked = _unlockedAmount(s);
        uint256 alreadyClaimable = unlocked > s.amountClaimed ? unlocked - s.amountClaimed : 0;
        uint256 locked = s.totalAmount - unlocked;
        require(locked > 0, "No locked funds remaining");

        // Release percentage of locked funds
        uint256 releaseAmount = (locked * percentage) / 100;
        require(releaseAmount > 0, "Release amount too small");

        s.amountClaimed += alreadyClaimable + releaseAmount;
        if (s.amountClaimed >= s.totalAmount) s.status = StreamStatus.COMPLETED;

        uint256 totalRelease = alreadyClaimable + releaseAmount;
        IERC20(s.token).safeTransfer(s.receiver, totalRelease);
        emit EmergencyUnlocked(streamId, totalRelease, percentage);
    }

    function pauseStream(uint256 streamId) external {
        Stream storage s = streams[streamId];
        require(msg.sender == s.sender, "Not the sender");
        require(s.status == StreamStatus.ACTIVE, "Stream not active");
        s.status = StreamStatus.PAUSED;
        s.pausedAt = block.timestamp;
        emit StreamPaused(streamId);
    }

    function resumeStream(uint256 streamId) external {
        Stream storage s = streams[streamId];
        require(msg.sender == s.sender, "Not the sender");
        require(s.status == StreamStatus.PAUSED, "Stream not paused");
        s.totalPausedTime += block.timestamp - s.pausedAt;
        s.pausedAt = 0;
        s.status = StreamStatus.ACTIVE;
        emit StreamResumed(streamId);
    }

    function cancelStream(uint256 streamId) external nonReentrant {
        Stream storage s = streams[streamId];
        require(msg.sender == s.sender, "Not the sender");
        require(s.status == StreamStatus.ACTIVE || s.status == StreamStatus.PAUSED, "Cannot cancel");

        uint256 unlocked = _unlockedAmount(s);
        uint256 receiverShare = unlocked - s.amountClaimed;
        uint256 senderRefund = s.totalAmount - unlocked;

        s.status = StreamStatus.CANCELLED;

        if (receiverShare > 0) IERC20(s.token).safeTransfer(s.receiver, receiverShare);
        if (senderRefund > 0) IERC20(s.token).safeTransfer(s.sender, senderRefund);

        emit StreamCancelled(streamId, senderRefund, receiverShare);
    }

    function claimableAmount(uint256 streamId) external view returns (uint256) {
        Stream storage s = streams[streamId];
        if (s.status != StreamStatus.ACTIVE) return 0;
        uint256 unlocked = _unlockedAmount(s);
        return unlocked > s.amountClaimed ? unlocked - s.amountClaimed : 0;
    }

    function getStream(uint256 streamId) external view returns (Stream memory) {
        return streams[streamId];
    }

    function _unlockedAmount(Stream storage s) internal view returns (uint256) {
        uint256 pausedDuration = s.totalPausedTime;
        if (s.status == StreamStatus.PAUSED) pausedDuration += block.timestamp - s.pausedAt;

        uint256 effectiveEnd = s.endTime + pausedDuration;
        uint256 effectiveNow = block.timestamp > effectiveEnd ? effectiveEnd : block.timestamp;
        uint256 elapsed = effectiveNow > s.startTime ? effectiveNow - s.startTime - pausedDuration : 0;

        uint256 totalDuration = s.endTime - s.startTime;
        if (elapsed == 0 || totalDuration == 0) return 0;

        uint256 intervalsElapsed = elapsed / s.interval;
        uint256 totalIntervals = totalDuration / s.interval;

        if (intervalsElapsed >= totalIntervals) return s.totalAmount;
        return (s.totalAmount * intervalsElapsed) / totalIntervals;
    }

    function _recoverSigner(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "Invalid sig length");
        bytes32 r;
        bytes32 sv;
        uint8 v;
        assembly {
            r  := calldataload(sig.offset)
            sv := calldataload(add(sig.offset, 32))
            v  := byte(0, calldataload(add(sig.offset, 64)))
        }
        return ecrecover(hash, v, r, sv);
    }

    function updateBackendSigner(address newSigner) external {
        backendSigner = newSigner;
    }
}
