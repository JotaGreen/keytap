// main.js

console.log("--- main.js started execution ---");

/**
 * @file main.js
 * Main entry point and orchestrator for the Keytap game.
 * Loads modules, initializes the game, handles global state and UI updates.
 * Designed to be loaded as an ES Module (<script type="module">).
 */


// --- Module Imports ---

// Import necessary functions/objects from other modules
// Adjust paths/URLs as necessary
import * as audio from './audioModule.js';
import { init as initKeyboard } from './keyboardModule.js';
import * as staff from './staffModule.js'; // Import the new staff module
import { getMidiNoteColor } from './midiColorConverter.js';


// --- Global Variables & State (Module-Scoped within main.js) ---
// Export values needed by other modules (like staffModule.js)

// Game Settings & Constants
export const INITIAL_HEALTH = 50;
export const MAX_HEALTH = 75;
export const MIN_HEALTH = 0;
export const PRE_DELAY_SECONDS = 1.0; // Delay before audio starts (used by staffModule via import)

// Scoring Constants (Can be moved to gameLogic.js later)
const ENERGY_PERFECT = 2;
const ENERGY_GOOD = 0;
const ENERGY_MISS = -5;

// Default values (can be changed in settings)
// Export if needed by other modules (staffModule needs SCROLL_SPEED)
export let SCROLL_SPEED_PIXELS_PER_SECOND = 120;
let HIT_WINDOW_GOOD_MS = 140; // Settings value

// Derived timing values (updated when HIT_WINDOW_GOOD_MS changes)
// Export if needed by other modules (staffModule needs these)
export let HIT_WINDOW_PERFECT_MS = HIT_WINDOW_GOOD_MS / 2;
export let HIT_WINDOW_GOOD_SEC = HIT_WINDOW_GOOD_MS / 1000.0;
export let HIT_WINDOW_PERFECT_SEC = HIT_WINDOW_PERFECT_MS / 1000.0;

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

// File Loading State
let audioFileBuffer = null;
let notesJsonData = null;
let audioFileLoaded = false;
let notesFileLoaded = false;

// Audio Playback State
// This is now managed internally by staffModule dragging via a callback
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


// --- Scoring & Game Logic Functions ---
// To be moved to gameLogic.js later...

/** Calculates the combo bonus energy. */
function calculateComboBonus(currentCombo) { /* ... unchanged ... */ if (currentCombo < 10) return 0; return Math.floor((currentCombo - 1) / 10); }

/** Applies scoring changes based on hit type. */
// Export this function as staffModule needs to import it
export function applyScore(hitType) {
    // Access module-scoped state directly
    if (isGameOver) return;
    let baseEnergyChange = 0; let comboBroken = false;
    if (hitType === 'perfect') { perfectCount++; comboCount++; baseEnergyChange = ENERGY_PERFECT; }
    else if (hitType === 'good') { goodCount++; comboCount++; baseEnergyChange = ENERGY_GOOD; }
    else if (hitType === 'miss') { missCount++; comboBroken = true; baseEnergyChange = ENERGY_MISS; }
    if (comboCount > maxCombo) maxCombo = comboCount;
    const comboBonus = comboBroken ? 0 : calculateComboBonus(comboCount);
    const totalEnergyChange = baseEnergyChange + comboBonus;
    const previousHealth = playerHealth;
    playerHealth = Math.max(MIN_HEALTH, Math.min(MAX_HEALTH, playerHealth + totalEnergyChange));
    const actualHealthChange = playerHealth - previousHealth;
    totalScore += totalEnergyChange;
    if (comboBroken) { if (comboCount > 0) { console.log(`Combo Broken! Was: ${comboCount}`); comboCount = 0; } }
    // console.log(`Score Event: ${hitType.toUpperCase()} | Combo: ${comboCount} (Max: ${maxCombo}) | Health Change: ${actualHealthChange} (Raw: ${totalEnergyChange}) | Health: ${playerHealth}/${MAX_HEALTH} | Score: ${totalScore} | P:${perfectCount} G:${goodCount} M:${missCount}`); // Corrected console log
    // Use template literal correctly
    console.log(`Score Event: ${hitType.toUpperCase()} | Combo: ${comboCount} (Max: ${maxCombo}) | Health Change: ${actualHealthChange} (Raw: ${totalEnergyChange}) | Health: ${playerHealth}/${MAX_HEALTH} | Score: ${totalScore} | P:${perfectCount} G:${goodCount} M:${missCount}`);
    updateInfoUI(); // Update UI
    // Check for Game Over
    if (playerHealth <= MIN_HEALTH && !isGameOver) {
         // Access noDeathMode directly from module scope
         if (!noDeathMode) { triggerGameOver(false); }
         else { console.log("Health reached zero, but No Death Mode is active."); }
    }
}

