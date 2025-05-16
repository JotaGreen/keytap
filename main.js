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
export const PRE_DELAY_SECONDS = 1.0; // Exported for staffModule via getter

// Default values for settings (can be changed via UI callbacks)
export let scrollSpeedPixelsPerSecond = 120; // Exported for staffModule via getter
let hitWindowGoodMs = 140;

// Derived timing values (updated when hitWindowGoodMs changes)
// Exported for staffModule via getters
export let hitWindowPerfectMs = hitWindowGoodMs / 2;
export let hitWindowGoodSec = hitWindowGoodMs / 1000.0;
export let hitWindowPerfectSec = hitWindowPerfectMs / 1000.0;

// Game State Variables - Managed by main.js
let comboCount = 0;
let playerHealth = gameLogic.INITIAL_HEALTH;
let totalScore = 0;
let perfectCount = 0;
let goodCount = 0;
let missCount = 0;
let maxCombo = 0;
let totalNotesInSong = 0;

export let useColoredNotes = false; // Exported for staffModule via getter
export let noDeathMode = false;
export let gameIsRunning = false; // True if actively playing (not paused by user, not game over, not in wait mode pause)
export let isGameOver = false;      // Exported for staffModule via getter

// Wait Mode State Variables
export let waitModeActive = false; // Is Wait Mode setting enabled?
export let isWaitingForKeyPress = false; // Is the game currently paused by Wait Mode, awaiting a key?
export let waitingForNote = null; // The specific note object that was missed and is being waited for.

let gameInitialized = false; // Flag to prevent multiple initializations

// File Loading State
let audioFileBuffer = null;
let notesJsonData = null;
let audioFileReady = false;
let notesFileReady = false;

// Audio Playback State
let audioPauseOffset = 0; // Time offset for resuming audio after pause

// --- Timing Window Calculation ---
/**
 * Recalculates derived timing window variables (seconds and perfect ms)
 * based on the current `hitWindowGoodMs`.
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
 * @param {'audio' | 'notes'} fileType - The type of file selected.
 * @param {File | null} file - The selected File object, or null if cleared.
 */
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
/** Callback triggered when the start button is clicked in the UI. */
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
            updateTimingWindows(); // Recalculate derived timings (hitWindowGoodSec, etc.)
            break;
        case 'useColoredNotes':
            useColoredNotes = Boolean(value);
            needsStaffRedraw = true;
            break;
        case 'noDeathMode':
            noDeathMode = Boolean(value);
            break;
        case 'waitModeActive':
            waitModeActive = Boolean(value);
            console.log(`Main: Wait Mode Active set to ${waitModeActive}`);
            if (!waitModeActive && isWaitingForKeyPress) {
                console.log("Main: Wait Mode deactivated while waiting. Resuming game.");
                isWaitingForKeyPress = false;
                waitingForNote = null;
                ui.setWaitModeStatusMessage(null);
                if (staff && audio && audio.isReady()) {
                    staff.play(audioPauseOffset);
                    gameIsRunning = true;
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
        waitModeActive: waitModeActive
    });
    if (needsStaffRedraw && !gameIsRunning && staff && !isWaitingForKeyPress) {
        console.log("Main: Redrawing staff due to setting change while paused (and not waiting).");
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
    if (isWaitingForKeyPress) {
        console.log("Main: Play/Pause button pressed while in Wait Mode pause. No action taken by this button.");
        return;
    }

    audio.resumeContext().then(() => {
        if (gameIsRunning) {
            audioPauseOffset = staff.pause();
            ui.setPlayButtonState('Play', false);
            gameIsRunning = false;
            console.log(`Main: Game Paused by user. Audio offset: ${audioPauseOffset.toFixed(3)}`);
        } else {
            staff.play(audioPauseOffset);
            ui.setPlayButtonState('Pause', false);
            gameIsRunning = true;
            console.log(`Main: Game Playing/Resumed by user from offset: ${audioPauseOffset.toFixed(3)}`);
        }
    }).catch(e => {
        console.error("Main: Failed to resume AudioContext on play/pause:", e);
        alert("Could not start audio. Please interact with the page again.");
        ui.setPlayButtonState('Play', false);
    });
}

/** Callback triggered when the settings button is clicked in the UI. */
function handleOpenSettings() {
    console.log("Main: handleOpenSettings called (from UI).");
    if (isGameOver || !gameInitialized) {
         console.warn("Main: Open Settings ignored, game over or not initialized.");
         return;
    }
    if (gameIsRunning && !isWaitingForKeyPress) {
        audioPauseOffset = staff.pause();
        ui.setPlayButtonState('Play', false);
        gameIsRunning = false;
        console.log("Main: Game paused to open settings. Offset: " + audioPauseOffset.toFixed(3));
    } else if (isWaitingForKeyPress) {
        console.log("Main: Opening settings while in Wait Mode pause. Game remains paused by Wait Mode.");
    }
    ui.updateSettingsUI({
        scrollSpeed: scrollSpeedPixelsPerSecond,
        hitWindowMs: hitWindowGoodMs,
        useColoredNotes: useColoredNotes,
        noDeathMode: noDeathMode,
        waitModeActive: waitModeActive
    });
    ui.showSettingsOverlay();
}

