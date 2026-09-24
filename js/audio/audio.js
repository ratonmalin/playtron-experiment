import { Voice } from "./voice.js";


/*
 * =========================================================
 * HARMONIC SCALE
 * =========================================================
 *
 * C major pentatonic:
 *
 * C - D - E - G - A
 *
 * Toutes les notes entrantes sont quantifiées vers
 * cette gamme avant d'être jouées.
 */

const PENTATONIC =
    [0, 2, 4, 7, 9];


function quantizeToPentatonic(note) {

    const octave =
        Math.floor(note / 12);

    const pitchClass =
        note % 12;


    let closest =
        PENTATONIC[0];

    let smallestDistance =
        Infinity;


    for (
        const candidate
        of PENTATONIC
    ) {

        const distance =
            Math.abs(
                candidate - pitchClass
            );


        if (
            distance <
            smallestDistance
        ) {

            smallestDistance =
                distance;

            closest =
                candidate;
        }
    }


    return (
        octave * 12 +
        closest
    );
}


export class AudioEngine {

    constructor(eventBus) {

        this.eventBus =
            eventBus;

        this.audioContext =
            null;

        this.masterGain =
            null;

        this.compressor =
            null;

        this.reverbInput =
            null;

        this.reverb =
            null;

        this.reverbGain =
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


            /*
             * =================================================
             * MASTER GAIN
             * =================================================
             */

            this.masterGain =
                this.audioContext.createGain();

            this.masterGain.gain.value =
                0.55;


            /*
             * =================================================
             * MASTER COMPRESSOR
             * =================================================
             *
             * Protection légère contre les accumulations
             * de nombreuses voix.
             */

            this.compressor =
                this.audioContext
                    .createDynamicsCompressor();


            this.compressor.threshold.value =
                -20;

            this.compressor.knee.value =
                25;

            this.compressor.ratio.value =
                2;

            this.compressor.attack.value =
                0.04;

            this.compressor.release.value =
                0.5;


            /*
             * =================================================
             * REVERB
             * =================================================
             */

            this.createReverb();


            /*
             * =================================================
             * OUTPUT
             * =================================================
             */

            this.masterGain.connect(
                this.compressor
            );

            this.compressor.connect(
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


    createReverb() {

        const context =
            this.audioContext;


        /*
         * =================================================
         * REVERB INPUT
         * =================================================
         */

        this.reverbInput =
            context.createGain();


        /*
         * =================================================
         * CONVOLUTION REVERB
         * =================================================
         *
         * On génère une impulse response directement
         * dans le navigateur.
         */

        const duration =
            7.0;

        const decay =
            3.8;

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


                /*
                 * Bruit décroissant.
                 *
                 * Les hautes fréquences disparaissent
                 * progressivement grâce au facteur de decay.
                 */

                const envelope =
                    Math.pow(
                        1 - time / duration,
                        decay
                    );


                const noise =
                    (
                        Math.random() * 2
                    ) - 1;


                /*
                 * Différence légère entre les canaux
                 * pour créer une impression stéréo.
                 */

                const stereo =
                    channel === 0
                        ? 1
                        : 0.88;


                data[i] =
                    noise *
                    envelope *
                    stereo;
            }
        }


        this.reverb =
            context.createConvolver();


        this.reverb.buffer =
            impulse;


        /*
         * =================================================
         * REVERB GAIN
         * =================================================
         */

        this.reverbGain =
            context.createGain();


        this.reverbGain.gain.value =
            0.62;


        /*
         * =================================================
         * REVERB FILTER
         *
         * On retire une partie des aigus pour obtenir
         * une reverb chaude plutôt que métallique.
         */

        const reverbFilter =
            context.createBiquadFilter();


        reverbFilter.type =
            "lowpass";

        reverbFilter.frequency.value =
            3200;

        reverbFilter.Q.value =
            0.25;


        /*
         * =================================================
         * ROUTING
         * =================================================
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
            event.type ===
            "noteon"
        ) {

            this.noteOn(event);
        }


        if (
            event.type ===
            "noteoff"
        ) {

            this.noteOff(event);
        }
    }


    noteOn(event) {

        /*
         * La note MIDI originale reste intacte dans
         * l'EventBus.
         *
         * Seule la note utilisée par le moteur sonore
         * est quantifiée.
         */

        const audioNote =
            quantizeToPentatonic(
                event.note
            );


        /*
         * Plusieurs entrées peuvent demander la même
         * note harmonique.
         *
         * Pour l'instant, une seule voix est conservée
         * pour éviter l'accumulation excessive.
         */

        if (
            this.activeVoices.has(
                audioNote
            )
        ) {

            return;
        }


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
            audioNote,
            voice
        );


        voice.start();
    }


    noteOff(event) {

        const audioNote =
            quantizeToPentatonic(
                event.note
            );


        const voice =
            this.activeVoices.get(
                audioNote
            );


        if (!voice) {
            return;
        }


        voice.release();


        this.activeVoices.delete(
            audioNote
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
