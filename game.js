// game.js
// Main JavaScript file for the Piano Sight Reading Rhythm Game

// Strict mode helps catch common coding errors and "unsafe" actions.
'use strict';

// Removed the unnecessary $(() => { ... }); wrapper

// ============================
// Global Variables & State
// ============================

// --- PixiJS Application ---
/** @type {PIXI.Application | null} Reference to the Pixi Application */
let pixiApp = null;
/** @type {PIXI.Container | null} Main container for all game visual elements */
let stage = null;
/** @type {PIXI.Graphics | null} Graphics object for drawing staff lines */
let staffLinesGfx = null;
// Add more PixiJS object references here as needed (notes container, keyboard keys, etc.)

// --- Web Audio API ---
/** @type {AudioContext | null} The main Audio Context */
let audioContext = null;
/** @type {AudioBuffer | null} Decoded audio data for the loaded song */
let loadedAudioBuffer = null;
/** @type {AudioBufferSourceNode | null} The node playing the audio */
let audioSourceNode = null;
/** @type {GainNode | null} Node to control the master volume */
let masterGainNode = null;
/** @type {number} Start time of audio playback relative to audioContext.currentTime */
let audioStartTime = 0;
/** @type {number} Offset within the audio buffer to start playback (for resuming) */
let audioStartOffset = 0;
/** @type {boolean} Flag indicating if audio is currently playing */
let isAudioPlaying = false;

// --- Game Data & State ---
/** @type {object | null} Parsed JSON Note Map data */
let noteMapData = null;
/** @type {boolean} Flag indicating if audio file is loaded and decoded */
let isAudioLoaded = false;
/** @type {boolean} Flag indicating if JSON file is loaded and parsed */
let isJsonLoaded = false;
/** @type {string} ID of the currently visible screen */
let currentScreen = 'loading-screen'; // Initial screen
/** @type {number | null} ID returned by requestAnimationFrame */
let animationFrameId = null;
/** @type {object} Holds the current game settings */
const gameSettings = {
    volume: 0.75,
    darkMode: false,
    scrollSpeed: 1.0, // Multiplier for scroll speed
    noteColorMode: 'color', // 'color' or 'black'
    noDeathMode: false,
    waitMode: false,
    hitWindowMs: 70, // Base hit window in milliseconds (+/- this value)
    playbackRate: 1.0, // Speed of audio playback
    showNoteNames: false,
    latencyOffsetMs: 0 // Audio/visual latency offset in milliseconds
};
/** @type {boolean} Flag indicating if the game is paused */
let isPaused = false;
// Add more game state variables (score, combo, health, etc.)

// --- DOM Element References ---
// Screen Containers
const loadingScreen = document.getElementById('loading-screen');
const gameScreen = document.getElementById('game-screen');
const pauseOverlay = document.getElementById('pause-overlay');
const resultsScreen = document.getElementById('results-screen');
const screens = { // Helper object for easy access
    'loading-screen': loadingScreen,
    'game-screen': gameScreen,
    'pause-overlay': pauseOverlay,
    'results-screen': resultsScreen
};

// Loading Screen Elements
const audioFileInput = document.getElementById('audio-file-input');
const jsonFileInput = document.getElementById('json-file-input');
const loadingStatus = document.getElementById('loading-status');
const settingsArea = document.getElementById('settings-area'); // For adding settings controls later
const startButton = document.getElementById('start-button');
const loadTestDataButton = document.getElementById('load-test-data-button');
const loadingIndicator = document.getElementById('loading-indicator');

// Game Screen Elements
const staffArea = document.getElementById('staff-area'); // PixiJS canvas will be added here
const infoDisplay = document.getElementById('info-display');
const keyboardArea = document.getElementById('keyboard-area'); // Keyboard will be rendered here
const healthValue = document.getElementById('health-value');
const healthBarFill = document.getElementById('health-bar-fill');
const comboCount = document.getElementById('combo-count');
const scoreValue = document.getElementById('score-value');
const pauseButton = document.getElementById('pause-button');

// Pause Overlay Elements
const resumeButton = document.getElementById('resume-button');
const quitButton = document.getElementById('quit-button');

// Results Screen Elements
const finalScore = document.getElementById('final-score')?.querySelector('span');
const perfectPercent = document.getElementById('perfect-percent');
const perfectCount = document.getElementById('perfect-count');
const goodPercent = document.getElementById('good-percent');
const goodCount = document.getElementById('good-count');
const missPercent = document.getElementById('miss-percent');
const missCount = document.getElementById('miss-count');
const maxCombo = document.getElementById('max-combo');
const resultMessage = document.getElementById('result-message');
const returnToMenuButton = document.getElementById('return-to-menu-button');

// ========================
// Initialization Logic
// ========================

/**
 * Initializes the entire game application.
 * Called once the DOM is fully loaded.
 */
function init() {
    console.log("Initializing game...");

    // **DEBUG**: Check if PIXI object exists
    if (typeof PIXI === 'undefined') {
        console.error("PIXI object not found. PixiJS library might not have loaded correctly.");
        updateLoadingStatus("Error: Graphics library failed to load.", true);
        if (startButton) startButton.disabled = true;
        if (loadTestDataButton) loadTestDataButton.disabled = true;
        return; // Stop initialization if PixiJS isn't loaded
    } else {
        console.log("PIXI object found:", PIXI);
    }

    // 1. Setup Audio Context
    setupAudio();

    // 2. Setup PixiJS Application
    setupPixi();

    // 3. Setup Event Listeners for UI elements
    setupEventListeners();

    // 4. Setup Settings Controls (Basic placeholders for now)
    setupSettingsControls();

    // 5. Initial Screen Setup (already done via HTML/CSS 'active' class)

    console.log("Initialization complete. Waiting for files.");
    updateLoadingStatus("Please load an MP3 audio file and a Note Map JSON file.", false);

    // 6. Add resize listener for layout adjustments
    window.addEventListener('resize', handleResize);
    handleResize(); // Call once initially to set correct layout
}

