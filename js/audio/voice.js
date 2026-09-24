export class Voice {

    constructor(
        audioContext,
        destination,
        { note, velocity }
    ) {

        this.audioContext =
            audioContext;


        this.destination =
            destination;


        this.note =
            note;


        this.velocity =
            velocity;


        this.oscillator =
            null;


        this.gain =
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


        this.oscillator =
            this.audioContext.createOscillator();


        this.gain =
            this.audioContext.createGain();


        this.oscillator.type =
            "triangle";


        this.oscillator.frequency.setValueAtTime(
            frequency,
            now
        );


        const peakGain =
            0.18 * this.velocity;


        this.gain.gain.setValueAtTime(
            0.0001,
            now
        );


        this.gain.gain.exponentialRampToValueAtTime(
            Math.max(peakGain, 0.0002),
            now + 0.08
        );


        this.oscillator.connect(
            this.gain
        );


        this.gain.connect(
            this.destination
        );


        this.oscillator.start(
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


        this.gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + 0.8
        );


        this.oscillator.stop(
            now + 0.85
        );


        this.releaseTimer =
            window.setTimeout(
                () => {
                    this.disconnect();
                },
                900
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

            this.oscillator?.disconnect();

        } catch {}


        try {

            this.gain?.disconnect();

        } catch {}


        this.oscillator =
            null;


        this.gain =
            null;
    }
}
