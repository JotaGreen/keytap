// --- Audio Module (Web Audio API) ---
        const audioModule = (() => {
            console.log("Initializing Audio Module...");
            let audioContext = null;
            let audioBuffer = null; // Decoded audio data
            let sourceNode = null;  // Current audio source playing
            let isAudioReady = false;
            let isAudioPlaying = false; // Flag to track if audio is currently playing or scheduled
            let audioContextStartTime = 0; // Actual context time when playback *actually* began or is scheduled to begin
            let startOffset = 0;    // Offset within the buffer where the latest playback started/resumed

            /** Initialize Audio Context and decode audio data */
            async function init(audioDataArrayBuffer) {
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

                isAudioReady = false;
                audioBuffer = null; // Clear previous buffer
                console.log("Decoding audio data...");
                try {
                    // Ensure context is running before decoding (good practice)
                    await resumeContext();
                    audioBuffer = await audioContext.decodeAudioData(audioDataArrayBuffer);
                    isAudioReady = true;
                    console.log(`Audio data decoded successfully. Duration: ${audioBuffer.duration.toFixed(2)}s`);
                    return true;
                } catch (e) {
                    console.error("Error decoding audio data:", e);
                    alert("Error decoding audio file. Please ensure it's a valid MP3 file.");
                    return false;
                }
            }

            /** Start or resume playback */
            function play(offset = 0) {
                if (!isAudioReady || !audioContext || audioContext.state === 'suspended') {
                    if (audioContext && audioContext.state === 'suspended') {
                        resumeContext().then(() => {
                            console.log("AudioContext resumed during play attempt.");
                            play(offset); // Retry play after resuming
                        }).catch(e => console.error("Failed to resume AudioContext during play:", e));
                    } else {
                        console.warn("Audio not ready or context suspended, cannot play.");
                    }
                    return;
                }
                if (sourceNode) { // Stop previous source if it exists (e.g., rapid pause/play)
                    try { sourceNode.stop(); } catch (e) { /* Ignore error if already stopped */ }
                    sourceNode.disconnect();
                    sourceNode = null; // Ensure clean slate
                }

                sourceNode = audioContext.createBufferSource();
                sourceNode.buffer = audioBuffer;
                sourceNode.connect(audioContext.destination);

                startOffset = offset; // Store the offset where playback should start within the buffer

                // Calculate when the audio should actually start playing in the context timeline
                const delay = (startOffset === 0 && PRE_DELAY_SECONDS > 0) ? PRE_DELAY_SECONDS : 0;
                audioContextStartTime = audioContext.currentTime + delay; // Schedule start time

                console.log(`Audio: Scheduling playback start at context time: ${audioContextStartTime.toFixed(3)}s (Delay: ${delay.toFixed(3)}s) from buffer offset: ${startOffset.toFixed(3)}s`);
                sourceNode.start(audioContextStartTime, startOffset); // Schedule start
                isAudioPlaying = true; // Mark as playing (or scheduled to play)

                sourceNode.onended = () => {
                    const wasPlaying = isAudioPlaying; // Store state before clearing
                    isAudioPlaying = false; // Mark as not playing

                    // Only trigger game over if the audio played fully or near fully
                    // and if the game wasn't already stopped/paused manually
                    const playbackDuration = audioContext.currentTime - audioContextStartTime;
                    const expectedRemainingDuration = audioBuffer.duration - startOffset;

                    if (wasPlaying && !isGameOver && playbackDuration >= 0 && playbackDuration >= expectedRemainingDuration - 0.1) {
                         console.log("Audio source ended naturally (song finished).");
                         if (staffModule && staffModule.isRunning()) {
                              triggerGameOver(true); // Song finished successfully
                         }
                    } else {
                         // console.log("Audio source ended (likely due to stop() or pause).");
                    }
                };
            }

            /** Pause playback */
            function pause() {
                // Use getPlaybackTime to calculate where we are *before* stopping
                const currentOffset = getPlaybackTime();

                if (!sourceNode || !isAudioReady || !audioContext || !isAudioPlaying) {
                    // If not playing, return the last known offset
                    return startOffset;
                }

                console.log(`Audio: Pausing at calculated offset: ${currentOffset.toFixed(3)}s`);

                try {
                    sourceNode.stop(); // Stop playback
                } catch (e) {
                    console.warn("Audio: Error stopping source node (might be already stopped):", e);
                }
                sourceNode.disconnect();
                sourceNode = null;
                isAudioPlaying = false;
                startOffset = currentOffset; // Update startOffset to the paused position

                return startOffset; // Return the offset where it stopped
            }

            /** Stop playback completely */
            function stop() {
                 if (!sourceNode || !isAudioReady || !audioContext) {
                    // If already stopped or not ready, just ensure state is reset
                    isAudioPlaying = false;
                    startOffset = 0;
                    audioContextStartTime = 0;
                    sourceNode = null; // Ensure reference is cleared
                    return;
                 }
                 console.log("Audio: Stopping playback.");
                 try {
                     sourceNode.stop();
                 } catch (e) {
                     console.warn("Audio: Error stopping source node (might be already stopped):", e);
                 }
                 sourceNode.disconnect();
                 sourceNode = null;
                 isAudioPlaying = false;
                 startOffset = 0; // Reset offset
                 audioContextStartTime = 0;
            }


            /** Get the current playback time within the audio buffer */
            function getPlaybackTime() {
                if (!isAudioPlaying || !audioContext || audioContextStartTime === 0) {
                    // If paused, stopped, or not yet started (during initial delay), return the offset
                    return startOffset;
                }
                // Calculate elapsed time since the *scheduled* start time
                const elapsedSinceScheduledStart = audioContext.currentTime - audioContextStartTime;

                // If the current time is before the scheduled start, playback hasn't begun, return the initial offset
                if (elapsedSinceScheduledStart < 0) {
                    return startOffset;
                }

                // Otherwise, return the starting offset plus the time elapsed since the actual start
                return startOffset + elapsedSinceScheduledStart;
            }

            /** Get the AudioContext time */
            function getCurrentContextTime() {
                return audioContext ? audioContext.currentTime : 0;
            }

            /** Resumes the AudioContext if it's suspended */
            function resumeContext() {
                if (audioContext && audioContext.state === 'suspended') {
                    console.log("Audio: Attempting to resume suspended AudioContext...");
                    return audioContext.resume(); // Returns a promise
                }
                return Promise.resolve(); // Return resolved promise if not suspended or not initialized
            }

            return {
                init,
                play,
                pause,
                stop,
                getPlaybackTime,
                getCurrentContextTime,
                isReady: () => isAudioReady,
                resumeContext // Expose resume function
            };
        })();