// main.js

console.log("--- main.js started execution ---");

/**
 * @file main.js
 * Main entry point and orchestrator for the Keytap game.
 * Loads modules, initializes the game, handles global state and UI updates.
 * Designed to be loaded as an ES Module (<script type="module">).
 */


// --- Module Imports ---
console.log("Main: Importing modules...");
// Import necessary functions/objects from other modules
// Adjust paths/URLs as necessary
import * as audio from './audioModule.js';
import { init as initKeyboard } from './keyboardModule.js';
import * as staff from './staffModule.js'; // Import the new staff module
import { getMidiNoteColor } from './midiColorConverter.js';
console.log("Main: Modules imported.");


// --- Global Variables & State (Module-Scoped within main.js) ---
// Export values needed by other modules (like staffModule.js)
console.log("Main: Defining global variables and state...");

// Game Settings & Constants
export const INITIAL_HEALTH = 50;
console.log(`Main: INITIAL_HEALTH set to ${INITIAL_HEALTH}`);
export const MAX_HEALTH = 75;
console.log(`Main: MAX_HEALTH set to ${MAX_HEALTH}`);
export const MIN_HEALTH = 0;
console.log(`Main: MIN_HEALTH set to ${MIN_HEALTH}`);
export const PRE_DELAY_SECONDS = 1.0; // Delay before audio starts (used by staffModule via import)
console.log(`Main: PRE_DELAY_SECONDS set to ${PRE_DELAY_SECONDS}`);

// Scoring Constants (Can be moved to gameLogic.js later)
const ENERGY_PERFECT = 2;
const ENERGY_GOOD = 0; // In this version, good hits give 0 energy, only combo.
const ENERGY_MISS = -5;
console.log(`Main: Scoring constants - Perfect: ${ENERGY_PERFECT}, Good: ${ENERGY_GOOD}, Miss: ${ENERGY_MISS}`);

// Default values (can be changed in settings)
// Export if needed by other modules (staffModule needs SCROLL_SPEED)
export let SCROLL_SPEED_PIXELS_PER_SECOND = 120;
console.log(`Main: Initial SCROLL_SPEED_PIXELS_PER_SECOND: ${SCROLL_SPEED_PIXELS_PER_SECOND}`);
let HIT_WINDOW_GOOD_MS = 140; // Settings value
console.log(`Main: Initial HIT_WINDOW_GOOD_MS: ${HIT_WINDOW_GOOD_MS}`);


// Derived timing values (updated when HIT_WINDOW_GOOD_MS changes)
// Export if needed by other modules (staffModule needs these)
export let HIT_WINDOW_PERFECT_MS = HIT_WINDOW_GOOD_MS / 2;
export let HIT_WINDOW_GOOD_SEC = HIT_WINDOW_GOOD_MS / 1000.0;
export let HIT_WINDOW_PERFECT_SEC = HIT_WINDOW_PERFECT_MS / 1000.0;
console.log(`Main: Initial derived timing - Perfect MS: ${HIT_WINDOW_PERFECT_MS}, Good SEC: ${HIT_WINDOW_GOOD_SEC}, Perfect SEC: ${HIT_WINDOW_PERFECT_SEC}`);


// Game State Variables
let comboCount = 0;
let playerHealth = INITIAL_HEALTH;
let totalScore = 0;
let perfectCount = 0;
let goodCount = 0;
let missCount = 0;
let maxCombo = 0;
let totalNotesInSong = 0; // Calculated after notes are loaded
export let useColoredNotes = false; // Export state needed by staffModule
export let noDeathMode = false; // Export state needed by applyScore
export let gameIsRunning = false; // Main flag for paused/playing state - Exported via function isGameRunning
export let isGameOver = false;    // Flag for game over state - Exported via function isGameOver
let gameInitialized = false; // **FIX:** Declare and initialize gameInitialized
console.log(`Main: Initial game state - combo: ${comboCount}, health: ${playerHealth}, score: ${totalScore}, coloredNotes: ${useColoredNotes}, noDeath: ${noDeathMode}, gameRunning: ${gameIsRunning}, gameOver: ${isGameOver}, gameInitialized: ${gameInitialized}`);


// File Loading State
let audioFileBuffer = null;
let notesJsonData = null;
let audioFileLoaded = false;
let notesFileLoaded = false;
console.log(`Main: Initial file loading state - audioLoaded: ${audioFileLoaded}, notesLoaded: ${notesFileLoaded}`);

// Audio Playback State
// This is now managed internally by staffModule dragging via a callback
let audioPauseOffset = 0;
console.log(`Main: Initial audioPauseOffset: ${audioPauseOffset}`);


// --- Global DOM Element References ---
// Assigned in window.onload listener
console.log("Main: Declaring DOM element reference variables.");
let loadingScreen, audioFileInput, notesFileInput, loadingStatus, startButton;
let gameContainer, infoSection, staffSection, bottomPanel, keyboardSection;
let playPauseButton, settingsButton, comboCountSpan, healthBarElement;
let settingsOverlay, colorToggleSwitch, noDeathToggleSwitch, closeSettingsButton;
let staffScaleValueSpan, staffScaleDownButton, staffScaleUpButton;
let hitWindowValueSpan, hitWindowDownButton, hitWindowUpButton;
let scoreOverlay, scorePerfectCount, scorePerfectPercent, scoreGoodCount, scoreGoodPercent;
let scoreMissCount, scoreMissPercent, scoreMaxCombo, scoreTotalScore, restartButton;


