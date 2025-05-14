/**
 * @file ui.js
 * Handles UI interactions, DOM manipulation, and visual updates for the Keytap game.
 * Manages the loading screen, game info display, settings overlay, and score overlay.
 * To be loaded as an ES Module.
 */

console.log("UI Module: Loading...");

// --- Module-Scoped Variables ---

// DOM Element References (initialized in initUI)
let loadingScreen, audioFileInput, notesFileInput, loadingStatus, startButton;
let gameContainer, infoSection, staffSection, bottomPanel, keyboardSection;
let playPauseButton, settingsButton, comboCountSpan, healthBarElement;
let settingsOverlay, colorToggleSwitch, noDeathToggleSwitch, waitModeToggleSwitch, closeSettingsButton; // Added waitModeToggleSwitch
let staffScaleValueSpan, staffScaleDownButton, staffScaleUpButton;
let hitWindowValueSpan, hitWindowDownButton, hitWindowUpButton;
let scoreOverlay, scorePerfectCount, scorePerfectPercent, scoreGoodCount, scoreGoodPercent;
let scoreMissCount, scoreMissPercent, scoreMaxCombo, scoreTotalScore, restartButton;
let waitModeStatusIndicator; // Optional: For displaying "Waiting..." message

// Callbacks (initialized in initUI)
let onStartGame = () => console.warn("UI: onStartGame callback not set!");
let onSettingChange = (setting, value) => console.warn(`UI: onSettingChange callback not set! Setting: ${setting}, Value: ${value}`);
let onRestart = () => console.warn("UI: onRestart callback not set!");
let onFileSelected = (type, file) => console.warn(`UI: onFileSelected callback not set! Type: ${type}, File: ${file?.name}`);
let onPlayPause = () => console.warn("UI: onPlayPause callback not set!");
let onOpenSettings = () => console.warn("UI: onOpenSettings callback not set!");
let onCloseSettings = () => console.warn("UI: onCloseSettings callback not set!");

// --- Initialization ---

/**
 * Initializes the UI module, finds DOM elements, and attaches event listeners.
 * Should be called once after the DOM is fully loaded.
 * @param {object} callbacks - An object containing callback functions provided by the main script.
 * @param {Function} callbacks.onStartGame - Called when the start button is clicked (and files are ready).
 * @param {Function} callbacks.onSettingChange - Called when a setting value is changed (e.g., toggle, slider). Signature: (settingName: string, value: any).
 * @param {Function} callbacks.onRestart - Called when the restart button on the score screen is clicked.
 * @param {Function} callbacks.onFileSelected - Called when a user selects a file. Signature: (fileType: 'audio' | 'notes', file: File).
 * @param {Function} callbacks.onPlayPause - Called when the play/pause button is clicked.
 * @param {Function} callbacks.onOpenSettings - Called when the settings button is clicked.
 * @param {Function} callbacks.onCloseSettings - Called when the close settings button is clicked.
 * @param {object} initialState - An object containing initial values for UI display.
 * @param {number} initialState.scrollSpeed - Initial scroll speed (px/s).
 * @param {number} initialState.hitWindowMs - Initial hit window (ms).
 * @param {boolean} initialState.useColoredNotes - Initial state for color toggle.
 * @param {boolean} initialState.noDeathMode - Initial state for no death mode toggle.
 * @param {boolean} initialState.waitModeActive - Initial state for wait mode toggle. // Added for wait mode
 * @param {number} initialState.initialHealth - Starting health value.
 * @param {number} initialState.maxHealth - Maximum possible health value.
 * @export
 */
