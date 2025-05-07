// staffModule.js

/**
 * @file staffModule.js
 * Handles rendering the scrolling staff, notes, judgment line, visual feedback,
 * timing calculations, and note hit judgment.
 * To be loaded as an ES Module.
 */

console.log("Staff Module: Script loading...");

// --- Module Imports ---
import * as audio from './audioModule.js'; // Audio playback functions
import { getMidiNoteColor } from './midiColorConverter.js'; // Color conversion utility

// Import functions/variables from main.js (or future gameLogic.js/config.js)
import { applyScore } from './main.js'; // Function to apply scoring
import {
    isGameOver,
    useColoredNotes,
    PRE_DELAY_SECONDS,
    scrollSpeedPixelsPerSecond,
    hitWindowGoodSec,
    hitWindowPerfectSec
} from './main.js';
console.log("Staff Module: Dependencies imported.");


// --- Configuration Constants (Internal to Staff Rendering) ---
const STAFF_LINE_COLOR = '#000000';
const NOTE_COLOR = '#333333'; // Default color for notes if not using colored notes
const ACCIDENTAL_COLOR_BLACK_NOTES = '#888888'; // Color for accidentals when notes are black
const ACCIDENTAL_COLOR_COLOR_NOTES = '#000000'; // Color for accidentals when notes are colored
const STAFF_LINE_WIDTH = 1;
const NOTE_CORNER_RADIUS = 3;
const LINE_SPACING = 12; // Vertical distance between centers of staff lines
const STAFF_PADDING = LINE_SPACING / 2; // Padding above top line and below bottom line (of a single staff)
const JUDGMENT_LINE_COLOR = '#FF0000';
const JUDGMENT_LINE_WIDTH = 2;
const JUDGMENT_LINE_X_PERCENT = 20; // Percentage from left where judgment line is drawn
const MIDI_NOTE_MIN = 36; // C2 - Lowest note to typically calculate Y position for
const MIDI_NOTE_MAX = 84; // C6 - Highest note to typically calculate Y position for
const ACCIDENTAL_PADDING_X = 3; // Horizontal padding for accidentals from note start
const ACCIDENTAL_FONT_SIZE = LINE_SPACING * 1.2; // Font size for accidentals, relative to line spacing
const LEDGER_LINE_EXTENSION = 4; // How much ledger lines extend beyond note width
const LEDGER_LINE_WIDTH = 1;
const MIN_DISPLAY_TIME = 0.0; // Visual time should not go below 0, even if audio time is negative (e.g., pre-delay)
const PERFECT_FLASH_COLOR = 'rgba(255, 215, 0, 0.7)'; // Gold, semi-transparent for perfect hit flash
const PERFECT_FLASH_DURATION_MS = 150; // How long the perfect hit flash lasts
const SONG_END_BUFFER_SEC = 2.0; // Visual buffer after the last note ends, to ensure it scrolls off screen

// --- DOM Elements & Canvas Context (Assigned in init) ---
let staffSectionElement = null; // The container div <div id="staffSection">
let canvas = null;              // The <canvas id="staffCanvas"> element
let ctx = null;                 // The 2D rendering context of the canvas
let devicePixelRatio = 1;       // For HiDPI display scaling
let canvasWidth = 300;          // Logical display width of the canvas (updated on resize)
let canvasHeight = 150;         // Logical display height of the canvas (updated on resize)
let judgmentLineX;              // Logical X position of the judgment line (updated on resize)

// --- Staff Geometry & Note Position Mapping ---
const HALF_LINE_SPACING = LINE_SPACING / 2;
let totalStaffLogicalHeight = 150;    // Calculated required height for the grand staff based on note range
const staffPositions = {};            // Holds absolute Y coords for staff lines (e.g., staffPositions.C4)
let diatonicNoteYPositions = {};      // Holds absolute Y coords for the center of diatonic note heads (e.g., diatonicNoteYPositions['C4'])
const midiToDiatonicDegree = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // C=0, C#=0 (use C's line), D=1, D#=1 (use D's line), ..., B=6
const notePitchClasses = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]; // For matching key presses

// --- Note Data & State ---
let noteMap = null;             // Parsed note data from the JSON file
let notesToDraw = [];           // Array of note objects processed and ready to be drawn { ..., y: number, hitStatus: null | 'good' | 'perfect' | 'miss' }
let totalNotesInSong = 0;       // Reference count, typically from main.js or calculated here for percentages
let songEndTimeVisual = 0;      // Time when the last note visually finishes scrolling off (including duration and buffer)

// --- Animation & Interaction State ---
let isStaffRunning = false;     // Internal state for staff animation loop (true if playing/scrolling)
let animationFrameId = null;    // ID from requestAnimationFrame, used to cancel the loop
let displayTime = 0;            // Current visual time of the staff, reflects audio time + pre-delay, clamped at MIN_DISPLAY_TIME
let isDragging = false;         // True if user is currently dragging the staff (when paused)
let dragStartX = 0;             // Mouse/Touch X position at the start of a drag
let dragStartTime = 0;          // `displayTime` at the start of a drag
let activeFlashes = [];         // Stores { y: number, endTime: number } for "perfect hit" visual flashes
let setAudioPauseOffsetFunc = (offset) => { // Placeholder for the callback from main.js
    console.warn("Staff Module: setAudioPauseOffsetFunc was not set during init. Dragging will not update audio offset in main.");
};

// --- Internal Helper Functions ---

/**
 * Calculates staff geometry (Y positions of lines) and diatonic note head Y positions.
 * Populates `staffPositions` and `diatonicNoteYPositions`.
 * Determines `totalStaffLogicalHeight`.
 * This MUST be called before `loadNoteData`.
 */
