export class MidiInput {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.access = null;
        this.inputs = new Map();
        this.handleMessage = this.handleMessage.bind(this);
    }

    async start() {
        if (!navigator.requestMIDIAccess) {
            console.log("[MIDI] Web MIDI unavailable.");
            return;
        }

        try {
            this.access = await navigator.requestMIDIAccess();
            this.refreshInputs();
            this.access.onstatechange = event => {
                console.log("[MIDI] State change:", event.port?.name, event.port?.state);
                this.refreshInputs();
            };
            console.log("[MIDI] Ready. Inputs:", this.access.inputs.size);
        } catch (error) {
            console.warn(
                "[MIDI] Access unavailable:",
                error?.name || "UnknownError",
                error?.message || error
            );
        }
    }

    refreshInputs() {
        for (const input of this.access.inputs.values()) {
            if (this.inputs.has(input.id)) continue;
            input.onmidimessage = this.handleMessage;
            this.inputs.set(input.id, input);
            console.log("[MIDI] Input:", input.name);
        }
    }

    handleMessage(message) {
        const [status, note, velocity] = message.data;
        const type = status & 0xf0;
        const channel = status & 0x0f;

        if (type === 0x90 && velocity > 0) {
            console.log(
                "[MIDI] Note On:",
                note,
                "velocity:",
                velocity,
                "channel:",
                channel + 1
            );

            this.eventBus.emit({
                type: "noteon",
                note,
                velocity: velocity / 127,
                channel,
                source: "midi",
                timestamp: performance.now()
            });
        }

        if (type === 0x80 || (type === 0x90 && velocity === 0)) {
            console.log(
                "[MIDI] Note Off:",
                note,
                "channel:",
                channel + 1
            );

            this.eventBus.emit({
                type: "noteoff",
                note,
                velocity: 0,
                channel,
                source: "midi",
                timestamp: performance.now()
            });
        }
    }
}
