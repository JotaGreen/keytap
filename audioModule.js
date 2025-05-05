// --- Audio Module ---

console.log("Loading Audio Module...");

// --- Module-Scoped Variables (Private State) ---
let audioContext = null;
let audioBuffer = null; // Decoded audio data
let sourceNode = null;  // Current audio source playing
let isAudioReady = false;
let isAudioPlaying = false; // Flag to track if audio is currently playing or scheduled
let audioContextStartTime = 0; // Actual context time when playback *actually* began or is scheduled to begin
let startOffset = 0;    // Offset within the buffer where the latest playback started/resumed
let onSongEndCallback = null; // Callback function for when the song ends naturally

/**
 * Initializes the Audio Context and decodes audio data.
 * Accepts a callback function to be executed when the song ends naturally.
 * @param {ArrayBuffer} audioDataArrayBuffer - The raw audio data.
 * @param {Function} [onSongEnd] - Optional callback function when song finishes naturally.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 * @export
 */
export async function init(audioDataArrayBuffer, onSongEnd) {
    console.log("Initializing Audio Module...");
    // Store the callback
    onSongEndCallback = typeof onSongEnd === 'function' ? onSongEnd : null;

    // Initialize Audio Context (if not already done)
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log("Audio Context created.");
        } catch (e) {
            console.error("Web Audio API is not supported in this browser.", e);
            alert("Error: Web Audio API is not supported in this browser.");
            return false;
        }
    }

    // Reset state for decoding
    isAudioReady = false;
    audioBuffer = null; // Clear previous buffer
    console.log("Decoding audio data...");
    try {
        // Ensure context is running before decoding (good practice)
        await resumeContext(); // Use exported resumeContext function
        audioBuffer = await audioContext.decodeAudioData(audioDataArrayBuffer);
        isAudioReady = true;
        console.log(`Audio data decoded successfully. Duration: ${audioBuffer.duration.toFixed(2)}s`);
        return true; // Indicate success
    } catch (e) {
        console.error("Error decoding audio data:", e);
        alert("Error decoding audio file. Please ensure it's a valid MP3 file.");
        return false; // Indicate failure
    }
}

/**
 * Starts or resumes playback.
 * @param {number} [offset=0] - The offset within the audio buffer to start playback from.
 * @param {number} [preDelay=0] - The delay (in seconds) before audio starts playing (e.g., PRE_DELAY_SECONDS from main).
 * @export
 */
export function play(offset = 0, preDelay = 0) {
    // Check if ready and context is running
    if (!isAudioReady || !audioContext || audioContext.state === 'suspended') {
        if (audioContext && audioContext.state === 'suspended') {
            resumeContext().then(() => { // Use exported resumeContext
                console.log("AudioContext resumed during play attempt.");
                play(offset, preDelay); // Retry play after resuming
            }).catch(e => console.error("Failed to resume AudioContext during play:", e));
        } else {
            console.warn("Audio not ready or context suspended, cannot play.");
        }
        return; // Exit if not ready or suspended
    }

    // Stop previous source if it exists (e.g., rapid pause/play)
    if (sourceNode) {
        try { sourceNode.stop(); } catch (e) { /* Ignore error if already stopped */ }
        sourceNode.disconnect();
        sourceNode = null; // Ensure clean slate
    }

    // Create and configure the new source node
    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(audioContext.destination);

    // Store the offset where playback should start within the buffer
    startOffset = offset;

    // Calculate when the audio should actually start playing in the context timeline
    // Use the preDelay passed in, applying it only if starting from the beginning
    const delay = (startOffset === 0 && preDelay > 0) ? preDelay : 0;
    audioContextStartTime = audioContext.currentTime + delay; // Schedule start time

    console.log(`Audio: Scheduling playback start at context time: ${audioContextStartTime.toFixed(3)}s (Delay: ${delay.toFixed(3)}s) from buffer offset: ${startOffset.toFixed(3)}s`);

    // Schedule start using the calculated time and offset
    sourceNode.start(audioContextStartTime, startOffset);
    isAudioPlaying = true; // Mark as playing (or scheduled to play)

    // --- onended Handler ---
    // This function is called when the source node finishes playing (naturally or via stop()).
    sourceNode.onended = () => {
        const wasAudioPlaying = isAudioPlaying; // Capture state before clearing
        isAudioPlaying = false; // Mark as not playing

        // Check if the song finished naturally (not stopped early)
        // Calculate duration played since scheduled start time
        const playbackDuration = audioContext.currentTime - audioContextStartTime;
        // Calculate expected duration from the start offset
        const expectedRemainingDuration = audioBuffer.duration - startOffset;

        // Trigger callback only if it was playing, finished near the expected end,
        // and a valid callback exists. Let the caller (main.js) handle game state checks.
        if (wasAudioPlaying && playbackDuration >= 0 && playbackDuration >= expectedRemainingDuration - 0.1 && onSongEndCallback) {
             console.log("Audio source ended naturally (song finished). Notifying caller.");
             onSongEndCallback(); // Call the callback function provided during init
        } else {
             // Log if stopped manually or for other reasons
             // console.log("Audio source ended (likely due to stop() or pause).");
        }
    };
}

