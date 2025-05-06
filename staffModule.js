// staffModule.js

/**
 * @file staffModule.js
 * Handles rendering the scrolling staff, notes, judgment line, visual feedback,
 * timing calculations, and note hit judgment.
 * To be loaded as an ES Module.
 */

// --- Module Imports ---
// Import functions/objects from other modules
// Adjust paths/URLs as necessary
import * as audio from './audioModule.js'; // Audio playback functions
import { getMidiNoteColor } from './midiColorConverter.js'; // Color conversion utility

// Import functions/variables that will be exported from main.js (or future gameLogic.js/config.js)
// TODO: Replace './main.js' with specific module paths once they exist (e.g., './gameLogic.js', './config.js')
import { applyScore } from './main.js'; // Function to apply scoring
import { isGameOver, useColoredNotes, PRE_DELAY_SECONDS, SCROLL_SPEED_PIXELS_PER_SECOND, HIT_WINDOW_GOOD_SEC, HIT_WINDOW_PERFECT_SEC } from './main.js';
// Note: Importing potentially mutable state like useColoredNotes directly is okay if main.js exports `let`, but function accessors are safer.
// Note: Importing SCROLL_SPEED etc. directly assumes they are exported constants or getter functions from main/config.

// --- Module-Scoped Variables (Private State) ---
console.log("Staff Module: Script loaded.");

// --- Configuration Constants (Internal to Staff Rendering) ---
const STAFF_LINE_COLOR = '#000000';
const NOTE_COLOR = '#333333';
const ACCIDENTAL_COLOR_BLACK_NOTES = '#888888';
const ACCIDENTAL_COLOR_COLOR_NOTES = '#000000';
const STAFF_LINE_WIDTH = 1;
const NOTE_CORNER_RADIUS = 3;
const LINE_SPACING = 12;
const STAFF_PADDING = LINE_SPACING / 2;
const JUDGMENT_LINE_COLOR = '#FF0000';
const JUDGMENT_LINE_WIDTH = 2;
const JUDGMENT_LINE_X_PERCENT = 20; // Percentage from left
const MIDI_NOTE_MIN = 36; // C2
const MIDI_NOTE_MAX = 84; // C6
const ACCIDENTAL_PADDING_X = 3;
const ACCIDENTAL_FONT_SIZE = LINE_SPACING * 1.2;
const LEDGER_LINE_EXTENSION = 4;
const LEDGER_LINE_WIDTH = 1;
const MIN_DISPLAY_TIME = 0.0; // Visual time should not go below 0
const PERFECT_FLASH_COLOR = 'rgba(255, 215, 0, 0.7)'; // Gold, semi-transparent
const PERFECT_FLASH_DURATION_MS = 150; // How long the flash lasts
const SONG_END_BUFFER_SEC = 2.0; // Visual buffer after last note

// --- DOM Elements & Canvas Context (Assigned in init) ---
let staffSectionElement = null; // The container div passed in init
let canvas = null;
let ctx = null;
let devicePixelRatio = 1;
let canvasWidth = 300; // Logical display width (updated on resize)
let canvasHeight = 150; // Logical display height (updated on resize)
let judgmentLineX; // Logical X position (updated on resize)

// --- Staff Geometry & Note Position Mapping ---
const HALF_LINE_SPACING = LINE_SPACING / 2;
let totalStaffLogicalHeight = 150; // Calculated height
const staffPositions = {}; // Holds absolute Y coords for staff lines/spaces
let diatonicNoteYPositions = {}; // Holds absolute Y coords for note centers
const midiToDiatonicDegree = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // C=0, D=1, ..., B=6
const notePitchClasses = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]; // For matching key presses

// --- Note Data & State ---
let noteMap = null; // Parsed note data from JSON
let notesToDraw = []; // Array of note objects to be drawn { ..., y: number, hitStatus: null | 'good' | 'perfect' | 'miss' }
let totalNotesInSong = 0; // Reference count for score percentages
let songEndTimeVisual = 0; // Time when the last note finishes + buffer

