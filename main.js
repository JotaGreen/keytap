// main.js

console.log("Main.js: starting execution");

/**
 * @file main.js
 * Main entry point and orchestrator for the Keytap game.
 * Loads modules, initializes the game, handles global state and UI updates.
 * Designed to be loaded as an ES Module (<script type="module">).
 */


// export { triggerGameOver }; // Already exported inline
// export { PRE_DELAY_SECONDS, INITIAL_HEALTH, MAX_HEALTH, MIN_HEALTH }; // Already exported inline


// --- Module Imports ---

// Import audio module (adjust path/URL as needed)
import * as audio from './audioModule.js';
// Import keyboard module (adjust path/URL as needed)
import {
    init as initKeyboard
} from './keyboardModule.js';
// Import color utility (adjust path/URL as needed)
import {
    getMidiNoteColor
} from './midiColorConverter.js';


// --- Global Variables & State (Module-Scoped within main.js) ---
// Game Settings & Constants
// Export constants if they need to be imported by other modules
export const INITIAL_HEALTH = 50;
export const MAX_HEALTH = 75;
export const MIN_HEALTH = 0;
export const PRE_DELAY_SECONDS = 1.0; // Delay before audio starts

// --- Scoring Constants ---
// Kept here for now, will move with scoring logic later
const ENERGY_PERFECT = 2;
const ENERGY_GOOD = 0;
const ENERGY_MISS = -5;

// Default values (can be changed in settings)
let SCROLL_SPEED_PIXELS_PER_SECOND = 120;
let HIT_WINDOW_GOOD_MS = 140;

// Derived timing values (updated when HIT_WINDOW_GOOD_MS changes)
let HIT_WINDOW_PERFECT_MS = HIT_WINDOW_GOOD_MS / 2;
let HIT_WINDOW_GOOD_SEC = HIT_WINDOW_GOOD_MS / 1000.0;
let HIT_WINDOW_PERFECT_SEC = HIT_WINDOW_PERFECT_MS / 1000.0;

// Game State Variables
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
let isGameOver = false; // Flag for game over state
let gameInitialized = false; // Prevent multiple initializations

// File Loading State
let audioFileBuffer = null;
let notesJsonData = null;
let audioFileLoaded = false;
let notesFileLoaded = false;

// Audio Playback State
let audioPauseOffset = 0; // Time offset where audio was paused

