/**
 * @file main.js
 * Main entry point and orchestrator for the Keytap game.
 * Loads modules, initializes the game, handles global state and UI updates.
 * Interacts with gameLogic.js for core game mechanics.
 * Designed to be loaded as an ES Module (<script type="module">).
 */

console.log("Main: Starting execution.");

// --- Module Imports ---
import * as audio from './audioModule.js';
import { init as initKeyboard } from './keyboardModule.js';
import * as staff from './staffModule.js';
// Import the new game logic module
import * as gameLogic from './gameLogic.js';
// midiColorConverter is imported directly by staffModule where needed.
console.log("Main: Modules imported.");


// --- Global Variables & State ---

// Game Settings & Constants
// PRE_DELAY_SECONDS is specific to main's orchestration with audio/staff
export const PRE_DELAY_SECONDS = 1.0; // Delay before audio starts (used by staffModule via import)

// Default values for settings (can be changed in UI)
export let scrollSpeedPixelsPerSecond = 120; // Exported for staffModule
let hitWindowGoodMs = 140;

// Derived timing values (updated when hitWindowGoodMs changes)
// Exported for staffModule
export let hitWindowPerfectMs = hitWindowGoodMs / 2;
export let hitWindowGoodSec = hitWindowGoodMs / 1000.0;
export let hitWindowPerfectSec = hitWindowPerfectMs / 1000.0;

// Game State Variables - Managed by main.js
let comboCount = 0;
// Player health is initialized using a constant from gameLogic.js
let playerHealth = gameLogic.INITIAL_HEALTH;
let totalScore = 0;
let perfectCount = 0;
let goodCount = 0;
let missCount = 0;
let maxCombo = 0;
let totalNotesInSong = 0; // Calculated after notes are loaded

export let useColoredNotes = false; // Exported for staffModule
export let noDeathMode = false;     // Game continues even if health is 0
export let gameIsRunning = false;   // Main flag for paused/playing state
export let isGameOver = false;      // Flag for game over state

let gameInitialized = false; // Flag to prevent multiple initializations

// File Loading State
let audioFileBuffer = null;
let notesJsonData = null;
let audioFileLoaded = false;
let notesFileLoaded = false;

// Audio Playback State
// This is primarily managed by staffModule and audioModule,
// main.js stores the offset when paused via settings or play/pause button.
let audioPauseOffset = 0;

// --- Global DOM Element References ---
// Assigned in window.onload listener
let loadingScreen, audioFileInput, notesFileInput, loadingStatus, startButton;
let gameContainer, infoSection, staffSection, bottomPanel, keyboardSection;
let playPauseButton, settingsButton, comboCountSpan, healthBarElement;
let settingsOverlay, colorToggleSwitch, noDeathToggleSwitch, closeSettingsButton;
let staffScaleValueSpan, staffScaleDownButton, staffScaleUpButton;
let hitWindowValueSpan, hitWindowDownButton, hitWindowUpButton;
let scoreOverlay, scorePerfectCount, scorePerfectPercent, scoreGoodCount, scoreGoodPercent;
let scoreMissCount, scoreMissPercent, scoreMaxCombo, scoreTotalScore, restartButton;


// --- Bridge Functions to Game Logic ---
console.log("Main: Defining bridge functions to gameLogic.js.");