// --- Scoring & Game Logic Functions ---
// To be moved to gameLogic.js later...
console.log("Main: Defining scoring and game logic functions.");

/**
 * Calculates the combo bonus energy based on the current combo count.
 * @param {number} currentCombo - The current number of consecutive non-missed notes.
 * @returns {number} The energy bonus to be added.
 */
function calculateComboBonus(currentCombo) {
    // No bonus for combos less than 10
    if (currentCombo < 10) return 0;
    // Bonus is 1 for 10-19, 2 for 20-29, etc.
    const bonus = Math.floor((currentCombo - 1) / 10);
    // console.log(`Main (calculateComboBonus): Combo: ${currentCombo}, Bonus: ${bonus}`);
    return bonus;
}

/**
 * Applies scoring changes based on hit type (perfect, good, miss).
 * Updates player health, combo, total score, and individual hit counts.
 * This function is exported for use by staffModule.
 * @param {string} hitType - The type of hit: 'perfect', 'good', or 'miss'.
 */
export function applyScore(hitType) {
    // console.log(`Main (applyScore): Received hitType: ${hitType}, isGameOver: ${isGameOver}`);
    // Do nothing if the game is already over
    if (isGameOver) {
        // console.log("Main (applyScore): Game is over, no score change.");
        return;
    }

    let baseEnergyChange = 0;
    let comboBroken = false;

    // Determine base energy change and update counts based on hit type
    if (hitType === 'perfect') {
        perfectCount++;
        comboCount++;
        baseEnergyChange = ENERGY_PERFECT;
    } else if (hitType === 'good') {
        goodCount++;
        comboCount++;
        baseEnergyChange = ENERGY_GOOD; // Good hits might not change energy directly but sustain combo
    } else if (hitType === 'miss') {
        missCount++;
        comboBroken = true;
        baseEnergyChange = ENERGY_MISS;
    }

    // Update max combo if current combo is higher
    if (comboCount > maxCombo) {
        maxCombo = comboCount;
    }

    // Calculate combo bonus (only if combo is not broken)
    const comboBonus = comboBroken ? 0 : calculateComboBonus(comboCount);
    const totalEnergyChange = baseEnergyChange + comboBonus;

    // Update player health, ensuring it stays within MIN_HEALTH and MAX_HEALTH
    const previousHealth = playerHealth;
    playerHealth = Math.max(MIN_HEALTH, Math.min(MAX_HEALTH, playerHealth + totalEnergyChange));
    const actualHealthChange = playerHealth - previousHealth; // How much health actually changed

    // Update total score
    totalScore += totalEnergyChange; // Score can go up or down

    // Reset combo if broken
    if (comboBroken) {
        if (comboCount > 0) { // Log only if there was an active combo
            console.log(`Main (applyScore): Combo Broken! Was: ${comboCount}`);
        }
        comboCount = 0;
    }

    console.log(`Main (applyScore): Event: ${hitType.toUpperCase()} | Combo: ${comboCount} (Max: ${maxCombo}) | Bonus: ${comboBonus} | Health Change: ${actualHealthChange} (Raw Energy: ${totalEnergyChange}) | Health: ${playerHealth}/${MAX_HEALTH} | Score: ${totalScore} | P:${perfectCount} G:${goodCount} M:${missCount}`);

    updateInfoUI(); // Update the UI elements (health bar, combo display)

    // Check for Game Over condition
    if (playerHealth <= MIN_HEALTH && !isGameOver) {
        if (!noDeathMode) { // Access noDeathMode directly from module scope
            console.log("Main (applyScore): Health reached zero. Triggering Game Over.");
            triggerGameOver(false); // Song did not finish naturally
        } else {
            console.log("Main (applyScore): Health reached zero, but No Death Mode is active. Game continues.");
        }
    }
}


/**
 * Handles the game over state (due to health depletion) or song completion.
 * Stops audio, staff animation, and displays the score screen.
 * This function is exported for use by audioModule's onSongEnd callback.
 * @param {boolean} songFinished - True if the song completed naturally, false if game over by other means (e.g., health).
 */
export function triggerGameOver(songFinished) {
    console.log(`Main (triggerGameOver): Called with songFinished: ${songFinished}. Current isGameOver: ${isGameOver}`);
    // Prevent multiple game over triggers
    if (isGameOver) {
        console.warn("Main (triggerGameOver): Game is already over. Ignoring call.");
        return;
    }

    console.log(songFinished ? "--- Main: SONG FINISHED NATURALLY ---" : "--- Main: GAME OVER (Health Depleted) ---");
    isGameOver = true;    // Set game over state
    gameIsRunning = false; // Stop game running state

    // Pause audio playback using the imported audio module
    if (audio) {
        console.log("Main (triggerGameOver): Pausing audio.");
        audio.pause(); // audio.stop() might be better to reset completely
    } else {
        console.warn("Main (triggerGameOver): Audio module not available to pause.");
    }

    // Pause staff animation using the imported staff module
    if (staff && staff.isRunning()) {
        console.log("Main (triggerGameOver): Pausing staff.");
        staff.pause(); // Call imported staff function
    } else {
        console.warn("Main (triggerGameOver): Staff module not available or not running.");
    }

    // Update UI elements
    if (playPauseButton) {
        playPauseButton.textContent = songFinished ? "Finished" : "Game Over";
        playPauseButton.disabled = true;
        console.log("Main (triggerGameOver): Play/Pause button updated and disabled.");
    }
    if (settingsButton) {
        settingsButton.disabled = true;
        console.log("Main (triggerGameOver): Settings button disabled.");
    }

    showScoreScreen(); // Display the final score screen
}