// --- Global DOM Element References ---
// Assigned in window.onload listener
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
    // --- Staff Module Scope ---
    console.log("Initializing Staff Module (within main.js)...");

    // Constants...
    const STAFF_LINE_COLOR = '#000000',
        NOTE_COLOR = '#333333',
        ACCIDENTAL_COLOR_BLACK_NOTES = '#888888',
        ACCIDENTAL_COLOR_COLOR_NOTES = '#000000';
    const STAFF_LINE_WIDTH = 1,
        NOTE_CORNER_RADIUS = 3,
        LINE_SPACING = 12,
        STAFF_PADDING = LINE_SPACING / 2;
    const JUDGMENT_LINE_COLOR = '#FF0000',
        JUDGMENT_LINE_WIDTH = 2,
        JUDGMENT_LINE_X_PERCENT = 20;
    const MIDI_NOTE_MIN = 36,
        MIDI_NOTE_MAX = 84,
        ACCIDENTAL_PADDING_X = 3,
        ACCIDENTAL_FONT_SIZE = LINE_SPACING * 1.2;
    const LEDGER_LINE_EXTENSION = 4,
        LEDGER_LINE_WIDTH = 1,
        MIN_DISPLAY_TIME = 0.0;
    const PERFECT_FLASH_COLOR = 'rgba(255, 215, 0, 0.7)',
        PERFECT_FLASH_DURATION_MS = 150,
        SONG_END_BUFFER_SEC = 2.0;

    // DOM Elements... (canvas assigned in init)
    let canvas = null,
        ctx = null;
    let devicePixelRatio = 1,
        canvasWidth = 300,
        canvasHeight = 150,
        judgmentLineX;

    // Geometry...
    const HALF_LINE_SPACING = LINE_SPACING / 2;
    let totalStaffLogicalHeight = 150;
    const staffPositions = {};
    let diatonicNoteYPositions = {};
    const midiToDiatonicDegree = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
    const notePitchClasses = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

    function setupStaffAndNotes() {
        /* ... (geometry calculation code - unchanged) ... */
        let currentY_rel = 0;
        const staffPositions_rel = {};
        staffPositions_rel.F5 = currentY_rel;
        staffPositions_rel.E5 = staffPositions_rel.F5 + HALF_LINE_SPACING;
        staffPositions_rel.D5 = staffPositions_rel.F5 + LINE_SPACING;
        staffPositions_rel.C5 = staffPositions_rel.D5 + HALF_LINE_SPACING;
        staffPositions_rel.B4 = staffPositions_rel.D5 + LINE_SPACING;
        staffPositions_rel.A4 = staffPositions_rel.B4 + HALF_LINE_SPACING;
        staffPositions_rel.G4 = staffPositions_rel.B4 + LINE_SPACING;
        staffPositions_rel.F4 = staffPositions_rel.G4 + HALF_LINE_SPACING;
        staffPositions_rel.E4 = staffPositions_rel.G4 + LINE_SPACING;
        const spaceBetweenStaves = LINE_SPACING;
        staffPositions_rel.D4 = staffPositions_rel.E4 + HALF_LINE_SPACING;
        staffPositions_rel.C4 = staffPositions_rel.E4 + LINE_SPACING;
        staffPositions_rel.B3 = staffPositions_rel.C4 + HALF_LINE_SPACING;
        staffPositions_rel.A3 = staffPositions_rel.C4 + LINE_SPACING;
        staffPositions_rel.G3 = staffPositions_rel.A3 + HALF_LINE_SPACING;
        staffPositions_rel.F3 = staffPositions_rel.A3 + LINE_SPACING;
        staffPositions_rel.E3 = staffPositions_rel.F3 + HALF_LINE_SPACING;
        staffPositions_rel.D3 = staffPositions_rel.F3 + LINE_SPACING;
        staffPositions_rel.C3 = staffPositions_rel.D3 + HALF_LINE_SPACING;
        staffPositions_rel.B2 = staffPositions_rel.D3 + LINE_SPACING;
        staffPositions_rel.A2 = staffPositions_rel.B2 + HALF_LINE_SPACING;
        staffPositions_rel.G2 = staffPositions_rel.B2 + LINE_SPACING;
        const noteNames = ["C", "D", "E", "F", "G", "A", "B"];
        const midiRef = 60;
        const yRef_rel = staffPositions_rel.C4;
        diatonicNoteYPositions = {};
        let minY_rel = Infinity,
            maxY_rel = -Infinity;
        for (let midi = MIDI_NOTE_MIN; midi <= MIDI_NOTE_MAX; midi++) {
            const octave = Math.floor(midi / 12) - 1;
            const noteIndex = midi % 12;
            const diatonicDegree = midiToDiatonicDegree[noteIndex];
            const referenceOctave = Math.floor(midiRef / 12) - 1;
            const octaveDifference = octave - referenceOctave;
            const stepsFromRefDegree = diatonicDegree - midiToDiatonicDegree[midiRef % 12];
            const totalDiatonicSteps = octaveDifference * 7 + stepsFromRefDegree;
            const yPos_rel = yRef_rel - (totalDiatonicSteps * HALF_LINE_SPACING);
            const baseNoteLetter = noteNames[diatonicDegree];
            const baseNoteName = baseNoteLetter + octave;
            if (!(baseNoteName in diatonicNoteYPositions)) {
                diatonicNoteYPositions[baseNoteName] = yPos_rel;
                minY_rel = Math.min(minY_rel, yPos_rel);
                maxY_rel = Math.max(maxY_rel, yPos_rel);
            }
        }
        const noteHeight = LINE_SPACING;
        const topNoteEdgeY_rel = minY_rel - (noteHeight / 2);
        const bottomNoteEdgeY_rel = maxY_rel + (noteHeight / 2);
        totalStaffLogicalHeight = (bottomNoteEdgeY_rel - topNoteEdgeY_rel) + (STAFF_PADDING * 2);
        totalStaffLogicalHeight = Math.max(100, totalStaffLogicalHeight);
        const yOffset = STAFF_PADDING - topNoteEdgeY_rel;
        for (const key in staffPositions_rel) {
            staffPositions[key] = staffPositions_rel[key] + yOffset;
        }
        for (const key in diatonicNoteYPositions) {
            diatonicNoteYPositions[key] += yOffset;
        }
        // console.log(`Staff: Precise Total Staff Logical Height Calculated: ${totalStaffLogicalHeight.toFixed(1)}px`);
    }
    setupStaffAndNotes();

    // Data & State...
    let noteMap = null,
        notesToDraw = [],
        songEndTimeVisual = 0;
    let isStaffRunning = false,
        animationFrameId = null,
        displayTime = 0;
    let isDragging = false,
        dragStartX = 0,
        dragStartTime = 0,
        activeFlashes = [];

    // Helper Functions...
    function getNoteYPosition(noteName) {
        /* ... unchanged ... */
        const baseNameMatch = noteName.match(/([A-G])[#b]?(\d)/);
        if (baseNameMatch) {
            const baseName = baseNameMatch[1] + baseNameMatch[2];
            return diatonicNoteYPositions[baseName] ?? null;
        } else {
            console.warn(`Staff: Could not parse base note name from: "${noteName}"`);
            return null;
        }
    }

    function getPitchClass(noteName) {
        /* ... unchanged ... */
        const match = noteName.match(/([A-G][#b]?)/);
        if (match) {
            let pc = match[1];
            if (pc === "C#") pc = "Db";
            if (pc === "D#") pc = "Eb";
            if (pc === "F#") pc = "Gb";
            if (pc === "G#") pc = "Ab";
            if (pc === "A#") pc = "Bb";
            return pc;
        }
        return null;
    }

    // --- Drawing Functions ---
    // These now correctly use module-scoped variables where appropriate
    // and access outer-scoped variables from main.js (like useColoredNotes)
    // or use imported functions (getMidiNoteColor, audio.*)
    function drawStaffLine(y) {
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.lineWidth = STAFF_LINE_WIDTH;
        ctx.strokeStyle = STAFF_LINE_COLOR;
        ctx.stroke();
    }

    function drawGrandStaff() {
        /* ... unchanged ... */
        drawStaffLine(staffPositions.E4);
        drawStaffLine(staffPositions.G4);
        drawStaffLine(staffPositions.B4);
        drawStaffLine(staffPositions.D5);
        drawStaffLine(staffPositions.F5);
        drawStaffLine(staffPositions.G2);
        drawStaffLine(staffPositions.B2);
        drawStaffLine(staffPositions.D3);
        drawStaffLine(staffPositions.F3);
        drawStaffLine(staffPositions.A3);
    }

    function drawRoundedRect(x, y, width, height, radius) {
        if (!ctx) return;
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        if (width <= 0 || height <= 0) return;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
        ctx.fill();
    }

    function drawLedgerLines(note, x, noteWidth) {
        /* ... unchanged ... */
        const y = note.y;
        if (y === null || !ctx) return;
        const checkTolerance = HALF_LINE_SPACING / 2;
        ctx.lineWidth = LEDGER_LINE_WIDTH;
        ctx.strokeStyle = STAFF_LINE_COLOR;
        const ledgerXStart = x - LEDGER_LINE_EXTENSION;
        const ledgerXEnd = x + noteWidth + LEDGER_LINE_EXTENSION;
        if (y < staffPositions.F5 - checkTolerance) {
            for (let lineY = staffPositions.F5 - LINE_SPACING; lineY >= y - checkTolerance; lineY -= LINE_SPACING) {
                ctx.beginPath();
                ctx.moveTo(ledgerXStart, lineY);
                ctx.lineTo(ledgerXEnd, lineY);
                ctx.stroke();
            }
        }
        if (Math.abs(y - staffPositions.C4) < checkTolerance) {
            ctx.beginPath();
            ctx.moveTo(ledgerXStart, staffPositions.C4);
            ctx.lineTo(ledgerXEnd, staffPositions.C4);
            ctx.stroke();
        }
        if (y > staffPositions.G2 + checkTolerance) {
            for (let lineY = staffPositions.G2 + LINE_SPACING; lineY <= y + checkTolerance; lineY += LINE_SPACING) {
                ctx.beginPath();
                ctx.moveTo(ledgerXStart, lineY);
                ctx.lineTo(ledgerXEnd, lineY);
                ctx.stroke();
            }
        }
    }

    function drawAccidental(note, x) {
        /* ... unchanged ... */
        const accidental = note.name.includes('#') ? '♯' : note.name.includes('b') ? '♭' : null;
        if (accidental && note.y !== null && ctx) {
            ctx.fillStyle = useColoredNotes ? ACCIDENTAL_COLOR_COLOR_NOTES : ACCIDENTAL_COLOR_BLACK_NOTES;
            ctx.font = `${ACCIDENTAL_FONT_SIZE}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const accidentalX = x + ACCIDENTAL_PADDING_X;
            const accidentalY = note.y;
            ctx.fillText(accidental, accidentalX, accidentalY);
        }
    }

    function drawNote(note, currentDisplayTime) {
        /* ... uses imported getMidiNoteColor ... */
        if (note.hitStatus === 'good' || note.hitStatus === 'perfect') return;
        if (note.y === null || note.y === undefined || !ctx) return;
        const noteY = note.y;
        const timeUntilJudgment = note.time - currentDisplayTime;
        const noteX = judgmentLineX + (timeUntilJudgment * SCROLL_SPEED_PIXELS_PER_SECOND);
        const noteWidth = Math.max(1, note.duration * SCROLL_SPEED_PIXELS_PER_SECOND);
        const noteHeight = LINE_SPACING;
        let currentNoteColor = NOTE_COLOR;
        if (useColoredNotes) {
            if (typeof getMidiNoteColor === 'function') {
                try {
                    const rgbArray = getMidiNoteColor(note.midi);
                    if (rgbArray && rgbArray.length === 3) {
                        currentNoteColor = `rgb(${rgbArray[0]}, ${rgbArray[1]}, ${rgbArray[2]})`;
                    } else {
                        currentNoteColor = NOTE_COLOR;
                    }
                } catch (e) {
                    console.error(`Staff: Error calling getMidiNoteColor:`, e);
                    currentNoteColor = NOTE_COLOR;
                }
            } else {
                currentNoteColor = NOTE_COLOR;
            }
        }
        if (noteX < canvasWidth && (noteX + noteWidth) > 0) {
            drawLedgerLines(note, noteX, noteWidth);
            ctx.fillStyle = currentNoteColor;
            drawRoundedRect(noteX, noteY - noteHeight / 2, noteWidth, noteHeight, NOTE_CORNER_RADIUS);
            drawAccidental(note, noteX);
        }
    }

    function drawJudgmentLine() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(judgmentLineX, 0);
        ctx.lineTo(judgmentLineX, canvasHeight);
        ctx.lineWidth = JUDGMENT_LINE_WIDTH;
        ctx.strokeStyle = JUDGMENT_LINE_COLOR;
        ctx.stroke();
    }

    function drawFlashes(currentDisplayTime) {
        /* ... uses imported audio.getCurrentContextTime ... */
        if (activeFlashes.length === 0 || !ctx || !audio) return;
        ctx.fillStyle = PERFECT_FLASH_COLOR;
        const flashHeight = LINE_SPACING * 1.5;
        const flashWidth = 10;
        const flashEndTimeContext = audio.getCurrentContextTime();
        for (let i = activeFlashes.length - 1; i >= 0; i--) {
            const flash = activeFlashes[i];
            if (flashEndTimeContext >= flash.endTime) {
                activeFlashes.splice(i, 1);
            } else {
                drawRoundedRect(judgmentLineX - flashWidth / 2, flash.y - flashHeight / 2, flashWidth, flashHeight, flashWidth / 2);
            }
        }
    }

    function redrawCanvas() {
        /* ... uses imported audio.getPlaybackTime ... */
        if (!ctx || !audio) {
            console.warn("redrawCanvas skipped: no ctx or audio module.");
            return;
        }
        displayTime = audio.getPlaybackTime();
        displayTime = Math.max(MIN_DISPLAY_TIME, displayTime);
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(devicePixelRatio, devicePixelRatio);
        drawGrandStaff();
        drawJudgmentLine();
        if (notesToDraw.length > 0) {
            notesToDraw.forEach(note => drawNote(note, displayTime));
        } else {
            ctx.fillStyle = '#888';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(noteMap ? 'No notes found in track' : 'Loading notes...', canvasWidth / 2, canvasHeight / 2);
        }
        drawFlashes(displayTime);
        ctx.restore();
    }

    // --- Animation Loop ---
    function animationLoop() {
        /* ... uses outer scope isGameOver, HIT_WINDOW_GOOD_SEC, applyScore ... */
        if (!isStaffRunning || isGameOver) {
            animationFrameId = null;
            return;
        }
        const missThresholdTime = displayTime - HIT_WINDOW_GOOD_SEC;
        notesToDraw.forEach(note => {
            if (!note.hitStatus && note.time < missThresholdTime) {
                note.hitStatus = 'miss';
                applyScore('miss');
            }
        });
        redrawCanvas();
        animationFrameId = requestAnimationFrame(animationLoop);
    }

    // --- Judgment Logic ---
    function judgeKeyPress(keyName) {
        /* ... uses outer scope isStaffRunning, isGameOver, HIT_WINDOW_GOOD_SEC, HIT_WINDOW_PERFECT_SEC, applyScore and imported audio ... */
        if (!isStaffRunning || isGameOver || !audio) return null;
        const currentJudgmentTime = displayTime;
        let hitResult = null;
        let bestNote = null;
        let minTimeDiff = Infinity;
        for (const note of notesToDraw) {
            if (note.hitStatus) continue;
            const timeDiff = note.time - currentJudgmentTime;
            const absTimeDiff = Math.abs(timeDiff);
            if (absTimeDiff <= HIT_WINDOW_GOOD_SEC) {
                const notePitchClass = getPitchClass(note.name);
                if (notePitchClass === keyName) {
                    if (absTimeDiff < minTimeDiff) {
                        minTimeDiff = absTimeDiff;
                        bestNote = note;
                    }
                }
            }
        }
        if (bestNote) {
            const flashEndTimeContext = audio.getCurrentContextTime() + PERFECT_FLASH_DURATION_MS / 1000.0;
            if (minTimeDiff <= HIT_WINDOW_PERFECT_SEC) {
                bestNote.hitStatus = 'perfect';
                hitResult = 'perfect';
                activeFlashes.push({
                    y: bestNote.y,
                    endTime: flashEndTimeContext
                });
                applyScore('perfect');
            } else {
                bestNote.hitStatus = 'good';
                hitResult = 'good';
                applyScore('good');
            }
        }
        return hitResult;
    }

    // --- Control Functions ---
    function playAnimationInternal(resumeOffset = 0) {
        /* ... uses outer scope isStaffRunning, isGameOver, PRE_DELAY_SECONDS and imported audio ... */
        if (!isStaffRunning && !isGameOver && audio && audio.isReady()) {
            console.log(`Staff: Playing animation, offset: ${resumeOffset.toFixed(3)}`);
            isStaffRunning = true;
            if (canvas) canvas.style.cursor = 'default';
            audio.play(resumeOffset, PRE_DELAY_SECONDS);
            if (!animationFrameId) {
                animationFrameId = requestAnimationFrame(animationLoop);
            }
        } else {
            console.warn("Staff: Cannot play.");
        }
    }

    function pauseAnimationInternal() {
        /* ... uses outer scope isStaffRunning and imported audio ... */
        if (isStaffRunning) {
            console.log("Staff: Pausing animation...");
            isStaffRunning = false;
            if (canvas) canvas.style.cursor = 'grab';
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            return audio ? audio.pause() : 0;
        }
        return audio ? audio.getPlaybackTime() : 0;
    }

    function resetNotesInternal() {
        console.log("Staff: Resetting notes.");
        notesToDraw.forEach(note => note.hitStatus = null);
        activeFlashes = [];
    }

    function resetTimeInternal() {
        console.log("Staff: Resetting time.");
        displayTime = 0;
    }

    // --- Event Handlers ---
    function handleResize() {
        /* ... uses outer scope staffSection ... */
        if (!staffSection || !canvas) return;
        const displayWidth = staffSection.offsetWidth;
        const displayHeight = staffSection.offsetHeight;
        if (displayWidth <= 0 || displayHeight <= 0) return;
        canvasWidth = displayWidth;
        canvasHeight = Math.min(displayHeight, totalStaffLogicalHeight);
        canvas.width = Math.round(canvasWidth * devicePixelRatio);
        canvas.height = Math.round(canvasHeight * devicePixelRatio);
        canvas.style.width = `${canvasWidth}px`;
        canvas.style.height = `${canvasHeight}px`;
        judgmentLineX = canvasWidth * (JUDGMENT_LINE_X_PERCENT / 100);
        redrawCanvas();
    }

    function getEventX(event) {
        return event.touches ? event.touches[0].clientX : event.clientX;
    }

    function handleDragStart(event) {
        /* ... uses outer scope isStaffRunning, isGameOver ... */
        if (!isStaffRunning && !isGameOver && canvas) {
            isDragging = true;
            dragStartX = getEventX(event) - canvas.getBoundingClientRect().left;
            dragStartTime = displayTime;
            canvas.classList.add('dragging');
            if (event.target === canvas) {
                event.preventDefault();
            }
        }
    }

    function handleDragMove(event) {
        /* ... uses outer scope SCROLL_SPEED_PIXELS_PER_SECOND ... */
        if (isDragging && canvas) {
            const currentX = getEventX(event) - canvas.getBoundingClientRect().left;
            const deltaX = currentX - dragStartX;
            const deltaTimeOffset = deltaX / SCROLL_SPEED_PIXELS_PER_SECOND;
            displayTime = Math.max(MIN_DISPLAY_TIME, dragStartTime - deltaTimeOffset);
            redrawCanvas();
            if (event.target === canvas) {
                event.preventDefault();
            }
        }
    }

    function handleDragEnd(event) {
        /* ... uses outer scope audioPauseOffset ... */
        if (isDragging && canvas) {
            isDragging = false;
            canvas.classList.remove('dragging');
            audioPauseOffset = Math.max(0, displayTime);
            console.log(`Staff: Drag ended. New audio offset: ${audioPauseOffset.toFixed(3)}`);
            if (event.target === canvas) {
                event.preventDefault();
            }
        }
    }

    // --- Initialization ---
    function loadNoteData(jsonData) {
        /* ... uses outer scope totalNotesInSong ... */
        // console.log(`Staff: Processing note data...`);
        try {
            noteMap = jsonData;
            if (noteMap?.tracks?.[0]?.notes) {
                const rawNotes = noteMap.tracks[0].notes;
                totalNotesInSong = rawNotes.length;
                let lastNoteEndTime = 0;
                notesToDraw = rawNotes.map(note => {
                    const yPos = getNoteYPosition(note.name);
                    const noteEndTime = note.time + note.duration;
                    if (noteEndTime > lastNoteEndTime) lastNoteEndTime = noteEndTime;
                    return {
                        ...note,
                        y: yPos,
                        hitStatus: null
                    };
                }).filter(note => note.y !== null);
                songEndTimeVisual = lastNoteEndTime + SONG_END_BUFFER_SEC;
                console.log(`Staff: Processed <span class="math-inline">\{notesToDraw\.length\}/</span>{rawNotes.length} notes. Visual end: ${songEndTimeVisual.toFixed(3)}s`);
                notesToDraw.sort((a, b) => a.time - b.time);
            } else {
                console.error("Staff Error: Invalid note data format.");
                notesToDraw = [];
                totalNotesInSong = 0;
                songEndTimeVisual = 0;
                redrawCanvas();
                return false;
            }
            return true;
        } catch (error) {
            console.error("Staff: Error processing note data:", error);
            alert("Error processing notes file.");
            notesToDraw = [];
            totalNotesInSong = 0;
            songEndTimeVisual = 0;
            redrawCanvas();
            return false;
        }
    }

    function init(noteDataJson) {
        /* ... uses outer scope staffSection and imported getMidiNoteColor... */
        // console.log("Staff Module: init() called (within main.js)...");
        canvas = document.getElementById('staffCanvas');
        if (!canvas || !staffSection) {
            console.error("Staff Error: Canvas or staffSection not found!");
            return false;
        }
        ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error("Staff Error: Could not get 2D context!");
            return false;
        }
        devicePixelRatio = window.devicePixelRatio || 1;
        if (typeof getMidiNoteColor !== 'function') console.error("Staff CRITICAL: getMidiNoteColor import failed?");
        const notesLoaded = loadNoteData(noteDataJson);
        if (!notesLoaded) return false;
        handleResize();
        displayTime = 0;
        redrawCanvas();
        canvas.addEventListener('mousedown', handleDragStart);
        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('mouseup', handleDragEnd);
        canvas.addEventListener('touchstart', handleDragStart, {
            passive: false
        });
        window.addEventListener('touchmove', handleDragMove, {
            passive: false
        });
        window.addEventListener('touchend', handleDragEnd);
        window.addEventListener('touchcancel', handleDragEnd);
        console.log("Staff Module: Initialization complete (within main.js).");
        return true;
    }

    // --- Public Interface ---
    return {
        init,
        handleResize,
        play: playAnimationInternal,
        pause: pauseAnimationInternal,
        redraw: redrawCanvas,
        isRunning: () => isStaffRunning,
        judgeKeyPress: judgeKeyPress,
        resetNotes: resetNotesInternal,
        resetTime: resetTimeInternal
    };

})(); // End of staffModule IIFE


// --- Scoring & Game Logic Functions ---
// To be moved later...

/** Calculates the combo bonus energy. */
function calculateComboBonus(currentCombo) {
    /* ... unchanged ... */
    if (currentCombo < 10) return 0;
    return Math.floor((currentCombo - 1) / 10);
}
/** Applies scoring changes based on hit type. */
function applyScore(hitType) {
    /* ... unchanged ... */
    if (isGameOver) return;
    let baseEnergyChange = 0;
    let comboBroken = false;
    if (hitType === 'perfect') {
        perfectCount++;
        comboCount++;
        baseEnergyChange = ENERGY_PERFECT;
    } else if (hitType === 'good') {
        goodCount++;
        comboCount++;
        baseEnergyChange = ENERGY_GOOD;
    } else if (hitType === 'miss') {
        missCount++;
        comboBroken = true;
        baseEnergyChange = ENERGY_MISS;
    }
    if (comboCount > maxCombo) maxCombo = comboCount;
    const comboBonus = comboBroken ? 0 : calculateComboBonus(comboCount);
    const totalEnergyChange = baseEnergyChange + comboBonus;
    const previousHealth = playerHealth;
    playerHealth = Math.max(MIN_HEALTH, Math.min(MAX_HEALTH, playerHealth + totalEnergyChange));
    const actualHealthChange = playerHealth - previousHealth;
    totalScore += totalEnergyChange;
    if (comboBroken) {
        if (comboCount > 0) {
            console.log(`Combo Broken! Was: ${comboCount}`);
            comboCount = 0;
        }
    }
    console.log(`Score Event: ${hitType.toUpperCase()} | Combo: ${comboCount} (Max: ${maxCombo}) | Health Change: ${actualHealthChange} (Raw: ${totalEnergyChange}) | Health: <span class="math-inline">\{playerHealth\}/</span>{MAX_HEALTH} | Score: <span class="math-inline">\{totalScore\} \| P\:</span>{perfectCount} G:<span class="math-inline">\{goodCount\} M\:</span>{missCount}`);
    updateInfoUI();
    if (playerHealth <= MIN_HEALTH && !isGameOver) {
        if (!noDeathMode) {
            triggerGameOver(false);
        } else {
            console.log("Health reached zero, but No Death Mode is active.");
        }
    }
}
/** Handles the game over state or song completion. */
// Export needed by audio.js callback
export function triggerGameOver(songFinished) {
    /* ... uses imported audio ... */
    if (isGameOver) return;
    console.log(songFinished ? "--- SONG FINISHED ---" : "--- GAME OVER ---");
    isGameOver = true;
    gameIsRunning = false;
    if (audio) audio.pause();
    if (staffModule && staffModule.isRunning()) {
        staffModule.pause();
    }
    if (playPauseButton) {
        playPauseButton.textContent = songFinished ? "Finished" : "Game Over";
        playPauseButton.disabled = true;
    }
    if (settingsButton) settingsButton.disabled = true;
    showScoreScreen();
}
/** Resets the game state for a new game. */
function restartGame() {
    /* ... uses imported audio ... */
    console.log("--- Restarting Game ---");
    if (scoreOverlay) scoreOverlay.classList.remove('visible');
    playerHealth = INITIAL_HEALTH;
    comboCount = 0;
    totalScore = 0;
    perfectCount = 0;
    goodCount = 0;
    missCount = 0;
    maxCombo = 0;
    isGameOver = false;
    gameIsRunning = false;
    audioPauseOffset = 0;
    if (audio) audio.stop();
    if (staffModule) {
        staffModule.resetNotes();
        staffModule.resetTime();
        staffModule.pause();
        staffModule.redraw();
    }
    updateInfoUI();
    if (playPauseButton) {
        playPauseButton.textContent = "Play";
        playPauseButton.disabled = false;
    }
    if (settingsButton) settingsButton.disabled = false;
    console.log("Game state reset.");
}

// --- UI Update Functions ---
// To be moved later...

/** Updates the health bar and combo display. */
function updateInfoUI() {
    /* ... unchanged ... */
    if (comboCountSpan) comboCountSpan.textContent = comboCount;
    if (healthBarElement) {
        const healthPercentage = Math.max(0, Math.min(100, (playerHealth / MAX_HEALTH) * 100));
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
    }
}
/** Updates the displayed values in the settings panel. */
function updateSettingsUI() {
    /* ... unchanged ... */
    updateTimingWindows();
    if (staffScaleValueSpan) staffScaleValueSpan.textContent = SCROLL_SPEED_PIXELS_PER_SECOND;
    if (hitWindowValueSpan) hitWindowValueSpan.textContent = HIT_WINDOW_GOOD_MS;
    if (colorToggleSwitch) colorToggleSwitch.checked = useColoredNotes;
    if (noDeathToggleSwitch) noDeathToggleSwitch.checked = noDeathMode;
    console.log("Settings UI updated.");
}
/** Calculates and displays the final score screen. */
function showScoreScreen() {
    /* ... unchanged ... */
    if (!scoreOverlay) return;
    const processedNotes = perfectCount + goodCount + missCount;
    const totalNotes = totalNotesInSong > 0 ? totalNotesInSong : processedNotes;
    const perfectPercent = totalNotes > 0 ? ((perfectCount / totalNotes) * 100).toFixed(1) : 0;
    const goodPercent = totalNotes > 0 ? ((goodCount / totalNotes) * 100).toFixed(1) : 0;
    const missPercent = totalNotes > 0 ? ((missCount / totalNotes) * 100).toFixed(1) : 0;
    if (scorePerfectCount) scorePerfectCount.textContent = perfectCount;
    if (scorePerfectPercent) scorePerfectPercent.textContent = perfectPercent;
    if (scoreGoodCount) scoreGoodCount.textContent = goodCount;
    if (scoreGoodPercent) scoreGoodPercent.textContent = goodPercent;
    if (scoreMissCount) scoreMissCount.textContent = missCount;
    if (scoreMissPercent) scoreMissPercent.textContent = missPercent;
    if (scoreMaxCombo) scoreMaxCombo.textContent = maxCombo;
    if (scoreTotalScore) scoreTotalScore.textContent = totalScore;
    scoreOverlay.classList.add('visible');
    console.log("Score screen displayed.");
}


// --- Layout & Timing Functions ---
// To be moved later...

/** Handles layout adjustments on orientation change or resize. */
function handleLayoutChange() {
    /* ... unchanged ... */
    if (!gameContainer || !infoSection || !staffSection || !bottomPanel || !keyboardSection) {
        console.error("Layout Error: Essential containers not found.");
        return;
    }
    const orientation = window.matchMedia("(orientation: landscape)").matches ? 'landscape' : 'portrait';
    if (orientation === 'landscape') {
        if (infoSection.parentElement !== bottomPanel) {
            bottomPanel.insertBefore(infoSection, keyboardSection);
        }
    } else {
        if (infoSection.parentElement === bottomPanel) {
            gameContainer.insertBefore(infoSection, staffSection);
        }
    }
    if (staffModule && typeof staffModule.handleResize === 'function') {
        setTimeout(staffModule.handleResize, 50);
    } else {
        console.warn("Could not trigger staff resize.");
    }
}
/** Recalculates derived timing variables. */
function updateTimingWindows() {
    /* ... unchanged ... */
    HIT_WINDOW_PERFECT_MS = Math.floor(HIT_WINDOW_GOOD_MS / 2);
    HIT_WINDOW_GOOD_SEC = HIT_WINDOW_GOOD_MS / 1000.0;
    HIT_WINDOW_PERFECT_SEC = HIT_WINDOW_PERFECT_MS / 1000.0;
    console.log(`Timing windows updated: Good=<span class="math-inline">\{HIT\_WINDOW\_GOOD\_MS\}ms \(</span>{HIT_WINDOW_GOOD_SEC.toFixed(3)}s), Perfect=<span class="math-inline">\{HIT\_WINDOW\_PERFECT\_MS\}ms \(</span>{HIT_WINDOW_PERFECT_SEC.toFixed(3)}s)`);
}


// --- Game Initialization ---

/** Initializes all game modules and sets up event listeners AFTER files are loaded. */
async function initializeGame(loadedAudioBuffer, loadedNoteData) {
    if (gameInitialized) {
        console.warn("Game already initialized. Skipping.");
        return;
    }
    console.log("--- Initializing Keytap Game ---");
    if (loadingStatus) loadingStatus.textContent = "Initializing audio...";

    // 1. Initialize Audio Module (using imported module)
    const handleSongEnd = () => {
        if (!isGameOver) {
            triggerGameOver(true);
        }
    };
    const audioInitialized = await audio.init(loadedAudioBuffer, handleSongEnd);
    if (!audioInitialized) {
        console.error("Audio module initialization failed.");
        if (loadingStatus) loadingStatus.textContent = "Error: Failed to decode audio.";
        if (startButton) startButton.disabled = false;
        return;
    }

    if (loadingStatus) loadingStatus.textContent = "Initializing visuals...";

    // 2. Initialize Staff Module (still defined locally in this file)
    const staffInitialized = staffModule.init(loadedNoteData);
    if (!staffInitialized) {
        console.error("Staff module initialization failed.");
        if (loadingStatus) loadingStatus.textContent = "Error: Failed to process notes file.";
        return;
    }

    // 3. Initialize Keyboard Module
    // Use imported initKeyboard function
    initKeyboard({
        judgeKeyPressFunc: staffModule.judgeKeyPress, // Get function from staff module
        isGameOverFunc: () => isGameOver, // Pass function to get game over state
        isGameRunningFunc: () => gameIsRunning, // Pass function to get running state
        // resumeAudioContextFunc is no longer needed here, keyboard imports it directly
    });

    // 4. Set initial UI states
    updateInfoUI();
    updateSettingsUI(); // Calls updateTimingWindows

    // 5. Set initial layout
    handleLayoutChange();

    // 6. Add Global Event Listeners ---
    setupGlobalEventListeners(); // Encapsulate listener setup

    gameInitialized = true;
    console.log("--- Keytap Game Initialization Complete ---");
    if (loadingStatus) loadingStatus.textContent = "Ready!";
}

/** Sets up global event listeners for buttons, settings, etc. */
function setupGlobalEventListeners() {
    console.log("Setting up global event listeners...");

    // Play/Pause Button
    if (playPauseButton && staffModule && audio) {
        playPauseButton.addEventListener('click', () => {
            /* ... unchanged ... */
            if (isGameOver) return;
            audio.resumeContext().then(() => {
                if (gameIsRunning) {
                    audioPauseOffset = staffModule.pause();
                    playPauseButton.textContent = "Play";
                    gameIsRunning = false;
                    console.log(`Game Paused. Offset: ${audioPauseOffset.toFixed(3)}`);
                } else {
                    staffModule.play(audioPauseOffset);
                    playPauseButton.textContent = "Pause";
                    gameIsRunning = true;
                    console.log(`Game Playing. Offset: ${audioPauseOffset.toFixed(3)}`);
                }
            }).catch(e => console.error("Failed to resume AudioContext on play/pause:", e));
        });
    } else {
        console.warn("Play/Pause button or required modules not found.");
    }

    // Settings Button
    if (settingsButton && settingsOverlay && staffModule && audio) {
        settingsButton.addEventListener('click', () => {
            /* ... unchanged ... */
            if (isGameOver) return;
            console.log("Settings button clicked.");
            if (gameIsRunning) {
                audioPauseOffset = staffModule.pause();
                playPauseButton.textContent = "Play";
                gameIsRunning = false;
                console.log("Paused game for settings.");
            }
            updateSettingsUI();
            settingsOverlay.classList.add('visible');
        });
    } else {
        console.warn("Settings button or required elements/modules not found.");
    }

    // Close Settings Button
    if (closeSettingsButton && settingsOverlay) {
        closeSettingsButton.addEventListener('click', () => {
            /* ... unchanged ... */
            settingsOverlay.classList.remove('visible');
            console.log("Settings overlay closed.");
            if (!gameIsRunning && staffModule) {
                staffModule.redraw();
            }
        });
    } else {
        console.warn("Close Settings button or overlay not found.");
    }

    // Settings: Color Toggle Switch
    if (colorToggleSwitch && staffModule) {
        colorToggleSwitch.addEventListener('change', (event) => {
            /* ... unchanged ... */
            useColoredNotes = event.target.checked;
            console.log(`Color notes setting changed: ${useColoredNotes}`);
            staffModule.redraw();
        });
    } else {
        console.warn("Color toggle switch or staff module not found.");
    }

    // Settings: No Death Mode Toggle Switch
    if (noDeathToggleSwitch) {
        noDeathToggleSwitch.addEventListener('change', (event) => {
            /* ... unchanged ... */
            noDeathMode = event.target.checked;
            console.log(`No Death Mode setting changed: ${noDeathMode}`);
        });
    } else {
        console.warn("No Death toggle switch not found.");
    }

    // Settings: Staff Scale Adjustment
    const STAFF_SCALE_STEP = 10;
    const STAFF_SCALE_MIN = 50;
    const STAFF_SCALE_MAX = 200;
    if (staffScaleDownButton && staffScaleUpButton && staffModule) {
        staffScaleDownButton.addEventListener('click', () => {
            SCROLL_SPEED_PIXELS_PER_SECOND = Math.max(STAFF_SCALE_MIN, SCROLL_SPEED_PIXELS_PER_SECOND - STAFF_SCALE_STEP);
            updateSettingsUI();
            staffModule.redraw();
        });
        staffScaleUpButton.addEventListener('click', () => {
            SCROLL_SPEED_PIXELS_PER_SECOND = Math.min(STAFF_SCALE_MAX, SCROLL_SPEED_PIXELS_PER_SECOND + STAFF_SCALE_STEP);
            updateSettingsUI();
            staffModule.redraw();
        });
    } else {
        console.warn("Staff scale buttons or staff module not found.");
    }

    // Settings: Hit Window Adjustment
    const HIT_WINDOW_STEP = 5;
    const HIT_WINDOW_MIN = 30;
    const HIT_WINDOW_MAX = 200;
    if (hitWindowDownButton && hitWindowUpButton) {
        hitWindowDownButton.addEventListener('click', () => {
            HIT_WINDOW_GOOD_MS = Math.max(HIT_WINDOW_MIN, HIT_WINDOW_GOOD_MS - HIT_WINDOW_STEP);
            updateSettingsUI();
        });
        hitWindowUpButton.addEventListener('click', () => {
            HIT_WINDOW_GOOD_MS = Math.min(HIT_WINDOW_MAX, HIT_WINDOW_GOOD_MS + HIT_WINDOW_STEP);
            updateSettingsUI();
        });
    } else {
        console.warn("Hit window buttons not found.");
    }

    // Score Screen: Restart Button
    if (restartButton) {
        restartButton.addEventListener('click', restartGame);
    } else {
        console.warn("Restart button not found.");
    }

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
// Stays in main.js as it orchestrates the start

/** Checks if both files are loaded and updates the start button state. */
function checkFilesLoaded() {
    /* ... unchanged ... */
    if (!startButton) return;
    if (audioFileLoaded && notesFileLoaded) {
        loadingStatus.textContent = "Files loaded. Ready to start!";
        startButton.disabled = false;
        console.log("Both files loaded.");
    } else {
        startButton.disabled = true;
        if (!loadingStatus) return;
        if (!audioFileLoaded && !notesFileLoaded) loadingStatus.textContent = "Please select both files.";
        else if (!audioFileLoaded) loadingStatus.textContent = "Please select an MP3 audio file.";
        else loadingStatus.textContent = "Please select a JSON notes file.";
    }
}
/** Handles audio file selection. */
function handleAudioFileSelect(event) {
    /* ... unchanged ... */
    const file = event.target.files[0];
    if (!file) {
        audioFileLoaded = false;
        audioFileBuffer = null;
        checkFilesLoaded();
        return;
    }
    if (!file.type.startsWith('audio/mpeg') && !file.name.toLowerCase().endsWith('.mp3')) {
        alert("Invalid audio file type. MP3 only.");
        event.target.value = '';
        audioFileLoaded = false;
        audioFileBuffer = null;
        checkFilesLoaded();
        return;
    }
    if (loadingStatus) loadingStatus.textContent = "Loading audio...";
    if (startButton) startButton.disabled = true;
    const reader = new FileReader();
    reader.onload = (e) => {
        audioFileBuffer = e.target.result;
        audioFileLoaded = true;
        console.log("Audio file loaded.");
        checkFilesLoaded();
    };
    reader.onerror = (e) => {
        console.error("Error reading audio file:", e);
        alert("Error reading audio file.");
        audioFileLoaded = false;
        audioFileBuffer = null;
        checkFilesLoaded();
    };
    reader.readAsArrayBuffer(file);
}
/** Handles notes file selection. */
function handleNotesFileSelect(event) {
    /* ... unchanged ... */
    const file = event.target.files[0];
    if (!file) {
        notesFileLoaded = false;
        notesJsonData = null;
        checkFilesLoaded();
        return;
    }
    if (!file.type.startsWith('application/json') && !file.name.toLowerCase().endsWith('.json')) {
        alert("Invalid notes file type. JSON only.");
        event.target.value = '';
        notesFileLoaded = false;
        notesJsonData = null;
        checkFilesLoaded();
        return;
    }
    if (loadingStatus) loadingStatus.textContent = "Loading notes...";
    if (startButton) startButton.disabled = true;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            notesJsonData = JSON.parse(e.target.result);
            if (!notesJsonData?.tracks?.length) {
                throw new Error("Invalid JSON: Missing 'tracks' array.");
            }
            notesFileLoaded = true;
            console.log("Notes file loaded.");
            checkFilesLoaded();
        } catch (error) {
            console.error("Error parsing JSON file:", error);
            alert(`Error parsing JSON file: ${error.message}`);
            notesFileLoaded = false;
            notesJsonData = null;
            checkFilesLoaded();
        }
    };
    reader.onerror = (e) => {
        console.error("Error reading notes file:", e);
        alert("Error reading notes file.");
        notesFileLoaded = false;
        notesJsonData = null;
        checkFilesLoaded();
    };
    reader.readAsText(file);
}


// --- Entry Point ---
// Runs once the HTML document is fully loaded
window.addEventListener('load', () => {
    console.log("Window loaded. Setting up main script.");

    // Assign Global DOM Elements
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

    // Check essential elements
    if (!loadingScreen || !startButton || !gameContainer) {
        console.error("CRITICAL: Essential elements not found!");
        alert("Error: Could not initialize interface.");
        return;
    }

    // Attach file input listeners
    if (audioFileInput) audioFileInput.addEventListener('change', handleAudioFileSelect);
    if (notesFileInput) notesFileInput.addEventListener('change', handleNotesFileSelect);

    // Attach start button listener
    startButton.addEventListener('click', async () => {
        if (audioFileLoaded && notesFileLoaded) {
            console.log("Start button clicked.");
            startButton.disabled = true;
            if (loadingStatus) loadingStatus.textContent = "Starting game...";
            loadingScreen.classList.add('hidden');
            gameContainer.classList.add('visible');
            await initializeGame(audioFileBuffer, notesJsonData); // Initialize game
        } else {
            console.warn("Start button clicked but files not ready.");
            checkFilesLoaded();
        }
    });

    // Initial setup
    updateTimingWindows();
    checkFilesLoaded();
    console.log("Main script setup complete. Waiting for file selection.");
});