// --- Animation & Interaction State ---
let isStaffRunning = false; // Internal state for staff animation loop
let animationFrameId = null;
let displayTime = 0; // Current visual time, reflects audio time
let isDragging = false;
let dragStartX = 0;
let dragStartTime = 0; // Display time at drag start
let activeFlashes = []; // To store { y: number, endTime: number } for perfect hit flashes
let setAudioPauseOffsetFunc = (offset) => { console.warn("setAudioPauseOffsetFunc not set during init"); }; // Function provided by caller


// --- Internal Helper Functions ---

/** Calculates staff geometry, note Y positions, and total canvas height */
function setupStaffAndNotes() {
    console.log("Staff Module: Setting up staff geometry...");
    // ... (geometry calculation code - unchanged from previous version) ...
    let currentY_rel = 0; const staffPositions_rel = {};
    staffPositions_rel.F5 = currentY_rel; staffPositions_rel.E5 = staffPositions_rel.F5 + HALF_LINE_SPACING; staffPositions_rel.D5 = staffPositions_rel.F5 + LINE_SPACING; staffPositions_rel.C5 = staffPositions_rel.D5 + HALF_LINE_SPACING; staffPositions_rel.B4 = staffPositions_rel.D5 + LINE_SPACING; staffPositions_rel.A4 = staffPositions_rel.B4 + HALF_LINE_SPACING; staffPositions_rel.G4 = staffPositions_rel.B4 + LINE_SPACING; staffPositions_rel.F4 = staffPositions_rel.G4 + HALF_LINE_SPACING; staffPositions_rel.E4 = staffPositions_rel.G4 + LINE_SPACING;
    const spaceBetweenStaves = LINE_SPACING;
    staffPositions_rel.D4 = staffPositions_rel.E4 + HALF_LINE_SPACING; staffPositions_rel.C4 = staffPositions_rel.E4 + LINE_SPACING; staffPositions_rel.B3 = staffPositions_rel.C4 + HALF_LINE_SPACING; staffPositions_rel.A3 = staffPositions_rel.C4 + LINE_SPACING; staffPositions_rel.G3 = staffPositions_rel.A3 + HALF_LINE_SPACING; staffPositions_rel.F3 = staffPositions_rel.A3 + LINE_SPACING; staffPositions_rel.E3 = staffPositions_rel.F3 + HALF_LINE_SPACING; staffPositions_rel.D3 = staffPositions_rel.F3 + LINE_SPACING; staffPositions_rel.C3 = staffPositions_rel.D3 + HALF_LINE_SPACING; staffPositions_rel.B2 = staffPositions_rel.D3 + LINE_SPACING; staffPositions_rel.A2 = staffPositions_rel.B2 + HALF_LINE_SPACING; staffPositions_rel.G2 = staffPositions_rel.B2 + LINE_SPACING;
    const noteNames = ["C", "D", "E", "F", "G", "A", "B"]; const midiRef = 60; const yRef_rel = staffPositions_rel.C4;
    diatonicNoteYPositions = {}; let minY_rel = Infinity, maxY_rel = -Infinity;
    for (let midi = MIDI_NOTE_MIN; midi <= MIDI_NOTE_MAX; midi++) { const octave = Math.floor(midi / 12) - 1; const noteIndex = midi % 12; const diatonicDegree = midiToDiatonicDegree[noteIndex]; const referenceOctave = Math.floor(midiRef / 12) - 1; const octaveDifference = octave - referenceOctave; const stepsFromRefDegree = diatonicDegree - midiToDiatonicDegree[midiRef % 12]; const totalDiatonicSteps = octaveDifference * 7 + stepsFromRefDegree; const yPos_rel = yRef_rel - (totalDiatonicSteps * HALF_LINE_SPACING); const baseNoteLetter = noteNames[diatonicDegree]; const baseNoteName = baseNoteLetter + octave; if (!(baseNoteName in diatonicNoteYPositions)) { diatonicNoteYPositions[baseNoteName] = yPos_rel; minY_rel = Math.min(minY_rel, yPos_rel); maxY_rel = Math.max(maxY_rel, yPos_rel); } }
    const noteHeight = LINE_SPACING; const topNoteEdgeY_rel = minY_rel - (noteHeight / 2); const bottomNoteEdgeY_rel = maxY_rel + (noteHeight / 2); totalStaffLogicalHeight = (bottomNoteEdgeY_rel - topNoteEdgeY_rel) + (STAFF_PADDING * 2); totalStaffLogicalHeight = Math.max(100, totalStaffLogicalHeight); const yOffset = STAFF_PADDING - topNoteEdgeY_rel; for (const key in staffPositions_rel) { staffPositions[key] = staffPositions_rel[key] + yOffset; } for (const key in diatonicNoteYPositions) { diatonicNoteYPositions[key] += yOffset; }
    console.log(`Staff Module: Staff Logical Height Calculated: ${totalStaffLogicalHeight.toFixed(1)}px`);
}

