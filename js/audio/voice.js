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

        this.filter =
            null;

        this.gain =
            null;

        this.reverbSend =
            null;

        this.isReleased =
            false;

        this.releaseTimer =
            null;
    }


    start() {

        const now =
            this.audioContext.currentTime;

        const frequency =
            440 *
            Math.pow(
                2,
                (this.note - 69) / 12
            );


        /*
         * =====================================================
         * OSCILLATORS
         * =====================================================
         */

        this.oscillatorA =
            this.audioContext.createOscillator();

        this.oscillatorB =
            this.audioContext.createOscillator();


        this.oscillatorA.type =
            "sine";

        this.oscillatorB.type =
            "triangle";


        this.oscillatorA.frequency.setValueAtTime(
            frequency,
            now
        );

        this.oscillatorB.frequency.setValueAtTime(
            frequency,
            now
        );


        // Très léger désaccordage.
        this.oscillatorA.detune.setValueAtTime(
            -4,
            now
        );

        this.oscillatorB.detune.setValueAtTime(
            4,
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
            1800,
            now
        );

        this.filter.Q.setValueAtTime(
            0.45,
            now
        );


        /*
         * =====================================================
         * VOICE GAIN
         * =====================================================
         */

        this.gain =
            this.audioContext.createGain();

        const peakGain =
            0.075 *
            this.velocity;


        this.gain.gain.setValueAtTime(
            0.0001,
            now
        );


        /*
         * Long attack.
         */

        this.gain.gain.exponentialRampToValueAtTime(
            Math.max(
                peakGain,
                0.0002
            ),
            now + 0.45
        );


        /*
         * =====================================================
         * REVERB SEND
         * =====================================================
         */

        this.reverbSend =
            this.audioContext.createGain();

        this.reverbSend.gain.setValueAtTime(
            0.32,
            now
        );


        /*
         * =====================================================
         * AUDIO ROUTING
         * =====================================================
         *
         * oscillator A
         *       \
         *        → filter → gain → dry
         *       /
         * oscillator B
         *
         * gain → reverb send → global reverb
         */

        this.oscillatorA.connect(
            this.filter
        );

        this.oscillatorB.connect(
            this.filter
        );

        this.filter.connect(
            this.gain
        );


        this.gain.connect(
            this.destination
        );


        this.gain.connect(
            this.reverbSend
        );


        this.reverbSend.connect(
            this.reverbInput
        );


        /*
         * Start.
         */

        this.oscillatorA.start(
            now
        );

        this.oscillatorB.start(
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
         * Long ambient release.
         */

        this.gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + 3.5
        );


        this.oscillatorA.stop(
            now + 3.6
        );

        this.oscillatorB.stop(
            now + 3.6
        );


        this.releaseTimer =
            window.setTimeout(
                () => {
                    this.disconnect();
                },
                3800
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
            this.filter?.disconnect();
        } catch {}


        try {
            this.gain?.disconnect();
        } catch {}


        try {
            this.reverbSend?.disconnect();
        } catch {}


        this.oscillatorA =
            null;

        this.oscillatorB =
            null;

        this.filter =
            null;

        this.gain =
            null;

        this.reverbSend =
            null;
    }
}