/**
 * Creates and configures the Web Audio API context and gain node.
 */
function setupAudio() {
    try {
        // Check if AudioContext is already created (e.g., by a previous init attempt)
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (!audioContext) {
                throw new Error("Web Audio API is not supported in this browser.");
            }
            masterGainNode = audioContext.createGain();
            masterGainNode.gain.value = gameSettings.volume; // Set initial volume
            masterGainNode.connect(audioContext.destination); // Connect gain node to output
            console.log("AudioContext created successfully.");
        } else {
            console.log("AudioContext already exists.");
        }
    } catch (error) {
        console.error("Error setting up AudioContext:", error);
        updateLoadingStatus(`Error: ${error.message}`, true);
        // Disable relevant features if audio context fails
        if (startButton) startButton.disabled = true;
        if (loadTestDataButton) loadTestDataButton.disabled = true;
    }
}

/**
 * Creates and configures the PixiJS application and adds its canvas to the DOM.
 */
function setupPixi() {
    // Ensure staffArea exists before proceeding
    if (!staffArea) {
        console.error("Staff area element not found in DOM.");
        updateLoadingStatus("Error: Cannot initialize graphics - required element missing.", true);
        return;
    }

    try {
        // Check if PixiApp is already created
        if (!pixiApp) {
            pixiApp = new PIXI.Application({
                resizeTo: staffArea, // Automatically resize canvas to fit the container
                backgroundColor: getPixiBackgroundColor(), // Use theme color
                antialias: true, // Enable anti-aliasing for smoother graphics
                resolution: window.devicePixelRatio || 1, // Adjust resolution for device screen density
                autoDensity: true, // Automatically handle density changes
                // view: document.createElement('canvas') // Alternative: create canvas manually if needed
            });

            if (!pixiApp) {
                // This check might be redundant if the constructor throws on failure, but safe to keep.
                throw new Error("PIXI.Application constructor returned null or undefined.");
            }

            // **DEBUG**: Check if the view (canvas) was created
            if (!pixiApp.view || !(pixiApp.view instanceof HTMLCanvasElement)) {
                console.error("pixiApp.view is not a valid canvas element:", pixiApp.view);
                throw new Error("PixiJS Application failed to create a valid view (canvas).");
            }

            // Add the PixiJS canvas to the designated DOM element
            // Clear staffArea first in case of re-initialization attempts
            while (staffArea.firstChild) {
                staffArea.removeChild(staffArea.firstChild);
            }
            staffArea.appendChild(pixiApp.view);

            stage = pixiApp.stage; // Get reference to the main container

            console.log("PixiJS Application created and view added successfully.");

            // Draw basic staff lines (placeholder)
            staffLinesGfx = new PIXI.Graphics();
            stage.addChild(staffLinesGfx);
            drawStaffLines(); // Draw initial staff lines

        } else {
            console.log("PixiJS Application already exists.");
            // If re-initializing, ensure canvas is still in the DOM and visible
             if (!staffArea.contains(pixiApp.view)) {
                 staffArea.appendChild(pixiApp.view);
             }
            // Redraw static elements if needed
            drawStaffLines();
        }

    } catch (error) {
        console.error("Error setting up PixiJS:", error);
        // Try to provide more context if possible
        let detailedMessage = `Error: Failed to initialize graphics. ${error.message}`;
        if (error.stack) {
            console.error("Stack trace:", error.stack);
        }
        // Check for WebGL issues (common cause)
        if (!window.WebGLRenderingContext) {
             detailedMessage += " WebGL might not be supported or enabled in your browser.";
        } else {
            try {
                const tempCanvas = document.createElement('canvas');
                const gl = tempCanvas.getContext('webgl') || tempCanvas.getContext('experimental-webgl');
                if (!gl) {
                    detailedMessage += " Failed to get WebGL context.";
                }
            } catch (e) {
                detailedMessage += " Error checking WebGL context.";
            }
        }

        updateLoadingStatus(detailedMessage, true);

        // Disable relevant features if Pixi fails
        if (startButton) startButton.disabled = true;
        if (loadTestDataButton) loadTestDataButton.disabled = true;
        pixiApp = null; // Ensure pixiApp is null if setup failed
        stage = null;
    }
}


/**
 * Attaches event listeners to buttons and inputs.
 */
function setupEventListeners() {
    // Remove previous listeners first to prevent duplicates if init is called multiple times
    audioFileInput?.removeEventListener('change', handleAudioFileInput);
    jsonFileInput?.removeEventListener('change', handleJsonFileInput);
    startButton?.removeEventListener('click', startGame);
    loadTestDataButton?.removeEventListener('click', loadTestData);
    pauseButton?.removeEventListener('click', pauseGame);
    resumeButton?.removeEventListener('click', resumeGame);
    quitButton?.removeEventListener('click', quitGame);
    returnToMenuButton?.removeEventListener('click', quitGame);

    // Add listeners
    audioFileInput?.addEventListener('change', handleAudioFileInput);
    jsonFileInput?.addEventListener('change', handleJsonFileInput);
    startButton?.addEventListener('click', startGame);
    loadTestDataButton?.addEventListener('click', loadTestData);
    pauseButton?.addEventListener('click', pauseGame);
    resumeButton?.addEventListener('click', resumeGame);
    quitButton?.addEventListener('click', quitGame);
    returnToMenuButton?.addEventListener('click', quitGame); // Quit also returns to menu

    // Add listeners for settings controls later
}

