/**
 * @file main.js
 * Main entry point and orchestrator for the Keytap game.
 * Loads modules, initializes the game, handles global state, file loading,
 * and acts as the central coordinator between different modules (audio, staff, keyboard, gameLogic, ui).
 * Designed to be loaded as an ES Module (<script type="module">).
 */

console.log("Main: Starting execution.");

// --- Module Imports ---
import * as audio from './audioModule.js';
import { init as initKeyboard } from './keyboardModule.js';
import * as staff from './staffModule.js';
import * as gameLogic from './gameLogic.js';
import * as ui from './ui.js'; // Import the new UI module
// midiColorConverter is imported directly by staffModule where needed.
console.log("Main: Modules imported.");


// --- Global Variables & State ---

// Game Settings & Constants
// PRE_DELAY_SECONDS is specific to main's orchestration with audio/staff
export const PRE_DELAY_SECONDS = 1.0; // Delay before audio starts (used by staffModule via import)

// Default values for settings (can be changed via UI callbacks)
export let scrollSpeedPixelsPerSecond = 120; // Exported for staffModule
let hitWindowGoodMs = 140;

// Derived timing values (updated when hitWindowGoodMs changes)
// Exported for staffModule
export let hitWindowPerfectMs = hitWindowGoodMs / 2;
export let hitWindowGoodSec = hitWindowGoodMs / 1000.0;
export let hitWindowPerfectSec = hitWindowPerfectMs / 1000.0;

// Game State Variables - Managed by main.js
let comboCount = 0;
let playerHealth = gameLogic.INITIAL_HEALTH; // Initialized using constant from gameLogic
let totalScore = 0;
let perfectCount = 0;
let goodCount = 0;
let missCount = 0;
let maxCombo = 0;
let totalNotesInSong = 0; // Calculated after notes are loaded

export let useColoredNotes = false; // Exported for staffModule, updated via UI callback
export let noDeathMode = false;     // Updated via UI callback
export let gameIsRunning = false;   // Main flag for paused/playing state
export let isGameOver = false;      // Flag for game over state

let gameInitialized = false; // Flag to prevent multiple initializations

// File Loading State
let audioFileBuffer = null; // Holds the ArrayBuffer of the loaded audio file
let notesJsonData = null;   // Holds the parsed JSON object of the notes file
let audioFileReady = false; // Flag indicating audio file is loaded and processed
let notesFileReady = false; // Flag indicating notes file is loaded and parsed

// Audio Playback State
// This offset is updated when the game is paused (either by user or settings)
// It's used by staff.play() and audio.play() when resuming.
let audioPauseOffset = 0;

// --- Timing Window Calculation ---

/**
 * Recalculates derived timing window variables (seconds and perfect ms)
 * based on the current `hitWindowGoodMs`. This needs to be called whenever
 * `hitWindowGoodMs` changes. The derived variables are exported and used by staffModule.
 */
export function updateTimingWindows() {
    hitWindowPerfectMs = Math.floor(hitWindowGoodMs / 2);
    hitWindowGoodSec = hitWindowGoodMs / 1000.0;
    hitWindowPerfectSec = hitWindowPerfectMs / 1000.0;
    console.log(`Main (updateTimingWindows): Good=${hitWindowGoodMs}ms (${hitWindowGoodSec.toFixed(3)}s), Perfect=${hitWindowPerfectMs}ms (${hitWindowPerfectSec.toFixed(3)}s)`);
}

// --- File Loading Logic ---
console.log("Main: Defining file loading logic.");

/**
 * Handles the file selection event triggered by the UI module.
 * Reads the selected file (audio or notes) and updates the corresponding state.
 * @param {'audio' | 'notes'} fileType - The type of file selected.
 * @param {File | null} file - The selected File object, or null if cleared.
 */