/**
 * Resets the game state for a new game.
 * Clears scores, health, combo, and resets audio/staff modules.
 */
function restartGame() {
    console.log("--- Main (restartGame): Restarting Game ---");

    // Hide score overlay if visible
    if (scoreOverlay) {
        scoreOverlay.classList.remove('visible');
        console.log("Main (restartGame): Score overlay hidden.");
    }

    // Reset game state variables
    playerHealth = INITIAL_HEALTH;
    comboCount = 0;
    totalScore = 0;
    perfectCount = 0;
    goodCount = 0;
    missCount = 0;
    maxCombo = 0;
    isGameOver = false;
    gameIsRunning = false;
    audioPauseOffset = 0; // Reset audio offset for next play
    console.log("Main (restartGame): Game state variables reset.");

    // Stop and reset audio module
    if (audio) {
        audio.stop(); // Fully stop and reset audio
        console.log("Main (restartGame): Audio module stopped.");
    }

    // Reset staff module (notes, time, pause state, and redraw)
    if (staff) {
        staff.resetNotes(); // Clear hit statuses
        staff.resetTime();  // Set displayTime to 0
        staff.pause();      // Ensure animation loop is stopped
        staff.redraw();     // Redraw initial staff state
        console.log("Main (restartGame): Staff module reset and redrawn.");
    }

    updateInfoUI(); // Update health bar and combo display

    // Reset UI button states
    if (playPauseButton) {
        playPauseButton.textContent = "Play";
        playPauseButton.disabled = false;
        console.log("Main (restartGame): Play/Pause button reset.");
    }
    if (settingsButton) {
        settingsButton.disabled = false;
        console.log("Main (restartGame): Settings button reset.");
    }

    console.log("Main (restartGame): Game reset complete. Ready for new file selection or start.");
    // Note: This function doesn't automatically go back to the loading screen.
    // That's handled by the "Restart" button on the score screen which reloads the page or re-shows loading.
    // For a true in-app restart without reload, you'd hide gameContainer and show loadingScreen.
}


// --- UI Update Functions ---
// To be moved to ui.js later...
console.log("Main: Defining UI update functions.");

/** Updates the health bar and combo display on the UI. */
function updateInfoUI() {
    // console.log("Main (updateInfoUI): Updating health and combo display.");
    if (comboCountSpan) {
        comboCountSpan.textContent = comboCount;
    }
    if (healthBarElement) {
        const healthPercentage = Math.max(0, Math.min(100, (playerHealth / MAX_HEALTH) * 100));
        healthBarElement.style.width = `${healthPercentage}%`;

        // Change health bar color based on percentage
        if (healthPercentage <= 0) { // Should ideally not happen if game over triggers correctly
            healthBarElement.style.backgroundColor = '#555555'; // Dark grey for empty
        } else if (healthPercentage < 25) {
            healthBarElement.style.backgroundColor = '#f44336'; // Red for low health
        } else if (healthPercentage < 50) {
            healthBarElement.style.backgroundColor = '#ff9800'; // Orange for medium-low health
        } else {
            healthBarElement.style.backgroundColor = '#4CAF50'; // Green for good health
        }
    }
}

/** Updates the displayed values in the settings panel based on current state. */
function updateSettingsUI() {
    console.log("Main (updateSettingsUI): Updating settings panel UI values.");
    updateTimingWindows(); // Recalculate derived timing windows first

    if (staffScaleValueSpan) {
        staffScaleValueSpan.textContent = SCROLL_SPEED_PIXELS_PER_SECOND;
    }
    if (hitWindowValueSpan) {
        hitWindowValueSpan.textContent = HIT_WINDOW_GOOD_MS;
    }
    if (colorToggleSwitch) {
        colorToggleSwitch.checked = useColoredNotes;
    }
    if (noDeathToggleSwitch) {
        noDeathToggleSwitch.checked = noDeathMode;
    }
    console.log("Main (updateSettingsUI): Settings UI update complete.");
}

/** Calculates and displays the final score screen. */
function showScoreScreen() {
    console.log("Main (showScoreScreen): Preparing and displaying score screen.");
    if (!scoreOverlay) {
        console.error("Main (showScoreScreen): Score overlay element not found!");
        return;
    }

    // Calculate total notes processed. Fallback to sum of hits if totalNotesInSong wasn't set.
    const processedNotes = perfectCount + goodCount + missCount;
    const totalNotesForPercentage = totalNotesInSong > 0 ? totalNotesInSong : processedNotes;
    console.log(`Main (showScoreScreen): totalNotesInSong: ${totalNotesInSong}, processedNotes: ${processedNotes}, totalNotesForPercentage: ${totalNotesForPercentage}`);


    // Calculate percentages
    const perfectPercent = totalNotesForPercentage > 0 ? ((perfectCount / totalNotesForPercentage) * 100).toFixed(1) : "0.0";
    const goodPercent = totalNotesForPercentage > 0 ? ((goodCount / totalNotesForPercentage) * 100).toFixed(1) : "0.0";
    const missPercent = totalNotesForPercentage > 0 ? ((missCount / totalNotesForPercentage) * 100).toFixed(1) : "0.0";

    // Update score screen DOM elements
    if(scorePerfectCount) scorePerfectCount.textContent = perfectCount;
    if(scorePerfectPercent) scorePerfectPercent.textContent = perfectPercent;
    if(scoreGoodCount) scoreGoodCount.textContent = goodCount;
    if(scoreGoodPercent) scoreGoodPercent.textContent = goodPercent;
    if(scoreMissCount) scoreMissCount.textContent = missCount;
    if(scoreMissPercent) scoreMissPercent.textContent = missPercent;
    if(scoreMaxCombo) scoreMaxCombo.textContent = maxCombo;
    if(scoreTotalScore) scoreTotalScore.textContent = totalScore;

    scoreOverlay.classList.add('visible'); // Make the score overlay visible
    console.log("Main (showScoreScreen): Score screen displayed.");
}


