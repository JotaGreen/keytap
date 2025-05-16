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

// --- Placeholder for functions/values that will be passed from main.js during init ---
// These will be replaced by actual functions/getters from main.js via the init config.
let mainGetIsGameOver = () => { console.warn("Staff: mainGetIsGameOver not initialized"); return false; };
let mainGetUseColoredNotes = () => { console.warn("Staff: mainGetUseColoredNotes not initialized"); return false; };
let mainGetScrollSpeed = () => { console.warn("Staff: mainGetScrollSpeed not initialized"); return 120; };
let mainGetHitWindowGoodSec = () => { console.warn("Staff: mainGetHitWindowGoodSec not initialized"); return 0.140; };
let mainGetHitWindowPerfectSec = () => { console.warn("Staff: mainGetHitWindowPerfectSec not initialized"); return 0.070; };
let mainGetPreDelaySeconds = () => { console.warn("Staff: mainGetPreDelaySeconds not initialized"); return 1.0; };

// Wait Mode related callbacks/getters from main.js
let mainIsWaitModeActive = () => { console.warn("Staff: mainIsWaitModeActive not initialized"); return false; };
let mainIsCurrentlyWaitingForKey = () => { console.warn("Staff: mainIsCurrentlyWaitingForKey not initialized"); return false; };
let mainGetWaitingForNote = () => { console.warn("Staff: mainGetWaitingForNote not initialized"); return null; };
let mainOnWaitModeEnter = (missedNote) => { console.warn("Staff: mainOnWaitModeEnter not initialized", missedNote);};
let mainOnWaitModeExit = () => { console.warn("Staff: mainOnWaitModeExit not initialized");};
let mainApplyScoreCallback = (hitType) => { console.warn("Staff: mainApplyScoreCallback not initialized", hitType);};

console.log("Staff Module: Initial placeholders for main.js communication set.");


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
const midiToDiatonicDegree = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // C=0, C#=0, D=1, D#=1, ..., B=6

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
let setAudioPauseOffsetFunc = (offset) => { // This is for drag-to-seek functionality
    console.warn("Staff Module: setAudioPauseOffsetFunc (for drag) was not set during init.", offset);
};