/**
 * Bridge function called by staffModule when a note is judged.
 * It gathers current state, calls gameLogic.applyScore, and updates main.js state.
 * @param {string} hitType - The type of hit: 'perfect', 'good', or 'miss'.
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
        isGameOver: isGameOver, // Pass main.js's isGameOver state
        noDeathMode: noDeathMode  // Pass main.js's noDeathMode setting
    };

    // Define callbacks that gameLogic can use to trigger actions back in main.js
    const logicCallbacks = {
        triggerGameOverCallback: triggerGameOverInternal, // Pass the internal handler
        updateUICallback: updateInfoUI // Pass UI update function
    };

    // Call the actual scoring logic in gameLogic.js
    // gameLogic.applyScore will mutate the currentLogicGameState object.
    gameLogic.applyScore(hitType, currentLogicGameState, logicCallbacks);

    // Update main.js's state variables from the (potentially) mutated currentLogicGameState object
    playerHealth = currentLogicGameState.playerHealth;
    comboCount = currentLogicGameState.comboCount;
    perfectCount = currentLogicGameState.perfectCount;
    goodCount = currentLogicGameState.goodCount;
    missCount = currentLogicGameState.missCount;
    maxCombo = currentLogicGameState.maxCombo;
    totalScore = currentLogicGameState.totalScore;
    // isGameOver is set by triggerGameOverInternal, so no need to re-assign from currentLogicGameState.isGameOver here.
    // noDeathMode is a setting, not changed by applyScore logic.

    // console.log(`Main (applyScore bridge): State after gameLogic call - Health: ${playerHealth}, Combo: ${comboCount}`);
}

/**
 * Internal handler for game over conditions.
 * Called by gameLogic.applyScore (via callback) or by handleSongEnd.
 * This function then calls gameLogic.triggerGameOver.
 * @param {boolean} songFinished - True if the song completed naturally.
 */
function triggerGameOverInternal(songFinished) {
    console.log(`Main (triggerGameOverInternal): Called with songFinished: ${songFinished}. Current isGameOver: ${isGameOver}`);
    if (isGameOver) { // Prevent re-triggering if already over
        console.warn("Main (triggerGameOverInternal): Already game over. Ignoring.");
        return;
    }

    // Package current state and module/UI references for gameLogic
    const currentLogicGameState = {
        isGameOver: isGameOver,     // Pass current state
        gameIsRunning: gameIsRunning // Pass current state
    };
    const modules = { audio, staff };
    const uiAccess = { playPauseButton, settingsButton, showScoreScreen };

    // Call the centralized game over logic in gameLogic.js
    // gameLogic.triggerGameOver will mutate currentLogicGameState.
    gameLogic.triggerGameOver(songFinished, currentLogicGameState, modules, uiAccess);

    // Update main.js state from the mutated currentLogicGameState object
    isGameOver = currentLogicGameState.isGameOver;
    gameIsRunning = currentLogicGameState.gameIsRunning;

    console.log(`Main (triggerGameOverInternal): State after gameLogic call - isGameOver: ${isGameOver}, gameIsRunning: ${gameIsRunning}`);
}

/**
 * Handles the song ending naturally (callback from audioModule).
 */
function handleSongEnd() {
    console.log("Main (handleSongEnd): Song ended naturally (callback from audioModule).");
    if (!isGameOver) { // Only trigger game over if not already over
        triggerGameOverInternal(true); // True indicates song finished naturally
    }
}

// --- UI Update Functions ---
console.log("Main: Defining UI update functions.");

/** Updates the health bar and combo display on the UI. */
function updateInfoUI() {
    // console.log("Main (updateInfoUI): Updating health and combo display.");
    if (comboCountSpan) {
        comboCountSpan.textContent = comboCount;
    }
    if (healthBarElement) {
        const healthPercentage = Math.max(0, Math.min(100, (playerHealth / gameLogic.MAX_HEALTH) * 100));
        healthBarElement.style.width = `${healthPercentage}%`;

        if (healthPercentage <= 0) {
            healthBarElement.style.backgroundColor = '#555555';
        } else if (healthPercentage < 25) {
            healthBarElement.style.backgroundColor = '#f44336';
        } else if (healthPercentage < 50) {
            healthBarElement.style.backgroundColor = '#ff9800';
        } else {
            healthBarElement.style.backgroundColor = '#4CAF50';
        }
    }
}

