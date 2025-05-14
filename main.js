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
import * as ui from './ui.js';
// midiColorConverter is imported directly by staffModule where needed.
console.log("Main: Modules imported.");


// --- Global Variables & State ---

// Game Settings & Constants
export const PRE_DELAY_SECONDS = 1.0;

export let scrollSpeedPixelsPerSecond = 120;
let hitWindowGoodMs = 140;

export let hitWindowPerfectMs = hitWindowGoodMs / 2;
export let hitWindowGoodSec = hitWindowGoodMs / 1000.0;
export let hitWindowPerfectSec = hitWindowPerfectMs / 1000.0;

// Game State Variables
let comboCount = 0;
let playerHealth = gameLogic.INITIAL_HEALTH;
let totalScore = 0;
let perfectCount = 0;
let goodCount = 0;
let missCount = 0;
let maxCombo = 0;
let totalNotesInSong = 0;

export let useColoredNotes = false;
export let noDeathMode = false;
export let gameIsRunning = false; // True if actively playing (not paused by user, not game over, not in wait mode pause)
export let isGameOver = false;

// Wait Mode State Variables
export let waitModeActive = false; // Is Wait Mode setting enabled?
export let isWaitingForKeyPress = false; // Is the game currently paused by Wait Mode, awaiting a key?
export let waitingForNote = null; // The specific note object that was missed and is being waited for.

let gameInitialized = false;

// File Loading State
let audioFileBuffer = null;
let notesJsonData = null;
let audioFileReady = false;
let notesFileReady = false;

let audioPauseOffset = 0; // Time offset for resuming audio after pause

// --- Timing Window Calculation ---
export function updateTimingWindows() {
    hitWindowPerfectMs = Math.floor(hitWindowGoodMs / 2);
    hitWindowGoodSec = hitWindowGoodMs / 1000.0;
    hitWindowPerfectSec = hitWindowPerfectMs / 1000.0;
    console.log(`Main (updateTimingWindows): Good=${hitWindowGoodMs}ms (${hitWindowGoodSec.toFixed(3)}s), Perfect=${hitWindowPerfectMs}ms (${hitWindowPerfectSec.toFixed(3)}s)`);
}

// --- File Loading Logic ---
console.log("Main: Defining file loading logic.");
async function handleFileSelected(fileType, file) {
    console.log(`Main: handleFileSelected called for type: ${fileType}, file: ${file?.name ?? 'None'}`);
    if (!file) {
        if (fileType === 'audio') { audioFileBuffer = null; audioFileReady = false; }
        else if (fileType === 'notes') { notesJsonData = null; notesFileReady = false; }
        ui.checkFilesLoaded(audioFileReady, notesFileReady);
        return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const result = e.target.result;
            if (fileType === 'audio') {
                audioFileBuffer = result; audioFileReady = true;
                console.log("Main: Audio file loaded into ArrayBuffer.");
            } else if (fileType === 'notes') {
                notesJsonData = JSON.parse(result);
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
            ui.checkFilesLoaded(audioFileReady, notesFileReady);
        }
    };
    reader.onerror = () => {
        console.error(`Main: Error reading ${fileType} file.`);
        alert(`Error reading ${fileType} file.`);
        if (fileType === 'audio') { audioFileBuffer = null; audioFileReady = false; }
        else { notesJsonData = null; notesFileReady = false; }
        ui.setLoadingStatus(`Error reading ${fileType} file.`);
        ui.checkFilesLoaded(audioFileReady, notesFileReady);
    };
    if (fileType === 'audio') reader.readAsArrayBuffer(file);
    else if (fileType === 'notes') reader.readAsText(file);
}