export function initUI(callbacks, initialState) {
    console.log("UI Module: initUI() called.");

    // --- Assign DOM Elements ---
    console.log("UI Module (initUI): Assigning DOM elements...");
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
    waitModeToggleSwitch = document.getElementById('waitModeToggleSwitch'); // Added for wait mode
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

    // Optional: Add an element in your HTML (e.g., within infoSection) for wait mode status
    // waitModeStatusIndicator = document.getElementById('waitModeStatusIndicator');
    console.log("UI Module (initUI): DOM elements assigned.");

    // --- Validate Essential Elements ---
    if (!loadingScreen || !startButton || !gameContainer || !audioFileInput || !notesFileInput || !loadingStatus || !playPauseButton || !settingsButton || !settingsOverlay || !scoreOverlay || !waitModeToggleSwitch) { // Added waitModeToggleSwitch to validation
        console.error("UI CRITICAL ERROR: Essential UI elements for startup/gameplay are missing!");
        alert("Error: Could not initialize game interface. Key elements missing.");
        return; // Stop initialization
    }

    // --- Store Callbacks ---
    console.log("UI Module (initUI): Storing callbacks...");
    if (callbacks) {
        onStartGame = callbacks.onStartGame || onStartGame;
        onSettingChange = callbacks.onSettingChange || onSettingChange;
        onRestart = callbacks.onRestart || onRestart;
        onFileSelected = callbacks.onFileSelected || onFileSelected;
        onPlayPause = callbacks.onPlayPause || onPlayPause;
        onOpenSettings = callbacks.onOpenSettings || onOpenSettings;
        onCloseSettings = callbacks.onCloseSettings || onCloseSettings;
        console.log("UI Module (initUI): Callbacks stored.");
    } else {
        console.warn("UI Module (initUI): No callbacks object provided.");
    }

    // --- Set Initial UI State ---
    console.log("UI Module (initUI): Setting initial UI state...");
    if (initialState) {
        updateSettingsUI(initialState); // Update settings display
        updateInfoUI(initialState.initialHealth || 0, initialState.maxHealth || 1, 0); // Update health/combo
        console.log("UI Module (initUI): Initial UI state set.");
    } else {
        console.warn("UI Module (initUI): No initial state provided.");
    }

    // --- Attach Event Listeners ---
    console.log("UI Module (initUI): Attaching event listeners...");
    attachEventListeners();
    console.log("UI Module (initUI): Event listeners attached.");

    // --- Initial Layout and File Check ---
    handleLayoutChange(); // Adjust layout based on current orientation/size
    checkFilesLoaded(false, false); // Set initial state for file loading UI

    console.log("UI Module: initUI() complete.");
}