/** Finds the Y position for a given note name. */
function getNoteYPosition(noteName) {
    const baseNameMatch = noteName.match(/([A-G])[#b]?(\d)/);
    if (baseNameMatch) {
        const baseName = baseNameMatch[1] + baseNameMatch[2];
        const yPosition = diatonicNoteYPositions[baseName];
        // Return position if found, otherwise null
        return (yPosition !== undefined) ? yPosition : null;
    } else {
        // Log warning for unparsable names
        console.warn(`Staff Module: Could not parse base note name from: "${noteName}"`);
        return null;
    }
}

/** Gets the pitch class (e.g., "Db") from a full note name. */
function getPitchClass(noteName) {
    // Match the note letter and optional accidental
    const match = noteName.match(/([A-G][#b]?)/);
    if (match) {
        let pc = match[1];
        // Simple enharmonic normalization (prefer flats for black keys)
        if (pc === "C#") pc = "Db";
        if (pc === "D#") pc = "Eb";
        if (pc === "F#") pc = "Gb";
        if (pc === "G#") pc = "Ab";
        if (pc === "A#") pc = "Bb";
        return pc;
    }
    // Return null if no match found
    return null;
}


// --- Drawing Functions ---

/** Draws a single horizontal staff line. */
function drawStaffLine(y) {
    if (!ctx) return; // Need context to draw
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.lineWidth = STAFF_LINE_WIDTH;
    ctx.strokeStyle = STAFF_LINE_COLOR;
    ctx.stroke();
}

/** Draws the 10 lines of the grand staff. */
function drawGrandStaff() {
    // Check if positions are calculated
    if (!staffPositions.E4) {
        console.warn("drawGrandStaff skipped: staffPositions not ready.");
        return;
    }
    // Treble Staff Lines (E4, G4, B4, D5, F5)
    drawStaffLine(staffPositions.E4); drawStaffLine(staffPositions.G4); drawStaffLine(staffPositions.B4); drawStaffLine(staffPositions.D5); drawStaffLine(staffPositions.F5);
    // Bass Staff Lines (G2, B2, D3, F3, A3)
    drawStaffLine(staffPositions.G2); drawStaffLine(staffPositions.B2); drawStaffLine(staffPositions.D3); drawStaffLine(staffPositions.F3); drawStaffLine(staffPositions.A3);
}

/** Draws a rectangle with rounded corners. */
function drawRoundedRect(x, y, width, height, radius) {
    if (!ctx) return; // Need context
    // Clamp radius if dimensions are too small
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    // Don't draw zero/negative size rectangles
    if (width <= 0 || height <= 0) return;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    ctx.fill(); // Assumes fillStyle is set beforehand
}

/** Draws ledger lines for a note if needed. */
function drawLedgerLines(note, x, noteWidth) {
    if (!ctx) return; // Need context
    const y = note.y;
    // Skip if Y position is unknown
    if (y === null) return;
    const checkTolerance = HALF_LINE_SPACING / 2; // Tolerance for checking proximity to lines
    ctx.lineWidth = LEDGER_LINE_WIDTH;
    ctx.strokeStyle = STAFF_LINE_COLOR;
    const ledgerXStart = x - LEDGER_LINE_EXTENSION;
    const ledgerXEnd = x + noteWidth + LEDGER_LINE_EXTENSION;

    // Ledger lines ABOVE treble staff (F5 is top line)
    if (y < staffPositions.F5 - checkTolerance) {
        for (let lineY = staffPositions.F5 - LINE_SPACING; lineY >= y - checkTolerance; lineY -= LINE_SPACING) {
            ctx.beginPath(); ctx.moveTo(ledgerXStart, lineY); ctx.lineTo(ledgerXEnd, lineY); ctx.stroke();
        }
    }
    // Ledger line FOR Middle C (C4) - check if note is ON C4 line
    if (Math.abs(y - staffPositions.C4) < checkTolerance) {
        ctx.beginPath(); ctx.moveTo(ledgerXStart, staffPositions.C4); ctx.lineTo(ledgerXEnd, staffPositions.C4); ctx.stroke();
    }
     // Ledger lines BELOW bass staff (G2 is bottom line)
    if (y > staffPositions.G2 + checkTolerance) {
        for (let lineY = staffPositions.G2 + LINE_SPACING; lineY <= y + checkTolerance; lineY += LINE_SPACING) {
            ctx.beginPath(); ctx.moveTo(ledgerXStart, lineY); ctx.lineTo(ledgerXEnd, lineY); ctx.stroke();
        }
    }
}

/** Draws an accidental (sharp/flat) next to a note. */
function drawAccidental(note, x) {
    if (!ctx) return; // Need context
    // Determine accidental symbol
    const accidental = note.name.includes('#') ? '♯' : note.name.includes('b') ? '♭' : null;
    // Draw only if accidental exists and note has a Y position
    if (accidental && note.y !== null) {
        // Set color based on imported 'useColoredNotes' state
        ctx.fillStyle = useColoredNotes ? ACCIDENTAL_COLOR_COLOR_NOTES : ACCIDENTAL_COLOR_BLACK_NOTES;
        ctx.font = `${ACCIDENTAL_FONT_SIZE}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const accidentalX = x + ACCIDENTAL_PADDING_X;
        const accidentalY = note.y; // Center vertically on the note's Y
        ctx.fillText(accidental, accidentalX, accidentalY);
    }
}

/** Draws a single note rectangle on the canvas. */
function drawNote(note, currentDisplayTime) {
    // Don't draw if already hit successfully or no context
    if (!ctx || note.hitStatus === 'good' || note.hitStatus === 'perfect') {
        return;
    }
    // Continue drawing if missed or not yet judged
    // Skip notes with invalid Y positions
    if (note.y === null || note.y === undefined) { return; }

    const noteY = note.y; // Center Y position
    // Calculate time relative to the current display time
    const timeUntilJudgment = note.time - currentDisplayTime;
    // Use the imported SCROLL_SPEED_PIXELS_PER_SECOND configuration
    const noteX = judgmentLineX + (timeUntilJudgment * SCROLL_SPEED_PIXELS_PER_SECOND);
    const noteWidth = Math.max(1, note.duration * SCROLL_SPEED_PIXELS_PER_SECOND); // Ensure minimum width
    const noteHeight = LINE_SPACING; // Note height matches line spacing

    // Determine note color using imported function and state
    let currentNoteColor = NOTE_COLOR; // Default black/grey
    if (useColoredNotes) { // Check imported state
        if (typeof getMidiNoteColor === 'function') { // Check if import worked
            try {
                const rgbArray = getMidiNoteColor(note.midi); // Use imported function
                if (rgbArray && rgbArray.length === 3) {
                    currentNoteColor = `rgb(${rgbArray[0]}, ${rgbArray[1]}, ${rgbArray[2]})`;
                } else { currentNoteColor = NOTE_COLOR; } // Fallback
            } catch (e) { console.error(`Staff Module: Error calling imported getMidiNoteColor:`, e); currentNoteColor = NOTE_COLOR; }
        } else {
            console.warn("Staff Module: getMidiNoteColor function not available.");
             currentNoteColor = NOTE_COLOR; // Fallback if function missing
        }
    }

    // Draw only if potentially visible (basic culling)
    if (noteX < canvasWidth && (noteX + noteWidth) > 0) {
        drawLedgerLines(note, noteX, noteWidth); // Draw ledger lines first (behind)
        ctx.fillStyle = currentNoteColor; // Set the determined color
        drawRoundedRect(noteX, noteY - noteHeight / 2, noteWidth, noteHeight, NOTE_CORNER_RADIUS); // Draw note body
        // Draw accidental AFTER note body so it's on top
        drawAccidental(note, noteX);
    }
}

/** Draws the vertical judgment line. */
function drawJudgmentLine() {
    if (!ctx) return; // Need context
     ctx.beginPath();
     ctx.moveTo(judgmentLineX, 0);
     ctx.lineTo(judgmentLineX, canvasHeight);
     ctx.lineWidth = JUDGMENT_LINE_WIDTH;
     ctx.strokeStyle = JUDGMENT_LINE_COLOR;
     ctx.stroke();
}

/** Draws active "perfect hit" visual flashes. */
function drawFlashes(currentDisplayTime) {
    // Don't draw if no active flashes or context/audio module missing
    if (activeFlashes.length === 0 || !ctx || !audio) return;

    ctx.fillStyle = PERFECT_FLASH_COLOR;
    const flashHeight = LINE_SPACING * 1.5; // Make flash slightly taller than note
    const flashWidth = 10; // Fixed width for the flash effect
    const flashEndTimeContext = audio.getCurrentContextTime(); // Use imported audio function

    // Iterate backwards for safe removal while iterating
    for (let i = activeFlashes.length - 1; i >= 0; i--) {
        const flash = activeFlashes[i];
        // Check against context time when flash should end
        if (flashEndTimeContext >= flash.endTime) {
            activeFlashes.splice(i, 1); // Remove expired flash
        } else {
            // Draw the flash centered vertically on the note's Y at the judgment line X
            drawRoundedRect(
                judgmentLineX - flashWidth / 2,
                flash.y - flashHeight / 2,
                flashWidth,
                flashHeight,
                flashWidth / 2 // Make it oval/circular
            );
        }
    }
}

// --- Animation Loop ---

/** Main animation loop, called via requestAnimationFrame. */
function animationLoop() {
    // Stop loop if staff shouldn't be running or game is over (uses imported state)
    if (!isStaffRunning || isGameOver) {
         console.log("Staff Module: Stopping animation loop.");
         animationFrameId = null; // Clear ID
         return; // Exit loop
    }

    // Update current display time based on audio module
    if (audio) {
        displayTime = audio.getPlaybackTime();
        displayTime = Math.max(MIN_DISPLAY_TIME, displayTime); // Clamp time
    } else {
        console.warn("Staff Module: Audio module not available in animationLoop.");
        // Optionally stop loop if audio is critical?
    }


    // --- Check for Missed Notes ---
    // Uses imported timing window constant
    const missThresholdTime = displayTime - HIT_WINDOW_GOOD_SEC;
    notesToDraw.forEach(note => {
        // Check only notes that haven't been judged yet and are past the miss threshold
        if (!note.hitStatus && note.time < missThresholdTime) {
            // console.log(`Staff Module: Note missed: ${note.name} at time ${note.time.toFixed(3)} (displayTime: ${displayTime.toFixed(3)})`); // Debug log
            note.hitStatus = 'miss';
            applyScore('miss'); // Call imported scoring function
        }
    });

    // --- Redraw Canvas ---
    redrawCanvasInternal(); // Redraw everything based on current displayTime

    // --- Request Next Frame ---
    // Continue the loop if still running
    if (isStaffRunning) {
        animationFrameId = requestAnimationFrame(animationLoop);
    }
}

/** Internal redraw function called each frame. */
function redrawCanvasInternal() {
    // Need context and audio module to redraw based on time
    if (!ctx || !audio) {
        // console.warn("Staff Module: redrawCanvasInternal skipped - missing context or audio module.");
        return;
    }

    ctx.save(); // Save default context state
    // Clear the canvas using physical pixel dimensions
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Scale the context coordinate system for high-DPI displays
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // --- Drawing ---
    drawGrandStaff();
    drawJudgmentLine();

    // Draw notes based on the current displayTime (derived from audio time)
    if (notesToDraw.length > 0) {
        notesToDraw.forEach(note => drawNote(note, displayTime));
    } else {
        // Display message if notes haven't loaded or processed
        ctx.fillStyle = '#888';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(noteMap ? 'No notes found in track' : 'Loading notes...', canvasWidth / 2, canvasHeight / 2);
    }

    // Draw perfect hit flashes
    drawFlashes(displayTime);
    // ---------------

    ctx.restore(); // Restore context state
}

// --- Event Handlers ---

/** Handles window resize or orientation change. */
function handleResizeInternal() {
    // Need the container element passed during init
    if (!staffSectionElement || !canvas) {
        console.warn("Staff Module: handleResize skipped - staffSectionElement or canvas not available.");
        return;
    }
    console.log("Staff Module: Handling resize...");

    const displayWidth = staffSectionElement.offsetWidth;
    const displayHeight = staffSectionElement.offsetHeight;

    // Avoid resizing if dimensions are invalid
    if (displayWidth <= 0 || displayHeight <= 0) {
        console.warn("Staff Module: Resize called with zero or negative dimensions. Skipping redraw.");
        return;
    }

    // Update logical dimensions
    canvasWidth = displayWidth;
    canvasHeight = Math.min(displayHeight, totalStaffLogicalHeight); // Use calculated or container height

    // Update physical dimensions for high DPI
    canvas.width = Math.round(canvasWidth * devicePixelRatio);
    canvas.height = Math.round(canvasHeight * devicePixelRatio);

    // Update CSS dimensions for scaling
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    // Recalculate judgment line position
    judgmentLineX = canvasWidth * (JUDGMENT_LINE_X_PERCENT / 100);

    // Redraw immediately with new dimensions and current displayTime
    redrawCanvasInternal();
    console.log(`Staff Module: Resized canvas to ${canvasWidth}x${canvasHeight} (logical)`);
}

/** Helper to get X coordinate from mouse or touch event. */
function getEventX(event) {
    return event.touches ? event.touches[0].clientX : event.clientX;
}

/** Handles start of dragging on the canvas. */
function handleDragStart(event) {
    // Only allow dragging if the game is NOT running and NOT over
    if (!isStaffRunning && !isGameOver && canvas) {
        // console.log("Staff Module: Drag Start"); // Debug log
        isDragging = true;
        // Calculate starting X relative to the canvas
        dragStartX = getEventX(event) - canvas.getBoundingClientRect().left;
        // Store the display time (derived from audio time) at the start of the drag
        dragStartTime = displayTime;
        canvas.classList.add('dragging'); // Add CSS class for visual feedback
        // Prevent default actions if drag started on canvas (e.g., text selection)
        if (event.target === canvas) {
             event.preventDefault();
        }
    }
}

/** Handles mouse/touch movement during a drag. */
function handleDragMove(event) {
    // Only process if dragging is active and canvas exists
    if (isDragging && canvas) {
        // console.log("Staff Module: Drag Move"); // Debug log
        const currentX = getEventX(event) - canvas.getBoundingClientRect().left;
        const deltaX = currentX - dragStartX; // Pixel difference from drag start
        // Convert pixel offset to time offset using imported scroll speed
        const deltaTimeOffset = deltaX / SCROLL_SPEED_PIXELS_PER_SECOND;

        // Calculate new display time based on drag, subtracting offset
        // Clamp time to minimum allowed value (e.g., 0)
        displayTime = Math.max(MIN_DISPLAY_TIME, dragStartTime - deltaTimeOffset);

        // Redraw canvas immediately at the new display time
        redrawCanvasInternal();
        // Prevent default actions if dragging started on canvas
        if (event.target === canvas) {
             event.preventDefault();
        }
    }
}

/** Handles end of dragging on the canvas. */
function handleDragEnd(event) {
    // Only process if dragging was active and canvas exists
    if (isDragging && canvas) {
        // console.log("Staff Module: Drag End"); // Debug log
        isDragging = false;
        canvas.classList.remove('dragging'); // Remove dragging class

        // Update the shared audio pause offset using the function passed during init
        const newOffset = Math.max(0, displayTime); // Ensure non-negative
        setAudioPauseOffsetFunc(newOffset); // Call the setter function from main.js
        console.log(`Staff Module: Drag ended. Updated audio pause offset via callback to: ${newOffset.toFixed(3)}`);

        // Prevent default actions if drag started on canvas
        if (event.target === canvas) {
            event.preventDefault();
        }
    }
}

// --- Initialization & Data Loading ---

/** Loads and processes note data from the provided JSON object */
function loadNoteData(jsonData) {
     console.log(`Staff Module: Processing provided note data...`);
     try {
          noteMap = jsonData; // Assign the parsed JSON data

          // Process notes from the first track ONLY
          if (noteMap && noteMap.tracks && noteMap.tracks.length > 0 && noteMap.tracks[0].notes) {
             const rawNotes = noteMap.tracks[0].notes;
             console.log(`Staff Module: Found ${rawNotes.length} notes in the first track.`);

             // Set total notes reference (used externally potentially for score %?)
             // TODO: Consider if totalNotesInSong should be managed/exported differently
             totalNotesInSong = rawNotes.length;
             let lastNoteEndTime = 0;

             // Map raw notes to drawable notes with Y positions
             notesToDraw = rawNotes
                 .map(note => {
                     const yPos = getNoteYPosition(note.name);
                     const noteEndTime = note.time + note.duration;
                     if (noteEndTime > lastNoteEndTime) { lastNoteEndTime = noteEndTime; }
                     return { ...note, y: yPos, hitStatus: null }; // Add Y and initialize status
                 })
                 .filter(note => note.y !== null); // Filter out notes where Y lookup failed

             // Calculate visual end time based on last note end + buffer
             songEndTimeVisual = lastNoteEndTime + SONG_END_BUFFER_SEC;
             console.log(`Staff Module: Processed ${notesToDraw.length}/${rawNotes.length} notes. Visual song end time: ${songEndTimeVisual.toFixed(3)}s`);

             // Sort notes by start time for efficient processing later
             notesToDraw.sort((a, b) => a.time - b.time);
             return true; // Indicate success

          } else {
              // Handle invalid data format
              console.error("Staff Module Error: Provided note data is missing tracks[0] or tracks[0].notes, or has an invalid format.");
              notesToDraw = []; totalNotesInSong = 0; songEndTimeVisual = 0;
              // Attempt redraw to show error state if canvas exists
              if (ctx) redrawCanvasInternal();
              return false; // Indicate failure
          }
     } catch (error) {
         // Handle fatal errors during processing
         console.error("Staff Module: Fatal Error processing note data:", error);
         alert("Error processing notes file. Please ensure it's a valid Keytap JSON file.");
         notesToDraw = []; totalNotesInSong = 0; songEndTimeVisual = 0;
         if (ctx) redrawCanvasInternal();
         return false; // Indicate failure
     }
 }


// --- Public Interface ---
// Export functions needed by main.js or other modules

/**
 * Initializes the Staff Module.
 * @param {object} config - Configuration object.
 * @param {object} config.noteDataJson - The parsed JSON object containing note data.
 * @param {HTMLElement} config.staffSectionElement - The container element for the staff canvas.
 * @param {Function} config.setAudioPauseOffset - Function to update the shared audio pause offset state.
 * @returns {boolean} True if initialization was successful, false otherwise.
 * @export
 */
export function init(config) {
    console.log("Staff Module: init() called.");

    if (!config || !config.noteDataJson || !config.staffSectionElement || typeof config.setAudioPauseOffset !== 'function') {
        console.error("Staff Module Error: Missing required configuration in init (noteDataJson, staffSectionElement, setAudioPauseOffset).");
        return false;
    }
    // Store the container element and the setter function
    staffSectionElement = config.staffSectionElement;
    setAudioPauseOffsetFunc = config.setAudioPauseOffset;

    // Get canvas element and context (moved here from IIFE scope)
    canvas = document.getElementById('staffCanvas');
     if (!canvas || !staffSectionElement.contains(canvas)) { // Ensure canvas is within the provided section
         console.error("Staff Module Error: Canvas element (#staffCanvas) not found or not inside provided staffSectionElement!");
         return false;
     }
     ctx = canvas.getContext('2d');
     if (!ctx) {
         console.error("Staff Module Error: Could not get 2D rendering context!");
         return false;
     }
     devicePixelRatio = window.devicePixelRatio || 1;

    // Check if essential imported function is available
    if (typeof getMidiNoteColor !== 'function') {
        console.error("Staff Module CRITICAL: getMidiNoteColor function was not imported correctly.");
        // Decide if initialization should fail completely
        // return false;
    }
     if (!audio) {
        console.error("Staff Module CRITICAL: Audio module was not imported correctly.");
        return false; // Cannot function without audio timing
     }


    // Load and process note data
    const notesLoaded = loadNoteData(config.noteDataJson);
    if (!notesLoaded) {
        console.error("Staff Module: Failed to load note data during init.");
        return false; // Initialization fails if notes don't load
    }

    // Perform initial resize and draw
    setupStaffAndNotes(); // Ensure geometry is ready before first resize/draw
    handleResizeInternal(); // Set initial size based on container
    displayTime = 0; // Reset display time
    redrawCanvasInternal(); // Draw initial frame

    // Add event listeners for dragging
    // Ensure canvas exists before adding listeners
    if (canvas) {
        console.log("Staff Module: Attaching drag event listeners...");
        canvas.addEventListener('mousedown', handleDragStart);
        // Attach move/end listeners to window to catch events outside canvas bounds
        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('mouseup', handleDragEnd);
        canvas.addEventListener('touchstart', handleDragStart, { passive: false });
        window.addEventListener('touchmove', handleDragMove, { passive: false });
        window.addEventListener('touchend', handleDragEnd);
        window.addEventListener('touchcancel', handleDragEnd);
    } else {
         console.error("Staff Module: Could not attach drag listeners, canvas element not found.");
    }


    console.log("Staff Module: Initialization complete.");
    return true; // Indicate successful initialization
}

/**
 * Handles window resize or orientation changes. Should be called externally.
 * @export
 */
export function handleResize() {
    // Calls the internal resize handler
    handleResizeInternal();
}

/**
 * Starts or resumes the staff animation and audio playback.
 * @param {number} [resumeOffset=0] - The audio time (in seconds) to start playback from.
 * @export
 */
export function play(resumeOffset = 0) {
    console.log("Staff Module: Public play() called.");
    // Calls the internal function
    playAnimationInternal(resumeOffset);
}

/**
 * Pauses the staff animation and audio playback.
 * @returns {number} The audio time (in seconds) at which playback was paused.
 * @export
 */
export function pause() {
    console.log("Staff Module: Public pause() called.");
    // Calls the internal function
    return pauseAnimationInternal();
}

/**
 * Redraws the canvas. Useful after settings changes that affect appearance.
 * @export
 */
export function redraw() {
    console.log("Staff Module: Public redraw() called.");
    // Ensure displayTime reflects the latest audio time if paused
    if (!isStaffRunning && audio) {
        displayTime = audio.getPlaybackTime();
        displayTime = Math.max(MIN_DISPLAY_TIME, displayTime); // Clamp time
    }
    // Calls the internal redraw function
    redrawCanvasInternal();
}

/**
 * Returns whether the staff animation loop is currently running.
 * @returns {boolean} True if the animation is running, false otherwise.
 * @export
 */
export function isRunning() {
    // Returns the internal state flag
    return isStaffRunning;
}

/**
 * Judges a key press against notes near the judgment line.
 * @param {string} keyName - The name of the key pressed (e.g., "C", "Db").
 * @returns {string | null} - 'perfect', 'good', or null if no note was hit.
 * @export
 */
export function judgeKeyPress(keyName) {
    // console.log(`Staff Module: Public judgeKeyPress() called with: ${keyName}`); // Debug log
    // Calls the internal judgment logic
    return judgeKeyPressInternal(keyName); // Renamed internal function for clarity
}
// Rename internal function to avoid conflict with export
const judgeKeyPressInternal = judgeKeyPress;


/**
 * Resets the hit status of all notes (e.g., for restarting the song).
 * @export
 */
export function resetNotes() {
    console.log("Staff Module: Public resetNotes() called.");
    // Calls the internal function
    resetNotesInternal();
}

/**
 * Resets the internal display time to the beginning.
 * @export
 */
export function resetTime() {
    console.log("Staff Module: Public resetTime() called.");
    // Calls the internal function
    resetTimeInternal();
}
