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

// Playtron normally starts around C3. Keep the physical input mapping
// musically comfortable for the installation: one octave higher, then
// quantize into the currently selected scale.
const PLAYTRON_TRANSPOSE = 12;
const PLAYTRON_MIN_NOTE = 60;
const PLAYTRON_MAX_NOTE = 84;

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
        const transposed = note + PLAYTRON_TRANSPOSE;
        const clamped = Math.max(
            PLAYTRON_MIN_NOTE,
            Math.min(PLAYTRON_MAX_NOTE, transposed)
        );

        return this.quantize(clamped);
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