async function handleFileSelected(fileType, file) {
    console.log(`Main: handleFileSelected called for type: ${fileType}, file: ${file?.name ?? 'None'}`);

    if (!file) {
        // Handle file input clearing
        if (fileType === 'audio') {
            audioFileBuffer = null;
            audioFileReady = false;
        } else if (fileType === 'notes') {
            notesJsonData = null;
            notesFileReady = false;
        }
        ui.checkFilesLoaded(audioFileReady, notesFileReady); // Update UI button state
        return;
    }

    // Use FileReader to process the file
    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const result = e.target.result;
            if (fileType === 'audio') {
                audioFileBuffer = result; // result is ArrayBuffer for readAsArrayBuffer
                audioFileReady = true;
                console.log("Main: Audio file loaded into ArrayBuffer.");
            } else if (fileType === 'notes') {
                notesJsonData = JSON.parse(result); // result is text for readAsText
                // Basic validation of notes data structure
                if (!notesJsonData || !Array.isArray(notesJsonData.tracks) || notesJsonData.tracks.length === 0 || !Array.isArray(notesJsonData.tracks[0].notes)) {
                    throw new Error("Invalid JSON structure: Missing 'tracks[0].notes' array or invalid format.");
                }
                notesFileReady = true;
                console.log("Main: Notes file loaded and parsed.");
            }
            ui.setLoadingStatus("File loaded successfully.");
        } catch (error) {
            console.error(`Main: Error processing ${fileType} file:`, error);
            alert(`Error processing ${fileType} file: ${error.message}`);
            if (fileType === 'audio') { audioFileBuffer = null; audioFileReady = false; }
            else { notesJsonData = null; notesFileReady = false; }
            ui.setLoadingStatus(`Error loading ${fileType} file.`);
        } finally {
            ui.checkFilesLoaded(audioFileReady, notesFileReady); // Update UI button state
        }
    };

    reader.onerror = () => {
        console.error(`Main: Error reading ${fileType} file.`);
        alert(`Error reading ${fileType} file.`);
        if (fileType === 'audio') { audioFileBuffer = null; audioFileReady = false; }
        else { notesJsonData = null; notesFileReady = false; }
        ui.setLoadingStatus(`Error reading ${fileType} file.`);
        ui.checkFilesLoaded(audioFileReady, notesFileReady); // Update UI button state
    };

    // Read the file based on type
    if (fileType === 'audio') {
        reader.readAsArrayBuffer(file);
    } else if (fileType === 'notes') {
        reader.readAsText(file);
    }
}

// --- UI Action Callbacks ---
// These functions are passed to ui.initUI and are called by the UI module
// when the user interacts with UI elements.

/** Callback triggered when the start button is clicked in the UI. */
async function handleStartGame() {
    console.log("Main: handleStartGame called (from UI).");
    if (audioFileReady && notesFileReady && audioFileBuffer && notesJsonData) {
        ui.setPlayButtonState('Loading', true); // Use UI function to update button
        ui.setLoadingStatus("Starting game...");
        ui.hideLoadingScreen();
        ui.showGameContainer();
        console.log("Main: Switched to game container view.");
        // Initialize the core game modules
        await initializeGame(audioFileBuffer, notesJsonData);
        // Set initial play button state after initialization
        ui.setPlayButtonState('Play', false);
    } else {
        console.warn("Main: Start button clicked, but files not ready.");
        ui.checkFilesLoaded(audioFileReady, notesFileReady); // Re-check and update UI message
    }
}

/** Callback triggered when a setting is changed in the UI overlay. */
function handleSettingChange(settingName, value) {
    console.log(`Main: handleSettingChange called. Setting: ${settingName}, Value: ${value}`);
    let needsStaffRedraw = false;

    switch (settingName) {
        case 'scrollSpeed':
            scrollSpeedPixelsPerSecond = Number(value);
            needsStaffRedraw = true;
            break;
        case 'hitWindowMs':
            hitWindowGoodMs = Number(value);
            updateTimingWindows(); // Recalculate derived timings
            // No redraw needed for timing window change itself
            break;
        case 'useColoredNotes':
            useColoredNotes = Boolean(value);
            needsStaffRedraw = true;
            break;
        case 'noDeathMode':
            noDeathMode = Boolean(value);
            break;
        default:
            console.warn(`Main: Unknown setting change received: ${settingName}`);
            return;
    }

    // Update the settings UI immediately to reflect the change (e.g., slider value)
    // This might be slightly redundant if the UI component updates itself, but ensures consistency.
    ui.updateSettingsUI({
        scrollSpeed: scrollSpeedPixelsPerSecond,
        hitWindowMs: hitWindowGoodMs,
        useColoredNotes: useColoredNotes,
        noDeathMode: noDeathMode
    });


    // Redraw staff if needed and game is not running (to see changes immediately)
    if (needsStaffRedraw && !gameIsRunning && staff) {
        console.log("Main: Redrawing staff due to setting change while paused.");
        staff.redraw();
    }
}