/** Attaches all necessary event listeners to UI elements. */
function attachEventListeners() {
    // File Inputs
    if (audioFileInput) audioFileInput.addEventListener('change', handleAudioFileSelect);
    if (notesFileInput) notesFileInput.addEventListener('change', handleNotesFileSelect);

    // Start Button
    if (startButton) {
        startButton.addEventListener('click', () => {
            console.log("UI: Start button clicked.");
            onStartGame();
        });
    }

    // Play/Pause Button
    if (playPauseButton) {
        playPauseButton.addEventListener('click', () => {
            console.log("UI: Play/Pause button clicked.");
            onPlayPause();
        });
    }

    // Settings Button
    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            console.log("UI: Settings button clicked.");
            onOpenSettings();
        });
    }

    // Close Settings Button
    if (closeSettingsButton) {
        closeSettingsButton.addEventListener('click', () => {
            console.log("UI: Close Settings button clicked.");
            hideSettingsOverlay();
            onCloseSettings();
        });
    }

    // Settings: Color Toggle Switch
    if (colorToggleSwitch) {
        colorToggleSwitch.addEventListener('change', (event) => {
            const value = event.target.checked;
            console.log(`UI: Color notes setting changed to: ${value}`);
            onSettingChange('useColoredNotes', value);
        });
    }

    // Settings: No Death Mode Toggle Switch
    if (noDeathToggleSwitch) {
        noDeathToggleSwitch.addEventListener('change', (event) => {
            const value = event.target.checked;
            console.log(`UI: No Death Mode setting changed to: ${value}`);
            onSettingChange('noDeathMode', value);
        });
    }

    // Settings: Wait Mode Toggle Switch // Added for wait mode
    if (waitModeToggleSwitch) {
        waitModeToggleSwitch.addEventListener('change', (event) => {
            const value = event.target.checked;
            console.log(`UI: Wait Mode setting changed to: ${value}`);
            onSettingChange('waitModeActive', value); // Notify main logic with new setting name
        });
    }

    // Settings: Staff Scale Adjustment
    const STAFF_SCALE_STEP = 10, STAFF_SCALE_MIN = 50, STAFF_SCALE_MAX = 200;
    if (staffScaleDownButton && staffScaleUpButton && staffScaleValueSpan) {
        staffScaleDownButton.addEventListener('click', () => {
            const currentValue = parseInt(staffScaleValueSpan.textContent || STAFF_SCALE_MIN.toString(), 10);
            const newValue = Math.max(STAFF_SCALE_MIN, currentValue - STAFF_SCALE_STEP);
            console.log(`UI: Staff scale decreased to: ${newValue}`);
            onSettingChange('scrollSpeed', newValue);
        });
        staffScaleUpButton.addEventListener('click', () => {
            const currentValue = parseInt(staffScaleValueSpan.textContent || STAFF_SCALE_MIN.toString(), 10);
            const newValue = Math.min(STAFF_SCALE_MAX, currentValue + STAFF_SCALE_STEP);
            console.log(`UI: Staff scale increased to: ${newValue}`);
            onSettingChange('scrollSpeed', newValue);
        });
    }

    // Settings: Hit Window Adjustment
    const HIT_WINDOW_STEP = 5, HIT_WINDOW_MIN = 30, HIT_WINDOW_MAX = 200;
    if (hitWindowDownButton && hitWindowUpButton && hitWindowValueSpan) {
        hitWindowDownButton.addEventListener('click', () => {
            const currentValue = parseInt(hitWindowValueSpan.textContent || HIT_WINDOW_MIN.toString(), 10);
            const newValue = Math.max(HIT_WINDOW_MIN, currentValue - HIT_WINDOW_STEP);
            console.log(`UI: Hit window decreased to: ${newValue}ms`);
            onSettingChange('hitWindowMs', newValue);
        });
        hitWindowUpButton.addEventListener('click', () => {
            const currentValue = parseInt(hitWindowValueSpan.textContent || HIT_WINDOW_MIN.toString(), 10);
            const newValue = Math.min(HIT_WINDOW_MAX, currentValue + HIT_WINDOW_STEP);
            console.log(`UI: Hit window increased to: ${newValue}ms`);
            onSettingChange('hitWindowMs', newValue);
        });
    }

    // Score Screen: Restart Button
    if (restartButton) {
        restartButton.addEventListener('click', () => {
            console.log("UI: Restart button clicked.");
            onRestart();
        });
    }

    // Orientation Change Listener
    const mediaQueryList = window.matchMedia("(orientation: landscape)");
    mediaQueryList.addEventListener("change", handleLayoutChange);

    // Window Resize Listener (Debounced)
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            console.log("UI: Executing debounced resize handling.");
            handleLayoutChange();
        }, 150);
    });
}

// --- File Loading UI ---

/**
 * Handles audio file selection input change.
 * Calls the onFileSelected callback.
 * @param {Event} event - The file input change event.
 */
function handleAudioFileSelect(event) {
    const file = event.target.files ? event.target.files[0] : null;
    console.log(`UI: Audio file selected: ${file?.name ?? 'None'}`);
    if (!file) {
        onFileSelected('audio', null);
        return;
    }
    if (!file.type.startsWith('audio/mpeg') && !file.name.toLowerCase().endsWith('.mp3')) {
        alert("Invalid audio file type. Please select an MP3 file.");
        event.target.value = '';
        onFileSelected('audio', null);
        return;
    }
    setLoadingStatus("Loading audio...");
    if (startButton) startButton.disabled = true;
    onFileSelected('audio', file);
}

/**
 * Handles notes file selection input change.
 * Calls the onFileSelected callback.
 * @param {Event} event - The file input change event.
 */