/** Callback triggered when the close settings button is clicked in the UI. */
function handleCloseSettings() {
    console.log("Main: handleCloseSettings called (from UI).");
    if (!gameIsRunning && staff && gameInitialized && !isWaitingForKeyPress) {
        console.log("Main: Redrawing staff after closing settings while user-paused.");
        staff.redraw();
    } else if (isWaitingForKeyPress) {
        console.log("Main: Settings closed while in Wait Mode pause. Staff remains static. Redrawing for visual consistency.");
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
    isWaitingForKeyPress = false;
    waitingForNote = null;
    ui.setWaitModeStatusMessage(null);

    const currentLogicGameState = {
        playerHealth, comboCount, totalScore, perfectCount, goodCount, missCount, maxCombo,
        isGameOver, gameIsRunning, audioPauseOffset,
    };
    const modules = { audio, staff };
    const uiAccessForLogic = {
        hideScoreOverlay: ui.hideScoreOverlay,
        setPlayButtonState: ui.setPlayButtonState,
        setSettingsButtonState: ui.setSettingsButtonState,
        updateInfoUI: () => {
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
    gameIsRunning = currentLogicGameState.gameIsRunning;
    audioPauseOffset = currentLogicGameState.audioPauseOffset;

    ui.updateInfoUI(playerHealth, gameLogic.MAX_HEALTH, comboCount);
    console.log("Main: Game state reset. Health:", playerHealth);
}


// --- Bridge Functions to Game Logic & Staff ---
/**
 * Bridge function called by staffModule when a note is judged for scoring.
 * @param {string} hitType - The type of hit: 'perfect', 'good', or 'miss'.
 * @export
 */
export function applyScore(hitType) {
    console.log(`Main (applyScore bridge): Received hitType: ${hitType} for scoring.`);
    const currentLogicGameState = {
        playerHealth: playerHealth, comboCount: comboCount, perfectCount: perfectCount,
        goodCount: goodCount, missCount: missCount, maxCombo: maxCombo, totalScore: totalScore,
        isGameOver: isGameOver, noDeathMode: noDeathMode
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

/** Internal handler for game over conditions. */
function triggerGameOverInternal(songFinished) {
    console.log(`Main (triggerGameOverInternal): Called. songFinished: ${songFinished}, isGameOver: ${isGameOver}`);
    if (isGameOver) {
        console.warn("Main (triggerGameOverInternal): Already game over.");
        return;
    }
    if (isWaitingForKeyPress) {
        console.log("Main (triggerGameOverInternal): Game over during Wait Mode. Clearing wait states.");
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
    gameIsRunning = currentLogicGameState.gameIsRunning;
    const scoreStats = {
        perfectCount: perfectCount, goodCount: goodCount, missCount: missCount,
        maxCombo: maxCombo, totalScore: totalScore, totalNotesInSong: totalNotesInSong
    };
    ui.showScoreScreen(scoreStats);
    console.log(`Main (triggerGameOverInternal): Game over processed. isGameOver: ${isGameOver}`);
}

/** Handles the song ending naturally (callback from audioModule). */
function handleSongEnd() {
    console.log("Main (handleSongEnd): Song ended naturally.");
    if (!isGameOver) {
        if (isWaitingForKeyPress) {
            console.log("Main (handleSongEnd): Song ended while in Wait Mode pause.");
        }
        triggerGameOverInternal(true);
    } else {
        console.log("Main (handleSongEnd): Game already over when song end callback received.");
    }
}

// --- Wait Mode Specific State Management Callbacks for StaffModule ---
/**
 * Called by StaffModule to indicate a miss occurred in Wait Mode and game should pause.
 * @param {object} missedNoteObject - The note object that was missed.
 */
export function enterWaitModePause(missedNoteObject) {
    if (!waitModeActive || isWaitingForKeyPress) return;

    console.log("Main: Entering Wait Mode Pause for note:", missedNoteObject.name);
    isWaitingForKeyPress = true;
    waitingForNote = missedNoteObject;
    gameIsRunning = false; // Song progression is paused

    audioPauseOffset = audio.pause();

    ui.setPlayButtonState('Waiting...', true);
    ui.setSettingsButtonState(true);
    ui.setWaitModeStatusMessage(`Press the correct key for ${missedNoteObject.name}...`);
}

/**
 * Called by StaffModule when the correct key is pressed during Wait Mode pause.
 */
export function exitWaitModePause() {
    if (!isWaitingForKeyPress) return;

    console.log("Main: Exiting Wait Mode Pause. Resuming song.");
    const noteNameToClear = waitingForNote ? waitingForNote.name : "unknown note";
    isWaitingForKeyPress = false;
    waitingForNote = null;
    gameIsRunning = true; // Song progression resumes

    // PRE_DELAY_SECONDS is not typically used when resuming from a mid-song pause.
    // The staff module's play() will handle audio.play()
    staff.play(audioPauseOffset); // This will call audio.play internally

    ui.setPlayButtonState('Pause', false);
    ui.setSettingsButtonState(false);
    ui.setWaitModeStatusMessage(null);
    console.log(`Main: Resumed from Wait Mode for note ${noteNameToClear}.`);
}


// --- Game Initialization Section ---
/**
 * Initializes all core game modules.
 * @param {ArrayBuffer} loadedAudioBuffer - The decoded audio data buffer.
 * @param {object} loadedNoteData - The parsed JSON object containing note map data.
 */
async function initializeGame(loadedAudioBuffer, loadedNoteData) {
    console.log("Main (initializeGame): Initializing core game modules.");
    if (gameInitialized) {
        console.warn("Main (initializeGame): Game already initialized. Skipping.");
        return;
    }
    ui.setLoadingStatus("Initializing audio...");
    totalNotesInSong = loadedNoteData?.tracks?.[0]?.notes?.length || 0;
    console.log(`Main (initializeGame): Total notes in song: ${totalNotesInSong}`);

    const audioInitialized = await audio.init(loadedAudioBuffer, handleSongEnd);
    if (!audioInitialized) {
        console.error("Main (initializeGame): Audio module init failed.");
        ui.setLoadingStatus("Error: Failed to decode audio.");
        ui.setPlayButtonState('Play', true);
        audioFileReady = false; notesFileReady = false;
        ui.checkFilesLoaded(audioFileReady, notesFileReady);
        ui.hideGameContainer(); ui.showLoadingScreen();
        return;
    }
    console.log("Main (initializeGame): Audio Module initialized.");
    ui.setLoadingStatus("Initializing visuals...");

    const staffConfig = {
        noteDataJson: loadedNoteData,
        staffSectionElement: document.getElementById('staffSection'),
        setAudioPauseOffset: (newOffset) => { audioPauseOffset = newOffset; },
        // Getters for dynamic values from main.js
        getIsGameOver: () => isGameOver,
        getUseColoredNotes: () => useColoredNotes,
        getScrollSpeed: () => scrollSpeedPixelsPerSecond,
        getHitWindowGoodSec: () => hitWindowGoodSec,
        getHitWindowPerfectSec: () => hitWindowPerfectSec,
        getPreDelaySeconds: () => PRE_DELAY_SECONDS,
        // Wait Mode related functions/getters:
        isWaitModeActive: () => waitModeActive,
        isCurrentlyWaitingForKey: () => isWaitingForKeyPress,
        getWaitingForNote: () => waitingForNote,
        onWaitModeEnter: enterWaitModePause,
        onWaitModeExit: exitWaitModePause,
        applyScoreCallback: applyScore
    };

    const staffInitialized = staff.init(staffConfig);
    if (!staffInitialized) {
        console.error("Main (initializeGame): Staff module init failed.");
        ui.setLoadingStatus("Error: Failed to process notes file.");
        audioFileReady = false; notesFileReady = false;
        ui.checkFilesLoaded(audioFileReady, notesFileReady);
        ui.hideGameContainer(); ui.showLoadingScreen();
        return;
    }
    console.log("Main (initializeGame): Staff Module initialized.");

    console.log("Main (initializeGame): Initializing Keyboard Module...");
    initKeyboard({
        judgeKeyPressFunc: staff.judgeKeyPress,
        isGameOverFunc: () => isGameOver,
        isGameRunningFunc: () => gameIsRunning || isWaitingForKeyPress,
    });
    console.log("Main (initializeGame): Keyboard Module initialized.");

    ui.updateInfoUI(playerHealth, gameLogic.MAX_HEALTH, comboCount);
    gameInitialized = true;
    console.log("--- Main: Keytap Game Modules Initialization Complete ---");
    ui.setLoadingStatus("Ready!");
}


// --- Entry Point ---
window.addEventListener('load', () => {
    console.log("Main: Window 'load' event. Setting up.");
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
        waitModeActive: waitModeActive,
        initialHealth: playerHealth,
        maxHealth: gameLogic.MAX_HEALTH,
    };
    ui.initUI(uiCallbacks, initialState);
    updateTimingWindows(); // Initial calculation
    console.log("Main: Setup complete. UI Initialized. Waiting for file selection.");
});

console.log("--- main.js finished synchronous execution ---");