/** Handles the game over state or song completion. */
// Export function triggerGameOver as it's potentially needed by audio module's callback
export function triggerGameOver(songFinished) {
    // Access module-scoped state directly
    if (isGameOver) return;
    console.log(songFinished ? "--- SONG FINISHED ---" : "--- GAME OVER ---");
    isGameOver = true; gameIsRunning = false; // Update state directly
    // Use imported audio module
    if (audio) audio.pause();
    // Use imported staff module
    if (staff && staff.isRunning()) { staff.pause(); } // Call imported staff function
    if (playPauseButton) { playPauseButton.textContent = songFinished ? "Finished" : "Game Over"; playPauseButton.disabled = true; }
    if (settingsButton) settingsButton.disabled = true;
    showScoreScreen(); // Call internal UI function
}

/** Resets the game state for a new game. */
function restartGame() {
    console.log("--- Restarting Game ---");
    // Reset state directly
    if (scoreOverlay) scoreOverlay.classList.remove('visible');
    playerHealth = INITIAL_HEALTH; comboCount = 0; totalScore = 0; perfectCount = 0; goodCount = 0; missCount = 0; maxCombo = 0;
    isGameOver = false; gameIsRunning = false; audioPauseOffset = 0;
    // Use imported modules
    if (audio) audio.stop();
    if (staff) { staff.resetNotes(); staff.resetTime(); staff.pause(); staff.redraw(); } // Use imported staff functions
    updateInfoUI(); // Update UI
    if (playPauseButton) { playPauseButton.textContent = "Play"; playPauseButton.disabled = false; }
    if (settingsButton) settingsButton.disabled = false;
    console.log("Game state reset.");
}

// --- UI Update Functions ---
// To be moved to ui.js later...

/** Updates the health bar and combo display. */
function updateInfoUI() { /* ... unchanged ... */ if (comboCountSpan) comboCountSpan.textContent = comboCount; if (healthBarElement) { const healthPercentage = Math.max(0, Math.min(100, (playerHealth / MAX_HEALTH) * 100)); healthBarElement.style.width = `${healthPercentage}%`; if (healthPercentage <= 0) { healthBarElement.style.backgroundColor = '#555555'; } else if (healthPercentage < 25) { healthBarElement.style.backgroundColor = '#f44336'; } else if (healthPercentage < 50) { healthBarElement.style.backgroundColor = '#ff9800'; } else { healthBarElement.style.backgroundColor = '#4CAF50'; } } }
/** Updates the displayed values in the settings panel. */
function updateSettingsUI() { /* ... unchanged ... */ updateTimingWindows(); if (staffScaleValueSpan) staffScaleValueSpan.textContent = SCROLL_SPEED_PIXELS_PER_SECOND; if (hitWindowValueSpan) hitWindowValueSpan.textContent = HIT_WINDOW_GOOD_MS; if (colorToggleSwitch) colorToggleSwitch.checked = useColoredNotes; if (noDeathToggleSwitch) noDeathToggleSwitch.checked = noDeathMode; console.log("Settings UI updated."); }
/** Calculates and displays the final score screen. */
function showScoreScreen() { /* ... unchanged ... */ if (!scoreOverlay) return; const processedNotes = perfectCount + goodCount + missCount; totalNotes = notesJsonData?.tracks?.[0]?.notes?.length || processedNotes; /* Recalculate totalNotes here */ const perfectPercent = totalNotes > 0 ? ((perfectCount / totalNotes) * 100).toFixed(1) : 0; const goodPercent = totalNotes > 0 ? ((goodCount / totalNotes) * 100).toFixed(1) : 0; const missPercent = totalNotes > 0 ? ((missCount / totalNotes) * 100).toFixed(1) : 0; if(scorePerfectCount) scorePerfectCount.textContent = perfectCount; if(scorePerfectPercent) scorePerfectPercent.textContent = perfectPercent; if(scoreGoodCount) scoreGoodCount.textContent = goodCount; if(scoreGoodPercent) scoreGoodPercent.textContent = goodPercent; if(scoreMissCount) scoreMissCount.textContent = missCount; if(scoreMissPercent) scoreMissPercent.textContent = missPercent; if(scoreMaxCombo) scoreMaxCombo.textContent = maxCombo; if(scoreTotalScore) scoreTotalScore.textContent = totalScore; scoreOverlay.classList.add('visible'); console.log("Score screen displayed."); }