/**
 * Sets up the initial display and handlers for game settings.
 * (This will be expanded significantly later)
 */
function setupSettingsControls() {
    // Example: Basic volume control
    const volumeContainer = document.getElementById('volume-control');
    if (volumeContainer) {
         // Clear previous controls
        volumeContainer.innerHTML = '';

        const volumeLabel = document.createElement('label');
        volumeLabel.textContent = 'Volume:';
        volumeLabel.htmlFor = 'volume-slider'; // Associate label with input

        const volumeSlider = document.createElement('input');
        volumeSlider.type = 'range';
        volumeSlider.id = 'volume-slider'; // Add id for label association
        volumeSlider.min = '0';
        volumeSlider.max = '1';
        volumeSlider.step = '0.01';
        volumeSlider.value = String(gameSettings.volume); // Ensure value is string

        volumeSlider.addEventListener('input', (e) => {
            const newVolume = parseFloat(e.target.value);
            gameSettings.volume = newVolume;
            if (masterGainNode && audioContext) {
                // Use setTargetAtTime for smoother volume changes
                masterGainNode.gain.setTargetAtTime(newVolume, audioContext.currentTime, 0.01);
            }
            // Optional: Update a visual display of the volume value
        });

        volumeContainer.appendChild(volumeLabel);
        volumeContainer.appendChild(volumeSlider);
    }


    // Add placeholders or basic controls for other settings here
    // - Theme toggle
    // - Scroll speed
    // - Note color
    // - etc.
}

// ========================
// Screen Management
// ========================

/**
 * Switches the visible screen by adding/removing the 'active' class.
 * @param {string} screenId - The ID of the screen div to show.
 */
function switchScreen(screenId) {
    if (!screens[screenId]) {
        console.error(`Screen with ID "${screenId}" not found.`);
        return;
    }

    // Hide the currently active screen (if different)
    if (currentScreen && screens[currentScreen] && currentScreen !== screenId) {
        screens[currentScreen].classList.remove('active');
    }

    // Show the new screen
    screens[screenId].classList.add('active');
    currentScreen = screenId;
    console.log(`Switched to screen: ${screenId}`);

    // Special handling for certain screen transitions
    if (screenId === 'game-screen') {
        // Ensure PixiJS renderer size is correct when switching to game screen
        handleResize(); // Resize might be needed if dimensions changed while on another screen
        // Ensure the game loop starts if resuming to the game screen (handled by resumeGame)
    } else if (screenId === 'loading-screen') {
        // Reset flags and UI elements when returning to loading screen
        resetLoadingState();
    } else if (screenId === 'pause-overlay') {
        // Make sure pause overlay is displayed correctly (CSS should handle this)
        // May need to ensure game-screen remains visible underneath if it's an overlay
        screens['game-screen'].classList.add('active'); // Ensure game screen stays visible under pause
        screens['pause-overlay'].classList.add('active'); // Activate pause overlay
    } else if (currentScreen === 'pause-overlay' && screenId !== 'game-screen') {
         // If moving away from pause overlay to something other than game screen, hide game screen too
         screens['game-screen']?.classList.remove('active');
    }


}

/**
 * Resets file loading state and UI elements on the loading screen.
 */
function resetLoadingState() {
    isAudioLoaded = false;
    isJsonLoaded = false;
    loadedAudioBuffer = null;
    noteMapData = null;

    if (audioFileInput) audioFileInput.value = ''; // Clear file input
    if (jsonFileInput) jsonFileInput.value = '';

    if (startButton) {
        startButton.disabled = true;
        startButton.textContent = 'Load Files to Start';
    }
    updateLoadingStatus("Please load an MP3 audio file and a Note Map JSON file.", false);
}

// ========================
// File Handling
// ========================

/**
 * Handles the selection of an audio file.
 * @param {Event} event - The file input change event.
 */
function handleAudioFileInput(event) {
    const file = event.target.files?.[0];
    if (file && audioContext) {
        showLoadingIndicator(true);
        updateLoadingStatus(`Loading audio: ${file.name}...`, false);
        isAudioLoaded = false; // Reset flag
        loadedAudioBuffer = null; // Clear previous buffer
        checkFilesLoaded(); // Update button state

        const reader = new FileReader();

        reader.onload = (e) => {
            const arrayBuffer = e.target.result;
            // Use Promise-based decodeAudioData
            audioContext.decodeAudioData(arrayBuffer)
                .then(decodedBuffer => {
                    loadedAudioBuffer = decodedBuffer;
                    isAudioLoaded = true;
                    console.log(`Audio decoded successfully: ${file.name}`);
                    updateLoadingStatus(`Audio loaded: ${file.name}`, false);
                })
                .catch(error => {
                    console.error("Error decoding audio data:", error);
                    updateLoadingStatus(`Error decoding audio: ${error.message}. Please try a different MP3 file.`, true);
                    isAudioLoaded = false; // Ensure flag is false on error
                    loadedAudioBuffer = null;
                })
                .finally(() => {
                    showLoadingIndicator(false);
                    checkFilesLoaded(); // Final check after attempt
                });
        };

        reader.onerror = (e) => {
            console.error("Error reading audio file:", e);
            updateLoadingStatus(`Error reading file: ${file.name}.`, true);
            isAudioLoaded = false;
            loadedAudioBuffer = null;
            showLoadingIndicator(false);
            checkFilesLoaded();
        };

        reader.readAsArrayBuffer(file);

    } else if (!audioContext) {
        updateLoadingStatus("Audio system not initialized. Cannot load audio.", true);
    }
}

/**
 * Handles the selection of a JSON note map file.
 * @param {Event} event - The file input change event.
 */
