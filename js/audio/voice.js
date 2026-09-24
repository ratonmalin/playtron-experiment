export class Voice {

    constructor(
        audioContext,
        destination,
        reverbInput,
        { note, velocity }
    ) {

        this.audioContext =
            audioContext;

        this.destination =
            destination;

        this.reverbInput =
            reverbInput;

        this.note =
            note;

        this.velocity =
            velocity;

        this.oscillatorA = null;
        this.oscillatorB = null;
        this.oscillatorC = null;

        this.filter = null;

        this.gain = null;
        this.reverbSend = null;

        this.panner = null;

        this.lfo = null;
        this.lfoGain = null;

        this.filterLfo = null;
        this.filterLfoGain = null;

        this.isReleased = false;
        this.releaseTimer = null;
    }


    start() {

        const context =
            this.audioContext;

        const now =
            context.currentTime;


        const frequency =
            440 *
            Math.pow(
                2,
                (this.note - 69) / 12
            );


        /*
         * OSCILLATEUR PRINCIPAL
         */

        this.oscillatorA =
            context.createOscillator();

        this.oscillatorA.type =
            "sine";

        this.oscillatorA.frequency
            .setValueAtTime(
                frequency,
                now
            );


        /*
         * SECONDE COUCHE
         *
         * Très légèrement désaccordée.
         */

        this.oscillatorB =
            context.createOscillator();

        this.oscillatorB.type =
            "triangle";

        this.oscillatorB.frequency
            .setValueAtTime(
                frequency,
                now
            );

        this.oscillatorB.detune
            .setValueAtTime(
                7,
                now
            );


        /*
         * HARMONIQUE SUPÉRIEURE
         */

        this.oscillatorC =
            context.createOscillator();

        this.oscillatorC.type =
            "sine";

        this.oscillatorC.frequency
            .setValueAtTime(
                frequency * 2,
                now
            );

        this.oscillatorC.detune
            .setValueAtTime(
                -5,
                now
            );


        /*
         * FILTRE
         */

        this.filter =
            context.createBiquadFilter();

        this.filter.type =
            "lowpass";

        this.filter.frequency
            .setValueAtTime(
                1100,
                now
            );

        this.filter.Q
            .setValueAtTime(
                0.3,
                now
            );


        /*
         * MODULATION LENTE DU FILTRE
         */

        this.filterLfo =
            context.createOscillator();

        this.filterLfoGain =
            context.createGain();

        this.filterLfo.type =
            "sine";

        this.filterLfo.frequency
            .setValueAtTime(
                0.055,
                now
            );

        this.filterLfoGain.gain
            .setValueAtTime(
                380,
                now
            );

        this.filterLfo.connect(
            this.filterLfoGain
        );

        this.filterLfoGain.connect(
            this.filter.frequency
        );


        /*
         * VIBRATION TRÈS LENTE
         */

        this.lfo =
            context.createOscillator();

        this.lfoGain =
            context.createGain();

        this.lfo.type =
            "sine";

        this.lfo.frequency
            .setValueAtTime(
                0.09,
                now
            );

        this.lfoGain.gain
            .setValueAtTime(
                1.8,
                now
            );

        this.lfo.connect(
            this.lfoGain
        );

        this.lfoGain.connect(
            this.oscillatorA.detune
        );

        this.lfoGain.connect(
            this.oscillatorB.detune
        );

        this.lfoGain.connect(
            this.oscillatorC.detune
        );


        /*
         * ENVELOPPE
         */

        this.gain =
            context.createGain();


        const peakGain =
            0.075 *
            this.velocity;


        /*
         * DÉPART QUASI SILENCIEUX
         */

        this.gain.gain
            .setValueAtTime(
                0.0001,
                now
            );


        /*
         * FADE IN TRÈS LONG
         *
         * 2.5 secondes.
         */

        this.gain.gain
            .exponentialRampToValueAtTime(
                Math.max(
                    peakGain,
                    0.0002
                ),
                now + 2.5
            );


        /*
         * PANORAMIQUE
         */

        this.panner =
            context.createStereoPanner();


        /*
         * Placement doux dans le champ stéréo.
         */

        const pan =
            ((this.note % 12) / 11) *
            0.5 -
            0.25;


        this.panner.pan
            .setValueAtTime(
                pan,
                now
            );


        /*
         * SEND REVERB
         */

        this.reverbSend =
            context.createGain();


        /*
         * Signal fortement envoyé
         * dans la reverb.
         */

        this.reverbSend.gain
            .setValueAtTime(
                0.82,
                now
            );


        /*
         * ROUTING
         */

        this.oscillatorA.connect(
            this.filter
        );

        this.oscillatorB.connect(
            this.filter
        );

        this.oscillatorC.connect(
            this.filter
        );


        this.filter.connect(
            this.gain
        );


        /*
         * SIGNAL DIRECT
         */

        this.gain.connect(
            this.panner
        );

        this.panner.connect(
            this.destination
        );


        /*
         * SIGNAL REVERB
         */

        this.gain.connect(
            this.reverbSend
        );

        this.reverbSend.connect(
            this.reverbInput
        );


        /*
         * DÉMARRAGE
         */

        this.lfo.start(now);

        this.filterLfo.start(now);

        this.oscillatorA.start(now);
        this.oscillatorB.start(now);
        this.oscillatorC.start(now);
    }


    release() {

        if (this.isReleased) {
            return;
        }

        this.isReleased = true;


        const context =
            this.audioContext;

        const now =
            context.currentTime;


        /*
         * FADE OUT TRÈS LONG
         *
         * 12 secondes.
         */

        const currentGain =
            Math.max(
                this.gain.gain.value,
                0.0001
            );


        this.gain.gain
            .cancelScheduledValues(
                now
            );

        this.gain.gain
            .setValueAtTime(
                currentGain,
                now
            );

        this.gain.gain
            .exponentialRampToValueAtTime(
                0.0001,
                now + 12
            );


        /*
         * Les oscillateurs restent actifs
         * pendant tout le fade.
         */

        this.oscillatorA.stop(
            now + 12.1
        );

        this.oscillatorB.stop(
            now + 12.1
        );

        this.oscillatorC.stop(
            now + 12.1
        );

        this.lfo.stop(
            now + 12.1
        );

        this.filterLfo.stop(
            now + 12.1
        );


        this.releaseTimer =
            window.setTimeout(
                () => {
                    this.disconnect();
                },
                12500
            );
    }


    disconnect() {

        if (
            this.releaseTimer !== null
        ) {

            clearTimeout(
                this.releaseTimer
            );

            this.releaseTimer = null;
        }


        try {
            this.oscillatorA?.disconnect();
        } catch {}

        try {
            this.oscillatorB?.disconnect();
        } catch {}

        try {
            this.oscillatorC?.disconnect();
        } catch {}

        try {
            this.filter?.disconnect();
        } catch {}

        try {
            this.gain?.disconnect();
        } catch {}

        try {
            this.reverbSend?.disconnect();
        } catch {}

        try {
            this.panner?.disconnect();
        } catch {}

        try {
            this.lfo?.disconnect();
        } catch {}

        try {
            this.lfoGain?.disconnect();
        } catch {}

        try {
            this.filterLfo?.disconnect();
        } catch {}

        try {
            this.filterLfoGain?.disconnect();
        } catch {}


        this.oscillatorA = null;
        this.oscillatorB = null;
        this.oscillatorC = null;

        this.filter = null;

        this.gain = null;
        this.reverbSend = null;

        this.panner = null;

        this.lfo = null;
        this.lfoGain = null;

        this.filterLfo = null;
        this.filterLfoGain = null;
    }
}