// --- Layout & Timing Functions ---
// To be moved later...

/** Handles layout adjustments on orientation change or resize. */
function handleLayoutChange() {
    if (!gameContainer || !infoSection || !staffSection || !bottomPanel || !keyboardSection) { console.error("Layout Error: Essential containers not found."); return; }
    const orientation = window.matchMedia("(orientation: landscape)").matches ? 'landscape' : 'portrait';
    if (orientation === 'landscape') { if (infoSection.parentElement !== bottomPanel) { bottomPanel.insertBefore(infoSection, keyboardSection); } }
    else { if (infoSection.parentElement === bottomPanel) { gameContainer.insertBefore(infoSection, staffSection); } }
    // Use imported staff module
    if (staff && typeof staff.handleResize === 'function') {
         setTimeout(staff.handleResize, 50); // Call imported function
    } else { console.warn("Could not trigger staff resize (module not ready?)."); }
}
/** Recalculates derived timing variables. */
// Export if needed by staffModule (they are)
export function updateTimingWindows() {
    HIT_WINDOW_PERFECT_MS = Math.floor(HIT_WINDOW_GOOD_MS / 2);
    HIT_WINDOW_GOOD_SEC = HIT_WINDOW_GOOD_MS / 1000.0;
    HIT_WINDOW_PERFECT_SEC = HIT_WINDOW_PERFECT_MS / 1000.0;
    // Use template literal correctly
    console.log(`Timing windows updated: Good=${HIT_WINDOW_GOOD_MS}ms (${HIT_WINDOW_GOOD_SEC.toFixed(3)}s), Perfect=${HIT_WINDOW_PERFECT_MS}ms (${HIT_WINDOW_PERFECT_SEC.toFixed(3)}s)`);
}


// --- Game Initialization ---

/** Initializes all game modules and sets up event listeners AFTER files are loaded. */
async function initializeGame(loadedAudioBuffer, loadedNoteData) {
    if (gameInitialized) { console.warn("Game already initialized. Skipping."); return; }
    console.log("--- Initializing Keytap Game ---");
    if(loadingStatus) loadingStatus.textContent = "Initializing audio...";

    // Calculate totalNotesInSong here from the loaded data
    totalNotesInSong = loadedNoteData?.tracks?.[0]?.notes?.length || 0;
    console.log(`Total notes calculated: ${totalNotesInSong}`);


    // 1. Initialize Audio Module (imported)
    const handleSongEnd = () => { if (!isGameOver) { triggerGameOver(true); } };
    const audioInitialized = await audio.init(loadedAudioBuffer, handleSongEnd);
    if (!audioInitialized) { /* ... error handling ... */ console.error("Audio module initialization failed."); if(loadingStatus) loadingStatus.textContent = "Error: Failed to decode audio."; if(startButton) startButton.disabled = false; return; }

    if(loadingStatus) loadingStatus.textContent = "Initializing visuals...";

    // 2. Initialize Staff Module (imported)
    const staffInitialized = staff.init({ // Call imported init
        noteDataJson: loadedNoteData,
        staffSectionElement: staffSection, // Pass the DOM element found in onload
        setAudioPauseOffset: (newOffset) => { audioPauseOffset = newOffset; } // Provide setter callback
    });
     if (!staffInitialized) { /* ... error handling ... */ console.error("Staff module initialization failed."); if(loadingStatus) loadingStatus.textContent = "Error: Failed to process notes file."; return; }

    // 3. Initialize Keyboard Module (imported)
    initKeyboard({ // Call imported init
        judgeKeyPressFunc: staff.judgeKeyPress, // Use imported staff function
        isGameOverFunc: () => isGameOver, // Provide function returning current state
        isGameRunningFunc: () => gameIsRunning, // Provide function returning current state
        // No need to pass resumeAudioContextFunc, keyboard imports it from audio now
    });

    // 4. Set initial UI states
    updateInfoUI();
    updateSettingsUI(); // Calls updateTimingWindows

    // 5. Set initial layout
    handleLayoutChange();

    // 6. Add Global Event Listeners ---
    setupGlobalEventListeners();

    gameInitialized = true;
    console.log("--- Keytap Game Initialization Complete ---");
    if(loadingStatus) loadingStatus.textContent = "Ready!";
}