// --- Layout & Timing Functions ---
// To be moved later...
console.log("Main: Defining layout and timing functions.");

/** Handles layout adjustments on orientation change or resize. */
function handleLayoutChange() {
    console.log("Main (handleLayoutChange): Adjusting layout for orientation/resize.");
    if (!gameContainer || !infoSection || !staffSection || !bottomPanel || !keyboardSection) {
        console.error("Main (handleLayoutChange): Essential layout containers not found. Cannot adjust layout.");
        return;
    }

    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    console.log(`Main (handleLayoutChange): Detected orientation: ${isLandscape ? 'landscape' : 'portrait'}`);

    if (isLandscape) {
        // Landscape: Info section moves into the bottom panel, to the left of the keyboard
        if (infoSection.parentElement !== bottomPanel) { // Check to avoid redundant moves
            console.log("Main (handleLayoutChange): Moving infoSection to bottomPanel for landscape.");
            bottomPanel.insertBefore(infoSection, keyboardSection); // Insert info before keyboard
        }
    } else {
        // Portrait: Info section moves to the top of the game container
        if (infoSection.parentElement === bottomPanel) { // Check to avoid redundant moves
            console.log("Main (handleLayoutChange): Moving infoSection to gameContainer for portrait.");
            gameContainer.insertBefore(infoSection, staffSection); // Insert info before staff
        }
    }

    // Trigger resize in staff module after a short delay to allow layout to settle
    if (staff && typeof staff.handleResize === 'function') {
        console.log("Main (handleLayoutChange): Scheduling staff.handleResize.");
        setTimeout(() => {
            console.log("Main (handleLayoutChange): Calling staff.handleResize now.");
            staff.handleResize(); // Call imported function from staffModule
        }, 50); // Small delay
    } else {
        console.warn("Main (handleLayoutChange): staff.handleResize function not available or staff module not ready.");
    }
    console.log("Main (handleLayoutChange): Layout adjustment attempt complete.");
}

/**
 * Recalculates derived timing window variables (in MS and seconds).
 * This function is exported as these variables are used by staffModule.
 */
export function updateTimingWindows() {
    HIT_WINDOW_PERFECT_MS = Math.floor(HIT_WINDOW_GOOD_MS / 2); // Perfect is half of good
    HIT_WINDOW_GOOD_SEC = HIT_WINDOW_GOOD_MS / 1000.0;
    HIT_WINDOW_PERFECT_SEC = HIT_WINDOW_PERFECT_MS / 1000.0;
    console.log(`Main (updateTimingWindows): Timing windows updated: Good=${HIT_WINDOW_GOOD_MS}ms (${HIT_WINDOW_GOOD_SEC.toFixed(3)}s), Perfect=${HIT_WINDOW_PERFECT_MS}ms (${HIT_WINDOW_PERFECT_SEC.toFixed(3)}s)`);
}


// --- Game Initialization ---
console.log("Main: Defining game initialization functions.");

/**
 * Initializes all game modules (Audio, Staff, Keyboard) and sets up event listeners
 * AFTER audio and notes files have been successfully loaded and parsed.
 * @param {ArrayBuffer} loadedAudioBuffer - The decoded audio data.
 * @param {object} loadedNoteData - The parsed JSON object containing note map data.
 */
