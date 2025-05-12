/**
 * @file gameLogic.js
 * Contains core game logic functions including scoring, game state changes,
 * and game over/restart procedures.
 */

console.log("GameLogic: Module loading...");

// --- Constants ---
// These constants define the core parameters for game difficulty and scoring.
export const INITIAL_HEALTH = 50; // Starting health for the player.
export const MAX_HEALTH = 75;     // Maximum health the player can have.
export const MIN_HEALTH = 0;      // Minimum health; reaching this can trigger game over.
export const ENERGY_PERFECT = 2;  // Energy gained for a 'perfect' hit.
export const ENERGY_GOOD = 0;     // Energy gained for a 'good' hit. (Design spec says 0, can be adjusted)
export const ENERGY_MISS = -5;    // Energy lost for a 'miss'.

// --- Scoring & Game Logic Functions ---

/**
 * Calculates the combo bonus energy based on the current combo count.
 * @param {number} currentCombo - The current number of consecutive non-missed notes.
 * @returns {number} The energy bonus to be added.
 */
export function calculateComboBonus(currentCombo) {
    // No bonus for combos less than 10
    if (currentCombo < 10) return 0;
    // Bonus is 1 for 10-19, 2 for 20-29, etc.
    const bonus = Math.floor((currentCombo - 1) / 10);
    // console.log(`GameLogic (calculateComboBonus): Combo: ${currentCombo}, Bonus: ${bonus}`);
    return bonus;
}

/**
 * Applies scoring changes based on hit type (perfect, good, miss).
 * Updates player health, combo, total score, and individual hit counts.
 * This function mutates the `gameState` object passed to it.
 * @param {string} hitType - The type of hit: 'perfect', 'good', or 'miss'.
 * @param {object} gameState - The current game state object from main.js.
 * Expected properties: playerHealth, comboCount, perfectCount, goodCount, missCount, maxCombo, totalScore, isGameOver, noDeathMode.
 * @param {object} callbacks - Callbacks to interact with main.js.
 * Expected properties: triggerGameOverCallback(songFinished), updateUICallback().
 */
export function applyScore(hitType, gameState, callbacks) {
    // console.log(`GameLogic (applyScore): Received hitType: ${hitType}, gameState.isGameOver: ${gameState.isGameOver}`);
    // Do nothing if the game is already over
    if (gameState.isGameOver) {
        // console.log("GameLogic (applyScore): Game is over, no score change.");
        return;
    }

    let baseEnergyChange = 0;
    let comboBroken = false;

    // Determine base energy change and update counts based on hit type
    if (hitType === 'perfect') {
        gameState.perfectCount++;
        gameState.comboCount++;
        baseEnergyChange = ENERGY_PERFECT;
    } else if (hitType === 'good') {
        gameState.goodCount++;
        gameState.comboCount++;
        baseEnergyChange = ENERGY_GOOD;
    } else if (hitType === 'miss') {
        gameState.missCount++;
        comboBroken = true;
        baseEnergyChange = ENERGY_MISS;
    }

    // Update max combo if current combo is higher
    if (gameState.comboCount > gameState.maxCombo) {
        gameState.maxCombo = gameState.comboCount;
    }

    // Calculate combo bonus (only if combo is not broken)
    const comboBonus = comboBroken ? 0 : calculateComboBonus(gameState.comboCount);
    const totalEnergyChange = baseEnergyChange + comboBonus;

    // Update player health, ensuring it stays within MIN_HEALTH and MAX_HEALTH
    const previousHealth = gameState.playerHealth;
    gameState.playerHealth = Math.max(MIN_HEALTH, Math.min(MAX_HEALTH, gameState.playerHealth + totalEnergyChange));
    const actualHealthChange = gameState.playerHealth - previousHealth;

    // Update total score
    gameState.totalScore += totalEnergyChange;

    // Reset combo if broken
    if (comboBroken) {
        if (gameState.comboCount > 0) {
            console.log(`GameLogic (applyScore): Combo Broken! Was: ${gameState.comboCount}`);
        }
        gameState.comboCount = 0;
    }

    console.log(`GameLogic (applyScore): Event: ${hitType.toUpperCase()} | Combo: ${gameState.comboCount} (Max: ${gameState.maxCombo}) | Bonus: ${comboBonus} | Health Change: ${actualHealthChange} (Raw Energy: ${totalEnergyChange}) | Health: ${gameState.playerHealth}/${MAX_HEALTH} | Score: ${gameState.totalScore} | P:${gameState.perfectCount} G:${gameState.goodCount} M:${gameState.missCount}`);

    // Call the UI update callback provided by main.js
    if (callbacks && typeof callbacks.updateUICallback === 'function') {
        callbacks.updateUICallback(); // Update the UI elements (health bar, combo display)
    } else {
        console.warn("GameLogic (applyScore): updateUICallback not provided or not a function.");
    }


    // Check for Game Over condition
    if (gameState.playerHealth <= MIN_HEALTH && !gameState.isGameOver) {
        if (!gameState.noDeathMode) {
            console.log("GameLogic (applyScore): Health reached zero. Triggering Game Over.");
            // Call the game over trigger callback provided by main.js
            if (callbacks && typeof callbacks.triggerGameOverCallback === 'function') {
                callbacks.triggerGameOverCallback(false); // Song did not finish naturally
            } else {
                console.warn("GameLogic (applyScore): triggerGameOverCallback not provided or not a function.");
            }
        } else {
            console.log("GameLogic (applyScore): Health reached zero, but No Death Mode is active. Game continues.");
        }
    }
}

