export class VisualEngine {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.canvas = null;
        this.ctx = null;

        this.active = new Map();
        this.memory = [];
        this.idleBodies = [];
        this.running = false;
        this.lastInteraction = performance.now();
        this.lastBloom = 0;

        this.onNoteOn = this.onNoteOn.bind(this);
        this.onNoteOff = this.onNoteOff.bind(this);
        this.frame = this.frame.bind(this);
        this.handleResize = this.handleResize.bind(this);

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

        window.addEventListener("resize", this.handleResize);

        this.createIdleBodies();
        this.running = true;
        requestAnimationFrame(this.frame);
    }

    stop() {
        this.running = false;
        window.removeEventListener("resize", this.handleResize);
    }

    handleResize() {
        this.resize();
    }

    resize() {
        if (!this.canvas || !this.ctx) return;

        const ratio = Math.min(window.devicePixelRatio || 1, 2);

        this.canvas.width = Math.floor(innerWidth * ratio);
        this.canvas.height = Math.floor(innerHeight * ratio);
        this.canvas.style.width = innerWidth + "px";
        this.canvas.style.height = innerHeight + "px";

        this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    createIdleBodies() {
        this.idleBodies = Array.from({ length: 5 }, (_, index) => ({
            angle: index * 1.2566,
            radius: 120 + index * 42,
            speed: 0.025 + index * 0.004,
            size: 1.5 + (index % 2),
            phase: index * 1.7
        }));
    }

    getBodyId(event) {
        return `${event.source}-${event.channel}-${event.note}`;
    }

    onNoteOn(event) {
        const now = performance.now();
        const id = this.getBodyId(event);

        this.lastInteraction = now;

        this.active.set(id, {
            id,
            note: event.note,
            source: event.source,
            born: now,
            releasedAt: null,
            velocity: event.velocity,
            angle: ((event.note * 47) % 360) * Math.PI / 180,
            phase: (event.note * 0.71) % (Math.PI * 2),
            duration: null
        });
    }

    onNoteOff(event) {
        const id = this.getBodyId(event);
        const item = this.active.get(id);

        this.lastInteraction = performance.now();

        if (!item) return;

        item.releasedAt = performance.now();
        item.duration = Math.max(0.05, (item.releasedAt - item.born) / 1000);

        this.memory.push({
            x: item.x ?? innerWidth * 0.5,
            y: item.y ?? innerHeight * 0.5,
            born: performance.now(),
            note: item.note,
            duration: item.duration,
            energy: item.velocity
        });

        if (this.memory.length > 90) {
            this.memory.shift();
        }
    }

    getSystemCenter() {
        if (this.active.size === 0) {
            return {
                x: innerWidth * 0.5,
                y: innerHeight * 0.47
            };
        }

        let x = 0;
        let y = 0;

        for (const item of this.active.values()) {
            x += item.x ?? innerWidth * 0.5;
            y += item.y ?? innerHeight * 0.47;
        }

        return {
            x: x / this.active.size,
            y: y / this.active.size
        };
    }

    updateActiveBodies(now) {
        const items = [...this.active.values()];
        const count = items.length;
        const center = this.getSystemCenter();
        const elapsed = now / 1000;

        for (const item of items) {
            const age = (now - item.born) / 1000;
            const baseX =
                innerWidth * (0.5 + Math.sin(item.note * 1.73) * 0.25);
            const baseY =
                innerHeight * (0.47 + Math.cos(item.note * 1.17) * 0.20);

            if (count >= 3) {
                const chaos = Math.sin(
                    elapsed * (0.7 + item.note * 0.003) + item.phase
                );

                const orbit =
                    70 +
                    (item.note % 7) * 17 +
                    chaos * 24 +
                    age * 7;

                const angle =
                    item.angle +
                    age * (0.25 + (item.note % 5) * 0.035) +
                    Math.sin(elapsed * 0.31 + item.phase) * 0.45;

                item.x =
                    center.x +
                    Math.cos(angle) * orbit;

                item.y =
                    center.y +
                    Math.sin(angle) * orbit * 0.68;

                item.chaotic = true;
            } else {
                const orbit =
                    62 +
                    (item.note % 7) * 20 +
                    Math.min(age, 3) * 9;

                const angle =
                    item.angle +
                    age * (0.16 + (item.note % 5) * 0.025);

                item.x = baseX + Math.cos(angle) * orbit;
                item.y = baseY + Math.sin(angle) * orbit * 0.62;
                item.chaotic = false;
            }

            if (item.releasedAt) {
                const release =
                    Math.min(1, (now - item.releasedAt) / 900);

                item.releaseLife = 1 - release;

                if (release >= 1) {
                    this.active.delete(item.id);
                }
            } else {
                item.releaseLife = 1;
            }
        }
    }

    drawMemory(ctx, now) {
        for (const star of this.memory) {
            const age = (now - star.born) / 1000;
            const life = Math.max(0, 1 - age / 28);

            if (life <= 0) continue;

            const radius =
                1.2 +
                Math.min(3, star.duration * 0.55) +
                star.energy * 1.5;

            ctx.beginPath();
            ctx.arc(star.x, star.y, radius, 0, Math.PI * 2);
            ctx.fillStyle =
                `rgba(235, 190, 105, ${0.34 * life})`;
            ctx.fill();

            if (star.duration > 1.4) {
                ctx.beginPath();
                ctx.arc(star.x, star.y, radius * 4, 0, Math.PI * 2);
                ctx.strokeStyle =
                    `rgba(213, 165, 91, ${0.08 * life})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }

    drawIdle(ctx, now) {
        const idle =
            now - this.lastInteraction > 9000;

        if (!idle) return;

        const elapsed = now / 1000;
        const centerX = innerWidth * 0.5;
        const centerY = innerHeight * 0.47;

        for (const body of this.idleBodies) {
            const angle =
                body.angle +
                elapsed * body.speed +
                Math.sin(elapsed * 0.17 + body.phase) * 0.18;

            const x =
                centerX +
                Math.cos(angle) * body.radius;

            const y =
                centerY +
                Math.sin(angle) * body.radius * 0.55;

            const alpha =
                0.07 +
                0.025 * Math.sin(elapsed * 0.6 + body.phase);

            ctx.beginPath();
            ctx.arc(x, y, body.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fill();
        }
    }

    drawActiveBodies(ctx, now) {
        const items = [...this.active.values()];

        if (items.length >= 2) {
            const center = this.getSystemCenter();
            const alpha = items.length >= 3 ? 0.16 : 0.08;

            ctx.beginPath();

            for (const item of items) {
                ctx.moveTo(center.x, center.y);
                ctx.lineTo(item.x, item.y);
            }

            ctx.strokeStyle = `rgba(213, 165, 91, ${alpha})`;
            ctx.lineWidth = items.length >= 3 ? 1.2 : 0.8;
            ctx.stroke();
        }

        for (const item of items) {
            const radius =
                4 +
                item.velocity * 8 +
                (item.duration ? Math.min(item.duration, 3) : 0);

            const life = item.releaseLife;

            ctx.beginPath();
            ctx.arc(item.x, item.y, radius * 3.8, 0, Math.PI * 2);
            ctx.strokeStyle =
                `rgba(213, 165, 91, ${0.10 * life})`;
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(item.x, item.y, radius, 0, Math.PI * 2);
            ctx.fillStyle =
                `rgba(235, 190, 105, ${0.88 * life})`;
            ctx.fill();

            if (item.chaotic) {
                const satelliteAngle =
                    -item.angle - now / 1800;

                const distance = radius * 5;

                ctx.beginPath();
                ctx.arc(
                    item.x + Math.cos(satelliteAngle) * distance,
                    item.y + Math.sin(satelliteAngle) * distance,
                    1.6,
                    0,
                    Math.PI * 2
                );
                ctx.fillStyle =
                    `rgba(191, 118, 91, ${0.65 * life})`;
                ctx.fill();
            }

            if (life < 1) {
                ctx.beginPath();
                ctx.arc(
                    item.x,
                    item.y,
                    radius * (1 + (1 - life) * 7),
                    0,
                    Math.PI * 2
                );
                ctx.strokeStyle =
                    `rgba(235, 190, 105, ${0.16 * life})`;
                ctx.stroke();
            }
        }

        if (
            items.length >= 3 &&
            now - this.lastBloom > 2600
        ) {
            this.lastBloom = now;

            const center = this.getSystemCenter();

            for (let i = 0; i < 10; i++) {
                this.memory.push({
                    x: center.x + (Math.random() - 0.5) * 150,
                    y: center.y + (Math.random() - 0.5) * 110,
                    born: now,
                    note: 0,
                    duration: 2,
                    energy: 0.6
                });
            }

            if (this.memory.length > 90) {
                this.memory.splice(0, this.memory.length - 90);
            }
        }
    }

    frame() {
        if (!this.running) return;

        const ctx = this.ctx;
        const now = performance.now();

        ctx.clearRect(0, 0, innerWidth, innerHeight);

        this.updateActiveBodies(now);
        this.drawIdle(ctx, now);
        this.drawMemory(ctx, now);
        this.drawActiveBodies(ctx, now);

        requestAnimationFrame(this.frame);
    }
}
