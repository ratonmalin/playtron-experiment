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

        this.oscillatorA =
            null;

        this.oscillatorB =
            null;

        this.oscillatorC =
            null;

        this.filter =
            null;

        this.gain =
            null;

        this.reverbSend =
            null;

        this.panner =
            null;

        this.lfo =
            null;

        this.lfoGain =
            null;

        this.filterLfo =
            null;

        this.filterLfoGain =
            null;

        this.isReleased =
            false;

        this.releaseTimer =
            null;
    }


    start() {

        const now =
            this.audioContext.currentTime;


        /*
         * =====================================================
         * NOTE → FREQUENCY
         * =====================================================
         */

        const frequency =
            440 *
            Math.pow(
                2,
                (this.note - 69) / 12
            );


        /*
         * =====================================================
         * OSCILLATOR A
         *
         * Fondamental très doux.
         * =====================================================
         */

        this.oscillatorA =
            this.audioContext.createOscillator();

        this.oscillatorA.type =
            "sine";

        this.oscillatorA.frequency.setValueAtTime(
            frequency,
            now
        );

        this.oscillatorA.detune.setValueAtTime(
            -5,
            now
        );


        /*
         * =====================================================
         * OSCILLATOR B
         *
         * Donne le corps du pad.
         * =====================================================
         */

        this.oscillatorB =
            this.audioContext.createOscillator();

        this.oscillatorB.type =
            "triangle";

        this.oscillatorB.frequency.setValueAtTime(
            frequency,
            now
        );

        this.oscillatorB.detune.setValueAtTime(
            5,
            now
        );


        /*
         * =====================================================
         * OSCILLATOR C
         *
         * Une couche très légèrement plus haute.
         * Elle est fortement filtrée et très faible.
         * =====================================================
         */

        this.oscillatorC =
            this.audioContext.createOscillator();

        this.oscillatorC.type =
            "sine";

        this.oscillatorC.frequency.setValueAtTime(
            frequency * 2,
            now
        );

        this.oscillatorC.detune.setValueAtTime(
            -7,
            now
        );


        /*
         * =====================================================
         * FILTER
         * =====================================================
         */

        this.filter =
            this.audioContext.createBiquadFilter();

        this.filter.type =
            "lowpass";

        this.filter.frequency.setValueAtTime(
            1250,
            now
        );

        this.filter.Q.setValueAtTime(
            0.35,
            now
        );


        /*
         * =====================================================
         * FILTER LFO
         *
         * Mouvement extrêmement lent du timbre.
         * =====================================================
         */

        this.filterLfo =
            this.audioContext.createOscillator();

        this.filterLfoGain =
            this.audioContext.createGain();


        this.filterLfo.type =
            "sine";

        this.filterLfo.frequency.setValueAtTime(
            0.075,
            now
        );

        this.filterLfoGain.gain.setValueAtTime(
            500,
            now
        );


        this.filterLfo.connect(
            this.filterLfoGain
        );

        this.filterLfoGain.connect(
            this.filter.frequency
        );


        /*
         * =====================================================
         * SLOW PITCH MODULATION
         *
         * Très faible mouvement de hauteur.
         * Presque imperceptible individuellement,
         * mais donne de la vie au son.
         * =====================================================
         */

        this.lfo =
            this.audioContext.createOscillator();

        this.lfoGain =
            this.audioContext.createGain();


        this.lfo.type =
            "sine";

        this.lfo.frequency.setValueAtTime(
            0.12,
            now
        );

        this.lfoGain.gain.setValueAtTime(
            2.5,
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
         * =====================================================
         * VOICE GAIN
         * =====================================================
         *
         * Très faible niveau par voix :
         * on veut pouvoir empiler beaucoup de notes.
         */

        this.gain =
            this.audioContext.createGain();


        const peakGain =
            0.085 *
            this.velocity;


        this.gain.gain.setValueAtTime(
            0.0001,
            now
        );


        /*
         * =====================================================
         * ATTACK
         * =====================================================
         */

        this.gain.gain.exponentialRampToValueAtTime(
            Math.max(
                peakGain,
                0.0002
            ),
            now + 0.7
        );


        /*
         * =====================================================
         * STEREO POSITION
         * =====================================================
         *
         * Chaque voix occupe légèrement une position
         * différente dans le champ stéréo.
         */

        this.panner =
            this.audioContext.createStereoPanner();


        const pan =
            (
                (
                    this.note % 12
                ) / 11
            ) * 0.5 - 0.25;


        this.panner.pan.setValueAtTime(
            pan,
            now
        );


        /*
         * =====================================================
         * REVERB SEND
         * =====================================================
         */

        this.reverbSend =
            this.audioContext.createGain();


        this.reverbSend.gain.setValueAtTime(
            0.62,
            now
        );


        /*
         * =====================================================
         * AUDIO ROUTING
         * =====================================================
         *
         * 3 oscillateurs
         *       ↓
         *     FILTER
         *       ↓
         *     GAIN
         *       ↓
         *    PANNER
         *      ↙  ↘
         *   DRY    REVERB
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


        this.gain.connect(
            this.panner
        );


        this.panner.connect(
            this.destination
        );


        this.gain.connect(
            this.reverbSend
        );


        this.reverbSend.connect(
            this.reverbInput
        );


        /*
         * =====================================================
         * START MODULATIONS
         * =====================================================
         */

        this.lfo.start(
            now
        );

        this.filterLfo.start(
            now
        );


        /*
         * =====================================================
         * START OSCILLATORS
         * =====================================================
         */

        this.oscillatorA.start(
            now
        );

        this.oscillatorB.start(
            now
        );

        this.oscillatorC.start(
            now
        );
    }


    release() {

        if (this.isReleased) {
            return;
        }


        this.isReleased =
            true;


        const now =
            this.audioContext.currentTime;


        const currentGain =
            Math.max(
                this.gain.gain.value,
                0.0001
            );


        this.gain.gain.cancelScheduledValues(
            now
        );


        this.gain.gain.setValueAtTime(
            currentGain,
            now
        );


        /*
         * =====================================================
         * LONG AMBIENT RELEASE
         * =====================================================
         */

        this.gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + 5
        );


        /*
         * Les oscillateurs restent vivants pendant
         * toute la décroissance.
         */

        this.oscillatorA.stop(
            now + 5.1
        );

        this.oscillatorB.stop(
            now + 5.1
        );

        this.oscillatorC.stop(
            now + 5.1
        );

        this.lfo.stop(
            now + 5.1
        );

        this.filterLfo.stop(
            now + 5.1
        );


        this.releaseTimer =
            window.setTimeout(
                () => {
                    this.disconnect();
                },
                5300
            );
    }


    disconnect() {

        if (
            this.releaseTimer !== null
        ) {

            clearTimeout(
                this.releaseTimer
            );

            this.releaseTimer =
                null;
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


        this.oscillatorA =
            null;

        this.oscillatorB =
            null;

        this.oscillatorC =
            null;

        this.filter =
            null;

        this.gain =
            null;

        this.reverbSend =
            null;

        this.panner =
            null;

        this.lfo =
            null;

        this.lfoGain =
            null;

        this.filterLfo =
            null;

        this.filterLfoGain =
            null;
    }
}