function handleNotesFileSelect(event) {
    const file = event.target.files ? event.target.files[0] : null;
    console.log(`UI: Notes file selected: ${file?.name ?? 'None'}`);
    if (!file) {
        onFileSelected('notes', null);
        return;
    }
    if (!file.type.startsWith('application/json') && !file.name.toLowerCase().endsWith('.json')) {
        alert("Invalid notes file type. Please select a JSON file.");
        event.target.value = '';
        onFileSelected('notes', null);
        return;
    }
    setLoadingStatus("Loading notes...");
    if (startButton) startButton.disabled = true;
    onFileSelected('notes', file);
}

/**
 * Updates the loading status message and start button state.
 * Should be called by main logic after attempting to load/process files.
 * @param {boolean} audioReady - True if audio file is loaded and processed.
 * @param {boolean} notesReady - True if notes file is loaded and processed.
 * @export
 */
export function checkFilesLoaded(audioReady, notesReady) {
    console.log(`UI: checkFilesLoaded called. Audio Ready: ${audioReady}, Notes Ready: ${notesReady}`);
    if (!startButton || !loadingStatus) return;

    if (audioReady && notesReady) {
        setLoadingStatus("Files loaded. Ready to start!");
        startButton.disabled = false;
    } else {
        startButton.disabled = true;
        if (!audioReady && !notesReady) setLoadingStatus("Please select both files.");
        else if (!audioReady) setLoadingStatus("Please select an MP3 audio file.");
        else setLoadingStatus("Please select a JSON notes file.");
    }
}

/**
 * Sets the text content of the loading status element.
 * @param {string} text - The message to display.
 * @export
 */
export function setLoadingStatus(text) {
    if (loadingStatus) {
        console.log(`UI: Setting loading status to: "${text}"`);
        loadingStatus.textContent = text;
    } else {
        console.warn("UI: loadingStatus element not found, cannot set status.");
    }
}


// --- Screen/Overlay Management ---

/** Hides the loading screen. @export */
export function hideLoadingScreen() {
    if (loadingScreen) {
        console.log("UI: Hiding loading screen.");
        loadingScreen.classList.add('hidden');
    }
}

/** Shows the loading screen. @export */
export function showLoadingScreen() {
    if (loadingScreen) {
        console.log("UI: Showing loading screen.");
        loadingScreen.classList.remove('hidden');
    }
}

/** Shows the main game container. @export */
export function showGameContainer() {
    if (gameContainer) {
        console.log("UI: Showing game container.");
        gameContainer.classList.add('visible');
    }
}

/** Hides the main game container. @export */
export function hideGameContainer() {
    if (gameContainer) {
        console.log("UI: Hiding game container.");
        gameContainer.classList.remove('visible');
    }
}

/** Shows the settings overlay. @export */
export function showSettingsOverlay() {
    if (settingsOverlay) {
        console.log("UI: Showing settings overlay.");
        settingsOverlay.classList.add('visible');
    }
}

/** Hides the settings overlay. @export */
export function hideSettingsOverlay() {
    if (settingsOverlay) {
        console.log("UI: Hiding settings overlay.");
        settingsOverlay.classList.remove('visible');
    }
}

/** Shows the score overlay. @export */
export function showScoreOverlay() {
    if (scoreOverlay) {
        console.log("UI: Showing score overlay.");
        scoreOverlay.classList.add('visible');
    }
}

/** Hides the score overlay. @export */
export function hideScoreOverlay() {
    if (scoreOverlay) {
        console.log("UI: Hiding score overlay.");
        scoreOverlay.classList.remove('visible');
    }
}


// --- UI Element Updates ---

/**
 * Updates the health bar and combo display.
 * @param {number} currentHealth - The player's current health.
 * @param {number} maxHealth - The maximum possible health.
 * @param {number} currentCombo - The current combo count.
 * @export
 */