async function initializeGame(loadedAudioBuffer, loadedNoteData) {
    console.log("Main (initializeGame): Attempting to initialize game.");
    // Prevent re-initialization if already done
    if (gameInitialized) {
        console.warn("Main (initializeGame): Game already initialized. Skipping.");
        return;
    }
    console.log("--- Main: Initializing Keytap Game ---");

    if(loadingStatus) loadingStatus.textContent = "Initializing audio...";

    // Calculate totalNotesInSong from the loaded note data
    // This is used for score percentage calculations.
    totalNotesInSong = loadedNoteData?.tracks?.[0]?.notes?.length || 0;
    console.log(`Main (initializeGame): Total notes in song calculated: ${totalNotesInSong}`);


    // 1. Initialize Audio Module (imported)
    console.log("Main (initializeGame): Initializing Audio Module...");
    // Define a callback for when the song ends naturally
    const handleSongEnd = () => {
        console.log("Main (initializeGame - handleSongEnd): Song ended naturally (callback from audioModule).");
        if (!isGameOver) { // Only trigger game over if not already over
            triggerGameOver(true); // True indicates song finished
        }
    };
    const audioInitialized = await audio.init(loadedAudioBuffer, handleSongEnd);
    if (!audioInitialized) {
        console.error("Main (initializeGame): Audio module initialization failed.");
        if(loadingStatus) loadingStatus.textContent = "Error: Failed to decode audio.";
        if(startButton) startButton.disabled = false; // Re-enable start button on failure
        return; // Stop initialization
    }
    console.log("Main (initializeGame): Audio Module initialized successfully.");

    if(loadingStatus) loadingStatus.textContent = "Initializing visuals...";

    // 2. Initialize Staff Module (imported)
    console.log("Main (initializeGame): Initializing Staff Module...");
    const staffInitialized = staff.init({ // Call imported init function from staffModule
        noteDataJson: loadedNoteData,
        staffSectionElement: staffSection, // Pass the DOM element for staff container
        setAudioPauseOffset: (newOffset) => { // Provide a callback to update main's audioPauseOffset
            console.log(`Main (initializeGame - staffCallback): audioPauseOffset updated to ${newOffset} by staffModule.`);
            audioPauseOffset = newOffset;
        }
    });
    if (!staffInitialized) {
        console.error("Main (initializeGame): Staff module initialization failed.");
        if(loadingStatus) loadingStatus.textContent = "Error: Failed to process notes file.";
        // Potentially stop audio if staff fails: if (audio) audio.stop();
        return; // Stop initialization
    }
    console.log("Main (initializeGame): Staff Module initialized successfully.");

    // 3. Initialize Keyboard Module (imported)
    console.log("Main (initializeGame): Initializing Keyboard Module...");
    initKeyboard({ // Call imported init function from keyboardModule
        judgeKeyPressFunc: staff.judgeKeyPress, // Pass staffModule's judgeKeyPress function
        isGameOverFunc: () => isGameOver,        // Provide a function that returns current isGameOver state
        isGameRunningFunc: () => gameIsRunning,  // Provide a function that returns current gameIsRunning state
        // resumeAudioContextFunc is no longer passed; keyboardModule imports it directly.
    });
    console.log("Main (initializeGame): Keyboard Module initialized successfully.");

    // 4. Set initial UI states
    console.log("Main (initializeGame): Updating initial UI states.");
    updateInfoUI();     // Update health bar, combo
    updateSettingsUI(); // Update settings display, which also calls updateTimingWindows

    // 5. Set initial layout based on current orientation/size
    console.log("Main (initializeGame): Performing initial layout adjustment.");
    handleLayoutChange();

    // 6. Add Global Event Listeners for game controls, settings, etc.
    console.log("Main (initializeGame): Setting up global event listeners.");
    setupGlobalEventListeners();

    gameInitialized = true; // Mark game as initialized
    console.log("--- Main: Keytap Game Initialization Complete ---");
    if(loadingStatus) loadingStatus.textContent = "Ready!";
}

