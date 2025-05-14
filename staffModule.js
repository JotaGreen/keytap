// staffModule.js

/**
 * @file staffModule.js
 * Handles rendering the scrolling staff, notes, judgment line, visual feedback,
 * timing calculations, and note hit judgment.
 * To be loaded as an ES Module.
 */

console.log("Staff Module: Script loading...");

// --- Module Imports ---
import * as audio from './audioModule.js';
import { getMidiNoteColor } from './midiColorConverter.js';

// Import functions/variables from main.js (or future gameLogic.js/config.js)
// Direct imports for static values:
import {
    isGameOver, // This is a getter function in the new main.js, but here it's used as if it's a direct value.
                 // This will need to be changed to use the callback.
    useColoredNotes, // Same as above.
    PRE_DELAY_SECONDS,
    scrollSpeedPixelsPerSecond,
    hitWindowGoodSec,
    hitWindowPerfectSec
} from './main.js'; // Note: Some of these might become callbacks/getters from main.js

// Placeholder for functions that will be passed from main.js during init
let mainIsWaitModeActive = () => false;
let mainIsCurrentlyWaitingForKey = () => false;
let mainGetWaitingForNote = () => null;
let mainOnWaitModeEnter = (missedNote) => {};
let mainOnWaitModeExit = () => {};
let mainApplyScoreCallback = (hitType) => {}; // Callback to main's applyScore

console.log("Staff Module: Dependencies potentially imported (some will be via init).");


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
const JUDGMENT_LINE_X_PERCENT = 20;
const MIDI_NOTE_MIN = 36;
const MIDI_NOTE_MAX = 84;
const ACCIDENTAL_PADDING_X = 3;
const ACCIDENTAL_FONT_SIZE = LINE_SPACING * 1.2;
const LEDGER_LINE_EXTENSION = 4;
const LEDGER_LINE_WIDTH = 1;
const MIN_DISPLAY_TIME = 0.0;
const PERFECT_FLASH_COLOR = 'rgba(255, 215, 0, 0.7)';
const PERFECT_FLASH_DURATION_MS = 150;
const SONG_END_BUFFER_SEC = 2.0;

// --- DOM Elements & Canvas Context (Assigned in init) ---
let staffSectionElement = null;
let canvas = null;
let ctx = null;
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

// --- Note Data & State ---
let noteMap = null;
let notesToDraw = [];
let totalNotesInSong = 0;
let songEndTimeVisual = 0;

// --- Animation & Interaction State ---
let isStaffRunning = false; // True if staff is actively scrolling due to song playback
let animationFrameId = null;
let displayTime = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartTime = 0;
let activeFlashes = [];
let setAudioPauseOffsetFunc = (offset) => {
    console.warn("Staff Module: setAudioPauseOffsetFunc was not set during init.");
};

