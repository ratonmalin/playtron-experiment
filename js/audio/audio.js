export class Voice {

    constructor(
        audioContext,
        destination,
        reverbInput,
        { note, velocity }
    ) {
        this.audioContext = audioContext;
        this.destination = destination;
        this.reverbInput = reverbInput;

        this.note = note;
        this.velocity = velocity;

        this.oscillatorA = null;
        this.oscillatorB = null;
        this.oscillatorC = null;
        this.oscillatorD = null;

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

        const context = this.audioContext;
        const now = context.currentTime;

        const frequency =
            440 * Math.pow(
                2,
                (this.note - 69) / 12
            );


        /*
         * COUCHE PRINCIPALE
         */

        this.oscillatorA =
            context.createOscillator();

        this.oscillatorA.type = "sine";

        this.oscillatorA.frequency
            .setValueAtTime(
                frequency,
                now
            );


        /*
         * COUCHE LÉGÈREMENT DÉSACCORDÉE
         *
         * Donne de la largeur sans créer
         * un effet de synthé agressif.
         */

        this.oscillatorB =
            context.createOscillator();

        this.oscillatorB.type = "sine";

        this.oscillatorB.frequency
            .setValueAtTime(
                frequency,
                now
            );

        this.oscillatorB.detune
            .setValueAtTime(
                5,
                now
            );


        /*
         * OCTAVE SUPÉRIEURE
         *
         * Très faible niveau : elle apporte
         * la sensation de lumière.
         */

        this.oscillatorC =
            context.createOscillator();

        this.oscillatorC.type = "sine";

        this.oscillatorC.frequency
            .setValueAtTime(
                frequency * 2,
                now
            );

        this.oscillatorC.detune
            .setValueAtTime(
                -4,
                now
            );


        /*
         * QUINZIÈME SUPÉRIEURE
         *
         * Encore plus discrète.
         * C'est cette couche qui donne
         * davantage de présence "céleste".
         */

        this.oscillatorD =
            context.createOscillator();

        this.oscillatorD.type = "sine";

        this.oscillatorD.frequency
            .setValueAtTime(
                frequency * 4,
                now
            );

        this.oscillatorD.detune
            .setValueAtTime(
                3,
                now
            );


        /*
         * FILTRE DOUX
         */

        this.filter =
            context.createBiquadFilter();

        this.filter.type = "lowpass";

        this.filter.frequency
            .setValueAtTime(
                1800,
                now
            );

        this.filter.Q
            .setValueAtTime(
                0.2,
                now
            );


        /*
         * OUVERTURE LENTE DU FILTRE
         */

        this.filterLfo =
            context.createOscillator();

        this.filterLfoGain =
            context.createGain();

        this.filterLfo.type = "sine";

        this.filterLfo.frequency
            .setValueAtTime(
                0.045,
                now
            );

        this.filterLfoGain.gain
            .setValueAtTime(
                650,
                now
            );

        this.filterLfo.connect(
            this.filterLfoGain
        );

        this.filterLfoGain.connect(
            this.filter.frequency
        );


        /*
         * MICRO-MOUVEMENT DE HAUTEUR
         */

        this.lfo =
            context.createOscillator();

        this.lfoGain =
            context.createGain();

        this.lfo.type = "sine";

        this.lfo.frequency
            .setValueAtTime(
                0.07,
                now
            );

        this.lfoGain.gain
            .setValueAtTime(
                1.2,
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

        this.lfoGain.connect(
            this.oscillatorD.detune
        );


        /*
         * ENVELOPPE
         */

        this.gain =
            context.createGain();

        const peakGain =
            0.065 * this.velocity;


        this.gain.gain
            .setValueAtTime(
                0.0001,
                now
            );


        /*
         * ATTAQUE :
         * beaucoup plus rapide que précédemment.
         */

        this.gain.gain
            .exponentialRampToValueAtTime(
                Math.max(
                    peakGain,
                    0.0002
                ),
                now + 0.45
            );


        /*
         * PANORAMIQUE
         */

        this.panner =
            context.createStereoPanner();

        const pan =
            ((this.note % 12) / 11) * 0.55 - 0.275;

        this.panner.pan
            .setValueAtTime(
                pan,
                now
            );


        /*
         * REVERB
         */

        this.reverbSend =
            context.createGain();

        this.reverbSend.gain
            .setValueAtTime(
                0.95,
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

        this.oscillatorD.connect(
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
         * SIGNAL RÉVERBÉRÉ
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
        this.oscillatorD.start(now);
    }


    release() {

        if (this.isReleased) {
            return;
        }

        this.isReleased = true;

        const context = this.audioContext;
        const now = context.currentTime;

        const currentGain =
            Math.max(
                this.gain.gain.value,
                0.0001
            );


        this.gain.gain
            .cancelScheduledValues(now);

        this.gain.gain
            .setValueAtTime(
                currentGain,
                now
            );


        /*
         * LONGUE DISPARITION
         */

        this.gain.gain
            .exponentialRampToValueAtTime(
                0.0001,
                now + 10
            );


        this.oscillatorA.stop(
            now + 10.1
        );

        this.oscillatorB.stop(
            now + 10.1
        );

        this.oscillatorC.stop(
            now + 10.1
        );

        this.oscillatorD.stop(
            now + 10.1
        );

        this.lfo.stop(
            now + 10.1
        );

        this.filterLfo.stop(
            now + 10.1
        );


        this.releaseTimer =
            window.setTimeout(
                () => {
                    this.disconnect();
                },
                10500
            );
    }


    disconnect() {

        if (this.releaseTimer !== null) {

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
            this.oscillatorD?.disconnect();
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
        this.oscillatorD = null;

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