// --- UI Action Callbacks ---
async function handleStartGame() {
    console.log("Main: handleStartGame called (from UI).");
    if (audioFileReady && notesFileReady && audioFileBuffer && notesJsonData) {
        ui.setPlayButtonState('Loading', true);
        ui.setLoadingStatus("Starting game...");
        ui.hideLoadingScreen();
        ui.showGameContainer();
        console.log("Main: Switched to game container view.");
        await initializeGame(audioFileBuffer, notesJsonData);
        ui.setPlayButtonState('Play', false);
    } else {
        console.warn("Main: Start button clicked, but files not ready.");
        ui.checkFilesLoaded(audioFileReady, notesFileReady);
    }
}

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
            updateTimingWindows();
            break;
        case 'useColoredNotes':
            useColoredNotes = Boolean(value);
            needsStaffRedraw = true;
            break;
        case 'noDeathMode':
            noDeathMode = Boolean(value);
            break;
        case 'waitModeActive': // Added for Wait Mode
            waitModeActive = Boolean(value);
            console.log(`Main: Wait Mode Active set to ${waitModeActive}`);
            // If wait mode is deactivated while waiting, resume game
            if (!waitModeActive && isWaitingForKeyPress) {
                console.log("Main: Wait Mode deactivated while waiting. Resuming game.");
                isWaitingForKeyPress = false;
                waitingForNote = null;
                ui.setWaitModeStatusMessage(null); // Clear any "Waiting..." message
                // Resume audio and staff. The staff module should handle its internal 'isStaffRunning' state.
                if (staff && audio && audio.isReady()) {
                    staff.play(audioPauseOffset); // Resume staff, which resumes audio
                    gameIsRunning = true; // Set main game running flag
                    ui.setPlayButtonState('Pause', false);
                }
            }
            break;
        default:
            console.warn(`Main: Unknown setting change received: ${settingName}`);
            return;
    }
    ui.updateSettingsUI({
        scrollSpeed: scrollSpeedPixelsPerSecond,
        hitWindowMs: hitWindowGoodMs,
        useColoredNotes: useColoredNotes,
        noDeathMode: noDeathMode,
        waitModeActive: waitModeActive // Pass waitModeActive to UI update
    });
    if (needsStaffRedraw && !gameIsRunning && staff && !isWaitingForKeyPress) { // Don't redraw if waiting for key
        console.log("Main: Redrawing staff due to setting change while paused (and not waiting).");
        staff.redraw();
    }
}

function handlePlayPause() {
    console.log("Main: handlePlayPause called (from UI).");
    if (isGameOver || !gameInitialized) {
        console.warn("Main: Play/Pause ignored, game over or not initialized.");
        return;
    }
    // If in Wait Mode and paused waiting for a key, the play/pause button should not resume.
    // Resuming from wait mode happens via correct key press in staffModule.
    if (isWaitingForKeyPress) {
        console.log("Main: Play/Pause button pressed while in Wait Mode pause. No action taken by this button.");
        // Optionally, provide feedback to user that they need to press the correct game key.
        // ui.setLoadingStatus("Press the correct key to continue..."); // Or a more subtle indicator
        return;
    }

    audio.resumeContext().then(() => {
        if (gameIsRunning) { // Game is actively running, so pause it
            audioPauseOffset = staff.pause(); // staff.pause also pauses audio module
            ui.setPlayButtonState('Play', false);
            gameIsRunning = false; // Set main game running flag to false
            console.log(`Main: Game Paused by user. Audio offset: ${audioPauseOffset.toFixed(3)}`);
        } else { // Game is paused (not due to wait mode), so play it
            staff.play(audioPauseOffset); // staff.play also starts/resumes audio
            ui.setPlayButtonState('Pause', false);
            gameIsRunning = true; // Set main game running flag to true
            console.log(`Main: Game Playing/Resumed by user from offset: ${audioPauseOffset.toFixed(3)}`);
        }
    }).catch(e => {
        console.error("Main: Failed to resume AudioContext on play/pause:", e);
        alert("Could not start audio. Please interact with the page again.");
        ui.setPlayButtonState('Play', false);
    });
}

function handleOpenSettings() {
    console.log("Main: handleOpenSettings called (from UI).");
    if (isGameOver || !gameInitialized) {
         console.warn("Main: Open Settings ignored, game over or not initialized.");
         return;
    }

    // Pause the game if it's running (and not already paused by wait mode)
    if (gameIsRunning && !isWaitingForKeyPress) {
        audioPauseOffset = staff.pause();
        ui.setPlayButtonState('Play', false);
        gameIsRunning = false; // Game is now paused by user
        console.log("Main: Game paused to open settings. Offset: " + audioPauseOffset.toFixed(3));
    } else if (isWaitingForKeyPress) {
        console.log("Main: Opening settings while in Wait Mode pause. Game remains paused by Wait Mode.");
        // No change to gameIsRunning, it's already effectively false from wait mode's perspective
    }


    ui.updateSettingsUI({
        scrollSpeed: scrollSpeedPixelsPerSecond,
        hitWindowMs: hitWindowGoodMs,
        useColoredNotes: useColoredNotes,
        noDeathMode: noDeathMode,
        waitModeActive: waitModeActive // Include waitModeActive
    });
    ui.showSettingsOverlay();
}

