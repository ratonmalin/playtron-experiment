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
const PLAYTRON_RAW_NOTES = Array.from(
    { length: 16 },
    (_, index) => 48 + index
);

const PLAYTRON_NOTE_TO_INDEX = new Map(
    PLAYTRON_RAW_NOTES.map((note, index) => [note, index])
);

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
        const rawIndex = PLAYTRON_NOTE_TO_INDEX.get(note);

        // Never let an unknown MIDI note silently collapse onto the last
        // Playtron input. Keep it musically valid, but preserve a predictable
        // fallback for custom device mappings.
        const index = rawIndex ?? Math.max(
            0,
            Math.min(
                PLAYTRON_RAW_NOTES.length - 1,
                Math.round(note - PLAYTRON_RAW_NOTES[0])
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