// --- Internal Helper Functions ---
/** Calculates staff geometry and Y positions for notes. */
function setupStaffAndNotes() {
    console.log("Staff Module (setupStaffAndNotes): Calculating staff geometry...");
    let currentY_rel = 0; const staffPositions_rel = {};
    staffPositions_rel.F5 = currentY_rel; staffPositions_rel.E5 = staffPositions_rel.F5 + HALF_LINE_SPACING;
    staffPositions_rel.D5 = staffPositions_rel.F5 + LINE_SPACING; staffPositions_rel.C5 = staffPositions_rel.D5 + HALF_LINE_SPACING;
    staffPositions_rel.B4 = staffPositions_rel.D5 + LINE_SPACING; staffPositions_rel.A4 = staffPositions_rel.B4 + HALF_LINE_SPACING;
    staffPositions_rel.G4 = staffPositions_rel.B4 + LINE_SPACING; staffPositions_rel.F4 = staffPositions_rel.G4 + HALF_LINE_SPACING;
    staffPositions_rel.E4 = staffPositions_rel.G4 + LINE_SPACING; staffPositions_rel.D4 = staffPositions_rel.E4 + HALF_LINE_SPACING;
    staffPositions_rel.C4 = staffPositions_rel.E4 + LINE_SPACING; staffPositions_rel.B3 = staffPositions_rel.C4 + HALF_LINE_SPACING;
    staffPositions_rel.A3 = staffPositions_rel.C4 + LINE_SPACING; staffPositions_rel.G3 = staffPositions_rel.A3 + HALF_LINE_SPACING;
    staffPositions_rel.F3 = staffPositions_rel.A3 + LINE_SPACING; staffPositions_rel.E3 = staffPositions_rel.F3 + HALF_LINE_SPACING;
    staffPositions_rel.D3 = staffPositions_rel.F3 + LINE_SPACING; staffPositions_rel.C3 = staffPositions_rel.D3 + HALF_LINE_SPACING;
    staffPositions_rel.B2 = staffPositions_rel.D3 + LINE_SPACING; staffPositions_rel.A2 = staffPositions_rel.B2 + HALF_LINE_SPACING;
    staffPositions_rel.G2 = staffPositions_rel.B2 + LINE_SPACING;
    const noteNames = ["C", "D", "E", "F", "G", "A", "B"]; const midiRef = 60; const yRef_rel = staffPositions_rel.C4;
    diatonicNoteYPositions = {}; let minY_rel = Infinity, maxY_rel = -Infinity;
    for (let midi = MIDI_NOTE_MIN; midi <= MIDI_NOTE_MAX; midi++) {
        const octave = Math.floor(midi / 12) - 1; const noteIndex = midi % 12;
        const diatonicDegree = midiToDiatonicDegree[noteIndex];
        const referenceOctave = Math.floor(midiRef / 12) - 1; const octaveDifference = octave - referenceOctave;
        const stepsFromRefDegree = diatonicDegree - midiToDiatonicDegree[midiRef % 12];
        const totalDiatonicSteps = (octaveDifference * 7) + stepsFromRefDegree;
        const yPos_rel = yRef_rel - (totalDiatonicSteps * HALF_LINE_SPACING);
        const baseNoteLetter = noteNames[diatonicDegree]; const baseNoteName = baseNoteLetter + octave;
        if (!(baseNoteName in diatonicNoteYPositions)) {
            diatonicNoteYPositions[baseNoteName] = yPos_rel;
            minY_rel = Math.min(minY_rel, yPos_rel); maxY_rel = Math.max(maxY_rel, yPos_rel);
        }
    }
    const noteHeight = LINE_SPACING; const topNoteEdgeY_rel = minY_rel - (noteHeight / 2);
    const bottomNoteEdgeY_rel = maxY_rel + (noteHeight / 2);
    totalStaffLogicalHeight = (bottomNoteEdgeY_rel - topNoteEdgeY_rel) + (STAFF_PADDING * 2);
    totalStaffLogicalHeight = Math.max(100, totalStaffLogicalHeight); // Min height
    const yOffset = STAFF_PADDING - topNoteEdgeY_rel;
    for (const key in staffPositions_rel) staffPositions[key] = staffPositions_rel[key] + yOffset;
    for (const key in diatonicNoteYPositions) diatonicNoteYPositions[key] += yOffset;
    console.log(`Staff Module (setupStaffAndNotes): Staff Logical Height: ${totalStaffLogicalHeight.toFixed(1)}px. Positions: ${Object.keys(diatonicNoteYPositions).length}`);
}

/** Finds Y position for a note name. */
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

