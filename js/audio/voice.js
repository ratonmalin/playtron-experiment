```js
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

        this.oscillatorCGain = null;

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
         * OSCILLATEUR PRINCIPAL
         *
         * Le coeur du son.
         * Sine = très doux, sans agressivité.
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
         * DEUXIÈME COUCHE
         *
         * Triangle très léger pour donner
         * un peu de matière sans rendre
         * le son brillant.
         */

        this.oscillatorB =
            context.createOscillator();

        this.oscillatorB.type = "triangle";

        this.oscillatorB.frequency
            .setValueAtTime(
                frequency,
                now
            );

        this.oscillatorB.detune
            .setValueAtTime(
                4,
                now
            );


        /*
         * OCTAVE SUPÉRIEURE
         *
         * Très discrète.
         *
         * Elle donne de l'air au son,
         * mais ne doit jamais dominer
         * le registre principal.
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

        this.oscillatorCGain =
            context.createGain();

        this.oscillatorCGain.gain
            .setValueAtTime(
                0.12,
                now
            );


        /*
         * FILTRE
         *
         * Coupe une grande partie
         * de l'énergie aiguë.
         */

        this.filter =
            context.createBiquadFilter();

        this.filter.type = "lowpass";

        this.filter.frequency
            .setValueAtTime(
                1450,
                now
            );

        this.filter.Q
            .setValueAtTime(
                0.25,
                now
            );


        /*
         * MODULATION TRÈS LENTE DU FILTRE
         *
         * Le filtre respire doucement
         * au lieu de rester statique.
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
                350,
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
         *
         * Très lent et très faible.
         * Donne une sensation organique
         * au pad.
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


        /*
         * ENVELOPPE
         *
         * Attaque assez rapide pour que
         * la note soit immédiatement perceptible,
         * mais suffisamment douce pour rester
         * dans une esthétique ambient.
         */

        this.gain =
            context.createGain();

        const peakGain =
            0.09 * this.velocity;

        this.gain.gain
            .setValueAtTime(
                0.0001,
                now
            );

        this.gain.gain
            .exponentialRampToValueAtTime(
                Math.max(
                    peakGain,
                    0.0002
                ),
                now + 0.55
            );


        /*
         * POSITION STÉRÉO
         *
         * Mouvement très modéré.
         * Les notes restent proches du centre.
         */

        this.panner =
            context.createStereoPanner();

        const pan =
            ((this.note % 12) / 11) * 0.30 - 0.15;

        this.panner.pan
            .setValueAtTime(
                pan,
                now
            );


        /*
         * SEND REVERB
         *
         * La reverb reste très présente
         * pour créer la longue traîne.
         */

        this.reverbSend =
            context.createGain();

        this.reverbSend.gain
            .setValueAtTime(
                1.0,
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
            this.oscillatorCGain
        );

        this.oscillatorCGain.connect(
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

        const context = this.audioContext;
        const now = context.currentTime;

        const currentGain =
            Math.max(
                this.gain.gain.value,
                0.0001
            );


        /*
         * LONGUE DESCENTE
         *
         * La note ne disparaît pas :
         * elle se fond progressivement
         * dans la reverb.
         */

        this.gain.gain
            .cancelScheduledValues(now);

        this.gain.gain
            .setValueAtTime(
                currentGain,
                now
            );

        this.gain.gain
            .exponentialRampToValueAtTime(
                0.0001,
                now + 10
            );


        /*
         * ARRÊT DES OSCILLATEURS
         */

        this.oscillatorA.stop(
            now + 10.1
        );

        this.oscillatorB.stop(
            now + 10.1
        );

        this.oscillatorC.stop(
            now + 10.1
        );

        this.lfo.stop(
            now + 10.1
        );

        this.filterLfo.stop(
            now + 10.1
        );


        /*
         * NETTOYAGE
         */

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
            this.oscillatorCGain?.disconnect();
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

        this.oscillatorCGain = null;

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
```
