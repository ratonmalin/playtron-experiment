export const KEYBOARD_MAPPING = {
    a: 60, // C4
    w: 61, // C#4
    s: 62, // D4
    e: 63, // D#4
    d: 64, // E4
    f: 65, // F4
    t: 66, // F#4
    g: 67, // G4
    y: 68, // G#4
    h: 69, // A4
    u: 70, // A#4
    j: 71, // B4
    k: 72  // C5
};

export const MIDI_NOTE_NAMES = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B"
];

export function midiToNoteName(midiNote) {
    const noteIndex = midiNote % 12;
    const octave = Math.floor(midiNote / 12) - 1;

    return `${MIDI_NOTE_NAMES[noteIndex]}${octave}`;
}
