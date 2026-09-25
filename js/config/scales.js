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

const PLAYTRON_ROOT_NOTE = 50;
const KEYBOARD_ROOT_NOTE = 50;
const PLAYTRON_INPUT_COUNT = 16;

// Playtron is configured with a low MIDI register. We transpose the
// incoming notes as a block instead of compressing them into scale degrees.
// This is important: 16 physical inputs must remain 16 distinct MIDI notes.
// The selected scale is still available to the visual system, but it must
// not collapse several Playtron inputs onto the same pitch.
const PLAYTRON_TRANSPOSE = 26;

export class ScaleManager {
    constructor() {
        this.index = 0;
        this.activeNotes = new Map();
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
        this.index = (this.index + 1) % SCALES.length;

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

        const active = this.activeNotes.get(key);

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
            return PLAYTRON_ROOT_NOTE;
        }

        return note + PLAYTRON_TRANSPOSE;
    }

    mapKeyboardNote(note) {
        const keyboardIndex = Math.max(
            0,
            Math.min(
                PLAYTRON_INPUT_COUNT - 1,
                Math.round(note - 60)
            )
        );

        return KEYBOARD_ROOT_NOTE + keyboardIndex;
    }

    scaleNote(rootNote, scaleSteps) {
        const intervals = this.currentScale.intervals;
        const octave = Math.floor(scaleSteps / intervals.length);
        const degree = scaleSteps % intervals.length;

        return (
            rootNote +
            octave * 12 +
            intervals[degree]
        );
    }

    quantize(note) {
        const intervals = this.currentScale.intervals;
        const relative = note - KEYBOARD_ROOT_NOTE;
        const octave = Math.floor(relative / 12);

        let nearestNote = null;
        let nearestDistance = Infinity;

        for (const octaveOffset of [-1, 0, 1]) {
            for (const interval of intervals) {
                const candidate =
                    KEYBOARD_ROOT_NOTE +
                    (octave + octaveOffset) * 12 +
                    interval;

                const distance = Math.abs(candidate - note);

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
