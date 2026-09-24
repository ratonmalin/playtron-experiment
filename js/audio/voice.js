export class Voice {

    constructor(audioContext, destination, {
        note,
        velocity
    }) {
        this.audioContext = audioContext;
        this.destination = destination;

        this.note = note;
        this.velocity = velocity;

        this.oscillator = null;
        this.gain = null;

        this.isReleased = false;
        this.releaseTimer = null;
    }

    start() {

        const now = this.audioContext.currentTime;

        const frequency =
            440 * Math.pow(
                2,
                (this.note - 69) / 12
            );

        this.oscillator =
            this.audioContext.createOscillator();

        this.gain =
            this.audioContext.createGain();

        /*
         * Timbre volontairement simple :
         * une onde triangle légèrement filtrée
         * par une enveloppe douce.
         */
        this.oscillator.type = "triangle";

        this.oscillator.frequency.setValueAtTime(
            frequency,
            now
        );

        /*
         * L'amplitude est volontairement faible.
         * Le gain global sera contrôlé par AudioEngine.
         */
        const peakGain =
            0.18 * this.velocity;

        this.gain.gain.setValueAtTime(
            0,
            now
        );

        /*
         * Petite attaque progressive.
         */
        this.gain.gain.linearRampToValueAtTime(
            peakGain,
            now + 0.08
        );

        this.oscillator.connect(this.gain);
        this.gain.connect(this.destination);

        this.oscillator.start(now);
    }

    release() {

        if (this.isReleased) {
            return;
        }

        this.isReleased = true;

        const now =
            this.audioContext.currentTime;

        /*
         * On annule toute automation future
         * avant de programmer le release.
         */
        this.gain.gain.cancelScheduledValues(now);

        const currentGain =
            this.gain.gain.value;

        this.gain.gain.setValueAtTime(
            currentGain,
            now
        );

        /*
         * Release assez long pour obtenir
         * un comportement doux.
         */
        this.gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + 0.8
        );

        this.oscillator.stop(
            now + 0.85
        );

        this.releaseTimer =
            window.setTimeout(() => {
                this.disconnect();
            }, 900);
    }

    disconnect() {

        if (this.releaseTimer !== null) {
            clearTimeout(this.releaseTimer);
            this.releaseTimer = null;
        }

        try {
            this.oscillator?.disconnect();
        } catch {
            // Already disconnected.
        }

        try {
            this.gain?.disconnect();
        } catch {
            // Already disconnected.
        }

        this.oscillator = null;
        this.gain = null;
    }
}