function handleCloseSettings() {
    console.log("Main: handleCloseSettings called (from UI).");
    // Hiding the overlay is handled directly in ui.js listener

    // Redraw staff if the game is paused (by user, not by wait mode) to reflect any changes made
    if (!gameIsRunning && staff && gameInitialized && !isWaitingForKeyPress) {
        console.log("Main: Redrawing staff after closing settings while user-paused.");
        staff.redraw();
    } else if (isWaitingForKeyPress) {
        console.log("Main: Settings closed while in Wait Mode pause. Staff remains static.");
        // Staff should already be showing the static "waiting" state.
        // If settings that affect appearance (like color) were changed, staff.redraw() might be needed
        // if it doesn't happen automatically. Let's assume staff.redraw() is safe to call.
        staff.redraw();
    }
}

function handleRestart() {
    console.log("Main: handleRestart called (from UI).");
    if (!gameInitialized) {
        console.warn("Main: Restart ignored, game not initialized.");
        return;
    }

    // Reset Wait Mode specific states
    isWaitingForKeyPress = false;
    waitingForNote = null;
    ui.setWaitModeStatusMessage(null); // Clear any "Waiting..." message from UI

    const currentLogicGameState = {
        playerHealth, comboCount, totalScore, perfectCount, goodCount, missCount, maxCombo,
        isGameOver, gameIsRunning, audioPauseOffset,
        // Wait mode state is reset above, not part of this object for gameLogic
    };
    const modules = { audio, staff };
    const uiAccessForLogic = {
        hideScoreOverlay: ui.hideScoreOverlay,
        setPlayButtonState: ui.setPlayButtonState,
        setSettingsButtonState: ui.setSettingsButtonState,
        updateInfoUI: () => {
            console.log("Main (handleRestart -> uiAccessForLogic.updateInfoUI): Calling ui.updateInfoUI after reset.");
            ui.updateInfoUI(playerHealth, gameLogic.MAX_HEALTH, comboCount);
        }
    };
    gameLogic.restartGame(currentLogicGameState, modules, uiAccessForLogic);
    playerHealth = currentLogicGameState.playerHealth;
    comboCount = currentLogicGameState.comboCount;
    totalScore = currentLogicGameState.totalScore;
    perfectCount = currentLogicGameState.perfectCount;
    goodCount = currentLogicGameState.goodCount;
    missCount = currentLogicGameState.missCount;
    maxCombo = currentLogicGameState.maxCombo;
    isGameOver = currentLogicGameState.isGameOver;
    gameIsRunning = currentLogicGameState.gameIsRunning; // Should be false after restart
    audioPauseOffset = currentLogicGameState.audioPauseOffset; // Should be 0

    console.log("Main (handleRestart): Updating UI info after state reset.");
    ui.updateInfoUI(playerHealth, gameLogic.MAX_HEALTH, comboCount);
    console.log("Main: Game state reset via gameLogic.restartGame. Health:", playerHealth);
}


// --- Bridge Functions to Game Logic & Staff ---

export function applyScore(hitType) {
    // This function is now only called for actual scoring events (initial miss, good, perfect)
    // The "resuming key press" in wait mode does not call this.
    console.log(`Main (applyScore bridge): Received hitType: ${hitType} for scoring.`);
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
    const logicCallbacks = {
        triggerGameOverCallback: triggerGameOverInternal,
        updateUICallback: () => {
            ui.updateInfoUI(playerHealth, gameLogic.MAX_HEALTH, comboCount);
        }
    };
    gameLogic.applyScore(hitType, currentLogicGameState, logicCallbacks);
    playerHealth = currentLogicGameState.playerHealth;
    comboCount = currentLogicGameState.comboCount;
    perfectCount = currentLogicGameState.perfectCount;
    goodCount = currentLogicGameState.goodCount;
    missCount = currentLogicGameState.missCount;
    maxCombo = currentLogicGameState.maxCombo;
    totalScore = currentLogicGameState.totalScore;
}