/** Updates the displayed values in the settings panel based on current state. */
function updateSettingsUI() {
    console.log("Main (updateSettingsUI): Updating settings panel UI values.");
    updateTimingWindows(); // Recalculate derived timing windows first

    if (staffScaleValueSpan) staffScaleValueSpan.textContent = scrollSpeedPixelsPerSecond;
    if (hitWindowValueSpan) hitWindowValueSpan.textContent = hitWindowGoodMs;
    if (colorToggleSwitch) colorToggleSwitch.checked = useColoredNotes;
    if (noDeathToggleSwitch) noDeathToggleSwitch.checked = noDeathMode;
    console.log("Main (updateSettingsUI): Settings UI update complete.");
}

/** Calculates and displays the final score screen. */
function showScoreScreen() {
    console.log("Main (showScoreScreen): Preparing and displaying score screen.");
    if (!scoreOverlay) {
        console.error("Main (showScoreScreen): Score overlay element not found!");
        return;
    }

    const processedNotes = perfectCount + goodCount + missCount;
    const totalNotesForPercentage = totalNotesInSong > 0 ? totalNotesInSong : processedNotes;
    console.log(`Main (showScoreScreen): totalNotesInSong: ${totalNotesInSong}, processedNotes: ${processedNotes}, totalNotesForPercentage: ${totalNotesForPercentage}`);

    const perfectPercentVal = totalNotesForPercentage > 0 ? ((perfectCount / totalNotesForPercentage) * 100).toFixed(1) : "0.0";
    const goodPercentVal = totalNotesForPercentage > 0 ? ((goodCount / totalNotesForPercentage) * 100).toFixed(1) : "0.0";
    const missPercentVal = totalNotesForPercentage > 0 ? ((missCount / totalNotesForPercentage) * 100).toFixed(1) : "0.0";

    if(scorePerfectCount) scorePerfectCount.textContent = perfectCount;
    if(scorePerfectPercent) scorePerfectPercent.textContent = perfectPercentVal;
    if(scoreGoodCount) scoreGoodCount.textContent = goodCount;
    if(scoreGoodPercent) scoreGoodPercent.textContent = goodPercentVal;
    if(scoreMissCount) scoreMissCount.textContent = missCount;
    if(scoreMissPercent) scoreMissPercent.textContent = missPercentVal;
    if(scoreMaxCombo) scoreMaxCombo.textContent = maxCombo;
    if(scoreTotalScore) scoreTotalScore.textContent = totalScore;

    scoreOverlay.classList.add('visible');
    console.log("Main (showScoreScreen): Score screen displayed.");
}


// --- Layout & Timing Functions ---
console.log("Main: Defining layout and timing functions.");

/** Handles layout adjustments on orientation change or resize. */
function handleLayoutChange() {
    console.log("Main (handleLayoutChange): Adjusting layout for orientation/resize.");
    if (!gameContainer || !infoSection || !staffSection || !bottomPanel || !keyboardSection) {
        console.error("Main (handleLayoutChange): Essential layout containers not found.");
        return;
    }

    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    console.log(`Main (handleLayoutChange): Detected orientation: ${isLandscape ? 'landscape' : 'portrait'}`);

    if (isLandscape) {
        if (infoSection.parentElement !== bottomPanel) {
            bottomPanel.insertBefore(infoSection, keyboardSection);
        }
    } else {
        if (infoSection.parentElement === bottomPanel) {
            gameContainer.insertBefore(infoSection, staffSection);
        }
    }

    if (staff && typeof staff.handleResize === 'function') {
        setTimeout(() => {
            staff.handleResize();
        }, 50);
    } else {
        console.warn("Main (handleLayoutChange): staff.handleResize function not available.");
    }
    console.log("Main (handleLayoutChange): Layout adjustment attempt complete.");
}

/**
 * Recalculates derived timing window variables. Exported for potential external use if needed,
 * and used by staffModule (which imports the derived sec/ms variables directly).
 */