function handleJsonFileInput(event) {
    const file = event.target.files?.[0];
    if (file) {
        showLoadingIndicator(true);
        updateLoadingStatus(`Loading JSON: ${file.name}...`, false);
        isJsonLoaded = false; // Reset flag
        noteMapData = null; // Clear previous data
        checkFilesLoaded(); // Update button state

        const reader = new FileReader();

        reader.onload = (e) => {
            const text = e.target.result;
            try {
                noteMapData = JSON.parse(text);

                // Basic validation (check for header and tracks array)
                if (!noteMapData || typeof noteMapData !== 'object' || !noteMapData.header || !Array.isArray(noteMapData.tracks) || noteMapData.tracks.length === 0) {
                    throw new Error("Invalid JSON structure. Missing header or tracks array, or tracks array is empty.");
                }
                 // Check for notes array in the first track
                 if (!noteMapData.tracks[0].notes || !Array.isArray(noteMapData.tracks[0].notes)) {
                     console.warn("First track in JSON is missing a valid 'notes' array.");
                     // Decide if this is an error or just a warning
                     // throw new Error("First track in JSON is missing a 'notes' array.");
                 }


                // Further validation could be added here (check ppq, tempos, notes structure)
                isJsonLoaded = true;
                console.log(`JSON parsed successfully: ${file.name}`);
                console.log("Note Map Header:", noteMapData.header);
                console.log(`Found ${noteMapData.tracks[0]?.notes?.length ?? 0} notes in the first track.`); // Use ?? for nullish coalescing
                updateLoadingStatus(`Note map loaded: ${file.name}`, false);

            } catch (error) {
                console.error("Error parsing JSON data:", error);
                updateLoadingStatus(`Error parsing JSON: ${error.message}. Please ensure it's a valid ToneJS MIDI JSON file.`, true);
                noteMapData = null;
                isJsonLoaded = false; // Ensure flag is false on error
            } finally {
                showLoadingIndicator(false);
                checkFilesLoaded();
            }
        };

        reader.onerror = (e) => {
            console.error("Error reading JSON file:", e);
            updateLoadingStatus(`Error reading file: ${file.name}.`, true);
            isJsonLoaded = false;
            noteMapData = null;
            showLoadingIndicator(false);
            checkFilesLoaded();
        };

        reader.readAsText(file);
    }
}

/**
 * Fetches and processes the default test audio and JSON files.
 */
async function loadTestData() {
    if (!audioContext) {
        updateLoadingStatus("Audio system not initialized. Cannot load test data.", true);
        return;
    }
    showLoadingIndicator(true);
    updateLoadingStatus("Loading test data...", false);
    isAudioLoaded = false;
    isJsonLoaded = false;
    loadedAudioBuffer = null;
    noteMapData = null;
    checkFilesLoaded(); // Disable start button

    const audioPath = 'testData/test.mp3';
    const jsonPath = 'testData/test.json';

    try {
        // Fetch and process audio
        const audioPromise = fetch(audioPath)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to fetch ${audioPath}: ${response.statusText}`);
                return response.arrayBuffer();
            })
            .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
            .then(decodedBuffer => {
                loadedAudioBuffer = decodedBuffer;
                isAudioLoaded = true;
                console.log("Test audio loaded and decoded.");
                updateLoadingStatus("Test audio loaded.", false);
            });

        // Fetch and process JSON
        const jsonPromise = fetch(jsonPath)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to fetch ${jsonPath}: ${response.statusText}`);
                return response.text();
            })
            .then(jsonText => {
                noteMapData = JSON.parse(jsonText);
                if (!noteMapData || typeof noteMapData !== 'object' || !noteMapData.header || !Array.isArray(noteMapData.tracks) || noteMapData.tracks.length === 0) {
                    throw new Error("Invalid JSON structure in test data.");
                }
                 if (!noteMapData.tracks[0].notes || !Array.isArray(noteMapData.tracks[0].notes)) {
                     console.warn("Test JSON first track is missing a valid 'notes' array.");
                 }
                isJsonLoaded = true;
                console.log("Test JSON loaded and parsed.");
                console.log("Test Note Map Header:", noteMapData.header);
                console.log(`Found ${noteMapData.tracks[0]?.notes?.length ?? 0} notes in the first track.`);
                updateLoadingStatus("Test JSON loaded.", false);
            });

        // Wait for both fetches to complete
        await Promise.all([audioPromise, jsonPromise]);

        updateLoadingStatus("Test data loaded successfully!", false);

    } catch (error) {
        console.error("Error loading test data:", error);
        updateLoadingStatus(`Error loading test data: ${error.message}`, true);
        // Reset flags on error
        isAudioLoaded = false;
        isJsonLoaded = false;
        loadedAudioBuffer = null;
        noteMapData = null;
    } finally {
        showLoadingIndicator(false);
        checkFilesLoaded();
    }
}


/**
 * Checks if both audio and JSON files are loaded and updates the start button state.
 */
function checkFilesLoaded() {
    if (isAudioLoaded && isJsonLoaded && startButton) {
        startButton.disabled = false;
        startButton.textContent = 'Start Game';
    } else if (startButton) {
        startButton.disabled = true;
        // Keep the text as "Load Files to Start" or update based on which file is missing
        if (!isAudioLoaded && !isJsonLoaded) {
            startButton.textContent = 'Load Files to Start';
        } else if (!isAudioLoaded) {
            startButton.textContent = 'Load Audio File';
        } else { // !isJsonLoaded
            startButton.textContent = 'Load Note Map File';
        }
    }
}

/**
 * Updates the status message on the loading screen.
 * @param {string} message - The text to display.
 * @param {boolean} [isError=false] - If true, displays the message as an error.
 */