/** Sets up global event listeners for buttons, settings, orientation changes, etc. */
function setupGlobalEventListeners() {
    console.log("Main (setupGlobalEventListeners): Setting up global event listeners...");

    // Play/Pause Button
    if (playPauseButton && staff && audio) {
        playPauseButton.addEventListener('click', () => {
            console.log("Main: Play/Pause button clicked.");
            if (isGameOver) {
                console.log("Main: Game is over, Play/Pause button does nothing.");
                return;
            }
            // Ensure AudioContext is resumed (especially after user interaction)
            audio.resumeContext().then(() => {
                console.log("Main: AudioContext resumed (or was already running).");
                if (gameIsRunning) {
                    // Pause the game
                    audioPauseOffset = staff.pause(); // staff.pause also pauses audio via its internal logic
                    playPauseButton.textContent = "Play";
                    gameIsRunning = false;
                    console.log(`Main: Game Paused. Audio offset: ${audioPauseOffset.toFixed(3)}`);
                } else {
                    // Play/Resume the game
                    staff.play(audioPauseOffset); // staff.play also starts/resumes audio
                    playPauseButton.textContent = "Pause";
                    gameIsRunning = true;
                    console.log(`Main: Game Playing/Resumed. Audio offset: ${audioPauseOffset.toFixed(3)}`);
                }
            }).catch(e => console.error("Main: Failed to resume AudioContext on play/pause:", e));
        });
        console.log("Main (setupGlobalEventListeners): Play/Pause button listener attached.");
    } else {
        console.warn("Main (setupGlobalEventListeners): Play/Pause button or required modules (staff, audio) not found. Listener not attached.");
    }

    // Settings Button
    if (settingsButton && settingsOverlay && staff && audio) {
        settingsButton.addEventListener('click', () => {
            console.log("Main: Settings button clicked.");
            if (isGameOver) {
                console.log("Main: Game is over, Settings button does nothing.");
                return;
            }
            console.log("Main: Opening settings overlay.");
            if (gameIsRunning) {
                // Pause game if it's running when settings are opened
                audioPauseOffset = staff.pause(); // staff.pause also pauses audio
                if(playPauseButton) playPauseButton.textContent = "Play";
                gameIsRunning = false;
                console.log("Main: Game paused to open settings. Audio offset: " + audioPauseOffset.toFixed(3));
            }
            updateSettingsUI(); // Ensure settings display current values
            settingsOverlay.classList.add('visible');
        });
        console.log("Main (setupGlobalEventListeners): Settings button listener attached.");
    } else {
        console.warn("Main (setupGlobalEventListeners): Settings button, overlay, or required modules not found. Listener not attached.");
    }

    // Close Settings Button
    if (closeSettingsButton && settingsOverlay) {
        closeSettingsButton.addEventListener('click', () => {
            console.log("Main: Close Settings button clicked.");
            settingsOverlay.classList.remove('visible');
            console.log("Main: Settings overlay closed.");
            // If game was paused for settings, it remains paused. User needs to press Play.
            // Redraw staff if it was paused, to reflect any visual changes from settings.
            if (!gameIsRunning && staff) {
                console.log("Main: Redrawing staff after closing settings (game is paused).");
                staff.redraw();
            }
        });
        console.log("Main (setupGlobalEventListeners): Close Settings button listener attached.");
    } else {
        console.warn("Main (setupGlobalEventListeners): Close Settings button or overlay not found. Listener not attached.");
    }

     // Settings: Color Toggle Switch
     if (colorToggleSwitch && staff) {
         colorToggleSwitch.addEventListener('change', (event) => {
             useColoredNotes = event.target.checked;
             console.log(`Main: Color notes setting changed to: ${useColoredNotes}`);
             // If staff module is initialized, redraw it to reflect the change
             if (staff) {
                 staff.redraw();
                 console.log("Main: Staff redrawn due to color toggle change.");
             }
         });
         console.log("Main (setupGlobalEventListeners): Color toggle switch listener attached.");
     } else {
         console.warn("Main (setupGlobalEventListeners): Color toggle switch or staff module not found. Listener not attached.");
     }

     // Settings: No Death Mode Toggle Switch
     if (noDeathToggleSwitch) {
         noDeathToggleSwitch.addEventListener('change', (event) => {
             noDeathMode = event.target.checked;
             console.log(`Main: No Death Mode setting changed to: ${noDeathMode}`);
         });
         console.log("Main (setupGlobalEventListeners): No Death Mode toggle listener attached.");
     } else {
         console.warn("Main (setupGlobalEventListeners): No Death Mode toggle switch not found. Listener not attached.");
     }

     // Settings: Staff Scale Adjustment
     const STAFF_SCALE_STEP = 10;
     const STAFF_SCALE_MIN = 50;
     const STAFF_SCALE_MAX = 200;
     if (staffScaleDownButton && staffScaleUpButton && staff) {
         staffScaleDownButton.addEventListener('click', () => {
             SCROLL_SPEED_PIXELS_PER_SECOND = Math.max(STAFF_SCALE_MIN, SCROLL_SPEED_PIXELS_PER_SECOND - STAFF_SCALE_STEP);
             console.log(`Main: Staff scale decreased to: ${SCROLL_SPEED_PIXELS_PER_SECOND}`);
             updateSettingsUI(); // Update display
             if (staff) staff.redraw(); // Redraw staff
         });
         staffScaleUpButton.addEventListener('click', () => {
             SCROLL_SPEED_PIXELS_PER_SECOND = Math.min(STAFF_SCALE_MAX, SCROLL_SPEED_PIXELS_PER_SECOND + STAFF_SCALE_STEP);
             console.log(`Main: Staff scale increased to: ${SCROLL_SPEED_PIXELS_PER_SECOND}`);
             updateSettingsUI(); // Update display
             if (staff) staff.redraw(); // Redraw staff
         });
         console.log("Main (setupGlobalEventListeners): Staff scale adjustment listeners attached.");
     } else {
         console.warn("Main (setupGlobalEventListeners): Staff scale buttons or staff module not found. Listeners not attached.");
     }

     // Settings: Hit Window Adjustment
     const HIT_WINDOW_STEP = 5; // Adjust in 5ms increments
     const HIT_WINDOW_MIN = 30;  // Minimum 30ms good window
     const HIT_WINDOW_MAX = 200; // Maximum 200ms good window
     if (hitWindowDownButton && hitWindowUpButton) {
         hitWindowDownButton.addEventListener('click', () => {
             HIT_WINDOW_GOOD_MS = Math.max(HIT_WINDOW_MIN, HIT_WINDOW_GOOD_MS - HIT_WINDOW_STEP);
             console.log(`Main: Hit window decreased to: ${HIT_WINDOW_GOOD_MS}ms`);
             updateSettingsUI(); // This calls updateTimingWindows()
             // No need to redraw staff unless it visually represents hit windows, which it doesn't.
         });
         hitWindowUpButton.addEventListener('click', () => {
             HIT_WINDOW_GOOD_MS = Math.min(HIT_WINDOW_MAX, HIT_WINDOW_GOOD_MS + HIT_WINDOW_STEP);
             console.log(`Main: Hit window increased to: ${HIT_WINDOW_GOOD_MS}ms`);
             updateSettingsUI(); // This calls updateTimingWindows()
         });
         console.log("Main (setupGlobalEventListeners): Hit window adjustment listeners attached.");
     } else {
         console.warn("Main (setupGlobalEventListeners): Hit window buttons not found. Listeners not attached.");
     }

     // Score Screen: Restart Button
     if (restartButton) {
         restartButton.addEventListener('click', () => {
            console.log("Main: Restart button (on score screen) clicked.");
            // A common way to "restart" a single-page app like this is to reload the page.
            // This ensures all state is truly reset.
            // Alternatively, implement a more complex state reset and transition back to loadingScreen.
            // For now, let's use location.reload() for simplicity.
            // restartGame(); // This resets state but doesn't go back to loading screen.
            // To go back to loading screen:
            // 1. Call restartGame()
            // 2. Hide gameContainer, show loadingScreen
            // 3. Reset file inputs, etc.
            // For now, a reload is cleaner.
            console.log("Main: Reloading the page to restart.");
            window.location.reload();
         });
         console.log("Main (setupGlobalEventListeners): Restart button listener attached.");
     } else {
         console.warn("Main (setupGlobalEventListeners): Restart button not found. Listener not attached.");
     }

    // Orientation Change Listener
    // Using modern addEventListener for matchMedia
    const mediaQueryList = window.matchMedia("(orientation: landscape)");
    mediaQueryList.addEventListener("change", handleLayoutChange);
    console.log("Main (setupGlobalEventListeners): Orientation change listener attached.");


    // Window Resize Listener (Debounced to avoid excessive calls)
    let resizeTimeout;
    window.addEventListener('resize', () => {
        // console.log("Main: Window resize event detected."); // Can be very noisy
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            console.log("Main: Executing debounced resize handling.");
            handleLayoutChange();
        }, 150); // Adjust debounce delay as needed (e.g., 150-250ms)
    });
    console.log("Main (setupGlobalEventListeners): Window resize listener attached.");

    console.log("Main (setupGlobalEventListeners): All global event listeners attached (or attempted).");
}