/** Callback triggered when the play/pause button is clicked in the UI. */
function handlePlayPause() {
    console.log("Main: handlePlayPause called (from UI).");
    if (isGameOver || !gameInitialized) {
        console.warn("Main: Play/Pause ignored, game over or not initialized.");
        return;
    }

    // Attempt to resume audio context first (required for user interaction)
    audio.resumeContext().then(() => {
        if (gameIsRunning) {
            // Pause the game
            audioPauseOffset = staff.pause(); // staff.pause also pauses audio module
            ui.setPlayButtonState('Play', false); // Update button via UI module
            gameIsRunning = false;
            console.log(`Main: Game Paused. Audio offset: ${audioPauseOffset.toFixed(3)}`);
        } else {
            // Play the game (from current offset)
            staff.play(audioPauseOffset); // staff.play also starts/resumes audio
            ui.setPlayButtonState('Pause', false); // Update button via UI module
            gameIsRunning = true;
            console.log(`Main: Game Playing/Resumed from offset: ${audioPauseOffset.toFixed(3)}`);
        }
    }).catch(e => {
        console.error("Main: Failed to resume AudioContext on play/pause:", e);
        alert("Could not start audio. Please interact with the page again.");
        ui.setPlayButtonState('Play', false); // Reset button state on error
    });
}

/** Callback triggered when the settings button is clicked in the UI. */
function handleOpenSettings() {
    console.log("Main: handleOpenSettings called (from UI).");
    if (isGameOver || !gameInitialized) {
         console.warn("Main: Open Settings ignored, game over or not initialized.");
         return;
    }

    // Pause the game if it's running
    if (gameIsRunning) {
        audioPauseOffset = staff.pause();
        ui.setPlayButtonState('Play', false); // Update button text
        gameIsRunning = false;
        console.log("Main: Game paused to open settings. Offset: " + audioPauseOffset.toFixed(3));
    }

    // Update the settings display with current values
    ui.updateSettingsUI({
        scrollSpeed: scrollSpeedPixelsPerSecond,
        hitWindowMs: hitWindowGoodMs,
        useColoredNotes: useColoredNotes,
        noDeathMode: noDeathMode
    });

    // Show the overlay
    ui.showSettingsOverlay();
}

/** Callback triggered when the close settings button is clicked in the UI. */
function handleCloseSettings() {
    console.log("Main: handleCloseSettings called (from UI).");
    // Hiding the overlay is handled directly in ui.js listener

    // Redraw staff if the game is paused to reflect any changes made
    if (!gameIsRunning && staff && gameInitialized) {
        console.log("Main: Redrawing staff after closing settings while paused.");
        staff.redraw();
    }
}