// --- Internal Helper Functions ---
function setupStaffAndNotes() {
    console.log("Staff Module (setupStaffAndNotes): Calculating staff geometry and note Y positions...");
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
    let minY_rel = Infinity, maxY_rel = -Infinity;
    for (let midi = MIDI_NOTE_MIN; midi <= MIDI_NOTE_MAX; midi++) {
        const octave = Math.floor(midi / 12) - 1;
        const noteIndex = midi % 12;
        const diatonicDegree = midiToDiatonicDegree[noteIndex];
        const referenceOctave = Math.floor(midiRef / 12) - 1;
        const octaveDifference = octave - referenceOctave;
        const stepsFromRefDegree = diatonicDegree - midiToDiatonicDegree[midiRef % 12];
        const totalDiatonicSteps = (octaveDifference * 7) + stepsFromRefDegree;
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
    for (const key in staffPositions_rel) staffPositions[key] = staffPositions_rel[key] + yOffset;
    for (const key in diatonicNoteYPositions) diatonicNoteYPositions[key] += yOffset;
    console.log(`Staff Module (setupStaffAndNotes): Staff Logical Height: ${totalStaffLogicalHeight.toFixed(1)}px. Positions: ${Object.keys(diatonicNoteYPositions).length}`);
}

function getNoteYPosition(noteName) {
    const baseNameMatch = noteName.match(/([A-G])[#b]?(\d)/);
    if (baseNameMatch) {
        const baseName = baseNameMatch[1] + baseNameMatch[2];
        const yPosition = diatonicNoteYPositions[baseName];
        return yPosition !== undefined ? yPosition : null;
    }
    console.warn(`Staff Module (getNoteYPosition): Could not parse base note name from: "${noteName}"`);
    return null;
}

function getPitchClass(noteName) {
    const match = noteName.match(/([A-G][#b]?)/);
    if (match) {
        let pc = match[1];
        if (pc === "C#") pc = "Db"; if (pc === "D#") pc = "Eb";
        if (pc === "F#") pc = "Gb"; if (pc === "G#") pc = "Ab";
        if (pc === "A#") pc = "Bb";
        return pc;
    }
    console.warn(`Staff Module (getPitchClass): Could not extract pitch class from "${noteName}"`);
    return null;
}

// --- Drawing Functions ---
function drawStaffLine(y) { if (!ctx) return; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasWidth, y); ctx.lineWidth = STAFF_LINE_WIDTH; ctx.strokeStyle = STAFF_LINE_COLOR; ctx.stroke(); }
function drawGrandStaff() {
    if (!ctx || Object.keys(staffPositions).length === 0) return;
    drawStaffLine(staffPositions.E4); drawStaffLine(staffPositions.G4); drawStaffLine(staffPositions.B4); drawStaffLine(staffPositions.D5); drawStaffLine(staffPositions.F5);
    drawStaffLine(staffPositions.G2); drawStaffLine(staffPositions.B2); drawStaffLine(staffPositions.D3); drawStaffLine(staffPositions.F3); drawStaffLine(staffPositions.A3);
}
function drawRoundedRect(x, y, width, height, radius) {
    if (!ctx) return; if (width < 2 * radius) radius = width / 2; if (height < 2 * radius) radius = height / 2; if (width <= 0 || height <= 0) return;
    ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.arcTo(x + width, y, x + width, y + height, radius); ctx.arcTo(x + width, y + height, x, y + height, radius); ctx.arcTo(x, y + height, x, y, radius); ctx.arcTo(x, y, x + width, y, radius); ctx.closePath(); ctx.fill();
}
function drawLedgerLines(note, x, noteWidth) {
    if (!ctx || note.y === null) return;
    const y = note.y; const checkTolerance = HALF_LINE_SPACING / 4;
    ctx.lineWidth = LEDGER_LINE_WIDTH; ctx.strokeStyle = STAFF_LINE_COLOR;
    const ledgerXStart = x - LEDGER_LINE_EXTENSION; const ledgerXEnd = x + noteWidth + LEDGER_LINE_EXTENSION;
    if (y < staffPositions.F5 - checkTolerance) for (let lineY = staffPositions.F5 - LINE_SPACING; lineY >= y - checkTolerance; lineY -= LINE_SPACING) { ctx.beginPath(); ctx.moveTo(ledgerXStart, lineY); ctx.lineTo(ledgerXEnd, lineY); ctx.stroke(); }
    if (Math.abs(y - staffPositions.C4) < checkTolerance) { ctx.beginPath(); ctx.moveTo(ledgerXStart, staffPositions.C4); ctx.lineTo(ledgerXEnd, staffPositions.C4); ctx.stroke(); }
    if (y > staffPositions.G2 + checkTolerance) for (let lineY = staffPositions.G2 + LINE_SPACING; lineY <= y + checkTolerance; lineY += LINE_SPACING) { ctx.beginPath(); ctx.moveTo(ledgerXStart, lineY); ctx.lineTo(ledgerXEnd, lineY); ctx.stroke(); }
}
function drawAccidental(note, x) {
    if (!ctx || note.y === null) return;
    const accidentalSymbol = note.name.includes('#') ? '♯' : note.name.includes('b') ? '♭' : null;
    if (accidentalSymbol) {
        ctx.fillStyle = useColoredNotes() ? ACCIDENTAL_COLOR_COLOR_NOTES : ACCIDENTAL_COLOR_BLACK_NOTES; // Use callback
        ctx.font = `${ACCIDENTAL_FONT_SIZE}px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(accidentalSymbol, x + ACCIDENTAL_PADDING_X, note.y);
    }
}
function drawNote(note, currentDisplayTime) {
    if (!ctx || note.hitStatus === 'good' || note.hitStatus === 'perfect') return;
    if (note.y === null || note.y === undefined) return;
    const noteY = note.y;
    const timeUntilJudgment = note.time - currentDisplayTime;
    const noteX = judgmentLineX + (timeUntilJudgment * scrollSpeedPixelsPerSecond()); // Use callback
    const noteWidth = Math.max(1, note.duration * scrollSpeedPixelsPerSecond()); // Use callback
    const noteHeight = LINE_SPACING;
    let currentNoteColor = NOTE_COLOR;
    if (useColoredNotes()) { // Use callback
        try { const rgbArray = getMidiNoteColor(note.midi); if (rgbArray && rgbArray.length === 3) currentNoteColor = `rgb(${rgbArray[0]}, ${rgbArray[1]}, ${rgbArray[2]})`; }
        catch (e) { console.error(`Staff Module (drawNote): Error getMidiNoteColor for MIDI ${note.midi}:`, e); }
    }
    if (noteX < canvasWidth && (noteX + noteWidth) > 0) {
        drawLedgerLines(note, noteX, noteWidth);
        ctx.fillStyle = currentNoteColor;
        drawRoundedRect(noteX, noteY - noteHeight / 2, noteWidth, noteHeight, NOTE_CORNER_RADIUS);
        drawAccidental(note, noteX);
    }
}
function drawJudgmentLine() { if (!ctx) return; ctx.beginPath(); ctx.moveTo(judgmentLineX, 0); ctx.lineTo(judgmentLineX, canvasHeight); ctx.lineWidth = JUDGMENT_LINE_WIDTH; ctx.strokeStyle = JUDGMENT_LINE_COLOR; ctx.stroke(); }
function drawFlashes() {
    if (activeFlashes.length === 0 || !ctx || !audio) return;
    ctx.fillStyle = PERFECT_FLASH_COLOR;
    const flashHeight = LINE_SPACING * 1.5; const flashWidth = 10;
    const currentTimeContext = audio.getCurrentContextTime();
    for (let i = activeFlashes.length - 1; i >= 0; i--) {
        const flash = activeFlashes[i];
        if (currentTimeContext >= flash.endTime) activeFlashes.splice(i, 1);
        else drawRoundedRect(judgmentLineX - flashWidth / 2, flash.y - flashHeight / 2, flashWidth, flashHeight, flashWidth / 2);
    }
}
function redrawCanvasInternal() {
    if (!ctx) return;
    if (!audio && isStaffRunning) console.warn("Staff Module (redrawCanvasInternal): Audio module not available while staff is running.");
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(devicePixelRatio, devicePixelRatio);
    drawGrandStaff();
    drawJudgmentLine();
    if (notesToDraw.length > 0) notesToDraw.forEach(note => drawNote(note, displayTime));
    else {
        ctx.fillStyle = '#888888'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const message = noteMap ? 'No notes found or processed.' : 'Loading notes...';
        ctx.fillText(message, canvasWidth / 2, canvasHeight / 2);
    }
    drawFlashes();
    ctx.restore();
}

// --- Animation Loop ---
function animationLoop() {
    // Check if game is over (via callback from main.js) or staff shouldn't be running
    if (isGameOver() || (!isStaffRunning && !mainIsCurrentlyWaitingForKey())) { // Use mainIsCurrentlyWaitingForKey
        console.log(`Staff Module (animationLoop): Stopping. isGameOver: ${isGameOver()}, isStaffRunning: ${isStaffRunning}, mainIsCurrentlyWaitingForKey: ${mainIsCurrentlyWaitingForKey()}`);
        animationFrameId = null;
        return;
    }

    // If in Wait Mode and waiting for a key, staff does not advance time from audio.
    // It just keeps redrawing the static scene.
    if (mainIsCurrentlyWaitingForKey()) {
        // console.log("Staff Module (animationLoop): In Wait Mode pause, redrawing static scene.");
        // displayTime remains unchanged.
    } else if (isStaffRunning) { // Only update displayTime if staff is supposed to be running (i.e., song playing)
        if (audio) {
            let newTime = audio.getPlaybackTime();
            displayTime = Math.max(MIN_DISPLAY_TIME, newTime);
        } else {
            console.warn("Staff Module (animationLoop): Audio module not available for timing.");
        }
    } // else, staff is paused by user, displayTime also remains unchanged.


    // --- Check for Missed Notes ---
    // This logic needs to run even if staff is "paused" by wait mode, to trigger the wait mode.
    // However, if already waiting for a key, don't process further misses until resumed.
    if (!mainIsCurrentlyWaitingForKey()) {
        const missThresholdTime = displayTime - hitWindowGoodSec(); // Use callback
        notesToDraw.forEach(note => {
            if (!note.hitStatus && note.time < missThresholdTime) {
                console.log(`Staff Module (animationLoop): Note missed: ${note.name} at time ${note.time.toFixed(3)} (displayTime: ${displayTime.toFixed(3)})`);
                note.hitStatus = 'miss';
                mainApplyScoreCallback('miss'); // Use callback to apply score

                // If Wait Mode is active, trigger the wait mode pause in main.js
                if (mainIsWaitModeActive()) {
                    console.log(`Staff Module (animationLoop): Wait Mode active. Entering wait for note: ${note.name}`);
                    // isStaffRunning = false; // Stop staff's own scrolling
                    mainOnWaitModeEnter(note); // Notify main.js to pause audio & set waiting state
                    // The animationLoop will continue (to allow key presses) but displayTime won't advance from audio.
                }
            }
        });
    }

    redrawCanvasInternal();

    // Request next frame if game not over.
    // If waiting for key, we still need to loop for redraws and key press checks.
    if (!isGameOver()) {
        animationFrameId = requestAnimationFrame(animationLoop);
    } else {
        animationFrameId = null;
    }
}

// --- Internal Core Logic Functions ---
function judgeKeyPressInternal(keyName) {
    // console.log(`Staff Module (judgeKeyPressInternal): Judging key: ${keyName}, displayTime: ${displayTime.toFixed(3)}`);

    // If in Wait Mode and waiting for a specific key
    if (mainIsCurrentlyWaitingForKey()) {
        const noteToHit = mainGetWaitingForNote();
        if (noteToHit) {
            const targetPitchClass = getPitchClass(noteToHit.name);
            if (targetPitchClass === keyName) {
                console.log(`Staff Module (judgeKeyPressInternal): Correct key '${keyName}' pressed for waiting note '${noteToHit.name}'. Resuming.`);
                mainOnWaitModeExit(); // Notify main.js to resume audio & clear waiting state
                // isStaffRunning = true; // Staff can resume scrolling
                // NO SCORE OR COMBO for this resume key press.
                return 'resumed_wait_mode'; // Special return type, not 'perfect' or 'good' for scoring
            } else {
                console.log(`Staff Module (judgeKeyPressInternal): Incorrect key '${keyName}' pressed while waiting for '${targetPitchClass}'. Still waiting.`);
                return null; // Incorrect key, do nothing, remain paused.
            }
        } else {
            console.warn("Staff Module (judgeKeyPressInternal): In wait mode but waitingForNote is null. This shouldn't happen.");
            mainOnWaitModeExit(); // Try to recover by exiting wait mode.
            return null;
        }
    }

    // Normal key press judgment (not in wait mode pause)
    if (!isStaffRunning || isGameOver() || !audio) { // Use isGameOver()
        return null;
    }

    const currentJudgmentTime = displayTime;
    let hitResult = null;
    let bestNote = null;
    let minTimeDiff = Infinity;

    for (const note of notesToDraw) {
        if (note.hitStatus) continue;
        const timeDiff = note.time - currentJudgmentTime;
        const absTimeDiff = Math.abs(timeDiff);
        if (absTimeDiff <= hitWindowGoodSec()) { // Use callback
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
        const flashEndTimeContext = audio.getCurrentContextTime() + (PERFECT_FLASH_DURATION_MS / 1000.0);
        if (minTimeDiff <= hitWindowPerfectSec()) { // Use callback
            bestNote.hitStatus = 'perfect';
            hitResult = 'perfect';
            activeFlashes.push({ y: bestNote.y, endTime: flashEndTimeContext });
            mainApplyScoreCallback('perfect'); // Use callback
        } else {
            bestNote.hitStatus = 'good';
            hitResult = 'good';
            mainApplyScoreCallback('good'); // Use callback
        }
    }
    return hitResult;
}

function playAnimationInternal(resumeOffset = 0) {
    console.log(`Staff Module (playAnimationInternal): Attempting to play. isStaffRunning: ${isStaffRunning}, isGameOver: ${isGameOver()}, audio ready: ${audio?.isReady()}`);

    // Do not start if game is over or if currently in a "wait mode" pause.
    if (isGameOver() || mainIsCurrentlyWaitingForKey()) {
        console.warn(`Staff Module (playAnimationInternal): Cannot play. Game Over or Waiting for Key. isGameOver: ${isGameOver()}, mainIsCurrentlyWaitingForKey: ${mainIsCurrentlyWaitingForKey()}`);
        return;
    }

    if (!isStaffRunning && audio && audio.isReady()) {
        console.log(`Staff Module (playAnimationInternal): Playing animation and audio from offset: ${resumeOffset.toFixed(3)}s. PRE_DELAY_SECONDS: ${PRE_DELAY_SECONDS()}`); // Use callback
        isStaffRunning = true; // Staff is now actively scrolling with audio
        if (canvas) canvas.style.cursor = 'default';

        audio.play(resumeOffset, PRE_DELAY_SECONDS()); // Use callback

        if (!animationFrameId) {
            console.log("Staff Module (playAnimationInternal): Requesting new animation frame.");
            displayTime = Math.max(MIN_DISPLAY_TIME, audio.getPlaybackTime());
            animationFrameId = requestAnimationFrame(animationLoop);
        }
    } else {
        console.warn(`Staff Module (playAnimationInternal): Conditions not met. isStaffRunning: ${isStaffRunning}, Audio Ready: ${audio?.isReady()}`);
    }
}

function pauseAnimationInternal() {
    console.log(`Staff Module (pauseAnimationInternal): Attempting to pause. Current isStaffRunning: ${isStaffRunning}`);

    // If the game is paused because of Wait Mode, this function should not interfere with audio.pause()
    // that was already called by mainOnWaitModeEnter.
    // This pause is for user-initiated pauses.
    if (mainIsCurrentlyWaitingForKey()) {
        console.log("Staff Module (pauseAnimationInternal): Already paused by Wait Mode. User pause ignored or redundant.");
        // isStaffRunning should already be false or handled by the wait mode logic.
        return audio ? audio.getPlaybackTime() : displayTime; // Return current time
    }

    if (isStaffRunning) {
        isStaffRunning = false; // Stop staff's own scrolling due to song playback
        if (canvas) canvas.style.cursor = 'grab';
        if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }

        const pauseOff = audio ? audio.pause() : 0; // This is a user pause, so do pause audio.
        console.log(`Staff Module (pauseAnimationInternal): User Paused. Audio offset: ${pauseOff.toFixed(3)}`);
        displayTime = Math.max(MIN_DISPLAY_TIME, pauseOff);
        return pauseOff;
    }
    const currentAudioTime = audio ? audio.getPlaybackTime() : displayTime;
    console.log(`Staff Module (pauseAnimationInternal): Was not running. Returning current audio/display time: ${currentAudioTime.toFixed(3)}`);
    return currentAudioTime;
}

function resetNotesInternal() {
    console.log("Staff Module (resetNotesInternal): Resetting hit status and flashes.");
    notesToDraw.forEach(note => note.hitStatus = null);
    activeFlashes = [];
}
function resetTimeInternal() {
    console.log(`Staff Module (resetTimeInternal): Resetting displayTime to ${MIN_DISPLAY_TIME}.`);
    displayTime = MIN_DISPLAY_TIME;
}

// --- Event Handlers ---
function handleResizeInternal() {
    if (!staffSectionElement || !canvas || !ctx) return;
    console.log("Staff Module (handleResizeInternal): Handling resize...");
    const displayWidth = staffSectionElement.offsetWidth;
    const displayHeight = staffSectionElement.offsetHeight;
    if (displayWidth <= 0 || displayHeight <= 0) return;
    canvasWidth = displayWidth;
    canvasHeight = Math.min(displayHeight, totalStaffLogicalHeight);
    canvas.width = Math.round(canvasWidth * devicePixelRatio);
    canvas.height = Math.round(canvasHeight * devicePixelRatio);
    canvas.style.width = `${canvasWidth}px`; canvas.style.height = `${canvasHeight}px`;
    judgmentLineX = canvasWidth * (JUDGMENT_LINE_X_PERCENT / 100.0);
    console.log(`Staff Module (handleResizeInternal): Resized. Judgment X: ${judgmentLineX.toFixed(1)}`);
    redrawCanvasInternal();
}
function getEventX(event) { return event.touches ? event.touches[0].clientX : event.clientX; }
function handleDragStart(event) {
    if (!isStaffRunning && !isGameOver() && canvas && !mainIsCurrentlyWaitingForKey()) { // Don't allow drag if waiting for key
        isDragging = true;
        dragStartX = getEventX(event) - canvas.getBoundingClientRect().left;
        dragStartTime = displayTime;
        canvas.classList.add('dragging');
        if (event.target === canvas) event.preventDefault();
    }
}
function handleDragMove(event) {
    if (isDragging && canvas) {
        const currentX = getEventX(event) - canvas.getBoundingClientRect().left;
        const deltaX = currentX - dragStartX;
        const deltaTimeOffset = deltaX / scrollSpeedPixelsPerSecond(); // Use callback
        displayTime = Math.max(MIN_DISPLAY_TIME, dragStartTime - deltaTimeOffset);
        if (songEndTimeVisual > 0) displayTime = Math.min(displayTime, songEndTimeVisual);
        redrawCanvasInternal();
        if (event.target === canvas) event.preventDefault();
    }
}
function handleDragEnd(event) {
    if (isDragging && canvas) {
        isDragging = false;
        canvas.classList.remove('dragging');
        const newOffset = Math.max(0, displayTime);
        setAudioPauseOffsetFunc(newOffset);
        console.log(`Staff Module (handleDragEnd): Drag ended. Updated audio pause offset via callback to: ${newOffset.toFixed(3)}s`);
        if (event.target === canvas) event.preventDefault();
    }
}

// --- Initialization & Data Loading ---
function loadNoteData(jsonData) {
    console.log(`Staff Module (loadNoteData): Processing note data...`);
    try {
        noteMap = jsonData;
        if (noteMap && noteMap.tracks && noteMap.tracks.length > 0 && noteMap.tracks[0].notes) {
            const rawNotes = noteMap.tracks[0].notes;
            totalNotesInSong = rawNotes.length;
            let lastNoteEndTime = 0;
            notesToDraw = rawNotes
                .map(note => {
                    const yPos = getNoteYPosition(note.name);
                    const noteEndTime = note.time + note.duration;
                    if (noteEndTime > lastNoteEndTime) lastNoteEndTime = noteEndTime;
                    return { ...note, y: yPos, hitStatus: null };
                })
                .filter(note => note.y !== null);
            songEndTimeVisual = lastNoteEndTime + SONG_END_BUFFER_SEC;
            console.log(`Staff Module (loadNoteData): Processed ${notesToDraw.length}/${rawNotes.length} notes. Visual song end: ${songEndTimeVisual.toFixed(3)}s`);
            if (notesToDraw.length === 0 && rawNotes.length > 0) console.error("Staff Module (loadNoteData): All notes filtered out. Check Y positions.");
            notesToDraw.sort((a, b) => a.time - b.time);
            return true;
        } else {
            console.error("Staff Module (loadNoteData) Error: Invalid note data format.");
            notesToDraw = []; totalNotesInSong = 0; songEndTimeVisual = 0;
            if (ctx) redrawCanvasInternal();
            return false;
        }
    } catch (error) {
        console.error("Staff Module (loadNoteData): Fatal Error:", error);
        alert("Error processing notes file.");
        notesToDraw = []; totalNotesInSong = 0; songEndTimeVisual = 0;
        if (ctx) redrawCanvasInternal();
        return false;
    }
}

// --- Public Interface ---
export function init(config) {
    console.log("Staff Module: init() called.");
    if (!config || !config.noteDataJson || !config.staffSectionElement || typeof config.setAudioPauseOffset !== 'function' ||
        typeof config.isWaitModeActive !== 'function' || typeof config.isCurrentlyWaitingForKey !== 'function' || // Check for new callbacks
        typeof config.getWaitingForNote !== 'function' || typeof config.onWaitModeEnter !== 'function' ||
        typeof config.onWaitModeExit !== 'function' || typeof config.applyScoreCallback !== 'function') {
        console.error("Staff Module Error: Missing required configuration in init (jsonData, staffElement, callbacks for audio offset and wait mode).");
        return false;
    }

    staffSectionElement = config.staffSectionElement;
    setAudioPauseOffsetFunc = config.setAudioPauseOffset;

    // Store Wait Mode callbacks from main.js
    mainIsWaitModeActive = config.isWaitModeActive;
    mainIsCurrentlyWaitingForKey = config.isCurrentlyWaitingForKey;
    mainGetWaitingForNote = config.getWaitingForNote;
    mainOnWaitModeEnter = config.onWaitModeEnter;
    mainOnWaitModeExit = config.onWaitModeExit;
    mainApplyScoreCallback = config.applyScoreCallback;

    console.log("Staff Module (init): Callbacks (including wait mode) stored.");

    canvas = document.getElementById('staffCanvas');
    if (!canvas || !staffSectionElement.contains(canvas)) { console.error("Staff Module Error: Canvas #staffCanvas not found/inside staffSection!"); return false; }
    ctx = canvas.getContext('2d');
    if (!ctx) { console.error("Staff Module Error: Could not get 2D context!"); return false; }
    devicePixelRatio = window.devicePixelRatio || 1;
    console.log(`Staff Module (init): Canvas context obtained. DPR: ${devicePixelRatio}`);

    if (typeof getMidiNoteColor !== 'function') console.error("Staff Module CRITICAL: getMidiNoteColor not imported.");
    if (!audio) { console.error("Staff Module CRITICAL: Audio module not imported."); return false; }

    console.log("Staff Module (init): Calling setupStaffAndNotes() BEFORE loadNoteData().");
    setupStaffAndNotes();

    console.log("Staff Module (init): Calling loadNoteData().");
    const notesLoaded = loadNoteData(config.noteDataJson);
    if (!notesLoaded) { console.error("Staff Module (init): Failed to load note data. Aborting."); return false; }

    console.log("Staff Module (init): Performing initial resize and draw.");
    handleResizeInternal();
    displayTime = MIN_DISPLAY_TIME;
    redrawCanvasInternal(); // Initial draw

    // Start animation loop immediately if not game over. It will handle its running state internally.
    // This ensures the loop starts even if the game begins paused, to handle drags or initial state.
    if (!isGameOver() && !animationFrameId) { // Use isGameOver()
        console.log("Staff Module (init): Starting animation loop.");
        animationFrameId = requestAnimationFrame(animationLoop);
    }


    if (canvas) {
        console.log("Staff Module (init): Attaching drag event listeners...");
        canvas.addEventListener('mousedown', handleDragStart);
        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('mouseup', handleDragEnd);
        canvas.addEventListener('touchstart', handleDragStart, { passive: false });
        window.addEventListener('touchmove', handleDragMove, { passive: false });
        window.addEventListener('touchend', handleDragEnd);
        window.addEventListener('touchcancel', handleDragEnd);
    }

    console.log("Staff Module: Initialization complete.");
    return true;
}

export function handleResize() { console.log("Staff Module: Public handleResize() called."); handleResizeInternal(); }
export function play(resumeOffset = 0) { console.log(`Staff Module: Public play(offset: ${resumeOffset.toFixed(3)}) called.`); playAnimationInternal(resumeOffset); }
export function pause() { console.log("Staff Module: Public pause() called."); return pauseAnimationInternal(); }
export function redraw() {
    console.log("Staff Module: Public redraw() called.");
    if (!isStaffRunning && audio && !mainIsCurrentlyWaitingForKey()) { // Only sync if user-paused
        let currentAudioTime = audio.getPlaybackTime();
        displayTime = Math.max(MIN_DISPLAY_TIME, currentAudioTime);
    }
    redrawCanvasInternal();
}
export function isRunning() { return isStaffRunning && !mainIsCurrentlyWaitingForKey(); } // Staff considered "running" if scrolling and not in wait mode pause
export function judgeKeyPress(keyName) { return judgeKeyPressInternal(keyName); }
export function resetNotes() { console.log("Staff Module: Public resetNotes() called."); resetNotesInternal(); }
export function resetTime() { console.log("Staff Module: Public resetTime() called."); resetTimeInternal(); }

console.log("Staff Module: Script fully parsed.");