export function updateTimingWindows() {
    hitWindowPerfectMs = Math.floor(hitWindowGoodMs / 2);
    hitWindowGoodSec = hitWindowGoodMs / 1000.0;
    hitWindowPerfectSec = hitWindowPerfectMs / 1000.0;
    console.log(`Main (updateTimingWindows): Good=${hitWindowGoodMs}ms (${hitWindowGoodSec.toFixed(3)}s), Perfect=${hitWindowPerfectMs}ms (${hitWindowPerfectSec.toFixed(3)}s)`);
}


// --- Game Initialization ---
console.log("Main: Defining game initialization functions.");

/**
 * Initializes all game modules and sets up event listeners
 * AFTER audio and notes files have been successfully loaded and parsed.
 * @param {ArrayBuffer} loadedAudioBuffer - The decoded audio data.
 * @param {object} loadedNoteData - The parsed JSON object containing note map data.
 */
async function initializeGame(loadedAudioBuffer, loadedNoteData) {
    console.log("Main (initializeGame): Attempting to initialize game.");
    if (gameInitialized) {
        console.warn("Main (initializeGame): Game already initialized. Skipping.");
        return;
    }
    console.log("--- Main: Initializing Keytap Game ---");

    if(loadingStatus) loadingStatus.textContent = "Initializing audio...";

    totalNotesInSong = loadedNoteData?.tracks?.[0]?.notes?.length || 0;
    console.log(`Main (initializeGame): Total notes in song calculated: ${totalNotesInSong}`);

    // 1. Initialize Audio Module
    console.log("Main (initializeGame): Initializing Audio Module...");
    // Pass handleSongEnd as the callback for when the song finishes naturally
    const audioInitialized = await audio.init(loadedAudioBuffer, handleSongEnd);
    if (!audioInitialized) {
        console.error("Main (initializeGame): Audio module initialization failed.");
        if(loadingStatus) loadingStatus.textContent = "Error: Failed to decode audio.";
        if(startButton) startButton.disabled = false;
        return;
    }
    console.log("Main (initializeGame): Audio Module initialized successfully.");

    if(loadingStatus) loadingStatus.textContent = "Initializing visuals...";

    // 2. Initialize Staff Module
    console.log("Main (initializeGame): Initializing Staff Module...");
    const staffInitialized = staff.init({
        noteDataJson: loadedNoteData,
        staffSectionElement: staffSection,
        setAudioPauseOffset: (newOffset) => {
            audioPauseOffset = newOffset;
            console.log(`Main (initializeGame - staffCallback): audioPauseOffset updated to ${audioPauseOffset.toFixed(3)} by staffModule.`);
        }
    });
    if (!staffInitialized) {
        console.error("Main (initializeGame): Staff module initialization failed.");
        if(loadingStatus) loadingStatus.textContent = "Error: Failed to process notes file.";
        return;
    }
    console.log("Main (initializeGame): Staff Module initialized successfully.");

    // 3. Initialize Keyboard Module
    console.log("Main (initializeGame): Initializing Keyboard Module...");
    initKeyboard({
        judgeKeyPressFunc: staff.judgeKeyPress,
        isGameOverFunc: () => isGameOver,       // Provide a function to get current isGameOver state
        isGameRunningFunc: () => gameIsRunning, // Provide a function to get current gameIsRunning state
    });
    console.log("Main (initializeGame): Keyboard Module initialized successfully.");

    // 4. Set initial UI states
    updateInfoUI();
    updateSettingsUI(); // Also calls updateTimingWindows

    // 5. Set initial layout
    handleLayoutChange();

    // 6. Add Global Event Listeners
    setupGlobalEventListeners();

    gameInitialized = true;
    console.log("--- Main: Keytap Game Initialization Complete ---");
    if(loadingStatus) loadingStatus.textContent = "Ready!";
}