function triggerGameOverInternal(songFinished) {
    console.log(`Main (triggerGameOverInternal): Called with songFinished: ${songFinished}. Current isGameOver: ${isGameOver}`);
    if (isGameOver) {
        console.warn("Main (triggerGameOverInternal): Already game over. Ignoring.");
        return;
    }

    // If game over happens while in wait mode, clear wait mode states
    if (isWaitingForKeyPress) {
        console.log("Main (triggerGameOverInternal): Game over occurred while in Wait Mode. Clearing wait states.");
        isWaitingForKeyPress = false;
        waitingForNote = null;
        ui.setWaitModeStatusMessage(null);
    }

    const currentLogicGameState = { isGameOver: isGameOver, gameIsRunning: gameIsRunning };
    const modules = { audio, staff };
    const uiAccessForLogic = {
        setPlayButtonState: ui.setPlayButtonState,
        setSettingsButtonState: ui.setSettingsButtonState,
    };
    gameLogic.triggerGameOver(songFinished, currentLogicGameState, modules, uiAccessForLogic);
    isGameOver = currentLogicGameState.isGameOver;
    gameIsRunning = currentLogicGameState.gameIsRunning; // Should be false
    const scoreStats = {
        perfectCount: perfectCount, goodCount: goodCount, missCount: missCount,
        maxCombo: maxCombo, totalScore: totalScore, totalNotesInSong: totalNotesInSong
    };
    ui.showScoreScreen(scoreStats);
    console.log(`Main (triggerGameOverInternal): State after gameLogic call - isGameOver: ${isGameOver}, gameIsRunning: ${gameIsRunning}. Score screen shown.`);
}

function handleSongEnd() {
    console.log("Main (handleSongEnd): Song ended naturally (callback from audioModule).");
    if (!isGameOver) {
        // If song ends while waiting for a key in wait mode, it's still a song completion.
        // The player just didn't hit the last note(s) to resume.
        if (isWaitingForKeyPress) {
            console.log("Main (handleSongEnd): Song ended while in Wait Mode pause.");
            // The game is already paused, penalties applied. Consider this a natural end.
        }
        triggerGameOverInternal(true);
    } else {
        console.log("Main (handleSongEnd): Game was already over when song end callback received.");
    }
}

// --- Wait Mode Specific State Management Callbacks for StaffModule ---
/**
 * Called by StaffModule to indicate a miss occurred in Wait Mode and game should pause.
 * @param {object} missedNoteObject - The note object that was missed.
 */
export function enterWaitModePause(missedNoteObject) {
    if (!waitModeActive || isWaitingForKeyPress) return; // Should only enter if active and not already waiting

    console.log("Main: Entering Wait Mode Pause for note:", missedNoteObject.name);
    isWaitingForKeyPress = true;
    waitingForNote = missedNoteObject;
    gameIsRunning = false; // Game is not actively "running" in terms of progression

    audioPauseOffset = audio.pause(); // Pause audio and store offset
    // Staff module will stop its own animation loop based on isWaitingForKeyPress

    ui.setPlayButtonState('Waiting...', true); // Update UI to reflect waiting state
    ui.setSettingsButtonState(true); // Optionally disable settings while waiting for a specific key
    ui.setWaitModeStatusMessage(`Press the correct key for ${missedNoteObject.name}...`); // Inform user
}

/**
 * Called by StaffModule when the correct key is pressed during Wait Mode pause.
 */
export function exitWaitModePause() {
    if (!isWaitingForKeyPress) return; // Should only exit if actually waiting

    console.log("Main: Exiting Wait Mode Pause. Resuming song.");
    const noteNameToClear = waitingForNote ? waitingForNote.name : "unknown note";
    isWaitingForKeyPress = false;
    waitingForNote = null;
    gameIsRunning = true; // Game is now actively "running" again

    audio.play(audioPauseOffset, PRE_DELAY_SECONDS); // Resume audio from stored offset
    // Staff module will resume its animation loop

    ui.setPlayButtonState('Pause', false); // Restore play/pause button
    ui.setSettingsButtonState(false); // Re-enable settings
    ui.setWaitModeStatusMessage(null); // Clear "Waiting..." message
    console.log(`Main: Resumed from Wait Mode after player hit key for ${noteNameToClear}.`);
}


