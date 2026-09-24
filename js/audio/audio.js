import { Voice } from "./voice.js";


export class AudioEngine {

    constructor(eventBus) {

        this.eventBus =
            eventBus;


        this.audioContext =
            null;


        this.masterGain =
            null;


        this.activeVoices =
            new Map();


        this.started =
            false;


        this.handleEvent =
            this.handleEvent.bind(this);


        eventBus.on(
            "noteon",
            this.handleEvent
        );


        eventBus.on(
            "noteoff",
            this.handleEvent
        );
    }


    async start() {

        if (!this.audioContext) {

            const AudioContext =
                window.AudioContext ||
                window.webkitAudioContext;


            if (!AudioContext) {

                throw new Error(
                    "Web Audio API indisponible."
                );

            }


            this.audioContext =
                new AudioContext();


            this.masterGain =
                this.audioContext.createGain();


            this.masterGain.gain.value =
                0.7;


            this.masterGain.connect(
                this.audioContext.destination
            );
        }


        if (
            this.audioContext.state ===
            "suspended"
        ) {

            await this.audioContext.resume();

        }


        if (
            this.audioContext.state !==
            "running"
        ) {

            throw new Error(
                `AudioContext state: ${this.audioContext.state}`
            );

        }


        this.started =
            true;


        console.log(
            "[AUDIO ENGINE] Running."
        );
    }


    handleEvent(event) {

        if (!this.started) {
            return;
        }


        if (event.type === "noteon") {

            this.noteOn(event);

        }


        if (event.type === "noteoff") {

            this.noteOff(event);

        }
    }


    noteOn(event) {

        if (
            this.activeVoices.has(
                event.note
            )
        ) {

            return;

        }


        const voice =
            new Voice(
                this.audioContext,
                this.masterGain,
                {
                    note: event.note,
                    velocity: event.velocity
                }
            );


        this.activeVoices.set(
            event.note,
            voice
        );


        voice.start();
    }


    noteOff(event) {

        const voice =
            this.activeVoices.get(
                event.note
            );


        if (!voice) {
            return;
        }


        voice.release();


        this.activeVoices.delete(
            event.note
        );
    }


    panic() {

        for (
            const voice
            of this.activeVoices.values()
        ) {

            voice.release();

        }


        this.activeVoices.clear();
    }


    async resume() {

        if (!this.audioContext) {
            return;
        }


        if (
            this.audioContext.state ===
            "suspended"
        ) {

            await this.audioContext.resume();

        }
    }
}
