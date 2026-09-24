```js
/*
 * AUDIO ENGINE
 *
 * Le MIDI entrant est transformé en une note
 * appartenant à un registre harmonique resserré.
 */

const VERSION =
    new URL(import.meta.url).searchParams.get("v") || "unknown";

console.log(
    "[AUDIO ENGINE] Loaded version:",
    VERSION
);


/*
 * IMPORTANT
 *
 * On recharge Voice avec la même version
 * que celle utilisée pour ce module.
 */

const voiceModule =
    await import(`./voice.js?v=${VERSION}`);

const { Voice } = voiceModule;


/*
 * VOICING HARMONIQUE
 *
 * Registre resserré :
 *
 * C3 → A5
 *
 * On évite volontairement les extrêmes
 * qui donnaient l'impression de deux registres
 * complètement séparés.
 */

const HARMONIC_VOICING = [
    48, // C3
    52, // E3
    55, // G3
    57, // A3

    60, // C4
    64, // E4
    67, // G4
    69, // A4

    72, // C5
    76, // E5
    79, // G5
    81  // A5
];


function getHarmonicNote(midiNote) {

    const index =
        ((midiNote - 60) % HARMONIC_VOICING.length
            + HARMONIC_VOICING.length)
        % HARMONIC_VOICING.length;

    return HARMONIC_VOICING[index];
}


export class AudioEngine {

    constructor(eventBus) {

        this.eventBus = eventBus;

        this.audioContext = null;

        this.masterGain = null;
        this.compressor = null;

        this.reverbInput = null;
        this.reverb = null;
        this.reverbGain = null;

        this.activeVoices = new Map();

        this.started = false;

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


        console.log(
            "[AUDIO ENGINE] Constructor version:",
            VERSION
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


            /*
             * MASTER
             */

            this.masterGain =
                this.audioContext.createGain();

            this.masterGain.gain.value =
                0.42;


            /*
             * COMPRESSEUR LÉGER
             */

            this.compressor =
                this.audioContext
                    .createDynamicsCompressor();

            this.compressor.threshold.value =
                -24;

            this.compressor.knee.value =
                30;

            this.compressor.ratio.value =
                1.5;

            this.compressor.attack.value =
                0.08;

            this.compressor.release.value =
                1.2;


            /*
             * REVERB
             */

            this.createReverb();


            /*
             * SORTIE
             */

            this.masterGain.connect(
                this.compressor
            );

            this.compressor.connect(
                this.audioContext.destination
            );
        }


        /*
         * REPRENDRE LE CONTEXTE AUDIO
         */

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


        this.started = true;


        console.log(
            "[AUDIO ENGINE] Running version:",
            VERSION
        );
    }


    createReverb() {

        const context =
            this.audioContext;


        /*
         * ENTRÉE REVERB
         */

        this.reverbInput =
            context.createGain();


        /*
         * REVERB LONGUE
         */

        const duration = 14.0;
        const decay = 4.5;

        const sampleRate =
            context.sampleRate;

        const length =
            Math.floor(
                sampleRate * duration
            );


        const impulse =
            context.createBuffer(
                2,
                length,
                sampleRate
            );


        for (
            let channel = 0;
            channel < 2;
            channel++
        ) {

            const data =
                impulse.getChannelData(
                    channel
                );


            for (
                let i = 0;
                i < length;
                i++
            ) {

                const time =
                    i / sampleRate;


                const envelope =
                    Math.pow(
                        1 - time / duration,
                        decay
                    );


                const noise =
                    Math.random() * 2 - 1;


                const stereo =
                    channel === 0
                        ? 1
                        : 0.92;


                data[i] =
                    noise *
                    envelope *
                    stereo;
            }
        }


        /*
         * CONVOLVER
         */

        this.reverb =
            context.createConvolver();

        this.reverb.buffer =
            impulse;


        /*
         * VOLUME REVERB
         */

        this.reverbGain =
            context.createGain();

        this.reverbGain.gain.value =
            0.92;


        /*
         * FILTRE DE REVERB
         *
         * On coupe les aigus agressifs.
         */

        const reverbFilter =
            context.createBiquadFilter();

        reverbFilter.type =
            "lowpass";

        reverbFilter.frequency.value =
            2400;

        reverbFilter.Q.value =
            0.2;


        /*
         * ROUTING
         */

        this.reverbInput.connect(
            this.reverb
        );

        this.reverb.connect(
            reverbFilter
        );

        reverbFilter.connect(
            this.reverbGain
        );

        this.reverbGain.connect(
            this.masterGain
        );
    }


    handleEvent(event) {

        if (!this.started) {
            return;
        }


        if (
            event.type === "noteon"
        ) {

            this.noteOn(event);
        }


        if (
            event.type === "noteoff"
        ) {

            this.noteOff(event);
        }
    }


    noteOn(event) {

        const audioNote =
            getHarmonicNote(
                event.note
            );


        const voiceId =
            `${event.source}-${event.note}`;


        /*
         * Évite les doublons.
         */

        if (
            this.activeVoices.has(
                voiceId
            )
        ) {

            return;
        }


        /*
         * CRÉATION DE LA VOIX
         */

        const voice =
            new Voice(
                this.audioContext,
                this.masterGain,
                this.reverbInput,
                {
                    note: audioNote,
                    velocity: event.velocity
                }
            );


        this.activeVoices.set(
            voiceId,
            voice
        );


        voice.start();
    }


    noteOff(event) {

        const voiceId =
            `${event.source}-${event.note}`;


        const voice =
            this.activeVoices.get(
                voiceId
            );


        if (!voice) {
            return;
        }


        voice.release();


        this.activeVoices.delete(
            voiceId
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
```