/** Sets up global event listeners for buttons, settings, etc. */
function setupGlobalEventListeners() {
    console.log("Setting up global event listeners...");

    // Play/Pause Button - uses imported staff and audio modules
    if (playPauseButton && staff && audio) {
        playPauseButton.addEventListener('click', () => { if (isGameOver) return; audio.resumeContext().then(() => { if (gameIsRunning) { audioPauseOffset = staff.pause(); playPauseButton.textContent = "Play"; gameIsRunning = false; console.log(`Game Paused. Offset: ${audioPauseOffset.toFixed(3)}`); } else { staff.play(audioPauseOffset); playPauseButton.textContent = "Pause"; gameIsRunning = true; console.log(`Game Playing. Offset: ${audioPauseOffset.toFixed(3)}`); } }).catch(e => console.error("Failed to resume AudioContext on play/pause:", e)); });
    } else { console.warn("Play/Pause button or required modules not found."); }

    // Settings Button - uses imported staff and audio modules
    if (settingsButton && settingsOverlay && staff && audio) {
        settingsButton.addEventListener('click', () => { if (isGameOver) return; console.log("Settings button clicked."); if (gameIsRunning) { audioPauseOffset = staff.pause(); if(playPauseButton) playPauseButton.textContent = "Play"; gameIsRunning = false; console.log("Paused game for settings."); } updateSettingsUI(); settingsOverlay.classList.add('visible'); });
    } else { console.warn("Settings button or required elements/modules not found."); }

    // Close Settings Button - uses imported staff module
    if (closeSettingsButton && settingsOverlay) {
        closeSettingsButton.addEventListener('click', () => { settingsOverlay.classList.remove('visible'); console.log("Settings overlay closed."); if (!gameIsRunning && staff) { staff.redraw(); } });
    } else { console.warn("Close Settings button or overlay not found."); }

     // Settings: Color Toggle Switch - uses imported staff module
     if (colorToggleSwitch && staff) {
         colorToggleSwitch.addEventListener('change', (event) => { useColoredNotes = event.target.checked; console.log(`Color notes setting changed: ${useColoredNotes}`); staff.redraw(); });
     } else { console.warn("Color toggle switch or staff module not found."); }

     // Settings: No Death Mode Toggle Switch
     if (noDeathToggleSwitch) {
         noDeathToggleSwitch.addEventListener('change', (event) => { noDeathMode = event.target.checked; console.log(`No Death Mode setting changed: ${noDeathMode}`); });
     } else { console.warn("No Death toggle switch not found."); }

     // Settings: Staff Scale Adjustment - uses imported staff module
     // Note: SCROLL_SPEED_PIXELS_PER_SECOND needs to be exported if staffModule imports it.
     const STAFF_SCALE_STEP = 10; const STAFF_SCALE_MIN = 50; const STAFF_SCALE_MAX = 200;
     if (staffScaleDownButton && staffScaleUpButton && staff) {
         staffScaleDownButton.addEventListener('click', () => { SCROLL_SPEED_PIXELS_PER_SECOND = Math.max(STAFF_SCALE_MIN, SCROLL_SPEED_PIXELS_PER_SECOND - STAFF_SCALE_STEP); updateSettingsUI(); staff.redraw(); });
         staffScaleUpButton.addEventListener('click', () => { SCROLL_SPEED_PIXELS_PER_SECOND = Math.min(STAFF_SCALE_MAX, SCROLL_SPEED_PIXELS_PER_SECOND + STAFF_SCALE_STEP); updateSettingsUI(); staff.redraw(); });
     } else { console.warn("Staff scale buttons or staff module not found."); }

     // Settings: Hit Window Adjustment
     // Note: HIT_WINDOW_GOOD_MS update calls updateTimingWindows which updates exported vars used by staffModule
     const HIT_WINDOW_STEP = 5; const HIT_WINDOW_MIN = 30; const HIT_WINDOW_MAX = 200;
     if (hitWindowDownButton && hitWindowUpButton) {
         hitWindowDownButton.addEventListener('click', () => { HIT_WINDOW_GOOD_MS = Math.max(HIT_WINDOW_MIN, HIT_WINDOW_GOOD_MS - HIT_WINDOW_STEP); updateSettingsUI(); });
         hitWindowUpButton.addEventListener('click', () => { HIT_WINDOW_GOOD_MS = Math.min(HIT_WINDOW_MAX, HIT_WINDOW_GOOD_MS + HIT_WINDOW_STEP); updateSettingsUI(); });
     } else { console.warn("Hit window buttons not found."); }

     // Score Screen: Restart Button
     if (restartButton) {
         restartButton.addEventListener('click', restartGame);
     } else { console.warn("Restart button not found."); }

    // Orientation Change Listener - uses imported staff module
    window.matchMedia("(orientation: landscape)").addEventListener("change", handleLayoutChange);

    // Window Resize Listener (Debounced) - uses imported staff module
    let resizeTimeout;
    window.addEventListener('resize', () => { clearTimeout(resizeTimeout); resizeTimeout = setTimeout(handleLayoutChange, 150); });

    console.log("Global event listeners attached.");
}