/** Callback triggered when the restart button is clicked in the UI. */
function handleRestart() {
    console.log("Main: handleRestart called (from UI).");
    if (!gameInitialized) {
        console.warn("Main: Restart ignored, game not initialized.");
        return;
    }

    // 1. Package current state (mostly for gameLogic to reset)
    const currentLogicGameState = {
        playerHealth, comboCount, totalScore, perfectCount, goodCount, missCount, maxCombo,
        isGameOver, gameIsRunning, audioPauseOffset
        // noDeathMode is a setting, typically not reset by restart
    };

    // 2. References to modules needed by gameLogic.restartGame
    const modules = { audio, staff };

    // 3. Define UI access functions for gameLogic.restartGame
    //    These functions call the actual ui module functions.
    const uiAccessForLogic = {
        hideScoreOverlay: ui.hideScoreOverlay,
        setPlayButtonState: ui.setPlayButtonState,
        setSettingsButtonState: ui.setSettingsButtonState,
        // This function will be called by gameLogic AFTER it resets its state,
        // so we use the state variables from *this* scope (main.js) which will be updated shortly.
        updateInfoUI: () => {
            console.log("Main (handleRestart -> uiAccessForLogic.updateInfoUI): Calling ui.updateInfoUI after reset.");
            ui.updateInfoUI(playerHealth, gameLogic.MAX_HEALTH, comboCount);
        }
    };

    // 4. Call the centralized restart logic
    gameLogic.restartGame(currentLogicGameState, modules, uiAccessForLogic);

    // 5. Update main.js state from the (potentially mutated) currentLogicGameState object
    //    Note: gameLogic.restartGame primarily resets the state *within* the object,
    //    so we re-assign main.js variables from the reset object.
    playerHealth = currentLogicGameState.playerHealth;
    comboCount = currentLogicGameState.comboCount;
    totalScore = currentLogicGameState.totalScore;
    perfectCount = currentLogicGameState.perfectCount;
    goodCount = currentLogicGameState.goodCount;
    missCount = currentLogicGameState.missCount;
    maxCombo = currentLogicGameState.maxCombo;
    isGameOver = currentLogicGameState.isGameOver;
    gameIsRunning = currentLogicGameState.gameIsRunning;
    audioPauseOffset = currentLogicGameState.audioPauseOffset;

    // 6. Explicitly update UI info again here, AFTER main.js state is updated.
    //    This ensures the UI reflects the final reset state managed by main.js.
    console.log("Main (handleRestart): Updating UI info after state reset.");
    ui.updateInfoUI(playerHealth, gameLogic.MAX_HEALTH, comboCount);

    console.log("Main: Game state reset via gameLogic.restartGame. Health:", playerHealth);
}


// --- Bridge Functions to Game Logic ---

/**
 * Bridge function called by staffModule when a note is judged.
 * It gathers current state, calls gameLogic.applyScore, updates main.js state,
 * and triggers UI updates via the ui module.
 * @param {string} hitType - The type of hit: 'perfect', 'good', or 'miss'.
 * @export // Exported for staffModule to call
 */
export function applyScore(hitType) {
    // console.log(`Main (applyScore bridge): Received hitType: ${hitType}`);
    // Package the current state from main.js to pass to gameLogic
    const currentLogicGameState = {
        playerHealth: playerHealth,
        comboCount: comboCount,
        perfectCount: perfectCount,
        goodCount: goodCount,
        missCount: missCount,
        maxCombo: maxCombo,
        totalScore: totalScore,
        isGameOver: isGameOver,
        noDeathMode: noDeathMode
    };

    // Define callbacks that gameLogic can use to trigger actions back in main.js
    const logicCallbacks = {
        triggerGameOverCallback: triggerGameOverInternal, // Pass the internal handler
        // Pass a function that calls the ui module's update function with current main.js state
        updateUICallback: () => {
            // console.log("Main (applyScore bridge -> updateUICallback): Calling ui.updateInfoUI.");
            ui.updateInfoUI(playerHealth, gameLogic.MAX_HEALTH, comboCount);
        }
    };

    // Call the actual scoring logic in gameLogic.js
    gameLogic.applyScore(hitType, currentLogicGameState, logicCallbacks);

    // Update main.js's state variables from the mutated currentLogicGameState object
    playerHealth = currentLogicGameState.playerHealth;
    comboCount = currentLogicGameState.comboCount;
    perfectCount = currentLogicGameState.perfectCount;
    goodCount = currentLogicGameState.goodCount;
    missCount = currentLogicGameState.missCount;
    maxCombo = currentLogicGameState.maxCombo;
    totalScore = currentLogicGameState.totalScore;
    // isGameOver is set by triggerGameOverInternal

    // Note: UI update is handled by the updateUICallback passed to gameLogic.applyScore
    // console.log(`Main (applyScore bridge): State after gameLogic call - Health: ${playerHealth}, Combo: ${comboCount}`);
}