/** Sets up global event listeners for buttons, settings, orientation changes, etc. */
function setupGlobalEventListeners() {
    console.log("Main (setupGlobalEventListeners): Setting up...");

    // Play/Pause Button
    if (playPauseButton && staff && audio) {
        playPauseButton.addEventListener('click', () => {
            console.log("Main: Play/Pause button clicked.");
            if (isGameOver) return;

            audio.resumeContext().then(() => {
                if (gameIsRunning) {
                    audioPauseOffset = staff.pause(); // staff.pause also pauses audio
                    playPauseButton.textContent = "Play";
                    gameIsRunning = false;
                    console.log(`Main: Game Paused. Audio offset: ${audioPauseOffset.toFixed(3)}`);
                } else {
                    staff.play(audioPauseOffset); // staff.play also starts/resumes audio
                    playPauseButton.textContent = "Pause";
                    gameIsRunning = true;
                    console.log(`Main: Game Playing/Resumed from offset: ${audioPauseOffset.toFixed(3)}`);
                }
            }).catch(e => console.error("Main: Failed to resume AudioContext on play/pause:", e));
        });
    } else {
        console.warn("Main (setupGlobalEventListeners): Play/Pause button or modules not found.");
    }

    // Settings Button
    if (settingsButton && settingsOverlay && staff && audio) {
        settingsButton.addEventListener('click', () => {
            console.log("Main: Settings button clicked.");
            if (isGameOver) return;
            if (gameIsRunning) {
                audioPauseOffset = staff.pause();
                if(playPauseButton) playPauseButton.textContent = "Play";
                gameIsRunning = false;
                console.log("Main: Game paused for settings. Offset: " + audioPauseOffset.toFixed(3));
            }
            updateSettingsUI();
            settingsOverlay.classList.add('visible');
        });
    } else {
        console.warn("Main (setupGlobalEventListeners): Settings button/overlay or modules not found.");
    }

    // Close Settings Button
    if (closeSettingsButton && settingsOverlay) {
        closeSettingsButton.addEventListener('click', () => {
            settingsOverlay.classList.remove('visible');
            console.log("Main: Settings overlay closed.");
            if (!gameIsRunning && staff) staff.redraw();
        });
    } else {
        console.warn("Main (setupGlobalEventListeners): Close Settings button or overlay not found.");
    }

     // Settings: Color Toggle Switch
     if (colorToggleSwitch && staff) {
         colorToggleSwitch.addEventListener('change', (event) => {
             useColoredNotes = event.target.checked;
             console.log(`Main: Color notes setting changed to: ${useColoredNotes}`);
             if (staff) staff.redraw();
         });
     } else {
         console.warn("Main (setupGlobalEventListeners): Color toggle or staff module not found.");
     }

     // Settings: No Death Mode Toggle Switch
     if (noDeathToggleSwitch) {
         noDeathToggleSwitch.addEventListener('change', (event) => {
             noDeathMode = event.target.checked;
             console.log(`Main: No Death Mode setting changed to: ${noDeathMode}`);
         });
     } else {
         console.warn("Main (setupGlobalEventListeners): No Death Mode toggle not found.");
     }

     // Settings: Staff Scale Adjustment
     const STAFF_SCALE_STEP = 10, STAFF_SCALE_MIN = 50, STAFF_SCALE_MAX = 200;
     if (staffScaleDownButton && staffScaleUpButton && staff) {
         staffScaleDownButton.addEventListener('click', () => {
             scrollSpeedPixelsPerSecond = Math.max(STAFF_SCALE_MIN, scrollSpeedPixelsPerSecond - STAFF_SCALE_STEP);
             updateSettingsUI(); if (staff) staff.redraw();
             console.log(`Main: Staff scale decreased to: ${scrollSpeedPixelsPerSecond}`);
         });
         staffScaleUpButton.addEventListener('click', () => {
             scrollSpeedPixelsPerSecond = Math.min(STAFF_SCALE_MAX, scrollSpeedPixelsPerSecond + STAFF_SCALE_STEP);
             updateSettingsUI(); if (staff) staff.redraw();
             console.log(`Main: Staff scale increased to: ${scrollSpeedPixelsPerSecond}`);
         });
     } else {
         console.warn("Main (setupGlobalEventListeners): Staff scale buttons or staff module not found.");
     }

     // Settings: Hit Window Adjustment
     const HIT_WINDOW_STEP = 5, HIT_WINDOW_MIN = 30, HIT_WINDOW_MAX = 200;
     if (hitWindowDownButton && hitWindowUpButton) {
         hitWindowDownButton.addEventListener('click', () => {
             hitWindowGoodMs = Math.max(HIT_WINDOW_MIN, hitWindowGoodMs - HIT_WINDOW_STEP);
             updateSettingsUI(); // This calls updateTimingWindows()
             console.log(`Main: Hit window decreased to: ${hitWindowGoodMs}ms`);
         });
         hitWindowUpButton.addEventListener('click', () => {
             hitWindowGoodMs = Math.min(HIT_WINDOW_MAX, hitWindowGoodMs + HIT_WINDOW_STEP);
             updateSettingsUI();
             console.log(`Main: Hit window increased to: ${hitWindowGoodMs}ms`);
         });
     } else {
         console.warn("Main (setupGlobalEventListeners): Hit window buttons not found.");
     }

     // Score Screen: Restart Button
    if (restartButton) {
        restartButton.addEventListener('click', () => {
            console.log("Main: Restart button clicked.");
            // Package current state, modules, and UI access for gameLogic.restartGame
            const currentLogicGameState = {
                playerHealth, comboCount, totalScore, perfectCount, goodCount, missCount, maxCombo,
                isGameOver, gameIsRunning, audioPauseOffset
                // noDeathMode is a setting, typically not reset by restart, but can be included if needed
            };
            const modules = { audio, staff };
            const uiAccess = { scoreOverlay, playPauseButton, settingsButton, updateInfoUI };

            gameLogic.restartGame(currentLogicGameState, modules, uiAccess);

            // Update main.js state from the mutated currentLogicGameState object
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
            console.log("Main: Game state reset via gameLogic.restartGame. Health:", playerHealth);
        });
        console.log("Main (setupGlobalEventListeners): Restart button listener attached.");
    } else {
        console.warn("Main (setupGlobalEventListeners): Restart button not found.");
    }


    // Orientation Change Listener
    const mediaQueryList = window.matchMedia("(orientation: landscape)");
    mediaQueryList.addEventListener("change", handleLayoutChange);

    // Window Resize Listener (Debounced)
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            console.log("Main: Executing debounced resize handling.");
            handleLayoutChange();
        }, 150);
    });
    console.log("Main (setupGlobalEventListeners): Listeners attached.");
}