// --- File Loading Logic ---
// Stays in main.js as it orchestrates the start

/** Checks if both files are loaded and updates the start button state. */
function checkFilesLoaded() { /* ... unchanged ... */ if (!startButton) return; if (audioFileLoaded && notesFileLoaded) { if(loadingStatus) loadingStatus.textContent = "Files loaded. Ready to start!"; startButton.disabled = false; console.log("Both files loaded."); } else { startButton.disabled = true; if (!loadingStatus) return; if (!audioFileLoaded && !notesFileLoaded) loadingStatus.textContent = "Please select both files."; else if (!audioFileLoaded) loadingStatus.textContent = "Please select an MP3 audio file."; else loadingStatus.textContent = "Please select a JSON notes file."; } }
/** Handles audio file selection. */
function handleAudioFileSelect(event) { /* ... unchanged ... */ const file = event.target.files[0]; if (!file) { audioFileLoaded = false; audioFileBuffer = null; checkFilesLoaded(); return; } if (!file.type.startsWith('audio/mpeg') && !file.name.toLowerCase().endsWith('.mp3')) { alert("Invalid audio file type. MP3 only."); event.target.value = ''; audioFileLoaded = false; audioFileBuffer = null; checkFilesLoaded(); return; } if (loadingStatus) loadingStatus.textContent = "Loading audio..."; if (startButton) startButton.disabled = true; const reader = new FileReader(); reader.onload = (e) => { audioFileBuffer = e.target.result; audioFileLoaded = true; console.log("Audio file loaded."); checkFilesLoaded(); }; reader.onerror = (e) => { console.error("Error reading audio file:", e); alert("Error reading audio file."); audioFileLoaded = false; audioFileBuffer = null; checkFilesLoaded(); }; reader.readAsArrayBuffer(file); }
/** Handles notes file selection. */
function handleNotesFileSelect(event) { /* ... unchanged ... */ const file = event.target.files[0]; if (!file) { notesFileLoaded = false; notesJsonData = null; checkFilesLoaded(); return; } if (!file.type.startsWith('application/json') && !file.name.toLowerCase().endsWith('.json')) { alert("Invalid notes file type. JSON only."); event.target.value = ''; notesFileLoaded = false; notesJsonData = null; checkFilesLoaded(); return; } if (loadingStatus) loadingStatus.textContent = "Loading notes..."; if (startButton) startButton.disabled = true; const reader = new FileReader(); reader.onload = (e) => { try { notesJsonData = JSON.parse(e.target.result); if (!notesJsonData?.tracks?.length) { throw new Error("Invalid JSON: Missing 'tracks' array."); } notesFileLoaded = true; console.log("Notes file loaded."); checkFilesLoaded(); } catch (error) { console.error("Error parsing JSON file:", error); alert(`Error parsing JSON file: ${error.message}`); notesFileLoaded = false; notesJsonData = null; checkFilesLoaded(); } }; reader.onerror = (e) => { console.error("Error reading notes file:", e); alert("Error reading notes file."); notesFileLoaded = false; notesJsonData = null; checkFilesLoaded(); }; reader.readAsText(file); }


