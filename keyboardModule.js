// keyboardModule.js

// Only the init function needs to be exported.
// Other functions are internal helpers or event handlers.

/**
 * @file keyboardModule.js
 * Handles the virtual piano keyboard interactions, including touch and mouse input,
 * visual feedback, and triggering the note judgment function.
 * To be loaded as an ES Module.
 */

// --- Module Imports ---
// Import the specific function needed from the audio module
import { resumeContext as resumeAudioContext } from './audioModule.js';

// --- Module-Scoped Variables (Private State) ---
console.log("Keyboard Module: Script loaded.");

let pianoContainer = null; // DOM element for the piano container
let keys = null;           // NodeList of key elements
let judgeFunction = null; // Reference to the function that judges key presses (from staffModule)
let isGameOverFunc = () => false; // Function provided by caller to check if game is over
let isGameRunningFunc = () => false; // Function provided by caller to check if game is running

let isMouseDown = false; // Track mouse button state specifically for keyboard
let activeTouches = {}; // Store currently active key per touch identifier: { touchId: keyElement }

// --- Helper Functions ---

/**
 * Handles the visual pressing of a key and triggers the judgment function.
 * This is called internally by event handlers.
 * @param {Element} keyElement - The DOM element of the key that was pressed.
 */
function pressKey(keyElement) {
    // Check game state via the function provided during init
    if (isGameOverFunc()) {
        console.log("Keyboard: Game is over, key press ignored.");
        return;
    }

    // Process press only if element is valid and not already pressed
    if (keyElement && !keyElement.classList.contains('pressed')) {
        // console.log(`Keyboard: Key pressed: ${keyElement.dataset.key}`); // Debug log
        keyElement.classList.add('pressed'); // Add visual feedback
        const keyName = keyElement.dataset.key;

        // Check if judging function exists and game is running (via provided functions)
        if (judgeFunction && isGameRunningFunc()) {
            // Ensure AudioContext is running before judging (critical for touch interaction)
            // Call the imported resumeAudioContext function
            resumeAudioContext().then(() => {
                // console.log(`Keyboard: Judging key press: ${keyName}`); // Debug log
                judgeFunction(keyName); // Call the judgment function from staff module
            }).catch(e => {
                 // Log error if audio context resume fails
                 console.error("Keyboard: Error resuming AudioContext during key press:", e);
                 // Still attempt judgment even if context failed to resume explicitly
                 judgeFunction(keyName);
            });
        } else if (!isGameRunningFunc()) {
            // Log if pressed while paused (optional)
            // console.log("Keyboard: Key pressed but game is paused.");
        } else {
            // Log warning if judgment function is missing
            console.warn("Keyboard: Judge function was not provided during init!");
        }
    }
}

/**
 * Handles the visual release of a key.
 * This is called internally by event handlers.
 * @param {Element | null} keyElement - The DOM element of the key to release.
 */
function releaseKey(keyElement) {
    // Remove visual feedback if the key element is valid and was pressed
    if (keyElement && keyElement.classList.contains('pressed')) {
        // console.log(`Keyboard: Key released: ${keyElement.dataset.key}`); // Debug log
        keyElement.classList.remove('pressed');
    }
}

// --- Event Handlers ---
// These functions are attached as listeners in the init function

/** Handles mouse button down events on the piano container. */
function handleMouseDown(event) {
    // console.log("Keyboard: Mouse Down Event"); // Debug log
    // Ignore clicks that are not the primary button (left-click)
    if (event.button !== 0) return;
    // Find the closest ancestor element that is a key
    const targetKey = event.target.closest('.key');
    // Ensure the key exists and is within our piano container
    if (targetKey && pianoContainer && pianoContainer.contains(targetKey)) {
        isMouseDown = true; // Set flag indicating mouse is down
        pressKey(targetKey); // Process the key press
        event.preventDefault(); // Prevent default actions like text selection
    }
}

/** Handles mouse button up events anywhere on the document. */
function handleMouseUp(event) {
    // console.log("Keyboard: Mouse Up Event"); // Debug log
    // Ignore clicks that are not the primary button
    if (event.button !== 0) return;
    // If the mouse button was previously down...
    if (isMouseDown) {
        // Release all currently pressed keys visually
        if (keys) {
             keys.forEach(releaseKey);
        }
        isMouseDown = false; // Reset flag
    }
}

/** Handles the mouse leaving the piano container area. */
function handleMouseLeave(event) {
    // If the mouse button was down when leaving the piano container...
    if (isMouseDown && event.target === pianoContainer) {
        // console.log("Keyboard: Mouse Leave Event while down"); // Debug log
         // Release all currently pressed keys visually
        if (keys) {
             keys.forEach(releaseKey);
        }
        isMouseDown = false; // Reset flag
    }
}

/** Handles the start of a touch event on the piano container. */
 function handleTouchStart(event) {
    // console.log("Keyboard: Touch Start Event"); // Debug log
    // Prevent default touch behaviors like scrolling if touch starts on a key
    const initialTargetKey = event.target.closest('.key');
    if (initialTargetKey && pianoContainer && pianoContainer.contains(initialTargetKey)) {
         event.preventDefault();
    }
    // Iterate through all new touch points in this event
    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        // Find the DOM element currently under the touch point
        const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
        // Find the closest key element to where the touch landed
        const targetKey = elementUnderTouch ? elementUnderTouch.closest('.key') : null;
        // Check if it's a valid key within our piano
        if (targetKey && pianoContainer && pianoContainer.contains(targetKey)) {
            const touchId = touch.identifier; // Get unique ID for this touch
            // If this touch ID isn't already tracked...
            if (!activeTouches[touchId]) {
                activeTouches[touchId] = targetKey; // Track the key associated with this touch
                pressKey(targetKey); // Process the key press
            }
        }
    }
}