function updateLoadingStatus(message, isError = false) {
    if (loadingStatus) {
        loadingStatus.textContent = message;
        // Ensure CSS variables are accessible, otherwise fallback
        loadingStatus.style.color = isError ? (getComputedStyle(document.body).getPropertyValue('--error-color') || 'red')
                                             : (getComputedStyle(document.body).getPropertyValue('--primary-color') || 'blue');
    }
}


/**
 * Shows or hides the loading indicator overlay.
 * @param {boolean} show - True to show, false to hide.
 */
function showLoadingIndicator(show) {
    if (loadingIndicator) {
        loadingIndicator.classList.toggle('active', show);
    }
}

// ==================================
// Game Flow Control
// ==================================

/**
 * Starts the main game loop and audio playback.
 */
function startGame() {
    if (!isAudioLoaded || !noteMapData || !audioContext || !pixiApp || !stage) { // Added !stage check
        console.error("Cannot start game: Files not loaded or core systems not initialized.");
        updateLoadingStatus("Error: Cannot start game. Ensure files are loaded and system is ready.", true);
        return;
    }

    console.log("Starting game...");
    isPaused = false;
    audioStartOffset = 0; // Start from the beginning

    // Reset game state (score, health, combo, etc.) - TODO
    // resetGameState(); // Call a dedicated function for this

    // Pre-process notes if needed (e.g., calculate screen positions, colors) - TODO
    // prepareNotes();

    // Switch to the game screen
    switchScreen('game-screen');

    // Small delay before starting audio/visuals (as requested ~100ms)
    // Use audioContext.currentTime for scheduling the actual start
    const visualPreDelay = 0.100; // 100ms visual pre-delay
    const now = audioContext.currentTime;
    audioStartTime = now + visualPreDelay; // Schedule audio start slightly after 'now'

    // Start audio playback (scheduled)
    playAudio();

    // Start the game loop (rendering)
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId); // Cancel previous loop if any
    }
    animationFrameId = requestAnimationFrame(gameLoop);
    console.log(`Game started. Audio scheduled to start at: ${audioStartTime.toFixed(3)}`);
}

/**
 * The main game loop, called repeatedly by requestAnimationFrame.
 * @param {DOMHighResTimeStamp} timestamp - The time elapsed since navigation start (provided by requestAnimationFrame).
 */
function gameLoop(timestamp) {
    // Immediately request the next frame to maintain smooth animation,
    // unless paused or stopped.
    if (!isPaused) {
        animationFrameId = requestAnimationFrame(gameLoop);
    } else {
        // If paused, ensure animationFrameId is null so resumeGame knows to restart the loop.
        animationFrameId = null;
        return; // Exit loop if paused
    }

    // Ensure audio context is available
    if (!audioContext) {
        console.error("Game loop running without audio context.");
        pauseGame(); // Stop the game if audio context is lost
        return;
    }

    // Calculate current time within the song
    // This is the CRITICAL part for synchronization
    const elapsed = audioContext.currentTime - audioStartTime;
    const currentTime = audioStartOffset + elapsed * gameSettings.playbackRate;

    // --- Update Game Logic ---
    // 1. Check for missed notes based on currentTime
    // updateMissedNotes(currentTime);
    // 2. Handle player input checks (from keyboard events) - compare against note times
    // processInput(currentTime);
    // 3. Update score, health, combo based on hits/misses
    // updateScoreboard();
    // 4. Check for game over conditions
    // checkGameOver(currentTime);


    // --- Update Visuals (PixiJS Rendering) ---
     if (pixiApp && stage) { // Ensure Pixi is ready
        // 1. Clear previous drawings if necessary (Pixi often handles this, but specific elements might need clearing)

        // 2. Calculate and update positions of notes based on currentTime and scrollSpeed
        // updateNotePositions(currentTime, gameSettings.scrollSpeed);

        // 3. Draw/update staff elements if needed (less frequent, e.g., dynamic key signatures?)
        // drawDynamicStaffElements(currentTime);

        // 4. Draw/update keyboard state (pressed keys)
        // updateKeyboardVisuals();

        // 5. Draw/update UI elements (score, combo, health bar) - Can be done via DOM manipulation too
        // updateInfoDisplayDOM(); // Example: update DOM elements directly

        // PixiJS automatically renders the stage at the end of the browser frame,
        // so explicit render call is usually not needed unless using legacy renderer or specific settings.
     }


    // Example: Log current song time periodically
    // if (Math.random() < 0.01) console.log(`Song Time: ${currentTime.toFixed(3)}s`);

    // TODO: Implement actual game logic and rendering updates here
}

/**
 * Pauses the game audio and loop.
 */
function pauseGame() {
    if (!isAudioPlaying || isPaused) return; // Don't pause if not playing or already paused

    isPaused = true;
    console.log("Attempting to pause game...");

    // Stop the rendering loop *before* stopping audio to get accurate offset
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        // animationFrameId is set to null within the gameLoop when paused
    }

    // Calculate how much time has passed since the last start/resume
    // Ensure audioContext and audioStartTime are valid
    if (audioContext && audioStartTime > 0) {
        const elapsed = audioContext.currentTime - audioStartTime;
         // Ensure elapsed time is non-negative
         if (elapsed >= 0) {
            audioStartOffset += elapsed * gameSettings.playbackRate; // Store progress
            console.log(`Calculated elapsed time: ${elapsed.toFixed(3)}s, New offset: ${audioStartOffset.toFixed(3)}s`);
         } else {
             console.warn("Negative elapsed time detected during pause, offset not updated.");
         }
    } else {
        console.warn("Could not update audio offset on pause: audio context or start time invalid.");
    }


    // Stop the audio source node safely
    if (audioSourceNode) {
        try {
            // Remove the onended handler temporarily to prevent it firing due to stop()
            audioSourceNode.onended = null;
            audioSourceNode.stop();
            audioSourceNode.disconnect(); // Disconnect to allow garbage collection
            console.log("Audio source stopped and disconnected.");
        } catch (e) {
            console.warn("Error stopping audio source node (might have already stopped):", e);
        } finally {
            audioSourceNode = null;
        }
    } else {
         console.log("No active audio source node to stop.");
    }

    isAudioPlaying = false;

    // Show the pause overlay
    switchScreen('pause-overlay'); // Show overlay, keeping game screen visible underneath

    console.log(`Game paused. Stored offset: ${audioStartOffset.toFixed(3)}s`);
}


