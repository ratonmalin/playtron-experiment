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

const PLAYTRON_ROOT_NOTE = 48;
const KEYBOARD_ROOT_NOTE = 48;
const PLAYTRON_INPUT_COUNT = 16;
const PLAYTRON_MAX_SCALE_STEP = 7;

export class ScaleManager {
    constructor() {
        this.index = 0;
        this.activeNotes = new Map();
        this.playtronRawNotes = [];
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

        if (!this.playtronRawNotes.includes(note)) {
            this.playtronRawNotes.push(note);
            this.playtronRawNotes.sort((a, b) => a - b);

            if (this.playtronRawNotes.length > PLAYTRON_INPUT_COUNT) {
                this.playtronRawNotes.shift();
            }
        }

        const index = Math.max(
            0,
            this.playtronRawNotes.indexOf(note)
        );

        const scaleSteps = Math.round(
            index * PLAYTRON_MAX_SCALE_STEP /
            (PLAYTRON_INPUT_COUNT - 1)
        );

        return this.scaleNote(
            PLAYTRON_ROOT_NOTE,
            scaleSteps
        );
    }

    mapKeyboardNote(note) {
        const keyboardIndex = Math.max(
            0,
            Math.min(
                15,
                Math.round(note - 60)
            )
        );

        // The test keyboard follows exactly the same low register as
        // the Playtron, so testing with the keyboard gives a realistic
        // preview of the final installation.
        const scaleSteps = Math.round(
            keyboardIndex * PLAYTRON_MAX_SCALE_STEP / 15
        );

        return this.scaleNote(
            KEYBOARD_ROOT_NOTE,
            scaleSteps
        );
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