// --- Entry Point ---
// Runs once the HTML document is fully loaded
window.addEventListener('load', () => {
    console.log("Window loaded. Setting up main script.");

    // Assign Global DOM Elements
    loadingScreen = document.getElementById('loadingScreen'); audioFileInput = document.getElementById('audioFile'); notesFileInput = document.getElementById('notesFile'); loadingStatus = document.getElementById('loadingStatus'); startButton = document.getElementById('startButton'); gameContainer = document.getElementById('gameContainer'); infoSection = document.getElementById('infoSection'); staffSection = document.getElementById('staffSection'); bottomPanel = document.getElementById('bottomPanel'); keyboardSection = document.getElementById('keyboardSection'); playPauseButton = document.getElementById('playPauseButton'); settingsButton = document.getElementById('settingsButton'); comboCountSpan = document.getElementById('comboCount'); healthBarElement = document.getElementById('healthBar'); settingsOverlay = document.getElementById('settingsOverlay'); colorToggleSwitch = document.getElementById('colorToggleSwitch'); noDeathToggleSwitch = document.getElementById('noDeathToggleSwitch'); closeSettingsButton = document.getElementById('closeSettingsButton'); staffScaleValueSpan = document.getElementById('staffScaleValue'); staffScaleDownButton = document.getElementById('staffScaleDown'); staffScaleUpButton = document.getElementById('staffScaleUp'); hitWindowValueSpan = document.getElementById('hitWindowValue'); hitWindowDownButton = document.getElementById('hitWindowDown'); hitWindowUpButton = document.getElementById('hitWindowUp'); scoreOverlay = document.getElementById('scoreOverlay'); scorePerfectCount = document.getElementById('scorePerfectCount'); scorePerfectPercent = document.getElementById('scorePerfectPercent'); scoreGoodCount = document.getElementById('scoreGoodCount'); scoreGoodPercent = document.getElementById('scoreGoodPercent'); scoreMissCount = document.getElementById('scoreMissCount'); scoreMissPercent = document.getElementById('scoreMissPercent'); scoreMaxCombo = document.getElementById('scoreMaxCombo'); scoreTotalScore = document.getElementById('scoreTotalScore'); restartButton = document.getElementById('restartButton');

    // Check essential elements
    if (!loadingScreen || !startButton || !gameContainer) { console.error("CRITICAL: Essential elements not found!"); alert("Error: Could not initialize interface."); return; }

    // Attach file input listeners
    if (audioFileInput) audioFileInput.addEventListener('change', handleAudioFileSelect);
    if (notesFileInput) notesFileInput.addEventListener('change', handleNotesFileSelect);

    // Attach start button listener
    startButton.addEventListener('click', async () => {
        if (audioFileLoaded && notesFileLoaded) {
            console.log("Start button clicked."); startButton.disabled = true; if(loadingStatus) loadingStatus.textContent = "Starting game...";
            loadingScreen.classList.add('hidden'); gameContainer.classList.add('visible');
            await initializeGame(audioFileBuffer, notesJsonData); // Initialize game
        } else { console.warn("Start button clicked but files not ready."); checkFilesLoaded(); }
    });

    // Initial setup
    updateTimingWindows(); // Initialize derived timing windows
    checkFilesLoaded();
    console.log("Main script setup complete. Waiting for file selection.");
});

// Ensure state getter functions are exported if needed elsewhere, though currently keyboard gets them via function reference
// export function getIsGameOver() { return isGameOver; }
// export function getIsGameRunning() { return gameIsRunning; }