/**
 * Resumes the game from the paused state.
 */
function resumeGame() {
    if (!isPaused || isAudioPlaying || !audioContext) return; // Don't resume if not paused, already playing, or no audio context

    console.log("Resuming game...");
    isPaused = false;

    // Hide the pause overlay and ensure game screen is active
    switchScreen('game-screen'); // This should hide pause and ensure game is active

    // Set the new start time reference for the game loop and audio scheduling
    const now = audioContext.currentTime;
    // Add a small buffer to prevent immediate elapsed time calculation issues
    const resumeDelay = 0.05;
    audioStartTime = now + resumeDelay; // Reset start time reference for elapsed calculation, scheduled slightly ahead

    // Restart audio playback from the stored offset, scheduled slightly ahead
    playAudio(resumeDelay); // Pass delay to playAudio for scheduling

    // Restart the game loop
    if (!animationFrameId) {
        console.log("Restarting animation frame loop.");
        animationFrameId = requestAnimationFrame(gameLoop);
    } else {
        console.warn("Animation frame ID already exists on resume?");
    }

    console.log(`Game resumed from offset: ${audioStartOffset.toFixed(3)}s. Audio scheduled for ${audioStartTime.toFixed(3)}`);
}


/**
 * Stops the game and returns to the loading screen.
 */
function quitGame() {
    console.log("Quitting game...");
    isPaused = true; // Ensure loop stops if it hasn't already

    // Stop rendering loop
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log("Animation frame cancelled.");
    }

    // Stop audio playback safely
    if (audioSourceNode) {
        try {
            audioSourceNode.onended = null; // Prevent onended handler during manual stop
            audioSourceNode.stop();
            audioSourceNode.disconnect();
            console.log("Audio source stopped and disconnected.");
        } catch (e) {
            console.warn("Error stopping audio source node on quit (might have already stopped):", e);
        } finally {
             audioSourceNode = null;
        }
    }
    isAudioPlaying = false;

    // Reset game state variables (important!)
    audioStartOffset = 0;
    audioStartTime = 0; // Reset start time reference
    // Reset score, health, combo etc. here - TODO
    // resetGameState();

    // Clear Pixi stage? Or just hide elements? Decide based on performance needs.
    // For now, let's assume we clear/reset necessary visual elements later when starting a new game.
    // clearStage(); // Example function call

    // Switch back to the loading screen
    // resetLoadingState() is called by switchScreen when going to 'loading-screen'
    switchScreen('loading-screen');
    console.log("Returned to loading screen.");
}

/**
 * Displays the results screen with final stats.
 * (Called at the end of a song or on failure)
 * @param {object} stats - Object containing results data (e.g., score, counts, percentages, cleared status)
 */
function showResults(stats) {
    console.log("Showing results:", stats);
    isPaused = true; // Ensure loop stops

    // Stop rendering loop
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    // Stop audio (might already be stopped if song finished naturally)
    if (audioSourceNode) {
        try {
            audioSourceNode.onended = null;
            audioSourceNode.stop();
            audioSourceNode.disconnect();
        } catch (e) { /* Ignore errors if already stopped */ } finally {
             audioSourceNode = null;
        }
    }
    isAudioPlaying = false;

    // Populate the results screen elements - TODO: Replace with actual stats object properties
    const exampleStats = {
        score: stats?.score ?? 12345, // Use provided stats or fallback example
        perfectCount: stats?.perfectCount ?? 100,
        goodCount: stats?.goodCount ?? 50,
        missCount: stats?.missCount ?? 5,
        maxCombo: stats?.maxCombo ?? 75,
        cleared: stats?.cleared ?? true,
    };
    const totalNotes = exampleStats.perfectCount + exampleStats.goodCount + exampleStats.missCount;
    const perfectP = totalNotes > 0 ? (exampleStats.perfectCount / totalNotes * 100) : 0;
    const goodP = totalNotes > 0 ? (exampleStats.goodCount / totalNotes * 100) : 0;
    const missP = totalNotes > 0 ? (exampleStats.missCount / totalNotes * 100) : 0;


    if (finalScore) finalScore.textContent = exampleStats.score.toLocaleString(); // Format score
    if (perfectPercent) perfectPercent.textContent = perfectP.toFixed(1);
    if (perfectCount) perfectCount.textContent = exampleStats.perfectCount.toLocaleString();
    if (goodPercent) goodPercent.textContent = goodP.toFixed(1);
    if (goodCount) goodCount.textContent = exampleStats.goodCount.toLocaleString();
    if (missPercent) missPercent.textContent = missP.toFixed(1);
    if (missCount) missCount.textContent = exampleStats.missCount.toLocaleString();
    if (maxCombo) maxCombo.textContent = exampleStats.maxCombo.toLocaleString();

    if (resultMessage) {
        resultMessage.textContent = exampleStats.cleared ? "Song Cleared!" : "Failed!";
        resultMessage.className = exampleStats.cleared ? 'success' : 'failure'; // Use classes for styling
    }


    // Switch to results screen
    switchScreen('results-screen');
}

// ==================================
// Audio Playback
// ==================================

