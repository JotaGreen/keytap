/**
 * @file main.js
 * Main entry point and orchestrator for the Keytap game.
 * Loads modules, initializes the game, handles global state and UI updates.
 * Designed to be loaded as an ES Module (<script type="module">).
 */

console.log("--- main.js started execution ---");


// --- Module Imports ---

// Import all exported functions from audio.js (replace URL with your actual CDN link)
import * as audio from 'https://cdn.jsdelivr.net/gh/JotaGreen/keytap@main/audio.js';
// Import the color conversion function (assuming midiColorConverter.js is also an ES module exporting this)
// If midiColorConverter.js is NOT an ES module, load it via a separate standard <script> tag in HTML
// and access getMidiNoteColor globally (less ideal). Let's assume it IS an ES module for now.
import { getMidiNoteColor } from 'https://cdn.jsdelivr.net/gh/JotaGreen/keytap@main/midiColorConverter.js';


// --- Keyboard Module (Included here temporarily, formatted as ES Module) ---
// This code will eventually be moved to keyboard.js

console.log("Initializing Keyboard Module (within main.js)...");

// --- Keyboard Module Scope ---
let keyboard_pianoContainer = null; // DOM element for the piano container
let keyboard_keys = null;           // NodeList of key elements
let keyboard_judgeFunction = null; // Reference to the function that judges key presses
let keyboard_isGameOverFunc = () => false; // Function to check if game is over
let keyboard_isGameRunningFunc = () => false; // Function to check if game is running
let keyboard_resumeAudioContextFunc = async () => {}; // Function to resume audio context

let keyboard_isMouseDown = false; // Track mouse button state
let keyboard_activeTouches = {}; // Track active touches

/**
 * Handles the visual pressing of a key and triggers the judgment function.
 * @param {Element} keyElement - The DOM element of the key that was pressed.
 */
function keyboard_pressKey(keyElement) {
    if (keyboard_isGameOverFunc()) return; // Check game state via function

    if (keyElement && !keyElement.classList.contains('pressed')) {
        keyElement.classList.add('pressed');
        const keyName = keyElement.dataset.key;

        if (keyboard_judgeFunction && keyboard_isGameRunningFunc()) { // Check game state via function
            // Ensure AudioContext is running before judging
            keyboard_resumeAudioContextFunc().then(() => { // Call function to resume audio
                keyboard_judgeFunction(keyName);
            }).catch(e => {
                 console.error("Keyboard: Error resuming AudioContext during key press:", e);
                 keyboard_judgeFunction(keyName); // Still attempt judgment
            });
        } else if (!keyboard_isGameRunningFunc()) {
            // console.log("Keyboard: Key pressed but game is paused.");
        } else {
            console.warn("Keyboard: Judge function not available!");
        }
    }
}

/** Handles the visual release of a key. */
function keyboard_releaseKey(keyElement) {
    if (keyElement && keyElement.classList.contains('pressed')) {
        keyElement.classList.remove('pressed');
    }
}

/** Handles mouse button down events on the piano container. */
function keyboard_handleMouseDown(event) {
    if (event.button !== 0) return;
    const targetKey = event.target.closest('.key');
    if (targetKey && keyboard_pianoContainer && keyboard_pianoContainer.contains(targetKey)) {
        keyboard_isMouseDown = true;
        keyboard_pressKey(targetKey);
        event.preventDefault();
    }
}

/** Handles mouse button up events anywhere on the document. */
function keyboard_handleMouseUp(event) {
    if (event.button !== 0) return;
    if (keyboard_isMouseDown) {
        if (keyboard_keys) keyboard_keys.forEach(keyboard_releaseKey);
        keyboard_isMouseDown = false;
    }
}

/** Handles the mouse leaving the piano container area. */
function keyboard_handleMouseLeave(event) {
    if (keyboard_isMouseDown && event.target === keyboard_pianoContainer) {
        if (keyboard_keys) keyboard_keys.forEach(keyboard_releaseKey);
        keyboard_isMouseDown = false;
    }
}

/** Handles the start of a touch event on the piano container. */
 function keyboard_handleTouchStart(event) {
    const initialTargetKey = event.target.closest('.key');
    if (initialTargetKey && keyboard_pianoContainer && keyboard_pianoContainer.contains(initialTargetKey)) {
         event.preventDefault();
    }
    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetKey = elementUnderTouch ? elementUnderTouch.closest('.key') : null;
        if (targetKey && keyboard_pianoContainer && keyboard_pianoContainer.contains(targetKey)) {
            const touchId = touch.identifier;
            if (!keyboard_activeTouches[touchId]) {
                keyboard_activeTouches[touchId] = targetKey;
                keyboard_pressKey(targetKey);
            }
        }
    }
}

/** Handles touch movement events. */
function keyboard_handleTouchMove(event) {
     let shouldPreventDefault = false;
     for (let i = 0; i < event.changedTouches.length; i++) {
         const touch = event.changedTouches[i];
         if (keyboard_activeTouches[touch.identifier]) {
             shouldPreventDefault = true;
             break;
         }
     }
     if (shouldPreventDefault) {
         event.preventDefault();
     }
    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        const touchId = touch.identifier;
        const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
        const currentKey = elementUnderTouch ? elementUnderTouch.closest('.key') : null;
        const isValidKey = currentKey && keyboard_pianoContainer && keyboard_pianoContainer.contains(currentKey);
        const previousKey = keyboard_activeTouches[touchId];

        if (previousKey !== undefined) {
            if (currentKey !== previousKey) {
                keyboard_releaseKey(previousKey);
                if (isValidKey) {
                    keyboard_activeTouches[touchId] = currentKey;
                    keyboard_pressKey(currentKey);
                } else {
                     delete keyboard_activeTouches[touchId];
                }
            }
        }
    }
}

/** Handles the end or cancellation of a touch event. */
function keyboard_handleTouchEndOrCancel(event) {
    let shouldPreventDefault = false;
    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        if (keyboard_activeTouches[touch.identifier]) {
            shouldPreventDefault = true;
            break;
        }
    }
    if (shouldPreventDefault) {
        event.preventDefault();
    }
    for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        const touchId = touch.identifier;
        const lastKey = keyboard_activeTouches[touchId];
        keyboard_releaseKey(lastKey);
        delete keyboard_activeTouches[touchId];
    }
}

/**
 * Public initialization function for the keyboard module logic.
 * @param {object} config - Configuration object.
 * @param {Function} config.judgeKeyPressFunc - Function to judge key presses.
 * @param {Function} config.isGameOverFunc - Function that returns true if game is over.
 * @param {Function} config.isGameRunningFunc - Function that returns true if game is running.
 * @param {Function} config.resumeAudioContextFunc - Function to resume the audio context.
 */