export function updateInfoUI(currentHealth, maxHealth, currentCombo) {
    // console.log(`UI: Updating Info UI. Health: ${currentHealth}/${maxHealth}, Combo: ${currentCombo}`);
    if (comboCountSpan) {
        comboCountSpan.textContent = currentCombo;
    }
    if (healthBarElement && maxHealth > 0) {
        const healthPercentage = Math.max(0, Math.min(100, (currentHealth / maxHealth) * 100));
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
    } else if (maxHealth <= 0) {
        console.warn("UI (updateInfoUI): maxHealth is zero or negative, cannot calculate percentage.");
    }
}

/**
 * Updates the displayed values in the settings panel based on provided settings.
 * @param {object} settings - An object containing current setting values.
 * @param {number} settings.scrollSpeed - Current scroll speed (px/s).
 * @param {number} settings.hitWindowMs - Current hit window (ms).
 * @param {boolean} settings.useColoredNotes - Current state for color toggle.
 * @param {boolean} settings.noDeathMode - Current state for no death mode toggle.
 * @param {boolean} settings.waitModeActive - Current state for wait mode toggle. // Added for wait mode
 * @export
 */
export function updateSettingsUI(settings) {
    console.log("UI: Updating settings panel UI values.", settings);
    if (!settings) {
        console.warn("UI (updateSettingsUI): No settings object provided.");
        return;
    }
    if (staffScaleValueSpan && settings.scrollSpeed !== undefined) {
        staffScaleValueSpan.textContent = settings.scrollSpeed;
    }
    if (hitWindowValueSpan && settings.hitWindowMs !== undefined) {
        hitWindowValueSpan.textContent = settings.hitWindowMs;
    }
    if (colorToggleSwitch && settings.useColoredNotes !== undefined) {
        colorToggleSwitch.checked = settings.useColoredNotes;
    }
    if (noDeathToggleSwitch && settings.noDeathMode !== undefined) {
        noDeathToggleSwitch.checked = settings.noDeathMode;
    }
    if (waitModeToggleSwitch && settings.waitModeActive !== undefined) { // Added for wait mode
        waitModeToggleSwitch.checked = settings.waitModeActive;
    }
    console.log("UI: Settings UI update attempt complete.");
}

/**
 * Populates and displays the final score screen.
 * @param {object} stats - An object containing final game statistics.
 * @param {number} stats.perfectCount
 * @param {number} stats.goodCount
 * @param {number} stats.missCount
 * @param {number} stats.maxCombo
 * @param {number} stats.totalScore
 * @param {number} stats.totalNotesInSong - Total notes for percentage calculation.
 * @export
 */
export function showScoreScreen(stats) {
    console.log("UI: Preparing and displaying score screen.", stats);
    if (!scoreOverlay || !stats) {
        console.error("UI (showScoreScreen): Score overlay element or stats object not available!");
        return;
    }

    const { perfectCount = 0, goodCount = 0, missCount = 0, maxCombo = 0, totalScore = 0, totalNotesInSong = 0 } = stats;

    const processedNotes = perfectCount + goodCount + missCount;
    const totalNotesForPercentage = (totalNotesInSong > 0 && totalNotesInSong >= processedNotes) ? totalNotesInSong : (processedNotes > 0 ? processedNotes : 1);

    console.log(`UI (showScoreScreen): Calculating percentages based on ${totalNotesForPercentage} notes.`);

    const perfectPercentVal = ((perfectCount / totalNotesForPercentage) * 100).toFixed(1);
    const goodPercentVal = ((goodCount / totalNotesForPercentage) * 100).toFixed(1);
    const missPercentVal = ((missCount / totalNotesForPercentage) * 100).toFixed(1);

    if (scorePerfectCount) scorePerfectCount.textContent = perfectCount;
    if (scorePerfectPercent) scorePerfectPercent.textContent = perfectPercentVal;
    if (scoreGoodCount) scoreGoodCount.textContent = goodCount;
    if (scoreGoodPercent) scoreGoodPercent.textContent = goodPercentVal;
    if (scoreMissCount) scoreMissCount.textContent = missCount;
    if (scoreMissPercent) scoreMissPercent.textContent = missPercentVal;
    if (scoreMaxCombo) scoreMaxCombo.textContent = maxCombo;
    if (scoreTotalScore) scoreTotalScore.textContent = totalScore;

    showScoreOverlay();
    console.log("UI: Score screen populated and displayed.");
}

