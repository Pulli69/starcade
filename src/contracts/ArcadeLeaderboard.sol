// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ArcadeLeaderboard
 * @dev Stores top retro high scores on-chain for Neon Shift.
 */
contract ArcadeLeaderboard {
    struct ScoreEntry {
        address player;
        uint256 score;
        uint256 timestamp;
    }

    ScoreEntry[] public leaderboard;
    uint256 public constant MAX_LEADERBOARD_SIZE = 5;

    event NewHighScore(address indexed player, uint256 score, uint256 timestamp);

    /**
     * @dev Submits a new score. If it qualifies for the top 5, it is inserted and sorted.
     */
    function submitScore(uint256 _score) public {
        require(_score > 0, "Score must be greater than zero");
        
        bool added = false;
        
        // If leaderboard has space, just push
        if (leaderboard.length < MAX_LEADERBOARD_SIZE) {
            leaderboard.push(ScoreEntry(msg.sender, _score, block.timestamp));
            added = true;
        } else {
            // Find the lowest score in the leaderboard
            uint256 lowestIndex = 0;
            uint256 lowestScore = leaderboard[0].score;
            
            for (uint256 i = 1; i < leaderboard.length; i++) {
                if (leaderboard[i].score < lowestScore) {
                    lowestScore = leaderboard[i].score;
                    lowestIndex = i;
                }
            }
            
            // If the new score is higher than the lowest score, replace it
            if (_score > lowestScore) {
                leaderboard[lowestIndex] = ScoreEntry(msg.sender, _score, block.timestamp);
                added = true;
            }
        }

        if (added) {
            // Sort leaderboard descending using a simple insertion sort
            for (uint256 i = 1; i < leaderboard.length; i++) {
                ScoreEntry memory key = leaderboard[i];
                int256 j = int256(i) - 1;
                while (j >= 0 && leaderboard[uint256(j)].score < key.score) {
                    leaderboard[uint256(j) + 1] = leaderboard[uint256(j)];
                    j--;
                }
                leaderboard[uint256(j) + 1] = key;
            }
            
            emit NewHighScore(msg.sender, _score, block.timestamp);
        }
    }

    /**
     * @dev Returns the full array of high scores
     */
    function getLeaderboard() public view returns (ScoreEntry[] memory) {
        return leaderboard;
    }
}