// --- File Loading Logic ---
console.log("Main: Defining file loading logic.");

/** Checks if both audio and notes files are loaded and updates the start button state. */
function checkFilesLoaded() {
    if (!startButton) return;
    if (audioFileLoaded && notesFileLoaded) {
        if(loadingStatus) loadingStatus.textContent = "Files loaded. Ready to start!";
        startButton.disabled = false;
    } else {
        startButton.disabled = true;
        if (!loadingStatus) return;
        if (!audioFileLoaded && !notesFileLoaded) loadingStatus.textContent = "Please select both files.";
        else if (!audioFileLoaded) loadingStatus.textContent = "Please select an MP3 audio file.";
        else loadingStatus.textContent = "Please select a JSON notes file.";
    }
}

/** Handles audio file selection. */
function handleAudioFileSelect(event) {
    const file = event.target.files[0];
    if (!file) {
        audioFileLoaded = false; audioFileBuffer = null; checkFilesLoaded(); return;
    }
    console.log(`Main: Selected audio: ${file.name}`);
    if (!file.type.startsWith('audio/mpeg') && !file.name.toLowerCase().endsWith('.mp3')) {
        alert("Invalid audio file type. Please select an MP3 file.");
        event.target.value = ''; audioFileLoaded = false; audioFileBuffer = null; checkFilesLoaded(); return;
    }
    if (loadingStatus) loadingStatus.textContent = "Loading audio...";
    if (startButton) startButton.disabled = true;
    const reader = new FileReader();
    reader.onload = (e) => {
        audioFileBuffer = e.target.result; audioFileLoaded = true;
        console.log("Main: Audio file loaded into ArrayBuffer.");
        checkFilesLoaded();
    };
    reader.onerror = () => {
        alert("Error reading audio file."); audioFileLoaded = false; audioFileBuffer = null;
        if (loadingStatus) loadingStatus.textContent = "Error loading audio."; checkFilesLoaded();
    };
    reader.readAsArrayBuffer(file);
}