// --- Game Initialization Section ---
async function initializeGame(loadedAudioBuffer, loadedNoteData) {
    console.log("Main (initializeGame): Attempting to initialize core game modules.");
    if (gameInitialized) {
        console.warn("Main (initializeGame): Game already initialized. Skipping.");
        return;
    }
    console.log("--- Main: Initializing Keytap Game Modules ---");
    ui.setLoadingStatus("Initializing audio...");
    totalNotesInSong = loadedNoteData?.tracks?.[0]?.notes?.length || 0;
    console.log(`Main (initializeGame): Total notes in song calculated: ${totalNotesInSong}`);

    const audioInitialized = await audio.init(loadedAudioBuffer, handleSongEnd);
    if (!audioInitialized) {
        console.error("Main (initializeGame): Audio module initialization failed.");
        ui.setLoadingStatus("Error: Failed to decode audio.");
        ui.setPlayButtonState('Play', true);
        audioFileReady = false; notesFileReady = false;
        ui.checkFilesLoaded(audioFileReady, notesFileReady);
        ui.hideGameContainer(); ui.showLoadingScreen();
        return;
    }
    console.log("Main (initializeGame): Audio Module initialized successfully.");
    ui.setLoadingStatus("Initializing visuals...");

    // Provide staff module with necessary callbacks/getters for wait mode
    const staffConfig = {
        noteDataJson: loadedNoteData,
        staffSectionElement: document.getElementById('staffSection'),
        setAudioPauseOffset: (newOffset) => { audioPauseOffset = newOffset; },
        // Wait Mode related functions/getters:
        isWaitModeActive: () => waitModeActive,
        isCurrentlyWaitingForKey: () => isWaitingForKeyPress,
        getWaitingForNote: () => waitingForNote,
        onWaitModeEnter: enterWaitModePause, // Main's function to handle entering wait pause
        onWaitModeExit: exitWaitModePause,   // Main's function to handle exiting wait pause
        applyScoreCallback: applyScore       // Pass the main applyScore bridge
    };

    const staffInitialized = staff.init(staffConfig);
    if (!staffInitialized) {
        console.error("Main (initializeGame): Staff module initialization failed.");
        ui.setLoadingStatus("Error: Failed to process notes file.");
        audioFileReady = false; notesFileReady = false;
        ui.checkFilesLoaded(audioFileReady, notesFileReady);
        ui.hideGameContainer(); ui.showLoadingScreen();
        return;
    }
    console.log("Main (initializeGame): Staff Module initialized successfully.");

    console.log("Main (initializeGame): Initializing Keyboard Module...");
    initKeyboard({
        judgeKeyPressFunc: staff.judgeKeyPress,
        isGameOverFunc: () => isGameOver,
        isGameRunningFunc: () => gameIsRunning || isWaitingForKeyPress, // Keyboard active if game running OR waiting for key
    });
    console.log("Main (initializeGame): Keyboard Module initialized successfully.");

    ui.updateInfoUI(playerHealth, gameLogic.MAX_HEALTH, comboCount);
    gameInitialized = true;
    console.log("--- Main: Keytap Game Modules Initialization Complete ---");
    ui.setLoadingStatus("Ready!");
}


// --- Entry Point ---
window.addEventListener('load', () => {
    console.log("Main: Window 'load' event. Setting up main script.");
    const uiCallbacks = {
        onStartGame: handleStartGame,
        onSettingChange: handleSettingChange,
        onRestart: handleRestart,
        onFileSelected: handleFileSelected,
        onPlayPause: handlePlayPause,
        onOpenSettings: handleOpenSettings,
        onCloseSettings: handleCloseSettings,
    };
    const initialState = {
        scrollSpeed: scrollSpeedPixelsPerSecond,
        hitWindowMs: hitWindowGoodMs,
        useColoredNotes: useColoredNotes,
        noDeathMode: noDeathMode,
        waitModeActive: waitModeActive, // Add waitModeActive to initial state for UI
        initialHealth: playerHealth,
        maxHealth: gameLogic.MAX_HEALTH,
    };
    ui.initUI(uiCallbacks, initialState);
    updateTimingWindows();
    console.log("Main: Setup complete. UI Initialized. Waiting for file selection via UI.");
});

console.log("--- main.js finished synchronous execution ---");