/**
 * Internal handler for game over conditions (health depletion or song end).
 * Called by gameLogic.applyScore (via callback) or by handleSongEnd.
 * This function then calls gameLogic.triggerGameOver to stop modules and
 * finally calls the ui module to display the score screen.
 * @param {boolean} songFinished - True if the song completed naturally.
 */
function triggerGameOverInternal(songFinished) {
    console.log(`Main (triggerGameOverInternal): Called with songFinished: ${songFinished}. Current isGameOver: ${isGameOver}`);
    if (isGameOver) { // Prevent re-triggering
        console.warn("Main (triggerGameOverInternal): Already game over. Ignoring.");
        return;
    }

    // 1. Package current state for gameLogic.triggerGameOver
    const currentLogicGameState = {
        isGameOver: isGameOver,
        gameIsRunning: gameIsRunning
    };

    // 2. References to modules needed by gameLogic.triggerGameOver
    const modules = { audio, staff };

    // 3. Define UI access functions for gameLogic.triggerGameOver
    //    These functions call the actual ui module functions.
    const uiAccessForLogic = {
        setPlayButtonState: ui.setPlayButtonState,
        setSettingsButtonState: ui.setSettingsButtonState,
        // showScoreScreen is called *after* gameLogic.triggerGameOver finishes
    };

    // 4. Call the centralized game over logic to stop audio/staff etc.
    gameLogic.triggerGameOver(songFinished, currentLogicGameState, modules, uiAccessForLogic);

    // 5. Update main.js state from the mutated currentLogicGameState object
    isGameOver = currentLogicGameState.isGameOver;
    gameIsRunning = currentLogicGameState.gameIsRunning;

    // 6. Prepare stats and show the score screen using the UI module
    console.log("Main (triggerGameOverInternal): Preparing stats for score screen.");
    const scoreStats = {
        perfectCount: perfectCount,
        goodCount: goodCount,
        missCount: missCount,
        maxCombo: maxCombo,
        totalScore: totalScore,
        totalNotesInSong: totalNotesInSong
    };
    ui.showScoreScreen(scoreStats); // Use UI module function

    console.log(`Main (triggerGameOverInternal): State after gameLogic call - isGameOver: ${isGameOver}, gameIsRunning: ${gameIsRunning}. Score screen shown.`);
}

/**
 * Handles the song ending naturally (callback from audioModule).
 * Triggers the game over sequence indicating the song was finished.
 */
function handleSongEnd() {
    console.log("Main (handleSongEnd): Song ended naturally (callback from audioModule).");
    if (!isGameOver) { // Only trigger if not already over
        triggerGameOverInternal(true); // True indicates song finished naturally
    } else {
        console.log("Main (handleSongEnd): Game was already over when song end callback received.");
    }
}

// --- Game Initialization Section ---

/**
 * Initializes all core game modules (audio, staff, keyboard)
 * AFTER audio and notes files have been successfully loaded and parsed.
 * @param {ArrayBuffer} loadedAudioBuffer - The decoded audio data buffer.
 * @param {object} loadedNoteData - The parsed JSON object containing note map data.
 */