/** Handles notes file selection. */
function handleNotesFileSelect(event) {
    const file = event.target.files[0];
    if (!file) {
        notesFileLoaded = false; notesJsonData = null; checkFilesLoaded(); return;
    }
    console.log(`Main: Selected notes: ${file.name}`);
    if (!file.type.startsWith('application/json') && !file.name.toLowerCase().endsWith('.json')) {
        alert("Invalid notes file type. Please select a JSON file.");
        event.target.value = ''; notesFileLoaded = false; notesJsonData = null; checkFilesLoaded(); return;
    }
    if (loadingStatus) loadingStatus.textContent = "Loading notes...";
    if (startButton) startButton.disabled = true;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            notesJsonData = JSON.parse(e.target.result);
            if (!notesJsonData || !Array.isArray(notesJsonData.tracks) || notesJsonData.tracks.length === 0) {
                throw new Error("Invalid JSON structure: Missing 'tracks' array or empty.");
            }
            notesFileLoaded = true; console.log("Main: Notes file loaded and parsed.");
            checkFilesLoaded();
        } catch (error) {
            alert(`Error parsing JSON: ${error.message}.`); notesFileLoaded = false; notesJsonData = null;
            if (loadingStatus) loadingStatus.textContent = "Error parsing notes JSON."; checkFilesLoaded();
        }
    };
    reader.onerror = () => {
        alert("Error reading notes file."); notesFileLoaded = false; notesJsonData = null;
        if (loadingStatus) loadingStatus.textContent = "Error loading notes file."; checkFilesLoaded();
    };
    reader.readAsText(file);
}


// --- Entry Point ---
window.addEventListener('load', () => {
    console.log("Main: Window 'load' event. Setting up main script.");

    // Assign Global DOM Elements
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
    console.log("Main: DOM elements assigned.");

    if (!loadingScreen || !startButton || !gameContainer || !audioFileInput || !notesFileInput || !loadingStatus) {
        console.error("CRITICAL ERROR: Essential UI elements for startup are missing!");
        alert("Error: Could not initialize game interface. Key elements missing.");
        return;
    }

    // Attach file input listeners
    if (audioFileInput) audioFileInput.addEventListener('change', handleAudioFileSelect);
    if (notesFileInput) notesFileInput.addEventListener('change', handleNotesFileSelect);

    // Attach start button listener
    startButton.addEventListener('click', async () => {
        console.log("Main: Start button clicked.");
        if (audioFileLoaded && notesFileLoaded && audioFileBuffer && notesJsonData) {
            startButton.disabled = true;
            if(loadingStatus) loadingStatus.textContent = "Starting game...";
            loadingScreen.classList.add('hidden');
            gameContainer.classList.add('visible');
            console.log("Main: Switched to game container.");
            await initializeGame(audioFileBuffer, notesJsonData);
        } else {
            console.warn("Main: Start button clicked, but files not ready.");
            checkFilesLoaded();
        }
    });

    updateTimingWindows(); // Initialize derived timing windows
    checkFilesLoaded();    // Set initial state of start button
    console.log("Main: Setup complete. Waiting for file selection.");
});

console.log("--- main.js finished synchronous execution ---");
