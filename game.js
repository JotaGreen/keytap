// game.js
// Main JavaScript file for the Piano Sight Reading Rhythm Game

// Strict mode helps catch common coding errors and "unsafe" actions.
'use strict';

// Wrap the entire game logic in an IIFE (Immediately Invoked Function Expression)
// to avoid polluting the global scope.
(() => {

    // ==================================
    //      Global Variables & State
    // ==================================

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


    // ==================================
    //       Initialization Logic
    // ==================================

    /**
     * Initializes the entire game application.
     * Called once the DOM is fully loaded.
     */
    function init() {
        console.log("Initializing game...");

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
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (!audioContext) {
                throw new Error("Web Audio API is not supported in this browser.");
            }
            masterGainNode = audioContext.createGain();
            masterGainNode.gain.value = gameSettings.volume; // Set initial volume
            masterGainNode.connect(audioContext.destination); // Connect gain node to output
            console.log("AudioContext created successfully.");
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
        try {
            // Create Pixi Application
            pixiApp = new PIXI.Application({
                resizeTo: staffArea, // Automatically resize canvas to fit the container
                backgroundColor: getPixiBackgroundColor(), // Use theme color
                antialias: true, // Enable anti-aliasing for smoother graphics
                resolution: window.devicePixelRatio || 1, // Adjust resolution for device screen density
                autoDensity: true, // Automatically handle density changes
            });
            if (!pixiApp) {
                throw new Error("PixiJS Application could not be created.");
            }

            // Add the PixiJS canvas to the designated DOM element
            staffArea.appendChild(pixiApp.view);
            stage = pixiApp.stage; // Get reference to the main container

            console.log("PixiJS Application created successfully.");

            // Example: Draw basic staff lines (placeholder)
            staffLinesGfx = new PIXI.Graphics();
            stage.addChild(staffLinesGfx);
            // drawStaffLines(); // We'll call this properly later when layout is confirmed

        } catch (error) {
            console.error("Error setting up PixiJS:", error);
            updateLoadingStatus(`Error: Failed to initialize graphics. ${error.message}`, true);
            // Disable relevant features if Pixi fails
            if (startButton) startButton.disabled = true;
            if (loadTestDataButton) loadTestDataButton.disabled = true;
        }
    }

    /**
     * Attaches event listeners to buttons and inputs.
     */
    function setupEventListeners() {
        if (audioFileInput) audioFileInput.addEventListener('change', handleAudioFileInput);
        if (jsonFileInput) jsonFileInput.addEventListener('change', handleJsonFileInput);
        if (startButton) startButton.addEventListener('click', startGame);
        if (loadTestDataButton) loadTestDataButton.addEventListener('click', loadTestData);
        if (pauseButton) pauseButton.addEventListener('click', pauseGame);
        if (resumeButton) resumeButton.addEventListener('click', resumeGame);
        if (quitButton) quitButton.addEventListener('click', quitGame);
        if (returnToMenuButton) returnToMenuButton.addEventListener('click', quitGame); // Quit also returns to menu
        // Add listeners for settings controls later
    }

    /**
     * Sets up the initial display and handlers for game settings.
     * (This will be expanded significantly later)
     */
    function setupSettingsControls() {
        // Example: Basic volume control
        const volumeSlider = document.createElement('input');
        volumeSlider.type = 'range';
        volumeSlider.min = '0';
        volumeSlider.max = '1';
        volumeSlider.step = '0.01';
        volumeSlider.value = gameSettings.volume;
        volumeSlider.addEventListener('input', (e) => {
            gameSettings.volume = parseFloat(e.target.value);
            if (masterGainNode) {
                masterGainNode.gain.setValueAtTime(gameSettings.volume, audioContext.currentTime);
            }
            // Update volume display if needed
        });
        const volumeLabel = document.createElement('label');
        volumeLabel.textContent = 'Volume:';
        const volumeContainer = document.getElementById('volume-control');
        if (volumeContainer) {
            volumeContainer.appendChild(volumeLabel);
            volumeContainer.appendChild(volumeSlider);
        }

        // Add placeholders or basic controls for other settings here
        // - Theme toggle
        // - Scroll speed
        // - Note color
        // - etc.
    }


    // ==================================
    //       Screen Management
    // ==================================

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
            handleResize();
        } else if (screenId === 'loading-screen') {
            // Reset flags and UI elements when returning to loading screen
            resetLoadingState();
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

    // ==================================
    //       File Handling
    // ==================================

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
            checkFilesLoaded(); // Update button state

            const reader = new FileReader();
            reader.onload = (e) => {
                const arrayBuffer = e.target.result;
                audioContext.decodeAudioData(arrayBuffer)
                    .then(decodedBuffer => {
                        loadedAudioBuffer = decodedBuffer;
                        isAudioLoaded = true;
                        console.log(`Audio decoded successfully: ${file.name}`);
                        updateLoadingStatus(`Audio loaded: ${file.name}`, false);
                        checkFilesLoaded();
                    })
                    .catch(error => {
                        console.error("Error decoding audio data:", error);
                        updateLoadingStatus(`Error decoding audio: ${error.message}. Please try a different MP3 file.`, true);
                        isAudioLoaded = false; // Ensure flag is false on error
                        loadedAudioBuffer = null;
                    })
                    .finally(() => {
                        showLoadingIndicator(false);
                        checkFilesLoaded(); // Final check after potential error
                    });
            };
            reader.onerror = (e) => {
                 console.error("Error reading audio file:", e);
                 updateLoadingStatus(`Error reading file: ${file.name}.`, true);
                 isAudioLoaded = false;
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
            checkFilesLoaded(); // Update button state

            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                try {
                    noteMapData = JSON.parse(text);
                    // Basic validation (check for header and tracks array)
                    if (!noteMapData || typeof noteMapData !== 'object' || !noteMapData.header || !Array.isArray(noteMapData.tracks) || noteMapData.tracks.length === 0) {
                       throw new Error("Invalid JSON structure. Missing header or tracks.");
                    }
                    // Further validation could be added here (check ppq, tempos, notes structure)
                    isJsonLoaded = true;
                    console.log(`JSON parsed successfully: ${file.name}`);
                    console.log("Note Map Header:", noteMapData.header);
                    console.log(`Found ${noteMapData.tracks[0]?.notes?.length || 0} notes in the first track.`);
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
        checkFilesLoaded(); // Disable start button

        const audioPath = 'testData/test.mp3';
        const jsonPath = 'testData/test.json';

        try {
            // Fetch and process audio
            const audioResponse = await fetch(audioPath);
            if (!audioResponse.ok) throw new Error(`Failed to fetch ${audioPath}: ${audioResponse.statusText}`);
            const audioArrayBuffer = await audioResponse.arrayBuffer();
            loadedAudioBuffer = await audioContext.decodeAudioData(audioArrayBuffer);
            isAudioLoaded = true;
            console.log("Test audio loaded and decoded.");
            updateLoadingStatus("Test audio loaded.", false);

            // Fetch and process JSON
            const jsonResponse = await fetch(jsonPath);
            if (!jsonResponse.ok) throw new Error(`Failed to fetch ${jsonPath}: ${jsonResponse.statusText}`);
            const jsonText = await jsonResponse.text();
            noteMapData = JSON.parse(jsonText);
             if (!noteMapData || typeof noteMapData !== 'object' || !noteMapData.header || !Array.isArray(noteMapData.tracks) || noteMapData.tracks.length === 0) {
                throw new Error("Invalid JSON structure in test data.");
             }
            isJsonLoaded = true;
            console.log("Test JSON loaded and parsed.");
            console.log("Test Note Map Header:", noteMapData.header);
            console.log(`Found ${noteMapData.tracks[0]?.notes?.length || 0} notes in the first track.`);
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
     * @param {boolean} isError - If true, displays the message as an error.
     */
    function updateLoadingStatus(message, isError = false) {
        if (loadingStatus) {
            loadingStatus.textContent = message;
            loadingStatus.style.color = isError ? 'var(--error-color)' : 'var(--primary-color)';
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
    //       Game Flow Control
    // ==================================

    /**
     * Starts the main game loop and audio playback.
     */
    function startGame() {
        if (!isAudioLoaded || !noteMapData || !audioContext || !pixiApp) {
            console.error("Cannot start game: Files not loaded or systems not initialized.");
            updateLoadingStatus("Error: Cannot start game. Ensure files are loaded and system is ready.", true);
            return;
        }

        console.log("Starting game...");
        isPaused = false;
        audioStartOffset = 0; // Start from the beginning

        // Reset game state (score, health, combo, etc.) - TODO
        // Pre-process notes if needed (e.g., calculate screen positions, colors) - TODO

        // Switch to the game screen
        switchScreen('game-screen');

        // Small delay before starting audio/visuals (as requested ~100ms)
        // Use audioContext.currentTime for scheduling the actual start
        const visualPreDelay = 0.100; // 100ms visual pre-delay
        const now = audioContext.currentTime;
        audioStartTime = now + visualPreDelay; // Schedule audio start slightly after 'now'

        // Start audio playback
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
     * @param {DOMHighResTimeStamp} timestamp - The time elapsed since navigation start.
     */
    function gameLoop(timestamp) {
        if (isPaused) {
            // If paused, don't request another frame immediately.
            // The resume function will restart the loop.
            return;
        }

        // Calculate current time within the song
        // This is the CRITICAL part for synchronization
        const elapsed = audioContext.currentTime - audioStartTime;
        const currentTime = audioStartOffset + elapsed * gameSettings.playbackRate;

        // --- Update Game Logic ---
        // 1. Check for missed notes based on currentTime
        // 2. Handle player input checks (from keyboard events) - compare against note times
        // 3. Update score, health, combo based on hits/misses
        // 4. Check for game over conditions

        // --- Update Visuals (PixiJS Rendering) ---
        // 1. Clear previous drawings if necessary (Pixi often handles this)
        // 2. Calculate and update positions of notes based on currentTime and scrollSpeed
        // 3. Draw/update staff elements if needed (less frequent)
        // 4. Draw/update keyboard state (pressed keys)
        // 5. Draw/update UI elements (score, combo, health bar) - Can be done via DOM manipulation too

        // Example: Log current song time
        // console.log(`Song Time: ${currentTime.toFixed(3)}s`);

        // TODO: Implement actual game logic and rendering updates here

        // Request the next frame
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    /**
     * Pauses the game audio and loop.
     */
    function pauseGame() {
        if (!isAudioPlaying || isPaused) return; // Don't pause if not playing or already paused

        isPaused = true;
        cancelAnimationFrame(animationFrameId); // Stop the rendering loop
        animationFrameId = null;

        // Calculate how much time has passed since the last start/resume
        const elapsed = audioContext.currentTime - audioStartTime;
        audioStartOffset += elapsed * gameSettings.playbackRate; // Store progress

        // Stop the audio source node
        if (audioSourceNode) {
            audioSourceNode.stop();
            audioSourceNode.disconnect(); // Disconnect to allow garbage collection
            audioSourceNode = null;
        }
        isAudioPlaying = false;

        // Show the pause overlay
        switchScreen('pause-overlay'); // Or show as an overlay without switching background screen
        console.log(`Game paused at offset: ${audioStartOffset.toFixed(3)}s`);
    }

    /**
     * Resumes the game from the paused state.
     */
    function resumeGame() {
        if (!isPaused || isAudioPlaying) return; // Don't resume if not paused or already playing

        isPaused = false;

        // Hide the pause overlay and show game screen
        switchScreen('game-screen'); // Or just hide overlay

        // Set the new start time reference for the game loop and audio
        const now = audioContext.currentTime;
        audioStartTime = now; // Reset start time reference for elapsed calculation

        // Restart audio playback from the stored offset
        playAudio();

        // Restart the game loop
        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(gameLoop);
        }
        console.log(`Game resumed from offset: ${audioStartOffset.toFixed(3)}s`);
    }

     /**
     * Stops the game and returns to the loading screen.
     */
    function quitGame() {
        console.log("Quitting game...");
        isPaused = true; // Ensure loop stops

        // Stop rendering loop
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        // Stop audio playback
        if (audioSourceNode) {
            try {
                 audioSourceNode.stop();
            } catch (e) { /* Ignore errors if already stopped */ }
            audioSourceNode.disconnect();
            audioSourceNode = null;
        }
        isAudioPlaying = false;

        // Reset game state variables (important!)
        audioStartOffset = 0;
        // Reset score, health, combo etc. here - TODO

        // Clear Pixi stage? Or just hide elements? Decide based on performance needs.
        // For now, let's assume we clear/reset necessary visual elements later.

        // Switch back to the loading screen
        switchScreen('loading-screen');
        // resetLoadingState() is called by switchScreen
    }

    /**
     * Displays the results screen with final stats.
     * (Called at the end of a song or on failure)
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
                 audioSourceNode.stop();
            } catch (e) { /* Ignore errors */ }
            audioSourceNode.disconnect();
            audioSourceNode = null;
         }
         isAudioPlaying = false;

         // Populate the results screen elements - TODO
         /* Example:
         if (finalScore) finalScore.textContent = stats.score;
         if (perfectPercent) perfectPercent.textContent = stats.perfectPercent.toFixed(1);
         if (perfectCount) perfectCount.textContent = stats.perfectCount;
         // ... and so on for good, miss, max combo
         if (resultMessage) {
             resultMessage.textContent = stats.cleared ? "Song Cleared!" : "Failed!";
             resultMessage.className = stats.cleared ? 'success' : 'failure';
         }
         */

         // Switch to results screen
         switchScreen('results-screen');
    }


    // ==================================
    //         Audio Playback
    // ==================================

    /**
     * Creates and starts the AudioBufferSourceNode for playback.
     */
    function playAudio() {
        if (!audioContext || !loadedAudioBuffer || !masterGainNode || isAudioPlaying) {
            console.warn("Cannot play audio: Context, buffer missing, or already playing.");
            return;
        }

        // Create a new source node each time play is called
        audioSourceNode = audioContext.createBufferSource();
        audioSourceNode.buffer = loadedAudioBuffer;
        audioSourceNode.playbackRate.value = gameSettings.playbackRate; // Apply playback rate setting
        audioSourceNode.connect(masterGainNode); // Connect source to gain node -> destination

        // Handle song ending
        audioSourceNode.onended = () => {
             console.log("Audio playback ended.");
             isAudioPlaying = false;
             // Don't automatically call showResults here, as onended can trigger
             // from stop() calls too. Game logic should determine when to show results.
             // If game loop is still running (e.g. no death mode), it might continue.
             // Check if the end was natural (reached end of buffer) vs. stopped manually.
             const expectedEndTime = audioStartOffset + (loadedAudioBuffer.duration / gameSettings.playbackRate);
             const currentTime = audioStartOffset + (audioContext.currentTime - audioStartTime) * gameSettings.playbackRate;
             if (isPaused) return; // Don't show results if ended due to pause/quit
             if (currentTime >= expectedEndTime - 0.05) { // Allow small timing tolerance
                console.log("Song finished naturally.")
                // TODO: Trigger results screen calculation and display
                // showResults({ score: ..., cleared: true, ... });
             }
        };

        // Start playback at the correct offset and scheduled time
        // start(when, offset, duration)
        // when: absolute time in audioContext.currentTime seconds to start playback
        // offset: position within the buffer to start playing (in seconds)
        audioSourceNode.start(audioStartTime, audioStartOffset);
        isAudioPlaying = true;

        console.log(`Audio playback started. Scheduled: ${audioStartTime.toFixed(3)}, Offset: ${audioStartOffset.toFixed(3)}, Rate: ${gameSettings.playbackRate}x`);
    }


    // ==================================
    //      Rendering & Visuals (PixiJS)
    // ==================================

    /**
     * Gets the appropriate background color for PixiJS based on the theme.
     * @returns {number} The color in hexadecimal number format (e.g., 0xFFFFFF).
     */
     function getPixiBackgroundColor() {
        const cssVar = getComputedStyle(document.body).getPropertyValue('--screen-bg').trim();
        // Convert CSS color (like #ffffff or rgb(255,255,255)) to PixiJS hex number
        // Basic conversion for hex codes:
        if (cssVar.startsWith('#')) {
            return parseInt(cssVar.substring(1), 16);
        }
        // Add more sophisticated conversion if needed (e.g., for rgb)
        return 0xFFFFFF; // Default to white if conversion fails
    }

    /**
     * Handles window resize events to adjust layout and PixiJS renderer.
     */
    function handleResize() {
        // PixiJS renderer resizes automatically due to `resizeTo: staffArea`,
        // but we might need to redraw elements that depend on screen dimensions.
        console.log("Window resized / Orientation changed.");

        if (pixiApp && pixiApp.renderer) {
             // Optional: Force renderer resize if needed, though resizeTo should handle it.
             // pixiApp.renderer.resize(staffArea.clientWidth, staffArea.clientHeight);

             // Re-draw elements whose positions depend on screen size, like static staff lines
             drawStaffLines();
        }
        // Update any other layout-dependent elements if necessary
    }

     /**
      * Draws the static staff lines using PixiJS Graphics.
      * (This is a basic placeholder - needs proper positioning based on grand staff)
      */
     function drawStaffLines() {
        if (!staffLinesGfx || !pixiApp || !pixiApp.renderer) return;

        const rendererWidth = pixiApp.renderer.width;
        const rendererHeight = pixiApp.renderer.height;
        const staffLineColor = getPixiLineColor(); // Get color based on theme
        const lineWidth = 1; // Thickness of staff lines

        staffLinesGfx.clear(); // Clear previous lines before redrawing

        // --- This needs significant refinement based on the grand staff layout ---
        // --- It should calculate Y positions for all 10+ lines based on rendererHeight ---
        const numLinesTreble = 5;
        const numLinesBass = 5;
        const spaceBetweenLines = rendererHeight / 25; // Example spacing
        const spaceBetweenStaves = spaceBetweenLines * 3; // Example spacing

        const trebleTopY = rendererHeight * 0.2; // Example top position for treble staff
        const bassTopY = trebleTopY + (numLinesTreble - 1) * spaceBetweenLines + spaceBetweenStaves; // Example

        // Draw Treble Staff Lines
        staffLinesGfx.lineStyle(lineWidth, staffLineColor, 1);
        for (let i = 0; i < numLinesTreble; i++) {
            const y = trebleTopY + i * spaceBetweenLines;
            staffLinesGfx.moveTo(0, y);
            staffLinesGfx.lineTo(rendererWidth, y);
        }

        // Draw Bass Staff Lines
        for (let i = 0; i < numLinesBass; i++) {
            const y = bassTopY + i * spaceBetweenLines;
            staffLinesGfx.moveTo(0, y);
            staffLinesGfx.lineTo(rendererWidth, y);
        }

         // --- TODO: Draw Judgment Line ---
         const judgmentLineX = rendererWidth * 0.2; // Example position (e.g., 20% from left)
         staffLinesGfx.lineStyle(2, 0xFF0000, 1); // Red, slightly thicker
         staffLinesGfx.moveTo(judgmentLineX, 0);
         staffLinesGfx.lineTo(judgmentLineX, rendererHeight);

        console.log("Staff lines redrawn.");
     }

     /**
      * Gets the appropriate color for staff lines based on the theme.
      * @returns {number} The color in hexadecimal number format.
      */
     function getPixiLineColor() {
         const cssVar = getComputedStyle(document.body).getPropertyValue('--staff-line-color').trim();
         if (cssVar.startsWith('#')) {
             return parseInt(cssVar.substring(1), 16);
         }
         return 0xAAAAAA; // Default
     }

    // ==================================
    //        Utility Functions
    // ==================================

    // Add utility functions here if needed (e.g., color conversion, MIDI to pitch mapping)
    // Remember to include the colorconversion.js script in the HTML


    // ==================================
    //       Game Entry Point
    // ==================================

    // Wait for the DOM to be fully loaded before initializing the game
    document.addEventListener('DOMContentLoaded', init);

})(); // End of IIFE