/**
 * Pauses playback and returns the current playback offset.
 * @returns {number} The offset (in seconds) where playback was paused.
 * @export
 */
export function pause() {
    // Use getPlaybackTime to calculate where we are *before* stopping
    const currentOffset = getPlaybackTime(); // Use exported getPlaybackTime

    // Check if audio is actually playing and ready
    if (!sourceNode || !isAudioReady || !audioContext || !isAudioPlaying) {
        // If not playing, return the last known offset (startOffset is updated on pause)
        return startOffset;
    }

    console.log(`Audio: Pausing at calculated offset: ${currentOffset.toFixed(3)}s`);

    // Stop the source node
    try {
        sourceNode.stop(); // Stop playback immediately
    } catch (e) {
        // Log warning if stopping fails (might already be stopped)
        console.warn("Audio: Error stopping source node (might be already stopped):", e);
    }
    // Disconnect and clear reference
    sourceNode.disconnect();
    sourceNode = null;
    isAudioPlaying = false; // Update playing state
    startOffset = currentOffset; // Update startOffset to the paused position

    return startOffset; // Return the offset where it stopped
}

/**
 * Stops playback completely and resets the offset.
 * @export
 */
export function stop() {
     // Check if there's a source node to stop
     if (!sourceNode || !isAudioReady || !audioContext) {
        // If already stopped or not ready, just ensure state is reset
        isAudioPlaying = false;
        startOffset = 0;
        audioContextStartTime = 0;
        sourceNode = null; // Ensure reference is cleared
        return; // Exit
     }

     // Log and stop the node
     console.log("Audio: Stopping playback.");
     try {
         sourceNode.stop();
     } catch (e) {
         console.warn("Audio: Error stopping source node (might be already stopped):", e);
     }
     // Disconnect and clear reference
     sourceNode.disconnect();
     sourceNode = null;
     // Reset state variables
     isAudioPlaying = false;
     startOffset = 0; // Reset offset
     audioContextStartTime = 0;
}


/**
 * Gets the current playback time within the audio buffer.
 * Takes into account the scheduled start time and current context time.
 * @returns {number} The current playback time in seconds.
 * @export
 */
export function getPlaybackTime() {
    // If not playing, or context not ready, or not scheduled yet, return the last start offset
    if (!isAudioPlaying || !audioContext || audioContextStartTime === 0) {
        return startOffset;
    }

    // Calculate elapsed time since the *scheduled* start time
    const elapsedSinceScheduledStart = audioContext.currentTime - audioContextStartTime;

    // If the current time is before the scheduled start, playback hasn't begun. Return the initial offset.
    if (elapsedSinceScheduledStart < 0) {
        return startOffset;
    }

    // Otherwise, return the starting offset plus the time elapsed since the actual start
    return startOffset + elapsedSinceScheduledStart;
}

/**
 * Gets the current AudioContext time.
 * @returns {number} The current time of the AudioContext in seconds, or 0 if not available.
 * @export
 */
export function getCurrentContextTime() {
    // Return context time if available, otherwise 0
    return audioContext ? audioContext.currentTime : 0;
}

/**
 * Checks if the audio data has been successfully decoded and is ready for playback.
 * @returns {boolean} True if audio is ready, false otherwise.
 * @export
 */
export function isReady() {
    // Return the internal state flag
    return isAudioReady;
}

/**
 * Resumes the AudioContext if it's suspended (e.g., due to browser auto-play policies).
 * Must typically be called after a user interaction.
 * @returns {Promise<void>} A promise that resolves when the context is resumed.
 * @export
 */
export function resumeContext() {
    // Check if context exists and is suspended
    if (audioContext && audioContext.state === 'suspended') {
        console.log("Audio: Attempting to resume suspended AudioContext...");
        return audioContext.resume(); // Returns a promise
    }
    // Return a resolved promise if not suspended or not initialized
    return Promise.resolve();
}