/**
 * Creates and starts the AudioBufferSourceNode for playback.
 * @param {number} [delay=0] - Optional delay before starting (in seconds), relative to audioContext.currentTime.
 */
function playAudio(delay = 0) {
    if (!audioContext || !loadedAudioBuffer || !masterGainNode) {
        console.warn("Cannot play audio: Context, buffer, or gain node missing.");
        return;
    }
    if (isAudioPlaying) {
        console.warn("Audio is already playing. Stop existing audio first if restart is needed.");
        // Optionally stop existing audio first:
        // if (audioSourceNode) { try { audioSourceNode.stop(); } catch(e){} audioSourceNode.disconnect(); }
        // audioSourceNode = null;
        return; // Prevent overlapping playback
    }


    // Create a new source node each time play is called
    audioSourceNode = audioContext.createBufferSource();
    audioSourceNode.buffer = loadedAudioBuffer;
    audioSourceNode.playbackRate.value = gameSettings.playbackRate; // Apply playback rate setting
    audioSourceNode.connect(masterGainNode); // Connect source to gain node -> destination

    // Handle song ending *naturally*
    audioSourceNode.onended = () => {
        // This event fires for both natural end and manual .stop()
        // We only care about the natural end here. Check if paused or stopped manually.
        console.log("AudioBufferSourceNode 'onended' event fired.");

        if (isPaused || !isAudioPlaying) {
            // If paused or stop was called manually, isAudioPlaying should be false.
            console.log("Audio ended due to pause or stop().");
             // Ensure node is cleaned up if stop wasn't called explicitly before onended
             if (audioSourceNode) {
                 audioSourceNode.disconnect();
                 audioSourceNode = null;
             }
            isAudioPlaying = false; // Ensure state is correct
            return;
        }

        // If we reach here, it should be a natural end
        isAudioPlaying = false;
        audioSourceNode = null; // Clean up node reference

        console.log("Audio playback finished naturally.");

        // Check if the game loop should continue or if results should be shown
        // Calculate expected end time based on buffer duration and playback rate
        const bufferDuration = loadedAudioBuffer.duration;
        const playbackDuration = bufferDuration / gameSettings.playbackRate;
        const expectedEndTime = audioStartOffset + playbackDuration;

        // TODO: Add logic here based on game state (e.g., no death mode)
        // For now, assume natural end means show results
        console.log("Triggering results screen after natural song end.");
        // Gather final stats before showing results - TODO
        const finalStats = { score: 0 /* Calculate score */, cleared: true /* Assume cleared */ };
        showResults(finalStats);

    };

    // Determine the absolute start time in the AudioContext timeline
    const scheduledPlayTime = audioContext.currentTime + delay;

    // Start playback at the correct offset and scheduled time
    // start(when, offset)
    // when: absolute time in audioContext.currentTime seconds to start playback
    // offset: position within the buffer to start playing (in seconds)
    try {
        // Ensure offset is within buffer bounds
        const effectiveOffset = Math.max(0, Math.min(audioStartOffset, loadedAudioBuffer.duration));
        if (effectiveOffset !== audioStartOffset) {
             console.warn(`Corrected audio start offset from ${audioStartOffset} to ${effectiveOffset}`);
        }

        audioSourceNode.start(scheduledPlayTime, effectiveOffset);
        isAudioPlaying = true;
        console.log(`Audio playback scheduled for ${scheduledPlayTime.toFixed(3)}. Offset: ${effectiveOffset.toFixed(3)}, Rate: ${gameSettings.playbackRate}x`);

    } catch (e) {
        console.error("Error calling audioSourceNode.start():", e);
        isAudioPlaying = false;
        audioSourceNode = null; // Clean up on error
        updateLoadingStatus("Error starting audio playback.", true);
    }
}


// ==================================
// Rendering & Visuals (PixiJS)
// ==================================

/**
 * Gets the appropriate background color for PixiJS based on the theme.
 * @returns {number} The color in hexadecimal number format (e.g., 0xFFFFFF).
 */
function getPixiBackgroundColor() {
    try {
        const cssVar = getComputedStyle(document.body).getPropertyValue('--screen-bg').trim();
        // Convert CSS color (like #ffffff or rgb(255,255,255)) to PixiJS hex number
        if (cssVar.startsWith('#')) {
            return parseInt(cssVar.substring(1), 16);
        }
        // Basic conversion for rgb() - add rgba() if needed
        const rgbMatch = cssVar.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1]);
            const g = parseInt(rgbMatch[2]);
            const b = parseInt(rgbMatch[3]);
            return (r << 16) + (g << 8) + b;
        }
    } catch (e) {
        console.error("Error getting background color CSS variable:", e);
    }
    return 0xFFFFFF; // Default to white if conversion fails
}

/**
 * Gets the appropriate color for staff lines based on the theme.
 * @returns {number} The color in hexadecimal number format.
 */
function getPixiLineColor() {
     try {
        const cssVar = getComputedStyle(document.body).getPropertyValue('--staff-line-color').trim();
        if (cssVar.startsWith('#')) {
            return parseInt(cssVar.substring(1), 16);
        }
         const rgbMatch = cssVar.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
         if (rgbMatch) {
             const r = parseInt(rgbMatch[1]);
             const g = parseInt(rgbMatch[2]);
             const b = parseInt(rgbMatch[3]);
             return (r << 16) + (g << 8) + b;
         }
    } catch (e) {
        console.error("Error getting staff line color CSS variable:", e);
    }
    return 0xAAAAAA; // Default
}


/**
 * Handles window resize events to adjust layout and PixiJS renderer.
 */
