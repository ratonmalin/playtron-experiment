import { Voice } from "./voice.js";


/*
 * =========================================================
 * HARMONIC SCALE
 * =========================================================
 *
 * C major pentatonic:
 *
 * C  D  E  G  A
 *
 * Les notes MIDI entrantes sont quantifiées vers cette
 * échelle avant d'être envoyées au synthé.
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

        this.reverbOutput =
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
             * MASTER
             * =================================================
             */

            this.masterGain =
                this.audioContext.createGain();

            this.masterGain.gain.value =
                0.65;


            /*
             * =================================================
             * COMPRESSOR
             * =================================================
             *
             * Très léger.
             * Il évite que plusieurs voix simultanées
             * provoquent des pics désagréables.
             */

            this.compressor =
                this.audioContext
                    .createDynamicsCompressor();


            this.compressor.threshold.value =
                -18;

            this.compressor.knee.value =
                20;

            this.compressor.ratio.value =
                3;

            this.compressor.attack.value =
                0.02;

            this.compressor.release.value =
                0.35;


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
         * Le signal de chaque voix entre ici.
         */

        this.reverbInput =
            context.createGain();

        this.reverbOutput =
            context.createGain();


        this.reverbOutput.gain.value =
            0.75;


        /*
         * Plusieurs délais très courts créent une
         * réverbération dense de type ambient.
         */

        const delays = [
            0.071,
            0.113,
            0.173,
            0.227,
            0.311
        ];


        delays.forEach(
            (delayTime, index) => {

                const delay =
                    context.createDelay(1.0);

                const feedback =
                    context.createGain();

                const filter =
                    context.createBiquadFilter();


                delay.delayTime.value =
                    delayTime;


                /*
                 * Feedback différent pour chaque ligne.
                 */

                feedback.gain.value =
                    0.28 -
                    index * 0.025;


                /*
                 * On coupe les aigus de la reverb.
                 * Cela donne une queue plus douce.
                 */

                filter.type =
                    "lowpass";

                filter.frequency.value =
                    2600;


                this.reverbInput.connect(
                    delay
                );

                delay.connect(
                    filter
                );

                filter.connect(
                    feedback
                );

                feedback.connect(
                    delay
                );

                filter.connect(
                    this.reverbOutput
                );
            }
        );


        /*
         * Une petite ligne supplémentaire très longue
         * pour donner de la profondeur.
         */

        const longDelay =
            context.createDelay(1.0);

        const longFeedback =
            context.createGain();

        const longFilter =
            context.createBiquadFilter();


        longDelay.delayTime.value =
            0.47;

        longFeedback.gain.value =
            0.18;

        longFilter.type =
            "lowpass";

        longFilter.frequency.value =
            1800;


        this.reverbInput.connect(
            longDelay
        );

        longDelay.connect(
            longFilter
        );

        longFilter.connect(
            longFeedback
        );

        longFeedback.connect(
            longDelay
        );

        longFilter.connect(
            this.reverbOutput
        );


        /*
         * Reverb → master.
         */

        this.reverbOutput.connect(
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
         * Seule la note utilisée par l'audio est quantifiée.
         */

        const audioNote =
            quantizeToPentatonic(
                event.note
            );


        /*
         * Si plusieurs entrées demandent exactement
         * la même note harmonique, on ne crée pas une
         * nouvelle voix par-dessus.
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
