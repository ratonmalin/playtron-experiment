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
        this.index =
            (this.index + 1) % SCALES.length;

        return this.currentScale;
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
            event.source + "-" +
            event.channel + "-" +
            event.note;

        if (event.type === "noteon") {
            const mappedNote =
                this.quantize(event.note);

            this.activeNotes.set(key, mappedNote);

            return {
                ...event,
                rawNote: event.note,
                note: mappedNote
            };
        }

        const mappedNote =
            this.activeNotes.get(key) ??
            this.quantize(event.note);

        this.activeNotes.delete(key);

        return {
            ...event,
            rawNote: event.note,
            note: mappedNote
        };
    }

    quantize(note) {
        const intervals = this.currentScale.intervals;
        const relative = note - ROOT_NOTE;
        const octave = Math.floor(relative / 12);
        const pitchClass = ((relative % 12) + 12) % 12;

        let nearest = null;

        for (const interval of intervals) {
            const candidate = interval - pitchClass;

            if (
                nearest === null ||
                Math.abs(candidate) < Math.abs(nearest)
            ) {
                nearest = candidate;
            }
        }

        const lower =
            ROOT_NOTE +
            octave * 12 +
            pitchClass +
            nearest;

        const upper =
            lower +
            (nearest >= 0 ? 0 : 12);

        if (Math.abs(upper - note) < Math.abs(lower - note)) {
            return upper;
        }

        return lower;
    }

    resetHeldNotes() {
        this.activeNotes.clear();
    }
}
