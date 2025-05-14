/**
 * @file gameLogic.js
 * Contains core game logic functions including scoring, game state changes,
 * and game over/restart procedures.
 */

console.log("GameLogic: Module loading...");

// --- Constants ---
export const INITIAL_HEALTH = 50;
export const MAX_HEALTH = 75;
export const MIN_HEALTH = 0;
export const ENERGY_PERFECT = 2;
export const ENERGY_GOOD = 0;
export const ENERGY_MISS = -5;

// --- Scoring & Game Logic Functions ---

export function calculateComboBonus(currentCombo) {
    if (currentCombo < 10) return 0;
    const bonus = Math.floor((currentCombo - 1) / 10);
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
    if (gameState.isGameOver) {
        // console.log("GameLogic (applyScore): Game is over, no score change.");
        return;
    }

    // Wait Mode Consideration: This function is called for the *initial miss* in Wait Mode.
    // The subsequent key press to *resume* the song in Wait Mode should NOT call this function
    // for scoring purposes. That logic is handled in staffModule/main.js.
    console.log(`GameLogic (applyScore): Processing score for hitType: ${hitType}. This is an actual scoring event.`);

    let baseEnergyChange = 0;
    let comboBroken = false;

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

    if (gameState.comboCount > gameState.maxCombo) {
        gameState.maxCombo = gameState.comboCount;
    }

    const comboBonus = comboBroken ? 0 : calculateComboBonus(gameState.comboCount);
    const totalEnergyChange = baseEnergyChange + comboBonus;

    const previousHealth = gameState.playerHealth;
    gameState.playerHealth = Math.max(MIN_HEALTH, Math.min(MAX_HEALTH, gameState.playerHealth + totalEnergyChange));
    const actualHealthChange = gameState.playerHealth - previousHealth;

    gameState.totalScore += totalEnergyChange;

    if (comboBroken) {
        if (gameState.comboCount > 0) {
            console.log(`GameLogic (applyScore): Combo Broken! Was: ${gameState.comboCount}`);
        }
        gameState.comboCount = 0;
    }

    console.log(`GameLogic (applyScore): Event: ${hitType.toUpperCase()} | Combo: ${gameState.comboCount} (Max: ${gameState.maxCombo}) | Bonus: ${comboBonus} | Health Change: ${actualHealthChange} (Raw Energy: ${totalEnergyChange}) | Health: ${gameState.playerHealth}/${MAX_HEALTH} | Score: ${gameState.totalScore} | P:${gameState.perfectCount} G:${gameState.goodCount} M:${gameState.missCount}`);

    if (callbacks && typeof callbacks.updateUICallback === 'function') {
        callbacks.updateUICallback();
    } else {
        console.warn("GameLogic (applyScore): updateUICallback not provided or not a function.");
    }

    if (gameState.playerHealth <= MIN_HEALTH && !gameState.isGameOver) {
        if (!gameState.noDeathMode) {
            console.log("GameLogic (applyScore): Health reached zero. Triggering Game Over.");
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
 * Handles the game over state or song completion.
 * Stops audio, staff animation, and updates UI button states via uiAccess.
 * @param {boolean} songFinished - True if the song completed naturally.
 * @param {object} gameState - The current game state object from main.js.
 * @param {object} modules - References to other game modules (audio, staff).
 * @param {object} uiAccess - Object containing functions for UI updates.
 */
export function triggerGameOver(songFinished, gameState, modules, uiAccess) {
    console.log(`GameLogic (triggerGameOver): Called with songFinished: ${songFinished}. Current gameState.isGameOver: ${gameState.isGameOver}`);
    if (gameState.isGameOver) {
        console.warn("GameLogic (triggerGameOver): Game is already over. Ignoring call.");
        return;
    }

    console.log(songFinished ? "--- GameLogic: SONG FINISHED NATURALLY ---" : "--- GameLogic: GAME OVER (Health Depleted or Quit) ---");
    gameState.isGameOver = true;
    gameState.gameIsRunning = false; // Game is no longer running

    // Wait Mode Consideration: If game over happens (e.g. player quits from a pause menu)
    // while in a wait mode pause, the audio and staff are already "paused" in a sense.
    // Calling pause() again should be safe.
    if (modules && modules.audio) {
        console.log("GameLogic (triggerGameOver): Pausing audio.");
        modules.audio.pause(); // Ensure audio is paused
    } else {
        console.warn("GameLogic (triggerGameOver): Audio module not available to pause.");
    }

    if (modules && modules.staff) {
        // Staff module's animation loop will stop on its own if isGameOver becomes true.
        // We can also explicitly tell it to pause its internal state if needed,
        // but its animation loop already checks main.js's isGameOver.
        // Forcing a staff.pause() here ensures its internal `isStaffRunning` is false.
        console.log("GameLogic (triggerGameOver): Pausing staff.");
        modules.staff.pause();
    } else {
        console.warn("GameLogic (triggerGameOver): Staff module not available or not running.");
    }

    const endStateText = songFinished ? "Finished" : "Game Over";
    if (uiAccess && typeof uiAccess.setPlayButtonState === 'function') {
        uiAccess.setPlayButtonState(endStateText, true);
        console.log("GameLogic (triggerGameOver): Play/Pause button updated and disabled.");
    } else {
        console.warn("GameLogic (triggerGameOver): setPlayButtonState function not provided.");
    }
    if (uiAccess && typeof uiAccess.setSettingsButtonState === 'function') {
        uiAccess.setSettingsButtonState(true); // Disable settings button
        console.log("GameLogic (triggerGameOver): Settings button disabled.");
    } else {
        console.warn("GameLogic (triggerGameOver): setSettingsButtonState function not provided.");
    }
    console.log("GameLogic (triggerGameOver): Game state updated, modules paused, UI buttons updated.");
}


/**
 * Resets the game state for a new game.
 * @param {object} gameState - The current game state object from main.js.
 * @param {object} modules - References to other game modules.
 * @param {object} uiAccess - Object containing functions for UI updates.
 */
export function restartGame(gameState, modules, uiAccess) {
    console.log("--- GameLogic (restartGame): Restarting Game ---");

    if (uiAccess && typeof uiAccess.hideScoreOverlay === 'function') {
        uiAccess.hideScoreOverlay();
        console.log("GameLogic (restartGame): Score overlay hidden.");
    } else {
         console.warn("GameLogic (restartGame): hideScoreOverlay function not provided.");
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
    gameState.gameIsRunning = false; // Game is not running after restart
    gameState.audioPauseOffset = 0;

    // Wait Mode states are reset in main.js's handleRestart directly.
    // No need to handle waitModeActive, isWaitingForKeyPress, waitingForNote here.
    console.log("GameLogic (restartGame): Game state variables reset in provided gameState object.");

    if (modules && modules.audio) {
        modules.audio.stop(); // Fully stop and reset audio
        console.log("GameLogic (restartGame): Audio module stop called.");
    }

    if (modules && modules.staff) {
        modules.staff.resetNotes();
        modules.staff.resetTime();
        modules.staff.pause();      // Ensure animation loop is stopped and isStaffRunning is false
        modules.staff.redraw();
        console.log("GameLogic (restartGame): Staff module reset and redraw called.");
    }

    if (uiAccess && typeof uiAccess.updateInfoUI === 'function') {
        uiAccess.updateInfoUI(); // main.js will pass its own updated state to this
    } else {
        console.warn("GameLogic (restartGame): updateInfoUI function not provided.");
    }

    if (uiAccess && typeof uiAccess.setPlayButtonState === 'function') {
        uiAccess.setPlayButtonState("Play", false);
        console.log("GameLogic (restartGame): Play/Pause button reset.");
    } else {
         console.warn("GameLogic (restartGame): setPlayButtonState function not provided.");
    }
    if (uiAccess && typeof uiAccess.setSettingsButtonState === 'function') {
        uiAccess.setSettingsButtonState(false);
        console.log("GameLogic (restartGame): Settings button reset.");
    } else {
         console.warn("GameLogic (restartGame): setSettingsButtonState function not provided.");
    }

    console.log("GameLogic (restartGame): Game reset process complete.");
}

console.log("GameLogic: Module loaded.");