function setupStaffAndNotes() {
    console.log("Staff Module (setupStaffAndNotes): Calculating staff geometry and note Y positions...");

    // Relative Y positions for staff lines (0 is top line of treble staff)
    let currentY_rel = 0;
    const staffPositions_rel = {}; // Relative Y positions

    // Treble staff lines (top down)
    staffPositions_rel.F5 = currentY_rel;
    staffPositions_rel.E5 = staffPositions_rel.F5 + HALF_LINE_SPACING; // Space for E5
    staffPositions_rel.D5 = staffPositions_rel.F5 + LINE_SPACING;
    staffPositions_rel.C5 = staffPositions_rel.D5 + HALF_LINE_SPACING; // Space for C5
    staffPositions_rel.B4 = staffPositions_rel.D5 + LINE_SPACING;
    staffPositions_rel.A4 = staffPositions_rel.B4 + HALF_LINE_SPACING; // Space for A4
    staffPositions_rel.G4 = staffPositions_rel.B4 + LINE_SPACING;
    staffPositions_rel.F4 = staffPositions_rel.G4 + HALF_LINE_SPACING; // Space for F4
    staffPositions_rel.E4 = staffPositions_rel.G4 + LINE_SPACING;

    // Space between treble and bass staves (effectively where Middle C line would be)
    // const spaceBetweenStaves = LINE_SPACING; // This implies C4 is one full line_spacing below E4.

    // Bass staff lines (top down, continuing from treble)
    // Middle C (C4) is one ledger line below treble (or on its own line visually)
    // E4 is bottom line of treble. D4 is space below. C4 is line below D4.
    staffPositions_rel.D4 = staffPositions_rel.E4 + HALF_LINE_SPACING; // Space for D4
    staffPositions_rel.C4 = staffPositions_rel.E4 + LINE_SPACING;      // Line for C4 (Middle C)

    staffPositions_rel.B3 = staffPositions_rel.C4 + HALF_LINE_SPACING; // Space for B3
    staffPositions_rel.A3 = staffPositions_rel.C4 + LINE_SPACING;
    staffPositions_rel.G3 = staffPositions_rel.A3 + HALF_LINE_SPACING; // Space for G3
    staffPositions_rel.F3 = staffPositions_rel.A3 + LINE_SPACING;
    staffPositions_rel.E3 = staffPositions_rel.F3 + HALF_LINE_SPACING; // Space for E3
    staffPositions_rel.D3 = staffPositions_rel.F3 + LINE_SPACING;
    staffPositions_rel.C3 = staffPositions_rel.D3 + HALF_LINE_SPACING; // Space for C3
    staffPositions_rel.B2 = staffPositions_rel.D3 + LINE_SPACING;
    staffPositions_rel.A2 = staffPositions_rel.B2 + HALF_LINE_SPACING; // Space for A2
    staffPositions_rel.G2 = staffPositions_rel.B2 + LINE_SPACING;     // Bottom line of Bass staff

    const noteNames = ["C", "D", "E", "F", "G", "A", "B"]; // Diatonic note names
    const midiRef = 60; // MIDI Middle C (C4)
    const yRef_rel = staffPositions_rel.C4; // Y position of C4 is our reference

    diatonicNoteYPositions = {}; // Clear and repopulate
    let minY_rel = Infinity, maxY_rel = -Infinity;

    // Calculate Y positions for all diatonic notes within the MIDI range
    for (let midi = MIDI_NOTE_MIN; midi <= MIDI_NOTE_MAX; midi++) {
        const octave = Math.floor(midi / 12) - 1; // Standard octave numbering (C4 is octave 4)
        const noteIndex = midi % 12; // Pitch class index (0-11)
        const diatonicDegree = midiToDiatonicDegree[noteIndex]; // C=0, D=1, ..., B=6

        const referenceOctave = Math.floor(midiRef / 12) - 1;
        const octaveDifference = octave - referenceOctave;
        const stepsFromRefDegree = diatonicDegree - midiToDiatonicDegree[midiRef % 12]; // diatonic degree of C is 0
        const totalDiatonicSteps = (octaveDifference * 7) + stepsFromRefDegree; // 7 diatonic steps per octave

        const yPos_rel = yRef_rel - (totalDiatonicSteps * HALF_LINE_SPACING); // Negative because Y increases downwards

        const baseNoteLetter = noteNames[diatonicDegree];
        const baseNoteName = baseNoteLetter + octave; // e.g., "C4", "F5"

        if (!(baseNoteName in diatonicNoteYPositions)) {
            diatonicNoteYPositions[baseNoteName] = yPos_rel;
            minY_rel = Math.min(minY_rel, yPos_rel);
            maxY_rel = Math.max(maxY_rel, yPos_rel);
        }
    }

    // Calculate total logical height needed for the staff display
    const noteHeight = LINE_SPACING; // Visual height of a note rectangle
    const topNoteEdgeY_rel = minY_rel - (noteHeight / 2);
    const bottomNoteEdgeY_rel = maxY_rel + (noteHeight / 2);
    totalStaffLogicalHeight = (bottomNoteEdgeY_rel - topNoteEdgeY_rel) + (STAFF_PADDING * 2);
    totalStaffLogicalHeight = Math.max(100, totalStaffLogicalHeight); // Ensure a minimum height

    // Calculate offset to center the staff vertically within the allocated space, considering padding
    const yOffset = STAFF_PADDING - topNoteEdgeY_rel;

    // Convert relative Y positions to absolute Y positions for drawing
    for (const key in staffPositions_rel) {
        staffPositions[key] = staffPositions_rel[key] + yOffset;
    }
    for (const key in diatonicNoteYPositions) {
        diatonicNoteYPositions[key] += yOffset;
        // console.log(`Staff Module (setupStaffAndNotes): ${key} Y: ${diatonicNoteYPositions[key]}`);
    }
    console.log(`Staff Module (setupStaffAndNotes): Staff Logical Height Calculated: ${totalStaffLogicalHeight.toFixed(1)}px. diatonicNoteYPositions populated with ${Object.keys(diatonicNoteYPositions).length} entries.`);
}