/** Gets pitch class (e.g., "Db") from a full note name. */
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
    if (!ctx || note.y === null) return; const y = note.y; const checkTolerance = HALF_LINE_SPACING / 4;
    ctx.lineWidth = LEDGER_LINE_WIDTH; ctx.strokeStyle = STAFF_LINE_COLOR;
    const ledgerXStart = x - LEDGER_LINE_EXTENSION; const ledgerXEnd = x + noteWidth + LEDGER_LINE_EXTENSION;
    if (y < staffPositions.F5 - checkTolerance) for (let lineY = staffPositions.F5 - LINE_SPACING; lineY >= y - checkTolerance; lineY -= LINE_SPACING) { ctx.beginPath(); ctx.moveTo(ledgerXStart, lineY); ctx.lineTo(ledgerXEnd, lineY); ctx.stroke(); }
    if (Math.abs(y - staffPositions.C4) < checkTolerance) { ctx.beginPath(); ctx.moveTo(ledgerXStart, staffPositions.C4); ctx.lineTo(ledgerXEnd, staffPositions.C4); ctx.stroke(); }
    if (y > staffPositions.G2 + checkTolerance) for (let lineY = staffPositions.G2 + LINE_SPACING; lineY <= y + checkTolerance; lineY += LINE_SPACING) { ctx.beginPath(); ctx.moveTo(ledgerXStart, lineY); ctx.lineTo(ledgerXEnd, lineY); ctx.stroke(); }
}
function drawAccidental(note, x) {
    if (!ctx || note.y === null) return; const accidentalSymbol = note.name.includes('#') ? '♯' : note.name.includes('b') ? '♭' : null;
    if (accidentalSymbol) {
        ctx.fillStyle = mainGetUseColoredNotes() ? ACCIDENTAL_COLOR_COLOR_NOTES : ACCIDENTAL_COLOR_BLACK_NOTES; // USE GETTER
        ctx.font = `${ACCIDENTAL_FONT_SIZE}px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(accidentalSymbol, x + ACCIDENTAL_PADDING_X, note.y);
    }
}
function drawNote(note, currentDisplayTime) {
    if (!ctx || note.hitStatus === 'good' || note.hitStatus === 'perfect') return; if (note.y === null || note.y === undefined) return;
    const noteY = note.y; const timeUntilJudgment = note.time - currentDisplayTime;
    const noteX = judgmentLineX + (timeUntilJudgment * mainGetScrollSpeed()); // USE GETTER
    const noteWidth = Math.max(1, note.duration * mainGetScrollSpeed());     // USE GETTER
    const noteHeight = LINE_SPACING; let currentNoteColor = NOTE_COLOR;
    if (mainGetUseColoredNotes()) { // USE GETTER
        try { const rgbArray = getMidiNoteColor(note.midi); if (rgbArray?.length === 3) currentNoteColor = `rgb(${rgbArray.join(',')})`; }
        catch (e) { console.error(`Staff (drawNote): Error getMidiNoteColor for MIDI ${note.midi}:`, e); }
    }
    if (noteX < canvasWidth && (noteX + noteWidth) > 0) {
        drawLedgerLines(note, noteX, noteWidth); ctx.fillStyle = currentNoteColor;
        drawRoundedRect(noteX, noteY - noteHeight / 2, noteWidth, noteHeight, NOTE_CORNER_RADIUS);
        drawAccidental(note, noteX);
    }
}
function drawJudgmentLine() { if (!ctx) return; ctx.beginPath(); ctx.moveTo(judgmentLineX, 0); ctx.lineTo(judgmentLineX, canvasHeight); ctx.lineWidth = JUDGMENT_LINE_WIDTH; ctx.strokeStyle = JUDGMENT_LINE_COLOR; ctx.stroke(); }
function drawFlashes() {
    if (activeFlashes.length === 0 || !ctx || !audio) return; ctx.fillStyle = PERFECT_FLASH_COLOR;
    const flashHeight = LINE_SPACING * 1.5; const flashWidth = 10; const currentTimeContext = audio.getCurrentContextTime();
    for (let i = activeFlashes.length - 1; i >= 0; i--) {
        const flash = activeFlashes[i];
        if (currentTimeContext >= flash.endTime) activeFlashes.splice(i, 1);
        else drawRoundedRect(judgmentLineX - flashWidth / 2, flash.y - flashHeight / 2, flashWidth, flashHeight, flashWidth / 2);
    }
}
/** Internal redraw function. Clears and redraws the entire canvas. */
function redrawCanvasInternal() {
    if (!ctx) return; if (!audio && isStaffRunning) console.warn("Staff (redrawCanvasInternal): Audio module missing while staff running.");
    ctx.save(); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.scale(devicePixelRatio, devicePixelRatio);
    drawGrandStaff(); drawJudgmentLine();
    if (notesToDraw.length > 0) notesToDraw.forEach(note => drawNote(note, displayTime));
    else {
        ctx.fillStyle = '#888'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const message = noteMap ? 'No notes processed.' : 'Loading notes...';
        ctx.fillText(message, canvasWidth / 2, canvasHeight / 2);
    }
    drawFlashes(); ctx.restore();
}

// --- Animation Loop ---
/** Main animation loop, called via requestAnimationFrame. */
function animationLoop() {
    if (mainGetIsGameOver() || (!isStaffRunning && !mainIsCurrentlyWaitingForKey())) {
        console.log(`Staff (animationLoop): Stopping. GameOver: ${mainGetIsGameOver()}, StaffRunning: ${isStaffRunning}, WaitingForKey: ${mainIsCurrentlyWaitingForKey()}`);
        animationFrameId = null; return;
    }

    if (mainIsCurrentlyWaitingForKey()) {
        // console.log("Staff (animationLoop): In Wait Mode pause, static redraw.");
    } else if (isStaffRunning) {
        if (audio) { displayTime = Math.max(MIN_DISPLAY_TIME, audio.getPlaybackTime()); }
        else { console.warn("Staff (animationLoop): Audio module missing for timing."); }
    }

    if (!mainIsCurrentlyWaitingForKey()) {
        const missThresholdTime = displayTime - mainGetHitWindowGoodSec(); // USE GETTER
        notesToDraw.forEach(note => {
            if (!note.hitStatus && note.time < missThresholdTime) {
                console.log(`Staff (animationLoop): Note missed: ${note.name} at ${note.time.toFixed(3)} (displayTime: ${displayTime.toFixed(3)})`);
                note.hitStatus = 'miss';
                mainApplyScoreCallback('miss'); // Use callback for scoring

                if (mainIsWaitModeActive()) {
                    console.log(`Staff (animationLoop): Wait Mode active. Entering wait for note: ${note.name}`);
                    // isStaffRunning = false; // Main will set its gameIsRunning, staff follows that via isStaffRunning
                    mainOnWaitModeEnter(note); // Notify main.js
                }
            }
        });
    }
    redrawCanvasInternal();
    if (!mainGetIsGameOver()) animationFrameId = requestAnimationFrame(animationLoop);
    else animationFrameId = null;
}

// --- Internal Core Logic Functions ---
/** Internal implementation for judging a key press. */
function judgeKeyPressInternal(keyName) {
    if (mainIsCurrentlyWaitingForKey()) {
        const noteToHit = mainGetWaitingForNote();
        if (noteToHit) {
            const targetPitchClass = getPitchClass(noteToHit.name);
            if (targetPitchClass === keyName) {
                console.log(`Staff (judgeKeyPressInternal): Correct key '${keyName}' for waiting note '${noteToHit.name}'. Resuming.`);
                mainOnWaitModeExit(); // Notify main.js to resume
                return 'resumed_wait_mode'; // Special non-scoring return
            } else {
                console.log(`Staff (judgeKeyPressInternal): Incorrect key '${keyName}' while waiting for '${targetPitchClass}'.`);
                return null;
            }
        } else {
            console.warn("Staff (judgeKeyPressInternal): In wait mode but waitingForNote is null.");
            mainOnWaitModeExit(); return null; // Attempt recovery
        }
    }

    if (!isStaffRunning || mainGetIsGameOver() || !audio) return null;

    const currentJudgmentTime = displayTime; let hitResult = null; let bestNote = null; let minTimeDiff = Infinity;
    for (const note of notesToDraw) {
        if (note.hitStatus) continue;
        const timeDiff = note.time - currentJudgmentTime; const absTimeDiff = Math.abs(timeDiff);
        if (absTimeDiff <= mainGetHitWindowGoodSec()) { // USE GETTER
            const notePitchClass = getPitchClass(note.name);
            if (notePitchClass === keyName) {
                if (absTimeDiff < minTimeDiff) { minTimeDiff = absTimeDiff; bestNote = note; }
            }
        }
    }
    if (bestNote) {
        const flashEndTimeContext = audio.getCurrentContextTime() + (PERFECT_FLASH_DURATION_MS / 1000.0);
        if (minTimeDiff <= mainGetHitWindowPerfectSec()) { // USE GETTER
            bestNote.hitStatus = 'perfect'; hitResult = 'perfect';
            activeFlashes.push({ y: bestNote.y, endTime: flashEndTimeContext });
            mainApplyScoreCallback('perfect'); // Use callback for scoring
        } else {
            bestNote.hitStatus = 'good'; hitResult = 'good';
            mainApplyScoreCallback('good'); // Use callback for scoring
        }
    }
    return hitResult;
}

/** Internal implementation to start or resume staff animation and audio. */
function playAnimationInternal(resumeOffset = 0) {
    console.log(`Staff (playAnimationInternal): Attempting play. isStaffRunning: ${isStaffRunning}, GameOver: ${mainGetIsGameOver()}, Waiting: ${mainIsCurrentlyWaitingForKey()}, AudioReady: ${audio?.isReady()}`);
    if (mainGetIsGameOver() || mainIsCurrentlyWaitingForKey()) {
        console.warn(`Staff (playAnimationInternal): Cannot play. GameOver or WaitingForKey.`);
        return;
    }
    if (!isStaffRunning && audio && audio.isReady()) {
        console.log(`Staff (playAnimationInternal): Playing animation/audio from offset: ${resumeOffset.toFixed(3)}s. PreDelay: ${mainGetPreDelaySeconds()}`);
        isStaffRunning = true; // Staff is now actively scrolling
        if (canvas) canvas.style.cursor = 'default';
        audio.play(resumeOffset, mainGetPreDelaySeconds()); // USE GETTER for pre-delay
        if (!animationFrameId) {
            console.log("Staff (playAnimationInternal): Requesting new animation frame.");
            displayTime = Math.max(MIN_DISPLAY_TIME, audio.getPlaybackTime());
            animationFrameId = requestAnimationFrame(animationLoop);
        }
    } else {
        console.warn(`Staff (playAnimationInternal): Conditions not met. isStaffRunning: ${isStaffRunning}, AudioReady: ${audio?.isReady()}`);
    }
}

/** Internal implementation to pause staff animation and audio (user-initiated). */
function pauseAnimationInternal() {
    console.log(`Staff (pauseAnimationInternal): Attempting pause. isStaffRunning: ${isStaffRunning}`);
    if (mainIsCurrentlyWaitingForKey()) {
        console.log("Staff (pauseAnimationInternal): Already paused by Wait Mode. User pause redundant.");
        return audio ? audio.getPlaybackTime() : displayTime;
    }
    if (isStaffRunning) {
        isStaffRunning = false; // Staff scrolling stops
        if (canvas) canvas.style.cursor = 'grab';
        if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
        const pauseOff = audio ? audio.pause() : 0; // User pause, so pause audio
        console.log(`Staff (pauseAnimationInternal): User Paused. Audio offset: ${pauseOff.toFixed(3)}`);
        displayTime = Math.max(MIN_DISPLAY_TIME, pauseOff);
        return pauseOff;
    }
    const currentAudioTime = audio ? audio.getPlaybackTime() : displayTime;
    console.log(`Staff (pauseAnimationInternal): Was not running. Current time: ${currentAudioTime.toFixed(3)}`);
    return currentAudioTime;
}

/** Internal implementation to reset hit status of all notes. */
function resetNotesInternal() { console.log("Staff (resetNotesInternal): Resetting notes."); notesToDraw.forEach(note => note.hitStatus = null); activeFlashes = []; }
/** Internal implementation to reset the staff's display time. */
function resetTimeInternal() { console.log(`Staff (resetTimeInternal): Resetting displayTime.`); displayTime = MIN_DISPLAY_TIME; }

// --- Event Handlers ---
/** Handles window resize or orientation change for the staff canvas. */
function handleResizeInternal() {
    if (!staffSectionElement || !canvas || !ctx) return;
    console.log("Staff (handleResizeInternal): Resizing...");
    const displayWidth = staffSectionElement.offsetWidth; const displayHeight = staffSectionElement.offsetHeight;
    if (displayWidth <= 0 || displayHeight <= 0) return;
    canvasWidth = displayWidth; canvasHeight = Math.min(displayHeight, totalStaffLogicalHeight);
    canvas.width = Math.round(canvasWidth * devicePixelRatio); canvas.height = Math.round(canvasHeight * devicePixelRatio);
    canvas.style.width = `${canvasWidth}px`; canvas.style.height = `${canvasHeight}px`;
    judgmentLineX = canvasWidth * (JUDGMENT_LINE_X_PERCENT / 100.0);
    console.log(`Staff (handleResizeInternal): Resized. Judgment X: ${judgmentLineX.toFixed(1)}`);
    redrawCanvasInternal();
}
function getEventX(event) { return event.touches ? event.touches[0].clientX : event.clientX; }
function handleDragStart(event) {
    if (!isStaffRunning && !mainGetIsGameOver() && canvas && !mainIsCurrentlyWaitingForKey()) {
        isDragging = true; dragStartX = getEventX(event) - canvas.getBoundingClientRect().left; dragStartTime = displayTime;
        canvas.classList.add('dragging'); if (event.target === canvas) event.preventDefault();
    }
}
function handleDragMove(event) {
    if (isDragging && canvas) {
        const deltaX = (getEventX(event) - canvas.getBoundingClientRect().left) - dragStartX;
        const deltaTimeOffset = deltaX / mainGetScrollSpeed(); // USE GETTER
        displayTime = Math.max(MIN_DISPLAY_TIME, dragStartTime - deltaTimeOffset);
        if (songEndTimeVisual > 0) displayTime = Math.min(displayTime, songEndTimeVisual);
        redrawCanvasInternal(); if (event.target === canvas) event.preventDefault();
    }
}
function handleDragEnd(event) {
    if (isDragging && canvas) {
        isDragging = false; canvas.classList.remove('dragging');
        const newOffset = Math.max(0, displayTime);
        setAudioPauseOffsetFunc(newOffset); // This is for drag-to-seek, passed from main
        console.log(`Staff (handleDragEnd): Drag ended. Updated audioPauseOffset (drag) to: ${newOffset.toFixed(3)}s`);
        if (event.target === canvas) event.preventDefault();
    }
}

// --- Initialization & Data Loading ---
/** Loads and processes note data. */
function loadNoteData(jsonData) {
    console.log(`Staff (loadNoteData): Processing notes...`);
    try {
        noteMap = jsonData;
        if (noteMap?.tracks?.[0]?.notes) {
            const rawNotes = noteMap.tracks[0].notes; totalNotesInSong = rawNotes.length; let lastNoteEndTime = 0;
            notesToDraw = rawNotes.map(note => {
                const yPos = getNoteYPosition(note.name); const noteEndTime = note.time + note.duration;
                if (noteEndTime > lastNoteEndTime) lastNoteEndTime = noteEndTime;
                return { ...note, y: yPos, hitStatus: null };
            }).filter(note => note.y !== null);
            songEndTimeVisual = lastNoteEndTime + SONG_END_BUFFER_SEC;
            console.log(`Staff (loadNoteData): Processed ${notesToDraw.length}/${rawNotes.length} notes. Visual end: ${songEndTimeVisual.toFixed(3)}s`);
            if (notesToDraw.length === 0 && rawNotes.length > 0) console.error("Staff (loadNoteData): All notes filtered. Check Y positions.");
            notesToDraw.sort((a, b) => a.time - b.time); return true;
        } else {
            console.error("Staff (loadNoteData) Error: Invalid note data format.");
            notesToDraw = []; totalNotesInSong = 0; songEndTimeVisual = 0; if (ctx) redrawCanvasInternal(); return false;
        }
    } catch (error) {
        console.error("Staff (loadNoteData): Fatal Error:", error); alert("Error processing notes file.");
        notesToDraw = []; totalNotesInSong = 0; songEndTimeVisual = 0; if (ctx) redrawCanvasInternal(); return false;
    }
}

// --- Public Interface ---
/** Initializes the Staff Module. */
export function init(config) {
    console.log("Staff Module: init() called.");
    // Validate all required config properties (including new getters)
    const requiredConfigs = [
        'noteDataJson', 'staffSectionElement', 'setAudioPauseOffset',
        'getIsGameOver', 'getUseColoredNotes', 'getScrollSpeed',
        'getHitWindowGoodSec', 'getHitWindowPerfectSec', 'getPreDelaySeconds',
        'isWaitModeActive', 'isCurrentlyWaitingForKey', 'getWaitingForNote',
        'onWaitModeEnter', 'onWaitModeExit', 'applyScoreCallback'
    ];
    for (const key of requiredConfigs) {
        if (typeof config[key] === 'undefined') { // Check for undefined instead of just falsy
             console.error(`Staff Module Error: Missing required configuration in init: '${key}'.`);
             return false;
        }
    }

    staffSectionElement = config.staffSectionElement;
    setAudioPauseOffsetFunc = config.setAudioPauseOffset; // For drag-to-seek

    // Store functions/getters from main.js
    mainGetIsGameOver = config.getIsGameOver;
    mainGetUseColoredNotes = config.getUseColoredNotes;
    mainGetScrollSpeed = config.getScrollSpeed;
    mainGetHitWindowGoodSec = config.getHitWindowGoodSec;
    mainGetHitWindowPerfectSec = config.getHitWindowPerfectSec;
    mainGetPreDelaySeconds = config.getPreDelaySeconds;
    // Store Wait Mode callbacks/getters
    mainIsWaitModeActive = config.isWaitModeActive;
    mainIsCurrentlyWaitingForKey = config.isCurrentlyWaitingForKey;
    mainGetWaitingForNote = config.getWaitingForNote;
    mainOnWaitModeEnter = config.onWaitModeEnter;
    mainOnWaitModeExit = config.onWaitModeExit;
    mainApplyScoreCallback = config.applyScoreCallback;
    console.log("Staff Module (init): All callbacks and getters from main.js stored.");

    canvas = document.getElementById('staffCanvas');
    if (!canvas || !staffSectionElement.contains(canvas)) { console.error("Staff Error: Canvas #staffCanvas missing!"); return false; }
    ctx = canvas.getContext('2d');
    if (!ctx) { console.error("Staff Error: No 2D context!"); return false; }
    devicePixelRatio = window.devicePixelRatio || 1;
    console.log(`Staff (init): Canvas context obtained. DPR: ${devicePixelRatio}`);

    if (typeof getMidiNoteColor !== 'function') console.error("Staff CRITICAL: getMidiNoteColor missing.");
    if (!audio) { console.error("Staff CRITICAL: Audio module missing."); return false; }

    setupStaffAndNotes();
    if (!loadNoteData(config.noteDataJson)) { console.error("Staff (init): Failed to load note data."); return false; }

    handleResizeInternal(); displayTime = MIN_DISPLAY_TIME; redrawCanvasInternal();

    if (!mainGetIsGameOver() && !animationFrameId) {
        console.log("Staff (init): Starting animation loop.");
        animationFrameId = requestAnimationFrame(animationLoop);
    }

    if (canvas) {
        console.log("Staff (init): Attaching drag listeners.");
        canvas.addEventListener('mousedown', handleDragStart); window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('mouseup', handleDragEnd); canvas.addEventListener('touchstart', handleDragStart, { passive: false });
        window.addEventListener('touchmove', handleDragMove, { passive: false }); window.addEventListener('touchend', handleDragEnd);
        window.addEventListener('touchcancel', handleDragEnd);
    }
    console.log("Staff Module: Initialization complete.");
    return true;
}

export function handleResize() { console.log("Staff: Public handleResize()."); handleResizeInternal(); }
export function play(resumeOffset = 0) { console.log(`Staff: Public play(offset: ${resumeOffset.toFixed(3)}).`); playAnimationInternal(resumeOffset); }
export function pause() { console.log("Staff: Public pause()."); return pauseAnimationInternal(); }
export function redraw() {
    console.log("Staff: Public redraw().");
    if (!isStaffRunning && audio && !mainIsCurrentlyWaitingForKey()) {
        displayTime = Math.max(MIN_DISPLAY_TIME, audio.getPlaybackTime());
    }
    redrawCanvasInternal();
}
export function isRunning() { return isStaffRunning && !mainIsCurrentlyWaitingForKey(); }
export function judgeKeyPress(keyName) { return judgeKeyPressInternal(keyName); }
export function resetNotes() { console.log("Staff: Public resetNotes()."); resetNotesInternal(); }
export function resetTime() { console.log("Staff: Public resetTime()."); resetTimeInternal(); }

console.log("Staff Module: Script fully parsed.");
