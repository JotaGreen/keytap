# Keytap

## Overview
A web-based rhythm game that combines Guitar Hero-style gameplay with piano sheet music sight reading. The game will display a scrolling grand staff with notes that players must tap on a virtual keyboard in time with the music. This game is designed primarily for mobile devices in landscape and portrait orientation.

## Core Technical Requirements
- The game should be compatible to be hosted on GitHub pages
- Don’t use React or other libraries that require a build process.
- Use Web Audio API for precise audio timing and playback
- Use Canvas for rendering the staff, notes, and animations
- Add the Eruda library to facilitate debugging.. 
- Client-side only implementation (no server required)
- Files should be completely loaded/buffered before gameplay begins to avoid delays or synchronization issues
- Use audioContext.currentTime as the source of truth for timing animations
- Add plenty of comments in the code and many console logs to facilitate understanding, debugging and future changes

## Game Screen Layout

### Landscape Mode
- Top 2/3: Scrolling grand staff
- Bottom 1/3 right: Virtual one-octave piano keyboard
- Bottom 1/3 left: Information display (health bar, combo count) and pause button

### Portrait Mode
- Top 1/4: Information display and pause button
- Middle 1/2: Scrolling grand staff
- Bottom 1/4: Virtual one-octave piano keyboard

## Core Game Mechanics

### Note Display & Staff
- Display a horizontal grand staff that scrolls right to left.
- Notes appear as rounded rectangles with length indicating duration
- Staff should display notes from C2 to C6 (ignore notes outside this range)
- Add ledger lines under notes that require them; for the whole duration of the note (length of the rounded rectangle), starting and ending a little more than the note, like regular sheet music
- No clefs or bar lines need to be displayed
- Position notes according to standard sheet music notation
- Display small sharp (♯) or flat (♭) indicators on noteheads as needed
- Use the song's key signature to determine enharmonic spellings (C# vs Db)
- Display key signature to the left of the judgment line (fixed position, always visible)

### Note Colors
- Option to display notes in black or color-coded
- When colored, use okhsl color space:
  - Hue determined by pitch class: B=0°, C=30°, C#=60°, D=90°, D#=120°, E=150°, F=180°, F#=210°, G=240°, G#=270°, A=300°, A#=330°
  - Lightness interpolated from 0.35 (MIDI 36) to 0.65 (MIDI 84)
  - Saturation and Alpha set to 1 for all notes

### Keyboard Input
- Display a virtual one-octave piano keyboard (C to B)
- When keys are pressed, there should be some visual indication, but they don’t make any sound
- Keyboard accepts multi-touch for chord playing
- The same key works for all octaves (e.g., any C note uses the C key)
- If chord contains multiple notes of the same pitch class, a single key press counts for all of them

### Timing & Judgment
- Judgment line displayed as a vertical line where notes should be played
- Default hit window: ±70ms for "Good", ±35ms for "Perfect", outside is "Miss"
- Notes disappear when hit correctly
- Perfect hits show a brief flash/animation
- Good hits simply disappear with minimal animation
- Missed notes continue scrolling to the end of the staff

### Scoring System
- Energy Meter starts at 50 (range 0-75)
- Perfect hits: +2 Energy
- Missed notes: -10 Energy
- Combo bonus (consecutive non-miss notes):
  - 1-9: No bonus
  - 10-19: +1 extra Energy
  - 20-29: +2 extra Energy
  - 30-39: +3 extra Energy
  - And so on, adding 1 to the bonus every 10 combo
- Song Score: Total Energy gained (including overflow) minus total Energy lost
- At end of song: Display percentage of Perfect/Good/Miss hits
- If Energy Meter reaches 0, song is interrupted and player fails (unless "No Death Mode" is enabled)

## Settings
- Volume control
- Light/dark mode theme toggle
- Scroll speed adjustment (independent of song tempo)
- Note color toggle (black vs. color-coded)
- No death mode toggle (continue playing even with empty health bar)
- Wait mode toggle (audio and scrolling pauses on missed notes until correct note is played)
- Hit window adjustment (default 70ms)
- Playback rate adjustment (in 10% increments)
- Option to display note names on/off
- Latency calibration (opens the game screen with a simple song containing 10 C4 notes with a fixed beat; it will be provided in calibration.mp3 and calibration.json; but instead of scoring the player actions on this song, the game should measure the average player error from perfect timing and assume that is the latency)

## Game Flow
1. Initial Screen:
   - File loading interface for MP3 and Note Map JSON
   - Settings configuration
   - Start button (enabled only when files are loaded)

2. Gameplay Screen:
   - Scrolling staff with notes
   - Virtual keyboard
   - Information display (health, combo)
   - Pause button

3. Pause Screen (overlay):
   - Resume button
   - Quit button (returns to initial screen)
   - Volume adjustment

4. Results Screen:
   - Score
   - Performance statistics (Perfect/Good/Miss percentages)
   - Return to initial screen button

## File Handling
- Game accepts two files:
  1. MP3 audio file for the song
  2. Note Map JSON file (created by ToneJS MIDI to JSON converter)
- Files are loaded and processed entirely client-side
- Preload files completely before starting gameplay

## Note Map File Schema
```json
{
  "header": {
    "keySignatures": [
      {
        "key": "string",
        "scale": "string",
        "ticks": "number"
      }
    ],
    "meta": "array",
    "name": "string",
    "ppq": "number",
    "tempos": [
      {
        "bpm": "number",
        "ticks": "number"
      }
    ],
    "timeSignatures": [
      {
        "ticks": "number",
        "timeSignature": ["number", "number"],
        "measures": "number"
      }
    ]
  },
  "tracks": [
    {
      "channel": "number",
      "controlChanges": "object",
      "pitchBends": "array",
      "instrument": {
        "family": "string",
        "number": "number",
        "name": "string"
      },
      "name": "string",
      "notes": [
        {
          "duration": "number",
          "durationTicks": "number",
          "midi": "number",
          "name": "string",
          "ticks": "number",
          "time": "number",
          "velocity": "number"
        }
      ]
    }
  ]
}
```

## Technical Implementation Notes
- Use Web Audio API's context.currentTime as source of truth for sync
- Implement pre-loading and buffering of audio files
- To convert the colors from okhsl to rgb, use as reference the code in https://github.com/bottosson/bottosson.github.io/blob/master/misc/colorpicker/colorconversion.js. It is MIT licensed.
- Apply a small (~100ms) default pre-delay before starting visual scrolling
- Calculate note positions dynamically based on audio playback position
- For chords, handle each note independently for hit judgment (they don’t need to be pressed at the same time)
- Support multi-touch input for the virtual keyboard
- For development, there are files testData/test.mp3 and testData/test.json that can be used instead of requiring user to load files
- If the Note Map JSON has multiple tracks, use only the first one and ignore any other

## Avoid Common Issues
- Audio-visual synchronization problems
- Input latency (hence the calibration feature)
- Performance issues with many notes on screen
- Inaccurate timing judgments
- Inconsistent touch response