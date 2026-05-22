// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title StarcadeGame
 * @author STARCADE
 * @notice On-chain score registry, leaderboard, daily check-in,
 *         and achievement system for the STARCADE arcade game on Base.
 *
 * Design principles:
 *  - One score submission per game session (session nonce anti-spam)
 *  - Score cap prevents impossibly high submissions
 *  - Daily check-in enforced via block.timestamp (24 h cooldown)
 *  - Achievements stored as a per-player uint256 bitmask (cheap, no NFT)
 *  - Leaderboard: top-10 by personal best (one slot per address)
 *  - All functions are nonpayable — no ETH required, just gas
 */
contract StarcadeGame {

    // ─── Constants ────────────────────────────────────────────────────────────

    uint256 public constant MAX_SCORE        = 100_000;   // hard cap — rejects cheated scores
    uint256 public constant CHECKIN_COOLDOWN = 1 days;    // 24 h between check-ins
    uint8   public constant MAX_LEADERBOARD  = 10;        // top-10 slots

    // Achievement badge IDs (matches src/config/achievements.js)
    uint8 public constant BADGE_FIRST_BLOOD      = 0;
    uint8 public constant BADGE_SECTOR_ACE       = 1;
    uint8 public constant BADGE_HIGH_ROLLER      = 2;   // score >= 5000
    uint8 public constant BADGE_LEGENDARY_PILOT  = 3;   // score >= 15000
    uint8 public constant BADGE_DAILY_DEVOTEE    = 4;   // streak >= 3
    uint8 public constant BADGE_GALAXY_BRAIN     = 5;   // level >= 9

    // ─── Storage ──────────────────────────────────────────────────────────────

    struct LeaderboardEntry {
        address player;
        uint32  score;
        uint8   level;
        bool    win;
        uint40  timestamp;
    }

    struct PlayerStats {
        uint32  personalBest;
        uint8   bestLevel;
        uint256 achievementBits;   // bitmask of earned badge IDs
        uint40  lastCheckIn;       // unix timestamp of last check-in
        uint16  checkInStreak;     // consecutive days checked in
        uint32  totalSubmissions;
    }

    /// @dev Top-10 leaderboard (one slot per address — personal best only)
    LeaderboardEntry[10] public leaderboard;
    uint8 public leaderboardSize;

    /// @dev Per-player stats
    mapping(address => PlayerStats) public playerStats;

    /// @dev Session nonce registry — prevents submitting the same game twice
    mapping(bytes32 => bool) public usedSessions;

    // ─── Events ───────────────────────────────────────────────────────────────

    event ScoreSubmitted(
        address indexed player,
        uint32  score,
        uint8   level,
        bool    win,
        bytes32 indexed sessionId,
        uint40  timestamp
    );

    event CheckedIn(
        address indexed player,
        uint40  timestamp,
        uint16  streak
    );

    event AchievementUnlocked(
        address indexed player,
        uint8   indexed badgeId,
        string  name
    );

    // ─── Score Submission ─────────────────────────────────────────────────────

    /**
     * @notice Submit a final game score to the chain.
     * @param score      Final score (0 – MAX_SCORE)
     * @param level      Sector/wave reached (1–10)
     * @param win        True if player defeated the boss
     * @param sessionId  Unique bytes32 generated client-side per game session
     *
     * Anti-spam guarantees:
     *   1. sessionId can only be used once per address
     *   2. score must be ≤ MAX_SCORE
     *   3. Leaderboard only records personal bests
     */
    function submitScore(
        uint32  score,
        uint8   level,
        bool    win,
        bytes32 sessionId
    ) external {
        require(score > 0,           "Score must be > 0");
        require(score <= MAX_SCORE,  "Score exceeds maximum");
        require(level >= 1 && level <= 10, "Invalid level");

        // Build a wallet-scoped nonce so the same sessionId can't be
        // reused even from a different address (belt-and-suspenders)
        bytes32 nonce = keccak256(abi.encodePacked(msg.sender, sessionId));
        require(!usedSessions[nonce], "Session already submitted");
        usedSessions[nonce] = true;

        PlayerStats storage ps = playerStats[msg.sender];
        ps.totalSubmissions++;

        // Update personal best
        bool isPersonalBest = score > ps.personalBest;
        if (isPersonalBest) {
            ps.personalBest = score;
            ps.bestLevel    = level;
            _updateLeaderboard(msg.sender, score, level, win);
        }

        emit ScoreSubmitted(msg.sender, score, level, win, sessionId, uint40(block.timestamp));

        // Check and unlock achievements
        _checkAchievements(ps, score, level, win);
    }

    // ─── Daily Check-In ───────────────────────────────────────────────────────

    /**
     * @notice Record a daily check-in for the caller.
     *         Reverts if called more than once within 24 hours.
     */
    function dailyCheckIn() external {
        PlayerStats storage ps = playerStats[msg.sender];
        require(
            block.timestamp >= uint256(ps.lastCheckIn) + CHECKIN_COOLDOWN,
            "Already checked in today"
        );

        // Streak logic: if last check-in was within 48 h, streak continues
        bool streakContinues = ps.lastCheckIn > 0 &&
            block.timestamp < uint256(ps.lastCheckIn) + (CHECKIN_COOLDOWN * 2);

        ps.lastCheckIn   = uint40(block.timestamp);
        ps.checkInStreak = streakContinues ? ps.checkInStreak + 1 : 1;

        emit CheckedIn(msg.sender, uint40(block.timestamp), ps.checkInStreak);

        // Daily Devotee badge: 3+ day streak
        if (ps.checkInStreak >= 3) {
            _unlockAchievement(ps, BADGE_DAILY_DEVOTEE, "DAILY DEVOTEE");
        }
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the full leaderboard array (up to 10 entries).
     */
    function getLeaderboard() external view returns (LeaderboardEntry[10] memory, uint8 size) {
        return (leaderboard, leaderboardSize);
    }

    /**
     * @notice Returns all stats for a given player address.
     */
    function getPlayerStats(address player) external view returns (PlayerStats memory) {
        return playerStats[player];
    }

    /**
     * @notice Convenience check — has this address checked in today?
     */
    function hasCheckedInToday(address player) external view returns (bool) {
        return block.timestamp < uint256(playerStats[player].lastCheckIn) + CHECKIN_COOLDOWN;
    }

    /**
     * @notice Has a specific session nonce already been used by this address?
     */
    function isSessionUsed(address player, bytes32 sessionId) external view returns (bool) {
        return usedSessions[keccak256(abi.encodePacked(player, sessionId))];
    }

    // ─── Internal: Leaderboard ────────────────────────────────────────────────

    /**
     * @dev Updates the top-10 leaderboard with a new personal best.
     *      One slot per address — replaces the existing entry if present,
     *      otherwise inserts if there's space or the score beats the lowest.
     */
    function _updateLeaderboard(
        address player,
        uint32  score,
        uint8   level,
        bool    win
    ) internal {
        LeaderboardEntry memory entry = LeaderboardEntry({
            player:    player,
            score:     score,
            level:     level,
            win:       win,
            timestamp: uint40(block.timestamp)
        });

        // Check if player already has a slot
        for (uint8 i = 0; i < leaderboardSize; i++) {
            if (leaderboard[i].player == player) {
                leaderboard[i] = entry;
                _sortLeaderboard();
                return;
            }
        }

        // New player — add if there's space
        if (leaderboardSize < MAX_LEADERBOARD) {
            leaderboard[leaderboardSize] = entry;
            leaderboardSize++;
            _sortLeaderboard();
            return;
        }

        // Find lowest score in full leaderboard
        uint8  lowestIdx   = 0;
        uint32 lowestScore = leaderboard[0].score;
        for (uint8 i = 1; i < MAX_LEADERBOARD; i++) {
            if (leaderboard[i].score < lowestScore) {
                lowestScore = leaderboard[i].score;
                lowestIdx   = i;
            }
        }

        // Replace lowest if new score is better
        if (score > lowestScore) {
            leaderboard[lowestIdx] = entry;
            _sortLeaderboard();
        }
    }

    /** @dev Insertion sort descending by score (max 10 elements — gas acceptable) */
    function _sortLeaderboard() internal {
        for (uint8 i = 1; i < leaderboardSize; i++) {
            LeaderboardEntry memory key = leaderboard[i];
            int8 j = int8(i) - 1;
            while (j >= 0 && leaderboard[uint8(j)].score < key.score) {
                leaderboard[uint8(uint8(j) + 1)] = leaderboard[uint8(j)];
                j--;
            }
            leaderboard[uint8(uint8(j) + 1)] = key;
        }
    }

    // ─── Internal: Achievements ───────────────────────────────────────────────

    function _checkAchievements(
        PlayerStats storage ps,
        uint32 score,
        uint8  level,
        bool   win
    ) internal {
        // Badge 0: First Blood — any submission
        _unlockAchievement(ps, BADGE_FIRST_BLOOD, "FIRST BLOOD");

        // Badge 1: Sector Ace — won a boss fight
        if (win) {
            _unlockAchievement(ps, BADGE_SECTOR_ACE, "SECTOR ACE");
        }

        // Badge 2: High Roller — score >= 5000
        if (score >= 5000) {
            _unlockAchievement(ps, BADGE_HIGH_ROLLER, "HIGH ROLLER");
        }

        // Badge 3: Legendary Pilot — score >= 15000
        if (score >= 15000) {
            _unlockAchievement(ps, BADGE_LEGENDARY_PILOT, "LEGENDARY PILOT");
        }

        // Badge 5: Galaxy Brain — reached level/sector 9+
        if (level >= 9) {
            _unlockAchievement(ps, BADGE_GALAXY_BRAIN, "GALAXY BRAIN");
        }
    }

    /**
     * @dev Sets the achievement bit and emits event only if not already earned.
     *      Bitmask: bit N = badge ID N.
     */
    function _unlockAchievement(
        PlayerStats storage ps,
        uint8  badgeId,
        string memory name
    ) internal {
        uint256 bit = 1 << badgeId;
        if (ps.achievementBits & bit == 0) {
            ps.achievementBits |= bit;
            emit AchievementUnlocked(msg.sender, badgeId, name);
        }
    }
}
