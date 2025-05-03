// --- Keyboard Component Logic ---
const keyboardModule = (() => {
    // Module setup log
    console.log("Initializing Keyboard Module...");

    // --- DOM Element Variables ---
    // Declare variables here, but don't assign them yet.
    // Assignment will happen in the init function to ensure the DOM is ready.
    let pianoContainer = null; // Will hold the main piano div element
    let keys = null;           // Will hold a NodeList of all key elements

    // --- State Variables ---
    // These track the interaction state with the keyboard
    let isMouseDown = false; // Track mouse button state specifically for keyboard
    let activeTouches = {}; // Store currently active key per touch identifier: { touchId: keyElement }
    let judgeFunction = null; // To hold the reference to the judging function (e.g., staffModule.judgeKeyPress) passed in via init

    // --- Helper Functions ---

    /**
     * Handles the visual pressing of a key and triggers the judgment function.
     * @param {Element} keyElement - The DOM element of the key that was pressed.
     */
    function pressKey(keyElement) {
        // Check global game state: Don't allow key presses if the game is over.
        if (isGameOver) return;

        // Check if the key element is valid and not already visually pressed
        if (keyElement && !keyElement.classList.contains('pressed')) {
            // Add visual feedback
            keyElement.classList.add('pressed');
            // Get the musical key name (e.g., "C", "Db") from the data attribute
            const keyName = keyElement.dataset.key;

            // Call the judgment function if it exists and the game is actively running
            if (judgeFunction && gameIsRunning) {
                // Ensure AudioContext is running (important for responsiveness, especially on mobile/touch)
                // Check if audioModule is available globally
                if (audioModule && typeof audioModule.resumeContext === 'function') {
                    // Resume audio context (returns a promise)
                    audioModule.resumeContext().then(() => {
                        // Context is running or resumed, now judge the key press
                        // console.log(`Keyboard: Judging key press: ${keyName}`); // Optional log
                        judgeFunction(keyName);
                    }).catch(e => {
                         // Handle potential errors during context resume, though unlikely to interrupt judgment much
                         console.error("Keyboard: Error resuming AudioContext during key press:", e);
                         judgeFunction(keyName); // Still attempt judgment
                    });
                } else {
                    // Fallback if audioModule isn't found (shouldn't happen in normal operation)
                    console.warn("Keyboard: Audio module or resumeContext not available for context check.");
                    judgeFunction(keyName); // Attempt judgment anyway
                }
            } else if (!gameIsRunning) {
                // Log or handle key presses while paused if needed (currently does nothing)
                // console.log("Keyboard: Key pressed but game is paused.");
            } else {
                // Log warning if the judge function wasn't provided during init
                console.warn("Keyboard: Judge function not available!");
            }
        }
    }

    /**
     * Handles the visual release of a key.
     * @param {Element} keyElement - The DOM element of the key to release.
     */
    function releaseKey(keyElement) {
        // Remove visual feedback if the key element is valid and was pressed
        if (keyElement && keyElement.classList.contains('pressed')) {
            keyElement.classList.remove('pressed');
        }
    }

    // --- Event Handlers ---
    // These functions are attached as listeners in the init function

    /** Handles mouse button down events on the piano container. */
    function handleMouseDown(event) {
        // Ignore clicks that are not the primary button (left-click)
        if (event.button !== 0) return;
        // Find the closest ancestor element that is a key
        const targetKey = event.target.closest('.key');
        // Ensure the key exists and is within our piano container
        // IMPORTANT: This relies on `pianoContainer` being assigned during `init`
        if (targetKey && pianoContainer && pianoContainer.contains(targetKey)) {
            isMouseDown = true; // Set flag indicating mouse is down
            pressKey(targetKey); // Process the key press
            event.preventDefault(); // Prevent default actions like text selection
        }
    }

    /** Handles mouse button up events anywhere on the document. */
    function handleMouseUp(event) {
        // Ignore clicks that are not the primary button
        if (event.button !== 0) return;
        // If the mouse button was previously down...
        if (isMouseDown) {
            // Release all currently pressed keys visually
            // IMPORTANT: This relies on `keys` being assigned during `init`
            if (keys) {
                 keys.forEach(releaseKey);
            }
            isMouseDown = false; // Reset flag
        }
    }

    /** Handles the mouse leaving the piano container area. */
    function handleMouseLeave(event) {
        // If the mouse button was down when leaving the piano container...
        // IMPORTANT: This relies on `pianoContainer` being assigned during `init`
        if (isMouseDown && event.target === pianoContainer) {
             // Release all currently pressed keys visually
             // IMPORTANT: This relies on `keys` being assigned during `init`
            if (keys) {
                 keys.forEach(releaseKey);
            }
            isMouseDown = false; // Reset flag
        }
    }

    /** Handles the start of a touch event on the piano container. */
     function handleTouchStart(event) {
        // Prevent default touch behaviors like scrolling if touch starts on a key
        // IMPORTANT: This relies on `pianoContainer` being assigned during `init`
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
            // IMPORTANT: This relies on `pianoContainer` being assigned during `init`
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
            // IMPORTANT: This relies on `pianoContainer` being assigned during `init`
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
                        // (Use delete or set to null/undefined as appropriate for your tracking logic)
                         delete activeTouches[touchId];
                         // activeTouches[touchId] = null; // Alternative if delete causes issues downstream
                    }
                }
            }
             // Note: This logic doesn't handle starting a touch *outside* the keys and dragging *onto* them.
             // It primarily handles touches starting *on* a key and moving around.
        }
    }

    /** Handles the end or cancellation of a touch event. */
    function handleTouchEndOrCancel(event) {
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

    /**
     * Public initialization function for the keyboard module.
     * Should be called after the DOM is ready and the main game is initializing.
     * @param {Function} judgeKeyPressFunc - The function to call when a key press needs to be judged (e.g., staffModule.judgeKeyPress).
     */
    function init(judgeKeyPressFunc) {
        console.log("Keyboard Module: init() called.");

        // --- DOM Element Lookups ---
        // Find the piano container element. Moved here to ensure DOM is ready when init is called.
        pianoContainer = document.getElementById('piano');
        if (!pianoContainer) {
            // If the piano element isn't found, log an error and stop initialization for this module.
            console.error("Keyboard Error: Piano container element (#piano) not found during init!");
            // We don't 'return null' here as the module object itself is already created by the IIFE.
            // We just stop the initialization process for this module.
            return;
        }

        // Find all the key elements within the piano container. Also moved here.
        keys = pianoContainer.querySelectorAll('.key');
        if (!keys || keys.length === 0) {
            // Log a warning if no keys are found, though initialization might continue
            console.warn("Keyboard Warning: No elements with class '.key' found inside #piano during init!");
        }

        // Store the reference to the judgment function provided by the caller
        judgeFunction = judgeKeyPressFunc;
        if (typeof judgeFunction !== 'function') {
             console.error("Keyboard Error: Invalid or missing judgeKeyPressFunc passed to init!");
             // Consider stopping init here as well if judging is essential
             // return;
        }


        // --- Attach Event Listeners ---
        // Add listeners to the piano container element (or document where appropriate).
        // Use { passive: false } for touch events to allow preventDefault() to stop scrolling.
        pianoContainer.addEventListener('mousedown', handleMouseDown);
        // Listen on the whole document for mouseup to catch releases outside the piano
        document.addEventListener('mouseup', handleMouseUp);
        pianoContainer.addEventListener('mouseleave', handleMouseLeave);
        pianoContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
        pianoContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
        pianoContainer.addEventListener('touchend', handleTouchEndOrCancel, { passive: false });
        pianoContainer.addEventListener('touchcancel', handleTouchEndOrCancel, { passive: false });
        // Prevent the context menu (e.g., right-click menu) from appearing on the piano
        pianoContainer.addEventListener('contextmenu', (event) => event.preventDefault());

        console.log("Keyboard Module: Initialization complete and event listeners attached.");
    }

    // Expose only the init function publicly
    return {
        init: init // Make the init function callable from outside the module
    };
})(); // Immediately invoke the keyboard module function