async function initializeGame(loadedAudioBuffer, loadedNoteData) {
    console.log("Main (initializeGame): Attempting to initialize core game modules.");
    if (gameInitialized) {
        console.warn("Main (initializeGame): Game already initialized. Skipping.");
        return;
    }
    console.log("--- Main: Initializing Keytap Game Modules ---");

    ui.setLoadingStatus("Initializing audio...");

    // Calculate total notes (used for score screen percentages)
    totalNotesInSong = loadedNoteData?.tracks?.[0]?.notes?.length || 0;
    console.log(`Main (initializeGame): Total notes in song calculated: ${totalNotesInSong}`);

    // 1. Initialize Audio Module
    console.log("Main (initializeGame): Initializing Audio Module...");
    // Pass handleSongEnd as the callback for when the song finishes naturally
    const audioInitialized = await audio.init(loadedAudioBuffer, handleSongEnd);
    if (!audioInitialized) {
        console.error("Main (initializeGame): Audio module initialization failed.");
        ui.setLoadingStatus("Error: Failed to decode audio.");
        ui.setPlayButtonState('Play', true); // Re-enable play button? Or show error state?
        // Consider resetting file state and showing loading screen again
        audioFileReady = false;
        notesFileReady = false; // Reset both?
        ui.checkFilesLoaded(audioFileReady, notesFileReady);
        ui.hideGameContainer();
        ui.showLoadingScreen();
        return;
    }
    console.log("Main (initializeGame): Audio Module initialized successfully.");

    ui.setLoadingStatus("Initializing visuals...");

    // 2. Initialize Staff Module
    console.log("Main (initializeGame): Initializing Staff Module...");
    const staffInitialized = staff.init({
        noteDataJson: loadedNoteData,
        // Pass the actual staffSection DOM element (needed for canvas size calculation)
        staffSectionElement: document.getElementById('staffSection'), // Assuming ID is stable
        // Provide a callback function for staffModule to update main.js's offset
        setAudioPauseOffset: (newOffset) => {
            audioPauseOffset = newOffset;
            console.log(`Main (initializeGame - staffCallback): audioPauseOffset updated to ${audioPauseOffset.toFixed(3)} by staffModule.`);
        }
    });
    if (!staffInitialized) {
        console.error("Main (initializeGame): Staff module initialization failed.");
        ui.setLoadingStatus("Error: Failed to process notes file.");
         // Consider resetting and going back to loading screen
        audioFileReady = false;
        notesFileReady = false;
        ui.checkFilesLoaded(audioFileReady, notesFileReady);
        ui.hideGameContainer();
        ui.showLoadingScreen();
        return;
    }
    console.log("Main (initializeGame): Staff Module initialized successfully.");

    // 3. Initialize Keyboard Module
    console.log("Main (initializeGame): Initializing Keyboard Module...");
    initKeyboard({
        judgeKeyPressFunc: staff.judgeKeyPress, // Pass staff's judge function
        isGameOverFunc: () => isGameOver,       // Provide function to get current game over state
        isGameRunningFunc: () => gameIsRunning, // Provide function to get current running state
    });
    console.log("Main (initializeGame): Keyboard Module initialized successfully.");

    // 4. Initial UI state updates (health/combo)
    ui.updateInfoUI(playerHealth, gameLogic.MAX_HEALTH, comboCount);

    gameInitialized = true;
    console.log("--- Main: Keytap Game Modules Initialization Complete ---");
    ui.setLoadingStatus("Ready!"); // Update status via UI module
    // Play button state is handled after initialization finishes
}


// --- Entry Point ---
window.addEventListener('load', () => {
    console.log("Main: Window 'load' event. Setting up main script.");

    // Define callbacks for the UI module
    const uiCallbacks = {
        onStartGame: handleStartGame,
        onSettingChange: handleSettingChange,
        onRestart: handleRestart,
        onFileSelected: handleFileSelected,
        onPlayPause: handlePlayPause,
        onOpenSettings: handleOpenSettings,
        onCloseSettings: handleCloseSettings,
    };

    // Define initial state for the UI module
    const initialState = {
        scrollSpeed: scrollSpeedPixelsPerSecond,
        hitWindowMs: hitWindowGoodMs,
        useColoredNotes: useColoredNotes,
        noDeathMode: noDeathMode,
        initialHealth: playerHealth, // Use the initialized value
        maxHealth: gameLogic.MAX_HEALTH, // Use the constant
    };

    // Initialize the UI module
    // This also handles initial layout and file check display
    ui.initUI(uiCallbacks, initialState);

    // Initialize derived timing windows based on default hitWindowGoodMs
    updateTimingWindows();

    console.log("Main: Setup complete. UI Initialized. Waiting for file selection via UI.");
});

console.log("--- main.js finished synchronous execution ---");