function keyboard_init(config) {
    console.log("Keyboard Module: init() called (within main.js).");

    // Store functions passed in config
    keyboard_judgeFunction = config.judgeKeyPressFunc;
    keyboard_isGameOverFunc = config.isGameOverFunc;
    keyboard_isGameRunningFunc = config.isGameRunningFunc;
    keyboard_resumeAudioContextFunc = config.resumeAudioContextFunc;

    // Perform DOM Lookups
    keyboard_pianoContainer = document.getElementById('piano');
    if (!keyboard_pianoContainer) {
        console.error("Keyboard Error: Piano container element (#piano) not found during init!");
        return;
    }
    keyboard_keys = keyboard_pianoContainer.querySelectorAll('.key');
    if (!keyboard_keys || keyboard_keys.length === 0) {
        console.warn("Keyboard Warning: No elements with class '.key' found inside #piano during init!");
    }

    // Validate required functions
     if (typeof keyboard_judgeFunction !== 'function' ||
         typeof keyboard_isGameOverFunc !== 'function' ||
         typeof keyboard_isGameRunningFunc !== 'function' ||
         typeof keyboard_resumeAudioContextFunc !== 'function') {
         console.error("Keyboard Error: One or more required functions missing in init config!");
         return; // Stop initialization if functions are missing
     }

    // Attach Event Listeners
    keyboard_pianoContainer.addEventListener('mousedown', keyboard_handleMouseDown);
    document.addEventListener('mouseup', keyboard_handleMouseUp);
    keyboard_pianoContainer.addEventListener('mouseleave', keyboard_handleMouseLeave);
    keyboard_pianoContainer.addEventListener('touchstart', keyboard_handleTouchStart, { passive: false });
    keyboard_pianoContainer.addEventListener('touchmove', keyboard_handleTouchMove, { passive: false });
    keyboard_pianoContainer.addEventListener('touchend', keyboard_handleTouchEndOrCancel, { passive: false });
    keyboard_pianoContainer.addEventListener('touchcancel', keyboard_handleTouchEndOrCancel, { passive: false });
    keyboard_pianoContainer.addEventListener('contextmenu', (event) => event.preventDefault());

    console.log("Keyboard Module: Initialization complete and event listeners attached (within main.js).");
}

// --- End of Keyboard Module section ---



// --- Global Variables & State (Module-Scoped within main.js) ---
// Game Settings & Constants
// Export constants if they need to be imported by other modules (like audio.js)
export const INITIAL_HEALTH = 50;
export const MAX_HEALTH = 75;
export const MIN_HEALTH = 0;
export const PRE_DELAY_SECONDS = 1.0; // Delay before audio starts

// Default values (can be changed in settings)
let SCROLL_SPEED_PIXELS_PER_SECOND = 120;
let HIT_WINDOW_GOOD_MS = 140;

// Derived timing values (updated when HIT_WINDOW_GOOD_MS changes)
let HIT_WINDOW_PERFECT_MS = HIT_WINDOW_GOOD_MS / 2;
let HIT_WINDOW_GOOD_SEC = HIT_WINDOW_GOOD_MS / 1000.0;
let HIT_WINDOW_PERFECT_SEC = HIT_WINDOW_PERFECT_MS / 1000.0;

// Game State Variables (kept internal to main.js unless explicitly exported via functions)
let comboCount = 0;
let playerHealth = INITIAL_HEALTH;
let totalScore = 0;
let perfectCount = 0;
let goodCount = 0;
let missCount = 0;
let maxCombo = 0;
let totalNotesInSong = 0;
let useColoredNotes = false;
let noDeathMode = false;
let gameIsRunning = false; // Main flag for paused/playing state
let isGameOver = false;    // Flag for game over state
let gameInitialized = false; // Prevent multiple initializations

// File Loading State
let audioFileBuffer = null;
let notesJsonData = null;
let audioFileLoaded = false;
let notesFileLoaded = false;

// Audio Playback State
let audioPauseOffset = 0; // Time offset where audio was paused

// --- Global DOM Element References ---
// These are looked up once the DOM is loaded
let loadingScreen, audioFileInput, notesFileInput, loadingStatus, startButton;
let gameContainer, infoSection, staffSection, bottomPanel, keyboardSection;
let playPauseButton, settingsButton, comboCountSpan, healthBarElement;
let settingsOverlay, colorToggleSwitch, noDeathToggleSwitch, closeSettingsButton;
let staffScaleValueSpan, staffScaleDownButton, staffScaleUpButton;
let hitWindowValueSpan, hitWindowDownButton, hitWindowUpButton;
let scoreOverlay, scorePerfectCount, scorePerfectPercent, scoreGoodCount, scoreGoodPercent;
let scoreMissCount, scoreMissPercent, scoreMaxCombo, scoreTotalScore, restartButton;