// --- File Loading Logic ---
// Stays in main.js as it orchestrates the start of the game
console.log("Main: Defining file loading logic.");

/** Checks if both audio and notes files are loaded and updates the start button state accordingly. */
function checkFilesLoaded() {
    // console.log(`Main (checkFilesLoaded): Checking file status - audio: ${audioFileLoaded}, notes: ${notesFileLoaded}`); // Can be noisy
    if (!startButton) {
        console.warn("Main (checkFilesLoaded): Start button not found. Cannot update state.");
        return;
    }

    if (audioFileLoaded && notesFileLoaded) {
        if(loadingStatus) loadingStatus.textContent = "Files loaded. Ready to start!";
        startButton.disabled = false;
        console.log("Main (checkFilesLoaded): Both files loaded. Start button enabled.");
    } else {
        startButton.disabled = true;
        if (!loadingStatus) return; // No status element to update

        if (!audioFileLoaded && !notesFileLoaded) {
            loadingStatus.textContent = "Please select both files.";
        } else if (!audioFileLoaded) {
            loadingStatus.textContent = "Please select an MP3 audio file.";
        } else { // Only notesFileLoaded is false
            loadingStatus.textContent = "Please select a JSON notes file.";
        }
        // console.log("Main (checkFilesLoaded): Not all files loaded. Start button disabled. Status: " + (loadingStatus ? loadingStatus.textContent : "N/A"));
    }
}

/** Handles audio file selection from the input element. */
function handleAudioFileSelect(event) {
    console.log("Main (handleAudioFileSelect): Audio file input changed.");
    const file = event.target.files[0];
    if (!file) {
        console.log("Main (handleAudioFileSelect): No audio file selected (cleared).");
        audioFileLoaded = false;
        audioFileBuffer = null;
        checkFilesLoaded();
        return;
    }

    console.log(`Main (handleAudioFileSelect): Selected audio file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);

    // Basic client-side validation for MP3 (imperfect but a first check)
    if (!file.type.startsWith('audio/mpeg') && !file.name.toLowerCase().endsWith('.mp3')) {
        console.warn("Main (handleAudioFileSelect): Invalid audio file type. Expected MP3.");
        alert("Invalid audio file type. Please select an MP3 file.");
        event.target.value = ''; // Clear the input
        audioFileLoaded = false;
        audioFileBuffer = null;
        checkFilesLoaded();
        return;
    }

    if (loadingStatus) loadingStatus.textContent = "Loading audio...";
    if (startButton) startButton.disabled = true; // Disable start while loading

    const reader = new FileReader();
    reader.onload = (e) => {
        audioFileBuffer = e.target.result; // ArrayBuffer
        audioFileLoaded = true;
        console.log("Main (handleAudioFileSelect): Audio file loaded into ArrayBuffer successfully.");
        checkFilesLoaded();
    };
    reader.onerror = (e) => {
        console.error("Main (handleAudioFileSelect): Error reading audio file:", e);
        alert("Error reading audio file. Please try again or select a different file.");
        audioFileLoaded = false;
        audioFileBuffer = null;
        if (loadingStatus) loadingStatus.textContent = "Error loading audio.";
        checkFilesLoaded(); // Update button state
    };
    reader.readAsArrayBuffer(file); // Read file as ArrayBuffer for Web Audio API
    console.log("Main (handleAudioFileSelect): Started reading audio file as ArrayBuffer.");
}

/** Handles notes file selection from the input element. */
function handleNotesFileSelect(event) {
    console.log("Main (handleNotesFileSelect): Notes file input changed.");
    const file = event.target.files[0];
    if (!file) {
        console.log("Main (handleNotesFileSelect): No notes file selected (cleared).");
        notesFileLoaded = false;
        notesJsonData = null;
        checkFilesLoaded();
        return;
    }

    console.log(`Main (handleNotesFileSelect): Selected notes file: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);

    // Basic client-side validation for JSON
    if (!file.type.startsWith('application/json') && !file.name.toLowerCase().endsWith('.json')) {
        console.warn("Main (handleNotesFileSelect): Invalid notes file type. Expected JSON.");
        alert("Invalid notes file type. Please select a JSON file.");
        event.target.value = ''; // Clear the input
        notesFileLoaded = false;
        notesJsonData = null;
        checkFilesLoaded();
        return;
    }

    if (loadingStatus) loadingStatus.textContent = "Loading notes...";
    if (startButton) startButton.disabled = true; // Disable start while loading

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            notesJsonData = JSON.parse(e.target.result); // Parse text content as JSON
            // Basic validation of JSON structure (presence of tracks array)
            if (!notesJsonData || typeof notesJsonData !== 'object' || !Array.isArray(notesJsonData.tracks) || notesJsonData.tracks.length === 0) {
                throw new Error("Invalid JSON structure: Missing 'tracks' array or it's empty.");
            }
            notesFileLoaded = true;
            console.log("Main (handleNotesFileSelect): Notes file loaded and parsed successfully.");
            checkFilesLoaded();
        } catch (error) {
            console.error("Main (handleNotesFileSelect): Error parsing JSON file:", error);
            alert(`Error parsing JSON file: ${error.message}. Please ensure it's a valid Keytap JSON.`);
            notesFileLoaded = false;
            notesJsonData = null;
            if (loadingStatus) loadingStatus.textContent = "Error parsing notes JSON.";
            checkFilesLoaded();
        }
    };
    reader.onerror = (e) => {
        console.error("Main (handleNotesFileSelect): Error reading notes file:", e);
        alert("Error reading notes file. Please try again or select a different file.");
        notesFileLoaded = false;
        notesJsonData = null;
        if (loadingStatus) loadingStatus.textContent = "Error loading notes file.";
        checkFilesLoaded();
    };
    reader.readAsText(file); // Read file as text for JSON parsing
    console.log("Main (handleNotesFileSelect): Started reading notes file as text.");
}


