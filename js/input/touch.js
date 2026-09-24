export class TouchInput {
    constructor(eventBus, element, keyboardMapping) {
        this.eventBus = eventBus;
        this.element = element;
        this.keyboardMapping = keyboardMapping;
        this.activePointers = new Map();

        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
        this.handlePointerCancel = this.handlePointerCancel.bind(this);
    }

    start() {
        if (!this.element) return;

        this.element.addEventListener(
            "pointerdown",
            this.handlePointerDown
        );
        this.element.addEventListener(
            "pointermove",
            this.handlePointerMove
        );
        this.element.addEventListener(
            "pointerup",
            this.handlePointerUp
        );
        this.element.addEventListener(
            "pointercancel",
            this.handlePointerCancel
        );
    }

    stop() {
        if (!this.element) return;

        this.element.removeEventListener(
            "pointerdown",
            this.handlePointerDown
        );
        this.element.removeEventListener(
            "pointermove",
            this.handlePointerMove
        );
        this.element.removeEventListener(
            "pointerup",
            this.handlePointerUp
        );
        this.element.removeEventListener(
            "pointercancel",
            this.handlePointerCancel
        );

        this.releaseAll();
    }

    handlePointerDown(event) {
        if (event.pointerType !== "touch") return;

        const keyElement = this.getKeyAtPoint(
            event.clientX,
            event.clientY
        );

        if (!keyElement) return;

        event.preventDefault();

        try {
            this.element.setPointerCapture(event.pointerId);
        } catch {}

        const key = keyElement.dataset.key;
        const note = this.keyboardMapping[key];

        if (note === undefined) return;

        this.activePointers.set(event.pointerId, {
            key,
            note
        });

        this.emitNoteOn(note);
    }

    handlePointerMove(event) {
        if (event.pointerType !== "touch") return;

        const active = this.activePointers.get(event.pointerId);

        if (!active) return;

        const keyElement = this.getKeyAtPoint(
            event.clientX,
            event.clientY
        );

        if (!keyElement) return;

        const key = keyElement.dataset.key;

        if (key === active.key) return;

        const note = this.keyboardMapping[key];

        if (note === undefined) return;

        event.preventDefault();

        this.emitNoteOff(active.note);

        active.key = key;
        active.note = note;

        this.emitNoteOn(note);
    }

    handlePointerUp(event) {
        if (event.pointerType !== "touch") return;

        this.releasePointer(event.pointerId);
    }

    handlePointerCancel(event) {
        if (event.pointerType !== "touch") return;

        this.releasePointer(event.pointerId);
    }

    releasePointer(pointerId) {
        const active =
            this.activePointers.get(pointerId);

        if (!active) return;

        this.emitNoteOff(active.note);
        this.activePointers.delete(pointerId);
    }

    releaseAll() {
        for (const pointerId of this.activePointers.keys()) {
            this.releasePointer(pointerId);
        }
    }

    emitNoteOn(note) {
        this.eventBus.emit({
            type: "noteon",
            note,
            velocity: 1,
            channel: 0,
            source: "touch",
            timestamp: performance.now()
        });
    }

    emitNoteOff(note) {
        this.eventBus.emit({
            type: "noteoff",
            note,
            velocity: 0,
            channel: 0,
            source: "touch",
            timestamp: performance.now()
        });
    }

    getKeyAtPoint(x, y) {
        const element =
            document.elementFromPoint(x, y);

        if (!element) return null;

        return element.closest(".key");
    }
}
