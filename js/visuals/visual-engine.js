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
            velocity: event.velocity,
            angle: ((event.note * 47) % 360) * Math.PI / 180
        });
    }

    onNoteOff(event) {
        const item = this.active.get(event.note);

        if (item) {
            item.releasing = performance.now();
        }
    }

    drawOrbitalNote(ctx, item, now) {
        const age = (now - item.born) / 1000;
        const release = item.releasing
            ? Math.min(1, (now - item.releasing) / 900)
            : 0;

        const life = Math.max(0, 1 - release);
        const progress = Math.min(1, age / 2.8);

        const centerX =
            innerWidth * (0.5 + Math.sin(item.note * 1.73) * 0.28);

        const centerY =
            innerHeight * (0.48 + Math.cos(item.note * 1.17) * 0.22);

        const orbit =
            35 + (item.note % 7) * 13 + progress * 20;

        const angle =
            item.angle + age * (0.18 + (item.note % 5) * 0.025);

        const x =
            centerX + Math.cos(angle) * orbit;

        const y =
            centerY + Math.sin(angle) * orbit * 0.62;

        const radius =
            2.5 + item.velocity * 3.5;

        // Fine orbit line.
        ctx.beginPath();
        ctx.arc(centerX, centerY, orbit, 0, Math.PI * 2);
        ctx.strokeStyle =
            "rgba(184, 151, 91, " + (0.18 * life) + ")";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Small vintage "planet".
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle =
            "rgba(213, 165, 91, " + (0.78 * life) + ")";
        ctx.fill();

        // Tiny halo.
        ctx.beginPath();
        ctx.arc(x, y, radius * 3.2, 0, Math.PI * 2);
        ctx.strokeStyle =
            "rgba(213, 165, 91, " + (0.13 * life) + ")";
        ctx.stroke();

        // Delayed little satellite dot.
        const satelliteAngle = -angle * 1.7;
        const satelliteDistance = radius * 4.8;

        ctx.beginPath();
        ctx.arc(
            x + Math.cos(satelliteAngle) * satelliteDistance,
            y + Math.sin(satelliteAngle) * satelliteDistance,
            1.2,
            0,
            Math.PI * 2
        );
        ctx.fillStyle =
            "rgba(191, 118, 91, " + (0.5 * life) + ")";
        ctx.fill();

        if (release >= 1) {
            this.active.delete(item.note);
        }
    }

    frame() {
        if (!this.running) return;

        const ctx = this.ctx;
        const now = performance.now();

        // Almost-black canvas with a barely perceptible warm CRT-like haze.
        ctx.fillStyle = "rgba(7, 8, 7, 0.18)";
        ctx.fillRect(0, 0, innerWidth, innerHeight);

        // A single slow-moving warm field keeps the screen alive without
        // competing with the note events.
        const drift = now * 0.000018;
        const glowX = innerWidth * (0.5 + Math.sin(drift) * 0.18);
        const glowY = innerHeight * (0.5 + Math.cos(drift * 0.7) * 0.14);
        const glowRadius = Math.min(innerWidth, innerHeight) * 0.48;

        const glow = ctx.createRadialGradient(
            glowX,
            glowY,
            0,
            glowX,
            glowY,
            glowRadius
        );

        glow.addColorStop(0, "rgba(126, 92, 54, 0.035)");
        glow.addColorStop(0.65, "rgba(78, 62, 45, 0.018)");
        glow.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, innerWidth, innerHeight);

        for (const item of this.active.values()) {
            this.drawOrbitalNote(ctx, item, now);
        }

        requestAnimationFrame(() => this.frame());
    }
}