/** Handles touch movement events. */
function handleTouchMove(event) {
     // console.log("Keyboard: Touch Move Event"); // Debug log
     let shouldPreventDefault = false;
     // Check if any of the moving touches are currently tracked (started on a key)
     for (let i = 0; i < event.changedTouches.length; i++) {
         const touch = event.changedTouches[i];
         if (activeTouches[touch.identifier]) {
             shouldPreventDefault = true; // If yes, we'll prevent default scroll/zoom etc.
             break;
         }
     }
     if (shouldPreventDefault) {
         event.preventDefault();
     }

     // Iterate through moving touches
    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        const touchId = touch.identifier;
        // Find the element currently under the touch point
        const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
        // Find the closest key element
        const currentKey = elementUnderTouch ? elementUnderTouch.closest('.key') : null;
        // Check if it's a valid key within our piano
        const isValidKey = currentKey && pianoContainer && pianoContainer.contains(currentKey);
        // Get the key previously associated with this touch ID
        const previousKey = activeTouches[touchId];

        // If we were tracking this touch...
        if (previousKey !== undefined) {
             // Check if the touch has moved onto a *different* key or off the keys entirely
            if (currentKey !== previousKey) {
                // Release the previous key visually
                releaseKey(previousKey);
                // If the touch is now over a new valid key...
                if (isValidKey) {
                    activeTouches[touchId] = currentKey; // Update tracking to the new key
                    pressKey(currentKey); // Process the press on the new key
                } else {
                    // If touch moved off keys, stop tracking it
                     delete activeTouches[touchId];
                }
            }
        }
    }
}

/** Handles the end or cancellation of a touch event. */
function handleTouchEndOrCancel(event) {
    // console.log("Keyboard: Touch End/Cancel Event"); // Debug log
    let shouldPreventDefault = false;
    // Check if any ending touches were tracked
    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        if (activeTouches[touch.identifier]) {
            shouldPreventDefault = true; // Prevent default actions if touch ended on a key
            break;
        }
    }
    if (shouldPreventDefault) {
        event.preventDefault();
    }

    // Iterate through touches that ended/cancelled
    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        const touchId = touch.identifier;
        // Get the last key associated with this touch
        const lastKey = activeTouches[touchId];
        // Release that key visually
        releaseKey(lastKey);
        // Stop tracking this touch ID
        delete activeTouches[touchId];
    }
}

// --- Public Initialization Function ---

/**
 * Initializes the keyboard module. Should be called once after the DOM is ready.
 * Finds DOM elements and attaches event listeners.
 * @param {object} config - Configuration object containing necessary functions from other modules.
 * @param {Function} config.judgeKeyPressFunc - Function to call to judge a key press (e.g., staffModule.judgeKeyPress).
 * @param {Function} config.isGameOverFunc - Function that returns true if the game is over.
 * @param {Function} config.isGameRunningFunc - Function that returns true if the game is currently running (not paused).
 * @export
 */
export function init(config) {
    console.log("Keyboard Module: init() called.");

    // Store functions passed in config object
    // Use nullish coalescing or || to provide safe defaults, although errors are better for required functions.
    judgeFunction = config?.judgeKeyPressFunc;
    isGameOverFunc = config?.isGameOverFunc || (() => false);
    isGameRunningFunc = config?.isGameRunningFunc || (() => false);
    // resumeAudioContextFunc is imported directly now, no need to pass via config

    // Perform DOM Lookups safely inside init
    pianoContainer = document.getElementById('piano');
    if (!pianoContainer) {
        // Log error and prevent further initialization if essential element is missing
        console.error("Keyboard Module Error: Piano container element (#piano) not found during init! Cannot attach listeners.");
        return; // Stop initialization
    }
    keys = pianoContainer.querySelectorAll('.key');
    if (!keys || keys.length === 0) {
        // Log warning if no keys found, but continue initialization
        console.warn("Keyboard Module Warning: No elements with class '.key' found inside #piano during init!");
    }

    // Validate required function references
    if (typeof judgeFunction !== 'function') {
         console.error("Keyboard Module Error: Required 'judgeKeyPressFunc' was not provided in init config!");
         // Decide if you want to return here or allow operation without judging
         return;
    }
     // Check if the imported audio function is available
     if (typeof resumeAudioContext !== 'function') {
         console.error("Keyboard Module Error: Required 'resumeAudioContext' function not imported correctly from audio module!");
         return; // Stop initialization if audio context handling is missing
     }


    // Attach Event Listeners to the piano container
    console.log("Keyboard Module: Attaching event listeners...");
    pianoContainer.addEventListener('mousedown', handleMouseDown);
    // Listen on the whole document for mouseup to catch releases outside the piano
    document.addEventListener('mouseup', handleMouseUp);
    pianoContainer.addEventListener('mouseleave', handleMouseLeave);
    // Use { passive: false } for touch events where preventDefault() might be called
    pianoContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
    pianoContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    pianoContainer.addEventListener('touchend', handleTouchEndOrCancel, { passive: false });
    pianoContainer.addEventListener('touchcancel', handleTouchEndOrCancel, { passive: false });
    // Prevent the context menu (e.g., right-click menu) from appearing on the piano keys
    pianoContainer.addEventListener('contextmenu', (event) => event.preventDefault());

    console.log("Keyboard Module: Initialization complete.");
}
