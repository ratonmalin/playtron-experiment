export class VisualEngine {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.canvas = null;
        this.ctx = null;
        this.active = new Map();
        this.running = false;

        this.onNoteOn = this.onNoteOn.bind(this);
        this.onNoteOff = this.onNoteOff.bind(this);

        eventBus.on("noteon", this.onNoteOn);
        eventBus.on("noteoff", this.onNoteOff);
    }

    start() {
        this.canvas = document.createElement("canvas");
        this.canvas.className = "visual-field";
        this.canvas.setAttribute("aria-hidden", "true");
        document.body.prepend(this.canvas);
        this.ctx = this.canvas.getContext("2d");
        this.resize();
        window.addEventListener("resize", () => this.resize());
        this.running = true;
        requestAnimationFrame(() => this.frame());
    }

    resize() {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = Math.floor(innerWidth * ratio);
        this.canvas.height = Math.floor(innerHeight * ratio);
        this.canvas.style.width = innerWidth + "px";
        this.canvas.style.height = innerHeight + "px";
        this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    onNoteOn(event) {
        this.active.set(event.note, {
            note: event.note,
            born: performance.now(),
            velocity: event.velocity
        });
    }

    onNoteOff(event) {
        const item = this.active.get(event.note);
        if (item) item.releasing = performance.now();
    }

    frame() {
        if (!this.running) return;

        const ctx = this.ctx;
        const now = performance.now();
        ctx.fillStyle = "rgba(243, 240, 233, 0.12)";
        ctx.fillRect(0, 0, innerWidth, innerHeight);

        for (const [note, item] of this.active) {
            const age = (now - item.born) / 1000;
            const release = item.releasing ? Math.min(1, (now - item.releasing) / 1600) : 0;
            const life = Math.max(0, 1 - release);
            const x = innerWidth * (0.18 + ((note * 37) % 64) / 100);
            const y = innerHeight * (0.2 + ((note * 17) % 60) / 100);
            const radius = 42 + age * 18 + item.velocity * 70;

            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, "rgba(255,255,255," + (0.28 * life) + ")");
            gradient.addColorStop(0.45, "rgba(210,220,235," + (0.12 * life) + ")");
            gradient.addColorStop(1, "rgba(210,220,235,0)");

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();

            if (release >= 1) this.active.delete(note);
        }

        requestAnimationFrame(() => this.frame());
    }
}
