export const SCALES = [
    {
        id: "major-pentatonic",
        label: "MAJEURE",
        intervals: [0, 2, 4, 7, 9]
    },
    {
        id: "minor-pentatonic",
        label: "MINEURE",
        intervals: [0, 3, 5, 7, 10]
    },
    {
        id: "suspended-pentatonic",
        label: "SUSPENDUE",
        intervals: [0, 2, 5, 7, 10]
    }
];

const ROOT_NOTE = 60;

// Playtron's factory mapping is 16 consecutive MIDI notes starting at C3.
 // We deliberately map those 16 physical inputs by index rather than
 // quantizing each raw MIDI note independently: a pentatonic scale cannot
 // represent 16 distinct inputs inside a single octave without collisions.
// Do not assume the device is currently configured to C3. Playtron
// stores its pin mapping, so a device configured to C1..D#2 is perfectly
// valid. We detect the 16-note chromatic window from the raw MIDI values
// instead of hard-coding one octave.
const PLAYTRON_INPUT_COUNT = 16;

export class ScaleManager {
    constructor() {
        this.index = 0;
        this.activeNotes = new Map();
        this.playtronMinRawNote = null;
        this.playtronMaxRawNote = null;
    }

    get currentScale() {
        return SCALES[this.index];
    }

    get label() {
        return this.currentScale.label;
    }

    next() {
        const releases = [];

        for (const active of this.activeNotes.values()) {
            releases.push({
                ...active.event,
                type: "noteoff",
                note: active.mappedNote,
                velocity: 0,
                rawNote: active.event.note
            });
        }

        this.activeNotes.clear();
        this.index =
            (this.index + 1) % SCALES.length;

        return {
            scale: this.currentScale,
            releases
        };
    }

    transform(event) {
        if (
            !event ||
            !Number.isFinite(event.note) ||
            (event.type !== "noteon" && event.type !== "noteoff")
        ) {
            return event;
        }

        const key =
            event.source +
            "-" +
            event.channel +
            "-" +
            event.note;

        if (event.type === "noteon") {
            const mappedNote =
                event.source === "midi"
                    ? this.mapPlaytronNote(event.note)
                    : this.isDiscreteInstrumentSource(event.source)
                        ? this.mapKeyboardNote(event.note)
                        : event.note;

            this.activeNotes.set(key, {
                event,
                mappedNote
            });

            return {
                ...event,
                rawNote: event.note,
                note: mappedNote
            };
        }

        const active =
            this.activeNotes.get(key);

        const mappedNote =
            active?.mappedNote ??
            (
                event.source === "midi"
                    ? this.mapPlaytronNote(event.note)
                    : this.isDiscreteInstrumentSource(event.source)
                        ? this.mapKeyboardNote(event.note)
                        : event.note
            );

        this.activeNotes.delete(key);

        return {
            ...event,
            rawNote: event.note,
            note: mappedNote
        };
    }

    isDiscreteInstrumentSource(source) {
        return source === "keyboard" || source === "touch";
    }

    mapPlaytronNote(note) {
        if (!Number.isFinite(note)) {
            return ROOT_NOTE;
        }

        if (!Number.isFinite(this.playtronMinRawNote)) {
            // Start at the C of the octave containing the first raw note.
            // If a later lower note arrives (e.g. first D2, then C1), the
            // window is expanded downward as long as all 16 inputs still fit.
            this.playtronMinRawNote =
                Math.floor(note / 12) * 12;
        }

        const candidateMin =
            Math.min(
                this.playtronMinRawNote,
                Math.floor(note / 12) * 12
            );

        const candidateMax =
            Math.max(
                this.playtronMaxRawNote ?? note,
                note
            );

        if (
            candidateMax - candidateMin <
            PLAYTRON_INPUT_COUNT
        ) {
            this.playtronMinRawNote = candidateMin;
            this.playtronMaxRawNote = candidateMax;
        } else if (!Number.isFinite(this.playtronMaxRawNote)) {
            this.playtronMaxRawNote = note;
        }

        // Playtron's 16 inputs are consecutive MIDI notes in the normal
        // configuration. This also works when the stored range starts at
        // C1, C2, C3, etc. It prevents an entire lower octave from being
        // clamped to one note.
        const index = Math.max(
            0,
            Math.min(
                PLAYTRON_INPUT_COUNT - 1,
                Math.round(note - this.playtronMinRawNote)
            )
        );

        const intervals = this.currentScale.intervals;
        const octave = Math.floor(index / intervals.length);
        const degree = index % intervals.length;

        return (
            ROOT_NOTE +
            octave * 12 +
            intervals[degree]
        );
    }

    mapKeyboardNote(note) {
        const keyboardIndex =
            Math.round(note - ROOT_NOTE);

        if (
            keyboardIndex < 0 ||
            keyboardIndex >= 17
        ) {
            return this.quantize(note);
        }

        const intervals = this.currentScale.intervals;
        const degree = keyboardIndex;
        const octave = Math.floor(
            degree / intervals.length
        );
        const scaleDegree =
            degree % intervals.length;

        return (
            ROOT_NOTE +
            octave * 12 +
            intervals[scaleDegree]
        );
    }

    quantize(note) {
        const intervals = this.currentScale.intervals;
        const relative = note - ROOT_NOTE;
        const octave = Math.floor(relative / 12);

        let nearestNote = null;
        let nearestDistance = Infinity;

        for (const octaveOffset of [-1, 0, 1]) {
            for (const interval of intervals) {
                const candidate =
                    ROOT_NOTE +
                    (octave + octaveOffset) * 12 +
                    interval;

                const distance =
                    Math.abs(candidate - note);

                if (distance < nearestDistance) {
                    nearestNote = candidate;
                    nearestDistance = distance;
                }
            }
        }

        return nearestNote;
    }

    resetHeldNotes() {
        this.activeNotes.clear();
    }
}