function handleResize() {
    // PixiJS renderer resizes automatically due to `resizeTo: staffArea`,
    // but we need to redraw elements that depend on screen dimensions.
    console.log("Window resized / Orientation changed.");

    // The resizeTo option should handle the renderer size update.
    // If experiencing issues, manually resizing might be needed:
    // if (pixiApp && pixiApp.renderer && staffArea) {
    //     pixiApp.renderer.resize(staffArea.clientWidth, staffArea.clientHeight);
    // }

    // Re-draw elements whose positions depend on screen size, like static staff lines
    // Ensure Pixi is ready before drawing
    if (pixiApp && stage && staffLinesGfx) {
        drawStaffLines();
        // TODO: Add calls to redraw other layout-dependent elements (keyboard, notes if needed)
    }

    // Update any other layout-dependent elements if necessary (e.g., DOM elements)
}

/**
 * Draws the static staff lines and judgment line using PixiJS Graphics.
 * (This needs proper positioning based on grand staff layout and note range)
 */
function drawStaffLines() {
    // Ensure all necessary Pixi objects and dimensions are available
    if (!staffLinesGfx || !pixiApp || !pixiApp.renderer || !stage) {
        console.warn("Cannot draw staff lines: PixiJS not fully initialized or renderer/stage missing.");
        return;
    }
    // Use renderer dimensions for reliable width/height after resize
    const rendererWidth = pixiApp.renderer.width;
    const rendererHeight = pixiApp.renderer.height;

    // Avoid drawing if dimensions are invalid (e.g., 0x0 during initialization)
    if (rendererWidth <= 0 || rendererHeight <= 0) {
        console.warn(`Skipping staff line draw due to invalid dimensions: ${rendererWidth}x${rendererHeight}`);
        return;
    }


    const staffLineColor = getPixiLineColor(); // Get color based on theme
    const lineWidth = 1; // Thickness of staff lines

    staffLinesGfx.clear(); // Clear previous lines before redrawing

    // --- Grand Staff Layout Calculation ---
    // TODO: Refine these calculations based on desired visual appearance and note range (C2-C6)
    const numLinesTreble = 5;
    const numLinesBass = 5;
    const totalLinesHeightEstimate = 20 * (rendererHeight / 25); // Rough estimate, needs tuning
    const verticalPadding = rendererHeight * 0.1; // Padding top and bottom
    const availableHeight = rendererHeight - 2 * verticalPadding;

    // Calculate spacing based on available height and required lines/spaces
    // A grand staff has 11 lines (5 treble + 5 bass + middle C line space) and spaces between.
    // Let's estimate ~20 vertical units (lines + spaces) are needed visually.
    const spaceBetweenLines = Math.max(1, Math.min(availableHeight / 25, 15)); // Clamp spacing
    const spaceBetweenStaves = spaceBetweenLines * 2.5; // Space between treble and bass

    // Calculate top Y positions dynamically
    const totalStaffHeight = (numLinesTreble - 1 + numLinesBass - 1) * spaceBetweenLines + spaceBetweenStaves;
    let trebleTopY = verticalPadding + (availableHeight - totalStaffHeight) / 2;
    trebleTopY = Math.max(verticalPadding, trebleTopY); // Ensure it doesn't go into padding

    const bassTopY = trebleTopY + (numLinesTreble - 1) * spaceBetweenLines + spaceBetweenStaves;

    // --- Draw Treble Staff Lines ---
    staffLinesGfx.lineStyle(lineWidth, staffLineColor, 1); // Set line style once
    for (let i = 0; i < numLinesTreble; i++) {
        const y = Math.round(trebleTopY + i * spaceBetweenLines); // Round Y to nearest pixel
        staffLinesGfx.moveTo(0, y);
        staffLinesGfx.lineTo(rendererWidth, y);
    }

    // --- Draw Bass Staff Lines ---
    for (let i = 0; i < numLinesBass; i++) {
        const y = Math.round(bassTopY + i * spaceBetweenLines); // Round Y
        staffLinesGfx.moveTo(0, y);
        staffLinesGfx.lineTo(rendererWidth, y);
    }

    // --- Draw Judgment Line ---
    // TODO: Make position configurable or dynamic?
    const judgmentLineX = Math.round(rendererWidth * 0.20); // 20% from left, rounded
    const judgmentLineColor = 0xFF0000; // Red
    const judgmentLineWidth = 2;
    staffLinesGfx.lineStyle(judgmentLineWidth, judgmentLineColor, 1);
    staffLinesGfx.moveTo(judgmentLineX, 0);
    staffLinesGfx.lineTo(judgmentLineX, rendererHeight);

    console.log(`Staff lines redrawn. Canvas: ${rendererWidth}x${rendererHeight}, Treble Y: ${trebleTopY.toFixed(1)}, Bass Y: ${bassTopY.toFixed(1)}`);
}


// ==================================
// Utility Functions
// ==================================

// Add utility functions here if needed (e.g., color conversion, MIDI to pitch mapping)
// Remember to include the colorconversion.js script in the HTML


// ==================================
// Game Entry Point
// ==================================

// Wait for the DOM to be fully loaded before initializing the game
// Use an IIFE to ensure DOMContentLoaded listener is added only once
(function() {
    function onReady() {
        // Ensure this runs only once
        document.removeEventListener('DOMContentLoaded', onReady);
        window.removeEventListener('load', onReady); // Also handle load event as fallback
        init(); // Call the main initialization function
    }

    // Check if the DOM is already loaded
    if (document.readyState === 'loading') {
        // Loading hasn't finished yet
        document.addEventListener('DOMContentLoaded', onReady);
        // Add a fallback for the 'load' event in case DOMContentLoaded fires too early or fails
        window.addEventListener('load', onReady);
    } else {
        // `DOMContentLoaded` has already fired
        // Use setTimeout to ensure the call stack is clear before init
        setTimeout(init, 0);
    }
})();