// --- Staff Component Logic (Still IIFE for now) ---
// This will be moved to staff.js later
const staffModule = (() => {
    // ... (Paste the entire staffModule IIFE code here from index_without_keyboard.html) ...
    // IMPORTANT: Ensure any references inside staffModule to global functions (like applyScore)
    // or variables (like useColoredNotes, SCROLL_SPEED_PIXELS_PER_SECOND, HIT_WINDOW_GOOD_SEC etc.)
    // are correctly handled. They are currently defined in the outer scope of main.js.
    // Also ensure it uses the imported `getMidiNoteColor` and `audio` module functions correctly.

    console.log("Initializing Staff Module (within main.js)...");

    // --- Configuration Constants ---
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
    const JUDGMENT_LINE_X_PERCENT = 20;
    const MIDI_NOTE_MIN = 36; // C2
    const MIDI_NOTE_MAX = 84; // C6
    const ACCIDENTAL_PADDING_X = 3;
    const ACCIDENTAL_FONT_SIZE = LINE_SPACING * 1.2;
    const LEDGER_LINE_EXTENSION = 4;
    const LEDGER_LINE_WIDTH = 1;
    const MIN_DISPLAY_TIME = 0.0;
    const PERFECT_FLASH_COLOR = 'rgba(255, 215, 0, 0.7)';
    const PERFECT_FLASH_DURATION_MS = 150;
    const SONG_END_BUFFER_SEC = 2.0;

    // --- DOM Elements (Staff Specific) ---
    // Note: staffSection is defined in the outer scope of main.js
    let canvas = null; // Will be assigned in init
    let ctx = null;    // Will be assigned in init

    // --- Canvas Setup ---
    let devicePixelRatio = 1;
    let canvasWidth = 300;
    let canvasHeight = 150;
    let judgmentLineX;

    // --- Staff Geometry & Note Position Mapping ---
    const HALF_LINE_SPACING = LINE_SPACING / 2;
    let totalStaffLogicalHeight = 150;
    const staffPositions = {};
    let diatonicNoteYPositions = {};
    const midiToDiatonicDegree = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
    const notePitchClasses = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

    function setupStaffAndNotes() {
        // ... (geometry calculation code - unchanged) ...
        let currentY_rel = 0;
        const staffPositions_rel = {};
        staffPositions_rel.F5 = currentY_rel; staffPositions_rel.E5 = staffPositions_rel.F5 + HALF_LINE_SPACING; staffPositions_rel.D5 = staffPositions_rel.F5 + LINE_SPACING; staffPositions_rel.C5 = staffPositions_rel.D5 + HALF_LINE_SPACING; staffPositions_rel.B4 = staffPositions_rel.D5 + LINE_SPACING; staffPositions_rel.A4 = staffPositions_rel.B4 + HALF_LINE_SPACING; staffPositions_rel.G4 = staffPositions_rel.B4 + LINE_SPACING; staffPositions_rel.F4 = staffPositions_rel.G4 + HALF_LINE_SPACING; staffPositions_rel.E4 = staffPositions_rel.G4 + LINE_SPACING;
        const spaceBetweenStaves = LINE_SPACING;
        staffPositions_rel.D4 = staffPositions_rel.E4 + HALF_LINE_SPACING; staffPositions_rel.C4 = staffPositions_rel.E4 + LINE_SPACING; staffPositions_rel.B3 = staffPositions_rel.C4 + HALF_LINE_SPACING; staffPositions_rel.A3 = staffPositions_rel.C4 + LINE_SPACING; staffPositions_rel.G3 = staffPositions_rel.A3 + HALF_LINE_SPACING; staffPositions_rel.F3 = staffPositions_rel.A3 + LINE_SPACING; staffPositions_rel.E3 = staffPositions_rel.F3 + HALF_LINE_SPACING; staffPositions_rel.D3 = staffPositions_rel.F3 + LINE_SPACING; staffPositions_rel.C3 = staffPositions_rel.D3 + HALF_LINE_SPACING; staffPositions_rel.B2 = staffPositions_rel.D3 + LINE_SPACING; staffPositions_rel.A2 = staffPositions_rel.B2 + HALF_LINE_SPACING; staffPositions_rel.G2 = staffPositions_rel.B2 + LINE_SPACING;
        const noteNames = ["C", "D", "E", "F", "G", "A", "B"];
        const midiRef = 60; const yRef_rel = staffPositions_rel.C4;
        diatonicNoteYPositions = {};
        let minY_rel = Infinity, maxY_rel = -Infinity;
        for (let midi = MIDI_NOTE_MIN; midi <= MIDI_NOTE_MAX; midi++) {
            const octave = Math.floor(midi / 12) - 1; const noteIndex = midi % 12; const diatonicDegree = midiToDiatonicDegree[noteIndex];
            const referenceOctave = Math.floor(midiRef / 12) - 1; const octaveDifference = octave - referenceOctave;
            const stepsFromRefDegree = diatonicDegree - midiToDiatonicDegree[midiRef % 12];
            const totalDiatonicSteps = octaveDifference * 7 + stepsFromRefDegree;
            const yPos_rel = yRef_rel - (totalDiatonicSteps * HALF_LINE_SPACING);
            const baseNoteLetter = noteNames[diatonicDegree]; const baseNoteName = baseNoteLetter + octave;
            if (!(baseNoteName in diatonicNoteYPositions)) {
                diatonicNoteYPositions[baseNoteName] = yPos_rel; minY_rel = Math.min(minY_rel, yPos_rel); maxY_rel = Math.max(maxY_rel, yPos_rel);
            }
        }
        const noteHeight = LINE_SPACING; const topNoteEdgeY_rel = minY_rel - (noteHeight / 2); const bottomNoteEdgeY_rel = maxY_rel + (noteHeight / 2);
        totalStaffLogicalHeight = (bottomNoteEdgeY_rel - topNoteEdgeY_rel) + (STAFF_PADDING * 2); totalStaffLogicalHeight = Math.max(100, totalStaffLogicalHeight);
        const yOffset = STAFF_PADDING - topNoteEdgeY_rel;
        for (const key in staffPositions_rel) { staffPositions[key] = staffPositions_rel[key] + yOffset; }
        for (const key in diatonicNoteYPositions) { diatonicNoteYPositions[key] += yOffset; }
        console.log(`Staff: Precise Total Staff Logical Height Calculated: ${totalStaffLogicalHeight.toFixed(1)}px`);
    }
    setupStaffAndNotes();

    // --- Note Data Storage ---
    let noteMap = null;
    let notesToDraw = [];
    let songEndTimeVisual = 0;

    // --- State Variables ---
    let isStaffRunning = false;
    let animationFrameId = null;
    let displayTime = 0; // Visual time, reflects audio time
    let isDragging = false;
    let dragStartX = 0;
    let dragStartTime = 0;
    let activeFlashes = [];

    function getNoteYPosition(noteName) {
        const baseNameMatch = noteName.match(/([A-G])[#b]?(\d)/);
        if (baseNameMatch) {
            const baseName = baseNameMatch[1] + baseNameMatch[2];
            return diatonicNoteYPositions[baseName] ?? null;
        } else {
            console.warn(`Staff: Could not parse base note name from: "${noteName}"`); return null;
        }
    }
    function getPitchClass(noteName) {
        const match = noteName.match(/([A-G][#b]?)/);
        if (match) {
            let pc = match[1];
            if (pc === "C#") pc = "Db"; if (pc === "D#") pc = "Eb"; if (pc === "F#") pc = "Gb";
            if (pc === "G#") pc = "Ab"; if (pc === "A#") pc = "Bb";
            return pc;
        }
        return null;
    }

    // --- Drawing Functions ---
    function drawStaffLine(y) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasWidth, y); ctx.lineWidth = STAFF_LINE_WIDTH; ctx.strokeStyle = STAFF_LINE_COLOR; ctx.stroke(); }
    function drawGrandStaff() { drawStaffLine(staffPositions.E4); drawStaffLine(staffPositions.G4); drawStaffLine(staffPositions.B4); drawStaffLine(staffPositions.D5); drawStaffLine(staffPositions.F5); drawStaffLine(staffPositions.G2); drawStaffLine(staffPositions.B2); drawStaffLine(staffPositions.D3); drawStaffLine(staffPositions.F3); drawStaffLine(staffPositions.A3); }
    function drawRoundedRect(x, y, width, height, radius) { if (width < 2 * radius) radius = width / 2; if (height < 2 * radius) radius = height / 2; if (width <= 0 || height <= 0) return; ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.arcTo(x + width, y, x + width, y + height, radius); ctx.arcTo(x + width, y + height, x, y + height, radius); ctx.arcTo(x, y + height, x, y, radius); ctx.arcTo(x, y, x + width, y, radius); ctx.closePath(); ctx.fill(); }
    function drawLedgerLines(note, x, noteWidth) {
        const y = note.y; if (y === null) return; const checkTolerance = HALF_LINE_SPACING / 2; ctx.lineWidth = LEDGER_LINE_WIDTH; ctx.strokeStyle = STAFF_LINE_COLOR; const ledgerXStart = x - LEDGER_LINE_EXTENSION; const ledgerXEnd = x + noteWidth + LEDGER_LINE_EXTENSION;
        if (y < staffPositions.F5 - checkTolerance) { for (let lineY = staffPositions.F5 - LINE_SPACING; lineY >= y - checkTolerance; lineY -= LINE_SPACING) { ctx.beginPath(); ctx.moveTo(ledgerXStart, lineY); ctx.lineTo(ledgerXEnd, lineY); ctx.stroke(); } }
        if (Math.abs(y - staffPositions.C4) < checkTolerance) { ctx.beginPath(); ctx.moveTo(ledgerXStart, staffPositions.C4); ctx.lineTo(ledgerXEnd, staffPositions.C4); ctx.stroke(); }
        if (y > staffPositions.G2 + checkTolerance) { for (let lineY = staffPositions.G2 + LINE_SPACING; lineY <= y + checkTolerance; lineY += LINE_SPACING) { ctx.beginPath(); ctx.moveTo(ledgerXStart, lineY); ctx.lineTo(ledgerXEnd, lineY); ctx.stroke(); } }
    }
    function drawAccidental(note, x) {
        const accidental = note.name.includes('#') ? '♯' : note.name.includes('b') ? '♭' : null;
        if (accidental && note.y !== null) {
            // Access useColoredNotes from outer scope
            ctx.fillStyle = useColoredNotes ? ACCIDENTAL_COLOR_COLOR_NOTES : ACCIDENTAL_COLOR_BLACK_NOTES;
            ctx.font = `${ACCIDENTAL_FONT_SIZE}px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            const accidentalX = x + ACCIDENTAL_PADDING_X; const accidentalY = note.y;
            ctx.fillText(accidental, accidentalX, accidentalY);
        }
    }
    function drawNote(note, currentDisplayTime) {
        if (note.hitStatus === 'good' || note.hitStatus === 'perfect') return;
        if (note.y === null || note.y === undefined) return;
        const noteY = note.y; const timeUntilJudgment = note.time - currentDisplayTime;
        // Access SCROLL_SPEED_PIXELS_PER_SECOND from outer scope
        const noteX = judgmentLineX + (timeUntilJudgment * SCROLL_SPEED_PIXELS_PER_SECOND);
        const noteWidth = Math.max(1, note.duration * SCROLL_SPEED_PIXELS_PER_SECOND);
        const noteHeight = LINE_SPACING;
        let currentNoteColor = NOTE_COLOR;
        // Access useColoredNotes from outer scope
        if (useColoredNotes) {
            // Use imported getMidiNoteColor
            if (typeof getMidiNoteColor === 'function') {
                try {
                    const rgbArray = getMidiNoteColor(note.midi);
                    if (rgbArray && rgbArray.length === 3) { currentNoteColor = `rgb(${rgbArray[0]}, ${rgbArray[1]}, ${rgbArray[2]})`; } else { currentNoteColor = NOTE_COLOR; }
                } catch (e) { console.error(`Staff: Error calling getMidiNoteColor:`, e); currentNoteColor = NOTE_COLOR; }
            } else { currentNoteColor = NOTE_COLOR; }
        }
        if (noteX < canvasWidth && (noteX + noteWidth) > 0) {
            drawLedgerLines(note, noteX, noteWidth);
            ctx.fillStyle = currentNoteColor;
            drawRoundedRect(noteX, noteY - noteHeight / 2, noteWidth, noteHeight, NOTE_CORNER_RADIUS);
            drawAccidental(note, noteX);
        }
    }
    function drawJudgmentLine() { ctx.beginPath(); ctx.moveTo(judgmentLineX, 0); ctx.lineTo(judgmentLineX, canvasHeight); ctx.lineWidth = JUDGMENT_LINE_WIDTH; ctx.strokeStyle = JUDGMENT_LINE_COLOR; ctx.stroke(); }
    function drawFlashes(currentDisplayTime) {
        if (activeFlashes.length === 0) return;
        ctx.fillStyle = PERFECT_FLASH_COLOR;
        const flashHeight = LINE_SPACING * 1.5; const flashWidth = 10;
        // Use imported audio module
        const flashEndTimeContext = audio.getCurrentContextTime();
        for (let i = activeFlashes.length - 1; i >= 0; i--) {
            const flash = activeFlashes[i];
            if (flashEndTimeContext >= flash.endTime) { activeFlashes.splice(i, 1); } else {
                drawRoundedRect(judgmentLineX - flashWidth / 2, flash.y - flashHeight / 2, flashWidth, flashHeight, flashWidth / 2);
            }
        }
    }
    function redrawCanvas() {
        if (!ctx || !audio) return; // Check imported audio module
        // Use imported audio module
        displayTime = audio.getPlaybackTime();
        displayTime = Math.max(MIN_DISPLAY_TIME, displayTime);
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(devicePixelRatio, devicePixelRatio);
        drawGrandStaff(); drawJudgmentLine();
        if (notesToDraw.length > 0) { notesToDraw.forEach(note => drawNote(note, displayTime)); } else { ctx.fillStyle = '#888'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(noteMap ? 'No notes found in track' : 'Loading notes...', canvasWidth / 2, canvasHeight / 2); }
        drawFlashes(displayTime);
        ctx.restore();
    }

    // --- Animation Loop ---
    function animationLoop() {
        // Access isGameOver from outer scope
        if (!isStaffRunning || isGameOver) { animationFrameId = null; return; }
        // Access HIT_WINDOW_GOOD_SEC from outer scope
        const missThresholdTime = displayTime - HIT_WINDOW_GOOD_SEC;
        notesToDraw.forEach(note => {
            if (!note.hitStatus && note.time < missThresholdTime) {
                note.hitStatus = 'miss';
                applyScore('miss'); // Call applyScore from outer scope
            }
        });
        redrawCanvas();
        animationFrameId = requestAnimationFrame(animationLoop);
    }

    // --- Judgment Logic ---
    function judgeKeyPress(keyName) {
        // Access isStaffRunning, isGameOver from outer scope
        // Access audio module via import
        if (!isStaffRunning || isGameOver || !audio) return null;
        const currentJudgmentTime = displayTime; let hitResult = null; let bestNote = null; let minTimeDiff = Infinity;
        for (const note of notesToDraw) {
            if (note.hitStatus) continue;
            const timeDiff = note.time - currentJudgmentTime; const absTimeDiff = Math.abs(timeDiff);
            // Access HIT_WINDOW_GOOD_SEC from outer scope
            if (absTimeDiff <= HIT_WINDOW_GOOD_SEC) {
                const notePitchClass = getPitchClass(note.name);
                if (notePitchClass === keyName) {
                    if (absTimeDiff < minTimeDiff) { minTimeDiff = absTimeDiff; bestNote = note; }
                }
            }
        }
        if (bestNote) {
            // Use imported audio module
            const flashEndTimeContext = audio.getCurrentContextTime() + PERFECT_FLASH_DURATION_MS / 1000.0;
            // Access HIT_WINDOW_PERFECT_SEC from outer scope
            if (minTimeDiff <= HIT_WINDOW_PERFECT_SEC) {
                bestNote.hitStatus = 'perfect'; hitResult = 'perfect';
                activeFlashes.push({ y: bestNote.y, endTime: flashEndTimeContext });
                applyScore('perfect'); // Call applyScore from outer scope
            } else {
                bestNote.hitStatus = 'good'; hitResult = 'good';
                applyScore('good'); // Call applyScore from outer scope
            }
        }
        return hitResult;
    }

    // --- Control Functions (Internal) ---
    function playAnimationInternal(resumeOffset = 0) {
        // Access isStaffRunning, isGameOver from outer scope
        // Access audio module via import
        if (!isStaffRunning && !isGameOver && audio && audio.isReady()) {
            console.log(`Staff: Playing animation (Internal), resumeOffset: ${resumeOffset.toFixed(3)}`);
            isStaffRunning = true; if (canvas) canvas.style.cursor = 'default';
            // Use imported audio module, pass PRE_DELAY_SECONDS from outer scope
            audio.play(resumeOffset, PRE_DELAY_SECONDS);
            if (!animationFrameId) { console.log("Staff: Starting animation frame loop."); animationFrameId = requestAnimationFrame(animationLoop); }
        } else { console.warn("Staff: Cannot play - already running, game over, or audio not ready."); }
    }
    function pauseAnimationInternal() {
        if (isStaffRunning) {
            console.log("Staff: Pausing animation (Internal)...");
            isStaffRunning = false; if (canvas) canvas.style.cursor = 'grab';
            if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; console.log("Staff: Stopped animation frame loop."); }
            // Use imported audio module
            return audio ? audio.pause() : 0;
        }
        // Use imported audio module
        return audio ? audio.getPlaybackTime() : 0;
    }
    function resetNotesInternal() { console.log("Staff: Resetting note hit statuses."); notesToDraw.forEach(note => note.hitStatus = null); activeFlashes = []; }
    function resetTimeInternal() { console.log("Staff: Resetting display time."); displayTime = 0; }

    // --- Event Handlers ---
    function handleResize() {
        // Access staffSection from outer scope
        if (!staffSection || !canvas) return; // Check if elements exist
        const displayWidth = staffSection.offsetWidth; const displayHeight = staffSection.offsetHeight;
        if (displayWidth <= 0 || displayHeight <= 0) { console.warn("Staff: Resize called with zero or negative dimensions. Skipping redraw."); return; }
        canvasWidth = displayWidth; canvasHeight = Math.min(displayHeight, totalStaffLogicalHeight);
        canvas.width = Math.round(canvasWidth * devicePixelRatio); canvas.height = Math.round(canvasHeight * devicePixelRatio);
        canvas.style.width = `${canvasWidth}px`; canvas.style.height = `${canvasHeight}px`;
        judgmentLineX = canvasWidth * (JUDGMENT_LINE_X_PERCENT / 100);
        redrawCanvas();
    }
    function getEventX(event) { return event.touches ? event.touches[0].clientX : event.clientX; }
    function handleDragStart(event) {
        // Access isStaffRunning, isGameOver from outer scope
        if (!isStaffRunning && !isGameOver && canvas) {
            isDragging = true; dragStartX = getEventX(event) - canvas.getBoundingClientRect().left; dragStartTime = displayTime;
            canvas.classList.add('dragging'); if (event.target === canvas) { event.preventDefault(); }
        }
    }
    function handleDragMove(event) {
        if (isDragging && canvas) {
            const currentX = getEventX(event) - canvas.getBoundingClientRect().left; const deltaX = currentX - dragStartX;
            // Access SCROLL_SPEED_PIXELS_PER_SECOND from outer scope
            const deltaTimeOffset = deltaX / SCROLL_SPEED_PIXELS_PER_SECOND;
            displayTime = Math.max(MIN_DISPLAY_TIME, dragStartTime - deltaTimeOffset);
            redrawCanvas(); if (event.target === canvas) { event.preventDefault(); }
        }
    }
    function handleDragEnd(event) {
        if (isDragging && canvas) {
            isDragging = false; canvas.classList.remove('dragging');
            // Access audioPauseOffset in outer scope
            audioPauseOffset = Math.max(0, displayTime);
            console.log(`Staff: Drag ended. New audio pause offset: ${audioPauseOffset.toFixed(3)}`);
            if (event.target === canvas) { event.preventDefault(); }
        }
    }

    // --- Initialization & Data Loading ---
    function loadNoteData(jsonData) {
        console.log(`Staff: Processing provided note data...`);
        try {
            noteMap = jsonData;
            if (noteMap && noteMap.tracks && noteMap.tracks.length > 0 && noteMap.tracks[0].notes) {
                const rawNotes = noteMap.tracks[0].notes; console.log(`Staff: Found ${rawNotes.length} notes in the first track.`);
                // Access totalNotesInSong in outer scope
                totalNotesInSong = rawNotes.length;
                let lastNoteEndTime = 0;
                notesToDraw = rawNotes.map(note => { const yPos = getNoteYPosition(note.name); const noteEndTime = note.time + note.duration; if (noteEndTime > lastNoteEndTime) { lastNoteEndTime = noteEndTime; } return { ...note, y: yPos, hitStatus: null }; }).filter(note => note.y !== null);
                songEndTimeVisual = lastNoteEndTime + SONG_END_BUFFER_SEC;
                console.log(`Staff: Processed ${rawNotes.length} notes, ${notesToDraw.length} remain. Visual song end: ${songEndTimeVisual.toFixed(3)}s`);
                notesToDraw.sort((a, b) => a.time - b.time);
            } else { console.error("Staff Error: Invalid note data format."); notesToDraw = []; totalNotesInSong = 0; songEndTimeVisual = 0; redrawCanvas(); return false; }
            return true;
        } catch (error) { console.error("Staff: Fatal Error processing note data:", error); alert("Error processing notes file."); notesToDraw = []; totalNotesInSong = 0; songEndTimeVisual = 0; redrawCanvas(); return false; }
    }
    function init(noteDataJson) {
        console.log("Staff Module: Initializing (within main.js)...");

        // Get canvas element (defined in outer scope)
        canvas = document.getElementById('staffCanvas');
         if (!canvas || !staffSection) {
             console.error("Staff Error: Required DOM element (canvas or staffSection) not found!");
             return false;
         }
         ctx = canvas.getContext('2d');
         if (!ctx) {
             console.error("Staff Error: Could not get 2D rendering context!");
             return false;
         }
         devicePixelRatio = window.devicePixelRatio || 1;


        // Use imported getMidiNoteColor
        if (typeof getMidiNoteColor !== 'function') { console.error("Staff CRITICAL: getMidiNoteColor function NOT FOUND (import failed?)."); }
        const notesLoaded = loadNoteData(noteDataJson);
        if (!notesLoaded) { console.error("Staff Module: Failed to load note data during init."); return false; }
        handleResize(); displayTime = 0; redrawCanvas();
        canvas.addEventListener('mousedown', handleDragStart); window.addEventListener('mousemove', handleDragMove); window.addEventListener('mouseup', handleDragEnd);
        canvas.addEventListener('touchstart', handleDragStart, { passive: false }); window.addEventListener('touchmove', handleDragMove, { passive: false });
        window.addEventListener('touchend', handleDragEnd); window.addEventListener('touchcancel', handleDragEnd);
        console.log("Staff Module: Initialization complete (within main.js).");
        return true;
    }

    // --- Public Interface (Return object from IIFE) ---
    return { init, handleResize, play: playAnimationInternal, pause: pauseAnimationInternal, redraw: redrawCanvas, isRunning: () => isStaffRunning, judgeKeyPress: judgeKeyPress, resetNotes: resetNotesInternal, resetTime: resetTimeInternal };

})(); // Immediately invoke the staff module function


// --- Scoring & Game Logic Functions ---

/** Calculates the combo bonus energy. */
function calculateComboBonus(currentCombo) {
    if (currentCombo < 10) return 0;
    return Math.floor((currentCombo - 1) / 10);
}

/** Applies scoring changes based on hit type. */
function applyScore(hitType) {
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
    console.log(`Score Event: ${hitType.toUpperCase()} | Combo: ${comboCount} (Max: ${maxCombo}) | Health Change: ${actualHealthChange} (Raw: ${totalEnergyChange}) | Health: ${playerHealth}/${MAX_HEALTH} | Score: ${totalScore} | P:${perfectCount} G:${goodCount} M:${missCount}`);
    updateInfoUI(); // Update UI
    // Check for Game Over
    if (playerHealth <= MIN_HEALTH && !isGameOver) {
         if (!noDeathMode) { triggerGameOver(false); }
         else { console.log("Health reached zero, but No Death Mode is active."); }
    }
}

/** Handles the game over state or song completion. */
// Export needed by audio.js callback
export function triggerGameOver(songFinished) {
    if (isGameOver) return;
    console.log(songFinished ? "--- SONG FINISHED ---" : "--- GAME OVER ---");
    isGameOver = true; gameIsRunning = false;
    // Use imported audio module
    if (audio) audio.pause();
    if (staffModule && staffModule.isRunning()) { staffModule.pause(); }
    if (playPauseButton) { playPauseButton.textContent = songFinished ? "Finished" : "Game Over"; playPauseButton.disabled = true; }
    if (settingsButton) settingsButton.disabled = true;
    showScoreScreen();
}

/** Resets the game state for a new game. */
function restartGame() {
    console.log("--- Restarting Game ---");
    if (scoreOverlay) scoreOverlay.classList.remove('visible');
    playerHealth = INITIAL_HEALTH; comboCount = 0; totalScore = 0; perfectCount = 0; goodCount = 0; missCount = 0; maxCombo = 0;
    isGameOver = false; gameIsRunning = false; audioPauseOffset = 0;
    // Use imported audio module
    if (audio) audio.stop();
    if (staffModule) { staffModule.resetNotes(); staffModule.resetTime(); staffModule.pause(); staffModule.redraw(); }
    updateInfoUI();
    if (playPauseButton) { playPauseButton.textContent = "Play"; playPauseButton.disabled = false; }
    if (settingsButton) settingsButton.disabled = false;
    console.log("Game state reset.");
}

// --- UI Update Functions ---

/** Updates the health bar and combo display. */
function updateInfoUI() {
    if (comboCountSpan) comboCountSpan.textContent = comboCount;
    if (healthBarElement) {
        const healthPercentage = Math.max(0, Math.min(100, (playerHealth / MAX_HEALTH) * 100));
        healthBarElement.style.width = `${healthPercentage}%`;
        if (healthPercentage <= 0) { healthBarElement.style.backgroundColor = '#555555'; }
        else if (healthPercentage < 25) { healthBarElement.style.backgroundColor = '#f44336'; }
        else if (healthPercentage < 50) { healthBarElement.style.backgroundColor = '#ff9800'; }
        else { healthBarElement.style.backgroundColor = '#4CAF50'; }
    }
}

/** Updates the displayed values in the settings panel. */
function updateSettingsUI() {
    updateTimingWindows(); // Ensure derived values are current
    if (staffScaleValueSpan) staffScaleValueSpan.textContent = SCROLL_SPEED_PIXELS_PER_SECOND;
    if (hitWindowValueSpan) hitWindowValueSpan.textContent = HIT_WINDOW_GOOD_MS;
    if (colorToggleSwitch) colorToggleSwitch.checked = useColoredNotes;
    if (noDeathToggleSwitch) noDeathToggleSwitch.checked = noDeathMode;
    console.log("Settings UI updated.");
}

/** Calculates and displays the final score screen. */
function showScoreScreen() {
    if (!scoreOverlay) return;
    const processedNotes = perfectCount + goodCount + missCount;
    const totalNotes = totalNotesInSong > 0 ? totalNotesInSong : processedNotes;
    const perfectPercent = totalNotes > 0 ? ((perfectCount / totalNotes) * 100).toFixed(1) : 0;
    const goodPercent = totalNotes > 0 ? ((goodCount / totalNotes) * 100).toFixed(1) : 0;
    const missPercent = totalNotes > 0 ? ((missCount / totalNotes) * 100).toFixed(1) : 0;
    if(scorePerfectCount) scorePerfectCount.textContent = perfectCount;
    if(scorePerfectPercent) scorePerfectPercent.textContent = perfectPercent;
    if(scoreGoodCount) scoreGoodCount.textContent = goodCount;
    if(scoreGoodPercent) scoreGoodPercent.textContent = goodPercent;
    if(scoreMissCount) scoreMissCount.textContent = missCount;
    if(scoreMissPercent) scoreMissPercent.textContent = missPercent;
    if(scoreMaxCombo) scoreMaxCombo.textContent = maxCombo;
    if(scoreTotalScore) scoreTotalScore.textContent = totalScore;
    scoreOverlay.classList.add('visible');
    console.log("Score screen displayed.");
}


// --- Layout & Timing Functions ---

/** Handles layout adjustments on orientation change or resize. */
function handleLayoutChange() {
    // Check if elements exist before manipulating
    if (!gameContainer || !infoSection || !staffSection || !bottomPanel || !keyboardSection) {
        console.error("Layout Error: One or more essential layout containers not found.");
        return;
    }
    const orientation = window.matchMedia("(orientation: landscape)").matches ? 'landscape' : 'portrait';
    if (orientation === 'landscape') {
        if (infoSection.parentElement !== bottomPanel) { bottomPanel.insertBefore(infoSection, keyboardSection); }
    } else { // Portrait
        if (infoSection.parentElement === bottomPanel) { gameContainer.insertBefore(infoSection, staffSection); }
    }
    // Resize staff canvas after layout change (with slight delay for rendering)
    if (staffModule && typeof staffModule.handleResize === 'function') {
         setTimeout(staffModule.handleResize, 50);
    } else { console.warn("Could not trigger staff resize after layout change."); }
}

/** Recalculates derived timing variables. */
function updateTimingWindows() {
    HIT_WINDOW_PERFECT_MS = Math.floor(HIT_WINDOW_GOOD_MS / 2);
    HIT_WINDOW_GOOD_SEC = HIT_WINDOW_GOOD_MS / 1000.0;
    HIT_WINDOW_PERFECT_SEC = HIT_WINDOW_PERFECT_MS / 1000.0;
    console.log(`Timing windows updated: Good=${HIT_WINDOW_GOOD_MS}ms (${HIT_WINDOW_GOOD_SEC.toFixed(3)}s), Perfect=${HIT_WINDOW_PERFECT_MS}ms (${HIT_WINDOW_PERFECT_SEC.toFixed(3)}s)`);
}


// --- Game Initialization ---

/** Initializes all game modules and sets up event listeners AFTER files are loaded. */
async function initializeGame(loadedAudioBuffer, loadedNoteData) {
    if (gameInitialized) { console.warn("Game already initialized. Skipping."); return; }
    console.log("--- Initializing Keytap Game ---");
    loadingStatus.textContent = "Initializing audio...";

    // 1. Initialize Audio Module (using imported module)
    // Define the callback for when the song ends naturally
    const handleSongEnd = () => {
        // Check game state here instead of inside audio module
        if (!isGameOver) {
            triggerGameOver(true); // Song finished successfully
        }
    };
    // Pass the buffer and the callback to the imported init function
    const audioInitialized = await audio.init(loadedAudioBuffer, handleSongEnd);
    if (!audioInitialized) { console.error("Audio module initialization failed."); loadingStatus.textContent = "Error: Failed to decode audio."; startButton.disabled = false; return; }

    loadingStatus.textContent = "Initializing visuals...";

    // 2. Initialize Staff Module (still defined locally in this file)
    const staffInitialized = staffModule.init(loadedNoteData);
     if (!staffInitialized) { console.error("Staff module initialization failed."); loadingStatus.textContent = "Error: Failed to process notes file."; return; }

    // 3. Initialize Keyboard Module (defined locally in this file)
    // Pass dependencies via config object
    keyboard_init({
        judgeKeyPressFunc: staffModule.judgeKeyPress, // Get function from staff module
        isGameOverFunc: () => isGameOver,            // Pass function to get game over state
        isGameRunningFunc: () => gameIsRunning,        // Pass function to get running state
        resumeAudioContextFunc: audio.resumeContext   // Pass function from audio module
    });
    // We might add a check here if keyboard_init fails, though it currently doesn't return a status

    // 4. Set initial UI states
    updateInfoUI();
    updateSettingsUI(); // Calls updateTimingWindows

    // 5. Set initial layout
    handleLayoutChange();

    // 6. Add Global Event Listeners ---
    setupGlobalEventListeners(); // Encapsulate listener setup

    gameInitialized = true;
    console.log("--- Keytap Game Initialization Complete ---");
    loadingStatus.textContent = "Ready!";
}

/** Sets up global event listeners for buttons, settings, etc. */
function setupGlobalEventListeners() {
    console.log("Setting up global event listeners...");

    // Play/Pause Button
    if (playPauseButton && staffModule && audio) {
        playPauseButton.addEventListener('click', () => {
            if (isGameOver) return;
             audio.resumeContext().then(() => { // Use imported audio module function
                 if (gameIsRunning) {
                     audioPauseOffset = staffModule.pause(); // Pause visuals
                     // Audio pause is handled implicitly by staffModule calling audio.pause
                     playPauseButton.textContent = "Play";
                     gameIsRunning = false;
                     console.log(`Game Paused. Audio offset: ${audioPauseOffset.toFixed(3)}`);
                 } else {
                     // Pass PRE_DELAY_SECONDS when calling play
                     staffModule.play(audioPauseOffset); // Play visuals
                     // Audio play is handled implicitly by staffModule calling audio.play
                     playPauseButton.textContent = "Pause";
                     gameIsRunning = true;
                     console.log(`Game Playing. Resuming from offset: ${audioPauseOffset.toFixed(3)}`);
                 }
             }).catch(e => console.error("Failed to resume AudioContext on play/pause:", e));
        });
    } else { console.warn("Play/Pause button or required modules not found."); }

    // Settings Button
    if (settingsButton && settingsOverlay && staffModule && audio) {
        settingsButton.addEventListener('click', () => {
            if (isGameOver) return;
            console.log("Settings button clicked.");
            if (gameIsRunning) {
                audioPauseOffset = staffModule.pause(); // Pause visuals & audio
                playPauseButton.textContent = "Play";
                gameIsRunning = false;
                console.log("Paused game for settings.");
            }
            updateSettingsUI();
            settingsOverlay.classList.add('visible');
        });
    } else { console.warn("Settings button or required elements/modules not found."); }

    // Close Settings Button
    if (closeSettingsButton && settingsOverlay) {
        closeSettingsButton.addEventListener('click', () => {
            settingsOverlay.classList.remove('visible');
            console.log("Settings overlay closed.");
            if (!gameIsRunning && staffModule) { staffModule.redraw(); }
        });
    } else { console.warn("Close Settings button or overlay not found."); }

     // Settings: Color Toggle Switch
     if (colorToggleSwitch && staffModule) {
         colorToggleSwitch.addEventListener('change', (event) => {
             useColoredNotes = event.target.checked;
             console.log(`Color notes setting changed: ${useColoredNotes}`);
             staffModule.redraw();
         });
     } else { console.warn("Color toggle switch or staff module not found."); }

     // Settings: No Death Mode Toggle Switch
     if (noDeathToggleSwitch) {
         noDeathToggleSwitch.addEventListener('change', (event) => {
             noDeathMode = event.target.checked;
             console.log(`No Death Mode setting changed: ${noDeathMode}`);
         });
     } else { console.warn("No Death toggle switch not found."); }

     // Settings: Staff Scale Adjustment
     const STAFF_SCALE_STEP = 10; const STAFF_SCALE_MIN = 50; const STAFF_SCALE_MAX = 200;
     if (staffScaleDownButton && staffScaleUpButton && staffModule) {
         staffScaleDownButton.addEventListener('click', () => { SCROLL_SPEED_PIXELS_PER_SECOND = Math.max(STAFF_SCALE_MIN, SCROLL_SPEED_PIXELS_PER_SECOND - STAFF_SCALE_STEP); updateSettingsUI(); staffModule.redraw(); });
         staffScaleUpButton.addEventListener('click', () => { SCROLL_SPEED_PIXELS_PER_SECOND = Math.min(STAFF_SCALE_MAX, SCROLL_SPEED_PIXELS_PER_SECOND + STAFF_SCALE_STEP); updateSettingsUI(); staffModule.redraw(); });
     } else { console.warn("Staff scale buttons or staff module not found."); }

     // Settings: Hit Window Adjustment
     const HIT_WINDOW_STEP = 5; const HIT_WINDOW_MIN = 30; const HIT_WINDOW_MAX = 200;
     if (hitWindowDownButton && hitWindowUpButton) {
         hitWindowDownButton.addEventListener('click', () => { HIT_WINDOW_GOOD_MS = Math.max(HIT_WINDOW_MIN, HIT_WINDOW_GOOD_MS - HIT_WINDOW_STEP); updateSettingsUI(); });
         hitWindowUpButton.addEventListener('click', () => { HIT_WINDOW_GOOD_MS = Math.min(HIT_WINDOW_MAX, HIT_WINDOW_GOOD_MS + HIT_WINDOW_STEP); updateSettingsUI(); });
     } else { console.warn("Hit window buttons not found."); }

     // Score Screen: Restart Button
     if (restartButton) {
         // Use a simple listener directly
         restartButton.addEventListener('click', restartGame);
     } else { console.warn("Restart button not found."); }

    // Orientation Change Listener
    window.matchMedia("(orientation: landscape)").addEventListener("change", handleLayoutChange);

    // Window Resize Listener (Debounced)
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(handleLayoutChange, 150);
    });

    console.log("Global event listeners attached.");
}


// --- File Loading Logic ---

/** Checks if both files are loaded and updates the start button state. */
function checkFilesLoaded() {
    // Ensure startButton exists before modifying it
    if (!startButton) return;
    if (audioFileLoaded && notesFileLoaded) {
        loadingStatus.textContent = "Files loaded. Ready to start!";
        startButton.disabled = false;
        console.log("Both files loaded and validated.");
    } else {
        startButton.disabled = true;
        if (!loadingStatus) return; // Check if status element exists
        if (!audioFileLoaded && !notesFileLoaded) loadingStatus.textContent = "Please select both files.";
        else if (!audioFileLoaded) loadingStatus.textContent = "Please select an MP3 audio file.";
        else loadingStatus.textContent = "Please select a JSON notes file.";
    }
}

/** Handles audio file selection. */
function handleAudioFileSelect(event) {
    const file = event.target.files[0];
    if (!file) { audioFileLoaded = false; audioFileBuffer = null; checkFilesLoaded(); return; }
    if (!file.type.startsWith('audio/mpeg') && !file.name.toLowerCase().endsWith('.mp3')) {
        alert("Invalid audio file type. Please select an MP3 file.");
        event.target.value = ''; audioFileLoaded = false; audioFileBuffer = null; checkFilesLoaded(); return;
    }
    if (loadingStatus) loadingStatus.textContent = "Loading audio file...";
    if (startButton) startButton.disabled = true;
    const reader = new FileReader();
    reader.onload = (e) => { audioFileBuffer = e.target.result; audioFileLoaded = true; console.log("Audio file loaded into ArrayBuffer."); checkFilesLoaded(); };
    reader.onerror = (e) => { console.error("Error reading audio file:", e); alert("Error reading audio file."); audioFileLoaded = false; audioFileBuffer = null; checkFilesLoaded(); };
    reader.readAsArrayBuffer(file);
}

/** Handles notes file selection. */
function handleNotesFileSelect(event) {
    const file = event.target.files[0];
    if (!file) { notesFileLoaded = false; notesJsonData = null; checkFilesLoaded(); return; }
     if (!file.type.startsWith('application/json') && !file.name.toLowerCase().endsWith('.json')) {
        alert("Invalid notes file type. Please select a JSON file.");
        event.target.value = ''; notesFileLoaded = false; notesJsonData = null; checkFilesLoaded(); return;
    }
    if (loadingStatus) loadingStatus.textContent = "Loading notes file...";
    if (startButton) startButton.disabled = true;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            notesJsonData = JSON.parse(e.target.result);
            if (!notesJsonData || !notesJsonData.tracks || !Array.isArray(notesJsonData.tracks)) { throw new Error("Invalid JSON structure: Missing 'tracks' array."); }
            notesFileLoaded = true; console.log("Notes file loaded and parsed successfully."); checkFilesLoaded();
        } catch (error) { console.error("Error parsing JSON file:", error); alert(`Error parsing JSON file: ${error.message}`); notesFileLoaded = false; notesJsonData = null; checkFilesLoaded(); }
    };
    reader.onerror = (e) => { console.error("Error reading notes file:", e); alert("Error reading notes file."); notesFileLoaded = false; notesJsonData = null; checkFilesLoaded(); };
    reader.readAsText(file);
}


// --- Entry Point ---
// Use window.onload to ensure DOM is ready before querying elements and adding listeners
window.addEventListener('load', () => {
    console.log("Window loaded. Setting up main script.");

    // --- Assign Global DOM Elements ---
    // Assign references to DOM elements now that the DOM is loaded
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

    // Basic check for essential elements
    if (!loadingScreen || !startButton || !gameContainer) {
        console.error("CRITICAL: Essential elements (loadingScreen, startButton, gameContainer) not found!");
        alert("Error: Could not initialize the game interface.");
        return;
    }

    // Add file input listeners
    if (audioFileInput) audioFileInput.addEventListener('change', handleAudioFileSelect);
    if (notesFileInput) notesFileInput.addEventListener('change', handleNotesFileSelect);

    // Add start button listener
    startButton.addEventListener('click', async () => {
        if (audioFileLoaded && notesFileLoaded) {
            console.log("Start button clicked. Hiding loading screen.");
            startButton.disabled = true;
            loadingStatus.textContent = "Starting game...";
            loadingScreen.classList.add('hidden');
            gameContainer.classList.add('visible');
            // Initialize the game - awaits audio decoding etc.
            await initializeGame(audioFileBuffer, notesJsonData);
        } else {
            console.warn("Start button clicked but files not ready.");
            checkFilesLoaded();
        }
    });

    // Initial setup calls
    updateTimingWindows(); // Calculate initial timing windows
    checkFilesLoaded(); // Check if files might already be selected

    console.log("Main script setup complete. Waiting for file selection.");
});

// Export nothing from main.js itself, it's the entry point.