/**
 * Finds the Y position for a given note name (e.g., "C#4", "Fb5").
 * Uses the `diatonicNoteYPositions` map.
 * @param {string} noteName - The full note name.
 * @returns {number | null} The Y coordinate for the center of the note, or null if not found.
 */
function getNoteYPosition(noteName) {
    // Extract base note (e.g., "C4" from "C#4") because accidentals don't change Y line/space
    const baseNameMatch = noteName.match(/([A-G])[#b]?(\d)/);
    if (baseNameMatch) {
        const baseNoteLetter = baseNameMatch[1];
        const octave = baseNameMatch[2];
        const baseName = baseNoteLetter + octave; // e.g., "C4"
        const yPosition = diatonicNoteYPositions[baseName];

        if (yPosition !== undefined) {
            // console.log(`Staff Module (getNoteYPosition): For ${noteName} (base ${baseName}), found Y: ${yPosition}`);
            return yPosition;
        } else {
            // console.warn(`Staff Module (getNoteYPosition): Y position for base note "${baseName}" (from "${noteName}") not found in diatonicNoteYPositions.`);
            return null;
        }
    } else {
        console.warn(`Staff Module (getNoteYPosition): Could not parse base note name from: "${noteName}"`);
        return null;
    }
}

/**
 * Gets the pitch class (e.g., "Db" for C#, "C" for C) from a full note name.
 * Used for matching keyboard presses.
 * @param {string} noteName - The full note name (e.g., "C#4").
 * @returns {string | null} The pitch class string, or null if parsing fails.
 */
function getPitchClass(noteName) {
    const match = noteName.match(/([A-G][#b]?)/); // Match letter and optional accidental
    if (match) {
        let pc = match[1];
        // Normalize enharmonics to what the keyboard uses (typically flats for black keys)
        if (pc === "C#") pc = "Db";
        if (pc === "D#") pc = "Eb";
        // E# is F, Fb is E - assuming keyboard handles this or MIDI data is already sensible
        if (pc === "F#") pc = "Gb";
        if (pc === "G#") pc = "Ab";
        if (pc === "A#") pc = "Bb";
        // B# is C, Cb is B
        return pc;
    }
    console.warn(`Staff Module (getPitchClass): Could not extract pitch class from "${noteName}"`);
    return null;
}


// --- Drawing Functions ---

/** Draws a single horizontal staff line on the canvas. */
function drawStaffLine(y) {
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(0, y); // Start from left edge
    ctx.lineTo(canvasWidth, y); // Go to right edge
    ctx.lineWidth = STAFF_LINE_WIDTH;
    ctx.strokeStyle = STAFF_LINE_COLOR;
    ctx.stroke();
}

/** Draws the 10 lines of the grand staff. */
function drawGrandStaff() {
    if (!ctx) return;
    // Check if staffPositions are populated (safeguard)
    if (Object.keys(staffPositions).length === 0) {
        console.warn("Staff Module (drawGrandStaff): staffPositions is empty. Cannot draw staff lines.");
        return;
    }
    // console.log("Staff Module (drawGrandStaff): Drawing grand staff lines.");
    // Treble Staff Lines (E4, G4, B4, D5, F5)
    drawStaffLine(staffPositions.E4);
    drawStaffLine(staffPositions.G4);
    drawStaffLine(staffPositions.B4);
    drawStaffLine(staffPositions.D5);
    drawStaffLine(staffPositions.F5);
    // Bass Staff Lines (G2, B2, D3, F3, A3)
    drawStaffLine(staffPositions.G2);
    drawStaffLine(staffPositions.B2);
    drawStaffLine(staffPositions.D3);
    drawStaffLine(staffPositions.F3);
    drawStaffLine(staffPositions.A3);
}

/** Draws a rectangle with rounded corners. Utility function. */
function drawRoundedRect(x, y, width, height, radius) {
    if (!ctx) return;
    if (width < 2 * radius) radius = width / 2;   // Clamp radius if width is too small
    if (height < 2 * radius) radius = height / 2; // Clamp radius if height is too small
    if (width <= 0 || height <= 0) return;       // Don't draw zero/negative size rectangles

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    ctx.fill(); // Assumes fillStyle is set beforehand
}

/** Draws ledger lines for a note if needed, above or below the staves. */
function drawLedgerLines(note, x, noteWidth) {
    if (!ctx || note.y === null) return; // Need context and Y position

    const y = note.y; // Center Y of the note
    const checkTolerance = HALF_LINE_SPACING / 4; // Small tolerance for checking proximity to staff lines

    ctx.lineWidth = LEDGER_LINE_WIDTH;
    ctx.strokeStyle = STAFF_LINE_COLOR; // Ledger lines are same color as staff lines
    const ledgerXStart = x - LEDGER_LINE_EXTENSION;
    const ledgerXEnd = x + noteWidth + LEDGER_LINE_EXTENSION;

    // Ledger lines ABOVE treble staff (F5 is top line of treble staff)
    if (y < staffPositions.F5 - checkTolerance) {
        for (let lineY = staffPositions.F5 - LINE_SPACING; lineY >= y - checkTolerance; lineY -= LINE_SPACING) {
            ctx.beginPath(); ctx.moveTo(ledgerXStart, lineY); ctx.lineTo(ledgerXEnd, lineY); ctx.stroke();
        }
    }

    // Ledger line FOR Middle C (C4) - if the note is on C4's line
    // staffPositions.C4 is the Y of the middle C line.
    if (Math.abs(y - staffPositions.C4) < checkTolerance) {
        ctx.beginPath(); ctx.moveTo(ledgerXStart, staffPositions.C4); ctx.lineTo(ledgerXEnd, staffPositions.C4); ctx.stroke();
    }

    // Ledger lines BELOW bass staff (G2 is bottom line of bass staff)
    if (y > staffPositions.G2 + checkTolerance) {
        for (let lineY = staffPositions.G2 + LINE_SPACING; lineY <= y + checkTolerance; lineY += LINE_SPACING) {
            ctx.beginPath(); ctx.moveTo(ledgerXStart, lineY); ctx.lineTo(ledgerXEnd, lineY); ctx.stroke();
        }
    }
}

/** Draws an accidental (sharp/flat) next to a note. */
function drawAccidental(note, x) {
    if (!ctx || note.y === null) return;

    const accidentalSymbol = note.name.includes('#') ? '♯' : note.name.includes('b') ? '♭' : null;
    if (accidentalSymbol) {
        // Determine color based on whether notes are colored or black (imported 'useColoredNotes' state)
        ctx.fillStyle = useColoredNotes ? ACCIDENTAL_COLOR_COLOR_NOTES : ACCIDENTAL_COLOR_BLACK_NOTES;
        ctx.font = `${ACCIDENTAL_FONT_SIZE}px sans-serif`; // Standard font for symbols
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle'; // Vertically center the accidental on the note's Y
        const accidentalX = x + ACCIDENTAL_PADDING_X; // Position to the right of note start
        const accidentalY = note.y;
        ctx.fillText(accidentalSymbol, accidentalX, accidentalY);
    }
}

/** Draws a single note rectangle on the canvas. */
function drawNote(note, currentDisplayTime) {
    if (!ctx || note.hitStatus === 'good' || note.hitStatus === 'perfect') {
        return; // Don't draw if already hit successfully
    }
    if (note.y === null || note.y === undefined) {
        // console.warn(`Staff Module (drawNote): Skipping note ${note.name} due to null/undefined Y position.`);
        return; // Skip notes with invalid Y positions
    }

    const noteY = note.y; // Center Y position of the note head
    // Calculate time until the note reaches the judgment line, relative to current display time
    const timeUntilJudgment = note.time - currentDisplayTime;
    // Calculate X position based on time and scroll speed (imported SCROLL_SPEED_PIXELS_PER_SECOND)
    const noteX = judgmentLineX + (timeUntilJudgment * SCROLL_SPEED_PIXELS_PER_SECOND);
    const noteWidth = Math.max(1, note.duration * SCROLL_SPEED_PIXELS_PER_SECOND); // Ensure minimum width of 1px
    const noteHeight = LINE_SPACING; // Note head height is one line spacing

    // Determine note color (uses imported `useColoredNotes` state and `getMidiNoteColor` function)
    let currentNoteColor = NOTE_COLOR; // Default black/grey
    if (useColoredNotes) {
        if (typeof getMidiNoteColor === 'function') {
            try {
                const rgbArray = getMidiNoteColor(note.midi);
                if (rgbArray && rgbArray.length === 3) {
                    currentNoteColor = `rgb(${rgbArray[0]}, ${rgbArray[1]}, ${rgbArray[2]})`;
                } // else, fallback to default NOTE_COLOR is already set
            } catch (e) {
                console.error(`Staff Module (drawNote): Error calling imported getMidiNoteColor for MIDI ${note.midi}:`, e);
                // Fallback to default NOTE_COLOR
            }
        } else {
            // console.warn("Staff Module (drawNote): getMidiNoteColor function not available. Using default note color.");
            // Fallback to default NOTE_COLOR
        }
    }

    // Basic culling: Draw only if the note is potentially visible on screen
    if (noteX < canvasWidth && (noteX + noteWidth) > 0) {
        drawLedgerLines(note, noteX, noteWidth); // Draw ledger lines first (they are behind the note)
        ctx.fillStyle = currentNoteColor;       // Set the determined color for the note body
        drawRoundedRect(noteX, noteY - noteHeight / 2, noteWidth, noteHeight, NOTE_CORNER_RADIUS); // Draw note body
        drawAccidental(note, noteX); // Draw accidental on top of the note body
    }
}

/** Draws the vertical judgment line. */
function drawJudgmentLine() {
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(judgmentLineX, 0); // Top of canvas
    ctx.lineTo(judgmentLineX, canvasHeight); // Bottom of canvas
    ctx.lineWidth = JUDGMENT_LINE_WIDTH;
    ctx.strokeStyle = JUDGMENT_LINE_COLOR;
    ctx.stroke();
}

/** Draws active "perfect hit" visual flashes at the judgment line. */
function drawFlashes() {
    if (activeFlashes.length === 0 || !ctx || !audio) return;

    ctx.fillStyle = PERFECT_FLASH_COLOR;
    const flashHeight = LINE_SPACING * 1.5; // Make flash slightly taller than a note
    const flashWidth = 10; // Fixed width for the flash effect
    const currentTimeContext = audio.getCurrentContextTime(); // Use imported audio function for precise timing

    for (let i = activeFlashes.length - 1; i >= 0; i--) { // Iterate backwards for safe removal
        const flash = activeFlashes[i];
        if (currentTimeContext >= flash.endTime) {
            activeFlashes.splice(i, 1); // Remove expired flash
        } else {
            // Draw the flash centered vertically on the note's original Y, at the judgment line's X
            drawRoundedRect(
                judgmentLineX - flashWidth / 2,
                flash.y - flashHeight / 2,
                flashWidth,
                flashHeight,
                flashWidth / 2 // Make it oval/circular by using width/2 as radius
            );
        }
    }
}

/** Internal redraw function called each frame or when needed. Clears and redraws the entire canvas. */
function redrawCanvasInternal() {
    if (!ctx) {
        // console.warn("Staff Module (redrawCanvasInternal): Canvas context not available. Skipping redraw.");
        return;
    }
    if (!audio && isStaffRunning) { // If running, audio module is essential for timing
        console.warn("Staff Module (redrawCanvasInternal): Audio module not available while staff is running. Redraw might be incorrect.");
        // displayTime might not be updated if audio module is missing.
    }

    // console.log(`Staff Module (redrawCanvasInternal): Redrawing canvas at displayTime: ${displayTime.toFixed(3)}`);

    ctx.save(); // Save default context state (transform, fillStyle, etc.)
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear using physical pixel dimensions
    ctx.scale(devicePixelRatio, devicePixelRatio); // Scale context for HiDPI rendering

    // --- Drawing Order ---
    drawGrandStaff();
    drawJudgmentLine();

    if (notesToDraw.length > 0) {
        notesToDraw.forEach(note => drawNote(note, displayTime));
    } else {
        // Display a message if no notes are available to draw
        ctx.fillStyle = '#888888';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const message = noteMap ? 'No notes found in track or processed.' : 'Loading notes data...';
        ctx.fillText(message, canvasWidth / 2, canvasHeight / 2);
    }

    drawFlashes(); // Draw perfect hit flashes on top of notes/staff
    // ---------------------

    ctx.restore(); // Restore context to its original state
}


// --- Animation Loop ---

/** Main animation loop, called via requestAnimationFrame. */
function animationLoop() {
    // console.log(`Staff Module (animationLoop): Frame. isStaffRunning: ${isStaffRunning}, isGameOver (imported): ${isGameOver}`);
    if (!isStaffRunning || isGameOver) { // Uses imported `isGameOver` state from main.js
        console.log("Staff Module (animationLoop): Stopping animation loop.");
        animationFrameId = null; // Clear ID
        return; // Exit loop
    }

    // Update current display time based on audio module
    if (audio) {
        let newTime = audio.getPlaybackTime(); // Includes pre-delay if any
        displayTime = Math.max(MIN_DISPLAY_TIME, newTime); // Clamp time, ensure it's not negative
    } else {
        console.warn("Staff Module (animationLoop): Audio module not available for timing. Display time may be stale.");
        // If audio module is critical and missing, could stop the loop:
        // isStaffRunning = false; requestAnimationFrame(animationLoop); return;
    }

    // --- Check for Missed Notes ---
    // A note is missed if its start time is past the judgment line + good hit window, and it wasn't hit.
    // Uses imported `HIT_WINDOW_GOOD_SEC` from main.js
    const missThresholdTime = displayTime - HIT_WINDOW_GOOD_SEC; // Time beyond which a note is considered a miss if not hit
    notesToDraw.forEach(note => {
        if (!note.hitStatus && note.time < missThresholdTime) {
            // console.log(`Staff Module (animationLoop): Note missed: ${note.name} at time ${note.time.toFixed(3)} (displayTime: ${displayTime.toFixed(3)})`);
            note.hitStatus = 'miss';
            applyScore('miss'); // Call imported scoring function from main.js
        }
    });

    redrawCanvasInternal(); // Redraw everything based on current displayTime

    if (isStaffRunning) { // Double-check, as state might change during the loop
        animationFrameId = requestAnimationFrame(animationLoop);
    } else {
        animationFrameId = null; // Ensure cleared if loop stops for other reasons
    }
}

// --- Internal Core Logic Functions (Implementations from old working code) ---

/**
 * Internal implementation for judging a key press.
 * @param {string} keyName - The name of the key pressed (e.g., "C", "Db").
 * @returns {string | null} - 'perfect', 'good', or null if no note was hit.
 */
function judgeKeyPressInternal(keyName) {
    // console.log(`Staff Module (judgeKeyPressInternal): Judging key: ${keyName}, displayTime: ${displayTime.toFixed(3)}`);
    if (!isStaffRunning || isGameOver || !audio) { // Uses imported isGameOver
        // console.log(`Staff Module (judgeKeyPressInternal): Cannot judge. Running: ${isStaffRunning}, Over: ${isGameOver}, Audio: ${!!audio}`);
        return null;
    }

    const currentJudgmentTime = displayTime; // Time at the judgment line
    let hitResult = null;
    let bestNote = null; // The note closest to the judgment time for the pressed key
    let minTimeDiff = Infinity;

    for (const note of notesToDraw) {
        if (note.hitStatus) continue; // Skip already hit or missed notes

        const timeDiff = note.time - currentJudgmentTime; // Positive if note is upcoming, negative if past
        const absTimeDiff = Math.abs(timeDiff);

        // Check if within the 'good' hit window (imported HIT_WINDOW_GOOD_SEC)
        if (absTimeDiff <= HIT_WINDOW_GOOD_SEC) {
            const notePitchClass = getPitchClass(note.name); // Internal helper
            if (notePitchClass === keyName) { // Check if the pressed key matches the note's pitch class
                if (absTimeDiff < minTimeDiff) {
                    minTimeDiff = absTimeDiff;
                    bestNote = note;
                }
            }
        }
    }

    if (bestNote) {
        // console.log(`Staff Module (judgeKeyPressInternal): Best note found: ${bestNote.name}, timeDiff: ${minTimeDiff.toFixed(3)}s`);
        const flashEndTimeContext = audio.getCurrentContextTime() + (PERFECT_FLASH_DURATION_MS / 1000.0);

        // Check if within 'perfect' hit window (imported HIT_WINDOW_PERFECT_SEC)
        if (minTimeDiff <= HIT_WINDOW_PERFECT_SEC) {
            bestNote.hitStatus = 'perfect';
            hitResult = 'perfect';
            activeFlashes.push({ y: bestNote.y, endTime: flashEndTimeContext }); // Add flash effect
            applyScore('perfect'); // Imported from main.js
            // console.log(`Staff Module (judgeKeyPressInternal): PERFECT hit on ${bestNote.name}`);
        } else { // Otherwise, it's a 'good' hit
            bestNote.hitStatus = 'good';
            hitResult = 'good';
            applyScore('good'); // Imported from main.js
            // console.log(`Staff Module (judgeKeyPressInternal): GOOD hit on ${bestNote.name}`);
        }
    } else {
        // console.log(`Staff Module (judgeKeyPressInternal): No matching note in hit window for key ${keyName}.`);
    }
    return hitResult;
}

/** Internal implementation to start or resume staff animation and audio. */
function playAnimationInternal(resumeOffset = 0) {
    console.log(`Staff Module (playAnimationInternal): Attempting to play. Current isStaffRunning: ${isStaffRunning}, isGameOver: ${isGameOver}, audio ready: ${audio ? audio.isReady() : 'N/A'}`);
    if (!isStaffRunning && !isGameOver && audio && audio.isReady()) { // Uses imported isGameOver
        console.log(`Staff Module (playAnimationInternal): Playing animation and audio from offset: ${resumeOffset.toFixed(3)}s. PRE_DELAY_SECONDS: ${PRE_DELAY_SECONDS}`);
        isStaffRunning = true;
        if (canvas) canvas.style.cursor = 'default'; // Change cursor from 'grab'

        // Start audio playback (audioModule handles pre-delay logic if offset is 0)
        audio.play(resumeOffset, PRE_DELAY_SECONDS); // Uses imported PRE_DELAY_SECONDS

        // Start the animation loop if not already running
        if (!animationFrameId) {
            console.log("Staff Module (playAnimationInternal): Requesting new animation frame.");
            // Ensure displayTime is correctly set before the first frame, especially if resuming.
            // audio.getPlaybackTime() will include the pre-delay if starting from 0.
            // If resuming, resumeOffset is the target.
            displayTime = Math.max(MIN_DISPLAY_TIME, audio.getPlaybackTime()); // Initial sync
            animationFrameId = requestAnimationFrame(animationLoop);
        } else {
            console.log("Staff Module (playAnimationInternal): Animation frame already requested.");
        }
    } else {
        console.warn(`Staff Module (playAnimationInternal): Cannot play. Conditions not met. Running: ${isStaffRunning}, Over: ${isGameOver}, Audio Ready: ${audio ? audio.isReady() : false}`);
    }
}

/** Internal implementation to pause staff animation and audio. */
function pauseAnimationInternal() {
    console.log(`Staff Module (pauseAnimationInternal): Attempting to pause. Current isStaffRunning: ${isStaffRunning}`);
    if (isStaffRunning) {
        isStaffRunning = false; // Stop the animation loop flag
        if (canvas) canvas.style.cursor = 'grab'; // Change cursor to indicate draggable

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            console.log("Staff Module (pauseAnimationInternal): Animation frame cancelled.");
        }

        // Pause audio and get the current playback time
        const pauseOff = audio ? audio.pause() : 0;
        console.log(`Staff Module (pauseAnimationInternal): Paused. Audio offset reported by audio.pause(): ${pauseOff.toFixed(3)}`);
        displayTime = Math.max(MIN_DISPLAY_TIME, pauseOff); // Update displayTime to the paused time
        return pauseOff; // Return the time at which audio was paused
    }
    // If not running, return current audio time (or displayTime if audio module unavailable)
    const currentAudioTime = audio ? audio.getPlaybackTime() : displayTime;
    console.log(`Staff Module (pauseAnimationInternal): Was not running. Returning current audio/display time: ${currentAudioTime.toFixed(3)}`);
    return currentAudioTime;
}

/** Internal implementation to reset hit status of all notes. */
function resetNotesInternal() {
    console.log("Staff Module (resetNotesInternal): Resetting hit status for all notes and clearing flashes.");
    notesToDraw.forEach(note => note.hitStatus = null);
    activeFlashes = []; // Clear any active visual flashes
}

/** Internal implementation to reset the staff's display time to the beginning. */
function resetTimeInternal() {
    console.log(`Staff Module (resetTimeInternal): Resetting displayTime to ${MIN_DISPLAY_TIME}.`);
    displayTime = MIN_DISPLAY_TIME; // Reset visual time to the minimum (usually 0)
    // Audio offset is typically reset in main.js or when audio.stop() is called.
}


// --- Event Handlers ---

/** Handles window resize or orientation change for the staff canvas. */
function handleResizeInternal() {
    if (!staffSectionElement || !canvas || !ctx) {
        console.warn("Staff Module (handleResizeInternal): Essential elements (staffSection, canvas, ctx) not available. Skipping resize.");
        return;
    }
    console.log("Staff Module (handleResizeInternal): Handling resize...");

    const displayWidth = staffSectionElement.offsetWidth;
    const displayHeight = staffSectionElement.offsetHeight;

    if (displayWidth <= 0 || displayHeight <= 0) {
        console.warn(`Staff Module (handleResizeInternal): Resize called with zero/negative dimensions (${displayWidth}x${displayHeight}). Skipping redraw.`);
        return;
    }

    canvasWidth = displayWidth;
    // Canvas height should be the smaller of the container's height or the calculated totalStaffLogicalHeight
    canvasHeight = Math.min(displayHeight, totalStaffLogicalHeight);

    // Set physical canvas size considering device pixel ratio for sharpness
    canvas.width = Math.round(canvasWidth * devicePixelRatio);
    canvas.height = Math.round(canvasHeight * devicePixelRatio);

    // Set CSS dimensions for scaling
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    // Recalculate judgment line X position based on new canvas width
    judgmentLineX = canvasWidth * (JUDGMENT_LINE_X_PERCENT / 100.0);

    console.log(`Staff Module (handleResizeInternal): Resized canvas to ${canvasWidth}x${canvasHeight} (logical), ${canvas.width}x${canvas.height} (physical). Judgment line X: ${judgmentLineX.toFixed(1)}`);
    redrawCanvasInternal(); // Redraw with new dimensions
}

/** Helper to get X coordinate from mouse or touch event, relative to the page. */
function getEventX(event) {
    return event.touches ? event.touches[0].clientX : event.clientX;
}

/** Handles start of dragging (mousedown or touchstart) on the canvas. */
function handleDragStart(event) {
    if (!isStaffRunning && !isGameOver && canvas) { // Allow dragging only if paused and not game over
        // console.log("Staff Module (handleDragStart): Drag Start detected.");
        isDragging = true;
        // Calculate starting X relative to the canvas element's left edge
        dragStartX = getEventX(event) - canvas.getBoundingClientRect().left;
        dragStartTime = displayTime; // Store the display time at drag start
        canvas.classList.add('dragging');
        if (event.target === canvas) { // Prevent default only if event is directly on canvas
            event.preventDefault();
        }
    }
}

/** Handles mouse/touch movement during a drag. */
function handleDragMove(event) {
    if (isDragging && canvas) {
        // console.log("Staff Module (handleDragMove): Drag Move detected.");
        const currentX = getEventX(event) - canvas.getBoundingClientRect().left;
        const deltaX = currentX - dragStartX; // Pixel difference from drag start
        // Convert pixel offset to time offset (imported SCROLL_SPEED_PIXELS_PER_SECOND)
        const deltaTimeOffset = deltaX / SCROLL_SPEED_PIXELS_PER_SECOND;

        // New display time: start time - offset (dragging left moves time forward, right moves backward)
        displayTime = Math.max(MIN_DISPLAY_TIME, dragStartTime - deltaTimeOffset);
        // Ensure displayTime doesn't exceed song's visual end
        if (songEndTimeVisual > 0) { // Only if songEndTimeVisual is valid
            displayTime = Math.min(displayTime, songEndTimeVisual);
        }


        redrawCanvasInternal(); // Redraw at the new display time
        if (event.target === canvas) { // Prevent default only if event is directly on canvas
             event.preventDefault();
        }
    }
}

/** Handles end of dragging (mouseup or touchend) on the canvas. */
function handleDragEnd(event) {
    if (isDragging && canvas) {
        // console.log("Staff Module (handleDragEnd): Drag End detected.");
        isDragging = false;
        canvas.classList.remove('dragging');

        // Update the shared audio pause offset in main.js via the callback
        const newOffset = Math.max(0, displayTime); // Ensure non-negative offset
        setAudioPauseOffsetFunc(newOffset); // Call the setter function from main.js
        console.log(`Staff Module (handleDragEnd): Drag ended. Updated audio pause offset via callback to: ${newOffset.toFixed(3)}s`);

        if (event.target === canvas) { // Prevent default only if event is directly on canvas
            event.preventDefault();
        }
    }
}

// --- Initialization & Data Loading ---

/**
 * Loads and processes note data from the provided JSON object.
 * Populates `notesToDraw` and calculates `songEndTimeVisual`.
 * @param {object} jsonData - The parsed JSON object containing note map data.
 * @returns {boolean} True if notes were loaded and processed successfully, false otherwise.
 */
function loadNoteData(jsonData) {
    console.log(`Staff Module (loadNoteData): Processing provided note data...`);
    try {
        noteMap = jsonData; // Store the raw JSON data

        if (noteMap && noteMap.tracks && noteMap.tracks.length > 0 && noteMap.tracks[0].notes) {
            const rawNotes = noteMap.tracks[0].notes;
            console.log(`Staff Module (loadNoteData): Found ${rawNotes.length} raw notes in the first track.`);

            totalNotesInSong = rawNotes.length; // Update total notes count
            let lastNoteEndTime = 0;

            notesToDraw = rawNotes
                .map(note => {
                    const yPos = getNoteYPosition(note.name); // Crucial call relying on setupStaffAndNotes
                    // console.log(`Staff Module (loadNoteData map): Note ${note.name}, MIDI ${note.midi}, time ${note.time.toFixed(3)}, duration ${note.duration.toFixed(3)} -> yPos: ${yPos}`);
                    const noteEndTime = note.time + note.duration;
                    if (noteEndTime > lastNoteEndTime) {
                        lastNoteEndTime = noteEndTime;
                    }
                    return { ...note, y: yPos, hitStatus: null }; // Add Y and initialize hitStatus
                })
                .filter(note => {
                    if (note.y === null) {
                        // console.warn(`Staff Module (loadNoteData filter): Filtering out note "${note.name}" (MIDI: ${note.midi}) due to null Y position.`);
                        return false;
                    }
                    return true;
                });

            songEndTimeVisual = lastNoteEndTime + SONG_END_BUFFER_SEC;
            console.log(`Staff Module (loadNoteData): Processed ${notesToDraw.length}/${rawNotes.length} notes into notesToDraw. Visual song end time: ${songEndTimeVisual.toFixed(3)}s`);

            if (notesToDraw.length === 0 && rawNotes.length > 0) {
                console.error("Staff Module (loadNoteData): All notes were filtered out. This likely means getNoteYPosition is consistently failing. Check diatonicNoteYPositions and staff setup.");
            }

            notesToDraw.sort((a, b) => a.time - b.time); // Sort by start time for efficient processing
            return true; // Success
        } else {
            console.error("Staff Module (loadNoteData) Error: Note data is missing tracks[0] or tracks[0].notes, or has an invalid format.");
            notesToDraw = []; totalNotesInSong = 0; songEndTimeVisual = 0;
            if (ctx) redrawCanvasInternal(); // Attempt to show error state on canvas
            return false; // Failure
        }
    } catch (error) {
        console.error("Staff Module (loadNoteData): Fatal Error processing note data:", error);
        alert("Error processing notes file. Please ensure it's a valid Keytap JSON file.");
        notesToDraw = []; totalNotesInSong = 0; songEndTimeVisual = 0;
        if (ctx) redrawCanvasInternal();
        return false; // Failure
    }
}


// --- Public Interface ---

/**
 * Initializes the Staff Module.
 * @param {object} config - Configuration object.
 * @param {object} config.noteDataJson - The parsed JSON object containing note data.
 * @param {HTMLElement} config.staffSectionElement - The container DOM element for the staff canvas.
 * @param {Function} config.setAudioPauseOffset - Callback function from main.js to update its audioPauseOffset state.
 * @returns {boolean} True if initialization was successful, false otherwise.
 * @export
 */
export function init(config) {
    console.log("Staff Module: init() called.");

    if (!config || !config.noteDataJson || !config.staffSectionElement || typeof config.setAudioPauseOffset !== 'function') {
        console.error("Staff Module Error: Missing required configuration in init (noteDataJson, staffSectionElement, setAudioPauseOffset).");
        return false;
    }

    staffSectionElement = config.staffSectionElement;
    setAudioPauseOffsetFunc = config.setAudioPauseOffset;
    console.log("Staff Module (init): staffSectionElement and setAudioPauseOffsetFunc stored.");

    canvas = document.getElementById('staffCanvas');
    if (!canvas || !staffSectionElement.contains(canvas)) {
        console.error("Staff Module Error: Canvas element (#staffCanvas) not found or not inside provided staffSectionElement!");
        return false;
    }
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("Staff Module Error: Could not get 2D rendering context!");
        return false;
    }
    devicePixelRatio = window.devicePixelRatio || 1;
    console.log(`Staff Module (init): Canvas context obtained. Device Pixel Ratio: ${devicePixelRatio}`);

    // Verify essential imported functions/modules
    if (typeof getMidiNoteColor !== 'function') {
        console.error("Staff Module CRITICAL: getMidiNoteColor function was not imported correctly or is not available.");
        // return false; // Decide if this is fatal
    }
    if (!audio) {
        console.error("Staff Module CRITICAL: Audio module was not imported correctly or is not available.");
        return false; // Cannot function without audio timing
    }
    console.log("Staff Module (init): Essential imports verified.");

    // **FIXED ORDER**: Calculate staff geometry BEFORE loading note data
    console.log("Staff Module (init): Calling setupStaffAndNotes() BEFORE loadNoteData().");
    setupStaffAndNotes(); // Populate diatonicNoteYPositions

    // Load and process note data
    console.log("Staff Module (init): Calling loadNoteData().");
    const notesLoaded = loadNoteData(config.noteDataJson);
    if (!notesLoaded) {
        console.error("Staff Module (init): Failed to load note data. Initialization aborted.");
        // staffSectionElement.innerHTML = "<p style='color:red; text-align:center;'>Error loading notes.</p>"; // Basic error display
        return false;
    }
    console.log("Staff Module (init): Note data loaded successfully.");

    // Perform initial resize and draw
    console.log("Staff Module (init): Performing initial resize and draw.");
    handleResizeInternal(); // Set initial canvas size based on container and staff height
    displayTime = MIN_DISPLAY_TIME; // Reset display time for initial draw
    redrawCanvasInternal(); // Draw initial frame (staff, judgment line, potentially "loading" message if notesToDraw is empty)

    // Add event listeners for dragging interaction on the canvas
    if (canvas) {
        console.log("Staff Module (init): Attaching drag event listeners to canvas...");
        canvas.addEventListener('mousedown', handleDragStart);
        window.addEventListener('mousemove', handleDragMove); // Listen on window for moves outside canvas
        window.addEventListener('mouseup', handleDragEnd);     // Listen on window for mouseup outside canvas
        canvas.addEventListener('touchstart', handleDragStart, { passive: false }); // passive:false to allow preventDefault
        window.addEventListener('touchmove', handleDragMove, { passive: false });
        window.addEventListener('touchend', handleDragEnd);
        window.addEventListener('touchcancel', handleDragEnd); // Handle cancelled touches as drag end
        console.log("Staff Module (init): Drag event listeners attached.");
    } else {
        console.error("Staff Module (init): Could not attach drag listeners, canvas element not found (should not happen here).");
    }

    console.log("Staff Module: Initialization complete.");
    return true;
}

/** Handles window resize or orientation changes. Should be called externally by main.js. @export */
export function handleResize() {
    console.log("Staff Module: Public handleResize() called.");
    handleResizeInternal();
}

/** Starts or resumes the staff animation and audio playback. @param {number} [resumeOffset=0] Audio time to start from. @export */
export function play(resumeOffset = 0) {
    console.log(`Staff Module: Public play(resumeOffset: ${resumeOffset.toFixed(3)}) called.`);
    playAnimationInternal(resumeOffset);
}

/** Pauses the staff animation and audio playback. @returns {number} Audio time at pause. @export */
export function pause() {
    console.log("Staff Module: Public pause() called.");
    return pauseAnimationInternal();
}

/** Redraws the canvas. Useful after settings changes that affect appearance. @export */
export function redraw() {
    console.log("Staff Module: Public redraw() called.");
    // If paused, ensure displayTime reflects the current audio playback time before redrawing
    if (!isStaffRunning && audio) {
        let currentAudioTime = audio.getPlaybackTime();
        displayTime = Math.max(MIN_DISPLAY_TIME, currentAudioTime);
        // console.log(`Staff Module (redraw): Game paused. Synced displayTime to audio time: ${displayTime.toFixed(3)}`);
    }
    redrawCanvasInternal();
}

/** Returns whether the staff animation loop is currently running. @returns {boolean} True if running. @export */
export function isRunning() {
    // console.log(`Staff Module: Public isRunning() called. Returning: ${isStaffRunning}`);
    return isStaffRunning;
}

/** Judges a key press against notes near the judgment line. @param {string} keyName Key pressed. @returns {string | null} 'perfect', 'good', or null. @export */
export function judgeKeyPress(keyName) {
    // console.log(`Staff Module: Public judgeKeyPress(keyName: "${keyName}") called.`);
    return judgeKeyPressInternal(keyName);
}

/** Resets the hit status of all notes (e.g., for restarting song). @export */
export function resetNotes() {
    console.log("Staff Module: Public resetNotes() called.");
    resetNotesInternal();
}

/** Resets the internal display time to the beginning. @export */
export function resetTime() {
    console.log("Staff Module: Public resetTime() called.");
    resetTimeInternal();
}

console.log("Staff Module: Script fully parsed.");