/**
 * Sets the text and disabled state of the main play/pause button.
 * @param {'Play' | 'Pause' | 'Loading' | 'Finished' | 'Game Over' | 'Waiting...'} state - The desired button state/text.
 * @param {boolean} [disabled=undefined] - Optional override for the disabled state.
 * @export
 */
export function setPlayButtonState(state, disabled = undefined) {
    if (playPauseButton) {
        console.log(`UI: Setting play button state to "${state}", disabled: ${disabled ?? 'auto'}`);
        playPauseButton.textContent = state;
        if (disabled !== undefined) {
            playPauseButton.disabled = disabled;
        } else {
            playPauseButton.disabled = (state === 'Loading' || state === 'Finished' || state === 'Game Over' || state === 'Waiting...');
        }
    } else {
        console.warn("UI: Play/Pause button not found, cannot set state.");
    }
}

/**
 * Sets the disabled state of the settings button.
 * @param {boolean} disabled - True to disable, false to enable.
 * @export
 */
export function setSettingsButtonState(disabled) {
    if (settingsButton) {
        console.log(`UI: Setting settings button disabled state to: ${disabled}`);
        settingsButton.disabled = disabled;
    } else {
        console.warn("UI: Settings button not found, cannot set state.");
    }
}

/**
 * Displays or clears a status message for Wait Mode.
 * @param {string | null} message - The message to display, or null to clear.
 * @export
 */
export function setWaitModeStatusMessage(message) {
    if (waitModeStatusIndicator) {
        if (message) {
            waitModeStatusIndicator.textContent = message;
            waitModeStatusIndicator.style.display = 'block'; // Or your preferred display style
            console.log(`UI: Displaying Wait Mode status: "${message}"`);
        } else {
            waitModeStatusIndicator.textContent = '';
            waitModeStatusIndicator.style.display = 'none';
            console.log("UI: Clearing Wait Mode status.");
        }
    } else if (message) {
        // Fallback if dedicated element doesn't exist, could use loadingStatus or a temporary message.
        // For now, just log it.
        console.log(`UI: Wait Mode status (no dedicated element): "${message}"`);
    }
}


// --- Layout ---

/**
 * Handles layout adjustments for orientation changes or resizing.
 * Rearranges elements between portrait and landscape modes.
 * Should also be called initially.
 * @export
 */
export function handleLayoutChange() {
    console.log("UI: Adjusting layout for orientation/resize.");
    if (!gameContainer || !infoSection || !staffSection || !bottomPanel || !keyboardSection) {
        console.error("UI (handleLayoutChange): Essential layout containers not found.");
        return;
    }

    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    console.log(`UI (handleLayoutChange): Detected orientation: ${isLandscape ? 'landscape' : 'portrait'}`);

    if (isLandscape) {
        if (infoSection.parentElement !== bottomPanel) {
            bottomPanel.insertBefore(infoSection, keyboardSection);
            console.log("UI (Layout): Moved infoSection into bottomPanel for landscape.");
        } else {
             if (bottomPanel.children[0] !== infoSection) {
                 bottomPanel.insertBefore(infoSection, keyboardSection);
                 console.log("UI (Layout): Reordered infoSection within bottomPanel for landscape.");
             }
        }
    } else { // Portrait
        if (infoSection.parentElement === bottomPanel) {
            gameContainer.insertBefore(infoSection, staffSection);
            console.log("UI (Layout): Moved infoSection out of bottomPanel for portrait.");
        } else {
            if (gameContainer.children[0] !== infoSection) {
                 gameContainer.insertBefore(infoSection, staffSection);
                 console.log("UI (Layout): Reordered infoSection within gameContainer for portrait.");
            }
        }
    }

    console.log("UI: Layout adjustment attempt complete.");
}


console.log("UI Module: Loaded.");