/**
 * Handles the game over state (due to health depletion) or song completion.
 * Stops audio, staff animation, and updates UI button states via uiAccess.
 * It NO LONGER directly shows the score screen; that's handled by main.js after this returns.
 * This function mutates the `gameState` object.
 * @param {boolean} songFinished - True if the song completed naturally, false if game over by other means.
 * @param {object} gameState - The current game state object from main.js.
 * Expected properties: isGameOver, gameIsRunning.
 * @param {object} modules - References to other game modules.
 * Expected properties: audio, staff.
 * @param {object} uiAccess - Object containing functions for UI updates.
 * Expected properties: setPlayButtonState, setSettingsButtonState.
 */
export function triggerGameOver(songFinished, gameState, modules, uiAccess) {
    console.log(`GameLogic (triggerGameOver): Called with songFinished: ${songFinished}. Current gameState.isGameOver: ${gameState.isGameOver}`);
    // Prevent multiple game over triggers
    if (gameState.isGameOver) {
        console.warn("GameLogic (triggerGameOver): Game is already over. Ignoring call.");
        return;
    }

    console.log(songFinished ? "--- GameLogic: SONG FINISHED NATURALLY ---" : "--- GameLogic: GAME OVER (Health Depleted) ---");
    gameState.isGameOver = true;    // Set game over state
    gameState.gameIsRunning = false; // Stop game running state

    // Pause audio playback using the audio module
    if (modules && modules.audio) {
        console.log("GameLogic (triggerGameOver): Pausing audio.");
        modules.audio.pause();
    } else {
        console.warn("GameLogic (triggerGameOver): Audio module not available to pause.");
    }

    // Pause staff animation using the staff module
    if (modules && modules.staff && modules.staff.isRunning()) {
        console.log("GameLogic (triggerGameOver): Pausing staff.");
        modules.staff.pause();
    } else {
        console.warn("GameLogic (triggerGameOver): Staff module not available or not running.");
    }

    // Update UI button states via uiAccess functions provided by main.js
    const endStateText = songFinished ? "Finished" : "Game Over";
    if (uiAccess && typeof uiAccess.setPlayButtonState === 'function') {
        uiAccess.setPlayButtonState(endStateText, true); // Set text and disable
        console.log("GameLogic (triggerGameOver): Play/Pause button updated and disabled via callback.");
    } else {
        console.warn("GameLogic (triggerGameOver): setPlayButtonState function not provided in uiAccess.");
    }
    if (uiAccess && typeof uiAccess.setSettingsButtonState === 'function') {
        uiAccess.setSettingsButtonState(true); // Disable settings button
        console.log("GameLogic (triggerGameOver): Settings button disabled via callback.");
    } else {
        console.warn("GameLogic (triggerGameOver): setSettingsButtonState function not provided in uiAccess.");
    }

    // **REMOVED**: The call to show score screen is now handled in main.js *after* this function returns.
    // if (uiAccess && typeof uiAccess.showScoreScreen === 'function') {
    //     uiAccess.showScoreScreen();
    // } else {
    //     console.warn("GameLogic (triggerGameOver): showScoreScreen function not provided in uiAccess.");
    // }
    console.log("GameLogic (triggerGameOver): Game state updated, modules paused, UI buttons updated.");
}