// --- Entry Point ---
// Runs once the HTML document is fully loaded and parsed
window.addEventListener('load', () => {
    console.log("Main: Window 'load' event triggered. Setting up main script.");

    // Assign Global DOM Elements (cached for performance)
    console.log("Main: Assigning global DOM element references...");
    loadingScreen = document.getElementById('loadingScreen');
    audioFileInput = document.getElementById('audioFile');
    notesFileInput = document.getElementById('notesFile');
    loadingStatus = document.getElementById('loadingStatus');
    startButton = document.getElementById('startButton');
    gameContainer = document.getElementById('gameContainer');
    infoSection = document.getElementById('infoSection');
    staffSection = document.getElementById('staffSection');
    bottomPanel = document.getElementById('bottomPanel');
    keyboardSection = document.getElementById('keyboardSection');
    playPauseButton = document.getElementById('playPauseButton');
    settingsButton = document.getElementById('settingsButton');
    comboCountSpan = document.getElementById('comboCount');
    healthBarElement = document.getElementById('healthBar');
    settingsOverlay = document.getElementById('settingsOverlay');
    colorToggleSwitch = document.getElementById('colorToggleSwitch');
    noDeathToggleSwitch = document.getElementById('noDeathToggleSwitch');
    closeSettingsButton = document.getElementById('closeSettingsButton');
    staffScaleValueSpan = document.getElementById('staffScaleValue');
    staffScaleDownButton = document.getElementById('staffScaleDown');
    staffScaleUpButton = document.getElementById('staffScaleUp');
    hitWindowValueSpan = document.getElementById('hitWindowValue');
    hitWindowDownButton = document.getElementById('hitWindowDown');
    hitWindowUpButton = document.getElementById('hitWindowUp');
    scoreOverlay = document.getElementById('scoreOverlay');
    scorePerfectCount = document.getElementById('scorePerfectCount');
    scorePerfectPercent = document.getElementById('scorePerfectPercent');
    scoreGoodCount = document.getElementById('scoreGoodCount');
    scoreGoodPercent = document.getElementById('scoreGoodPercent');
    scoreMissCount = document.getElementById('scoreMissCount');
    scoreMissPercent = document.getElementById('scoreMissPercent');
    scoreMaxCombo = document.getElementById('scoreMaxCombo');
    scoreTotalScore = document.getElementById('scoreTotalScore');
    restartButton = document.getElementById('restartButton');
    console.log("Main: DOM element references assigned.");

    // Check if essential elements for startup exist
    if (!loadingScreen || !startButton || !gameContainer || !audioFileInput || !notesFileInput || !loadingStatus) {
        console.error("CRITICAL ERROR: Essential UI elements for startup are missing from the DOM! Cannot initialize.");
        alert("Error: Could not initialize the game interface. Key elements are missing. Please check the HTML structure.");
        return; // Halt execution if critical elements are missing
    }
    console.log("Main: Essential startup UI elements found.");

    // Attach file input listeners
    if (audioFileInput) {
        audioFileInput.addEventListener('change', handleAudioFileSelect);
        console.log("Main: Audio file input listener attached.");
    }
    if (notesFileInput) {
        notesFileInput.addEventListener('change', handleNotesFileSelect);
        console.log("Main: Notes file input listener attached.");
    }

    // Attach start button listener
    startButton.addEventListener('click', async () => {
        console.log("Main: Start button clicked.");
        if (audioFileLoaded && notesFileLoaded && audioFileBuffer && notesJsonData) {
            console.log("Main: Files are loaded. Proceeding to start the game.");
            startButton.disabled = true; // Disable button during startup
            if(loadingStatus) loadingStatus.textContent = "Starting game...";

            // Hide loading screen and show game container
            loadingScreen.classList.add('hidden');
            gameContainer.classList.add('visible'); // Make game container visible
            console.log("Main: Switched from loading screen to game container.");

            // Initialize the game with the loaded file data
            // This function will also set up other event listeners for gameplay
            await initializeGame(audioFileBuffer, notesJsonData);
        } else {
            console.warn("Main: Start button clicked, but files are not ready or data is missing.");
            checkFilesLoaded(); // Re-check and update status message if needed
        }
    });
    console.log("Main: Start button listener attached.");

    // Initial setup calls
    updateTimingWindows(); // Initialize derived timing windows based on defaults
    checkFilesLoaded();    // Set initial state of start button and loading status message
    // Initial layout adjustment is now handled inside initializeGame after modules are ready.

    console.log("Main: Main script setup complete. Waiting for file selection.");
});

// Export getter functions for game state if other modules need read-only access
// Currently, keyboardModule gets these via function references passed during its init.
// export function getIsGameOver() { return isGameOver; }
// export function getIsGameRunning() { return gameIsRunning; }
console.log("--- main.js finished synchronous execution ---");