/**
 * Resets the game state for a new game, keeping the loaded files.
 * Clears scores, health, combo, and signals main.js to reset audio/staff modules and UI.
 * This function mutates the `gameState` object.
 * @param {object} gameState - The current game state object from main.js.
 * Expected properties: playerHealth, comboCount, ..., isGameOver, gameIsRunning, audioPauseOffset.
 * @param {object} modules - References to other game modules.
 * Expected properties: audio, staff.
 * @param {object} uiAccess - Object containing functions for UI updates.
 * Expected properties: hideScoreOverlay, setPlayButtonState, setSettingsButtonState, updateInfoUI.
 */
export function restartGame(gameState, modules, uiAccess) {
    console.log("--- GameLogic (restartGame): Restarting Game ---");

    // **FIXED**: Call the hideScoreOverlay function if provided
    if (uiAccess && typeof uiAccess.hideScoreOverlay === 'function') {
        uiAccess.hideScoreOverlay();
        console.log("GameLogic (restartGame): Score overlay hidden via callback.");
    } else {
         console.warn("GameLogic (restartGame): hideScoreOverlay function not provided in uiAccess.");
    }

    // Reset game state variables within the provided gameState object
    gameState.playerHealth = INITIAL_HEALTH;
    gameState.comboCount = 0;
    gameState.totalScore = 0;
    gameState.perfectCount = 0;
    gameState.goodCount = 0;
    gameState.missCount = 0;
    gameState.maxCombo = 0;
    gameState.isGameOver = false;
    gameState.gameIsRunning = false;
    gameState.audioPauseOffset = 0; // Reset audio offset for next play
    console.log("GameLogic (restartGame): Game state variables reset in provided gameState object.");

    // Stop and reset audio module
    if (modules && modules.audio) {
        modules.audio.stop(); // Fully stop and reset audio
        console.log("GameLogic (restartGame): Audio module stop called.");
    }

    // Reset staff module (notes, time, pause state, and redraw)
    if (modules && modules.staff) {
        modules.staff.resetNotes(); // Clear hit statuses
        modules.staff.resetTime();  // Set displayTime to 0
        modules.staff.pause();      // Ensure animation loop is stopped
        modules.staff.redraw();     // Redraw initial staff state
        console.log("GameLogic (restartGame): Staff module reset and redraw called.");
    }

    // Call the UI update callback provided by main.js to refresh health/combo display
    if (uiAccess && typeof uiAccess.updateInfoUI === 'function') {
        uiAccess.updateInfoUI();
    } else {
        console.warn("GameLogic (restartGame): updateInfoUI function not provided in uiAccess.");
    }


    // Reset UI button states via uiAccess functions
    if (uiAccess && typeof uiAccess.setPlayButtonState === 'function') {
        uiAccess.setPlayButtonState("Play", false); // Set text to "Play" and enable
        console.log("GameLogic (restartGame): Play/Pause button reset via callback.");
    } else {
         console.warn("GameLogic (restartGame): setPlayButtonState function not provided in uiAccess.");
    }
    if (uiAccess && typeof uiAccess.setSettingsButtonState === 'function') {
        uiAccess.setSettingsButtonState(false); // Enable settings button
        console.log("GameLogic (restartGame): Settings button reset via callback.");
    } else {
         console.warn("GameLogic (restartGame): setSettingsButtonState function not provided in uiAccess.");
    }

    console.log("GameLogic (restartGame): Game reset process complete.");
}

console.log("GameLogic: Module loaded.");
