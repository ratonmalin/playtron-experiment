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
        this.chordStartedAt = 0;
        this.chordSize = 0;

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
        this.idleBodies = Array.from({ length: 12 }, (_, index) => ({
            angle: index * (Math.PI * 2 / 12),
            radius: 105 + index * 46,
            speed: 0.014 + index * 0.0028,
            size: 2.8 + (index % 4) * 1.1,
            phase: index * 1.37
        }));
    }

    getBodyId(event) {
        return `${event.source}-${event.channel}-${event.note}`;
    }

    getNoteHue(note) {
        return ((note - 48) * 27.6923076923 + 195) % 360;
    }

    onNoteOn(event) {
        const now = performance.now();
        const id = this.getBodyId(event);

        this.lastInteraction = now;

        const previousCount = this.active.size;

        if (previousCount >= 1) {
            this.chordStartedAt = now;
            this.chordSize = Math.min(6, previousCount + 1);
        }

        const idleMessage =
            document.getElementById("idle-message");

        if (idleMessage) {
            idleMessage.classList.remove("visible");
        }

        this.active.set(id, {
            id,
            note: event.note,
            source: event.source,
            born: now,
            releasedAt: null,
            velocity: event.velocity,
            angle: ((event.note * 47) % 360) * Math.PI / 180,
            phase: (event.note * 0.71) % (Math.PI * 2),
            hue: this.getNoteHue(event.note),
            duration: null,
            x: innerWidth * (0.5 + Math.sin(event.note * 1.73) * 0.25),
            y: innerHeight * (0.47 + Math.cos(event.note * 1.17) * 0.20),
            vx: Math.cos(event.note * 0.83) * 18,
            vy: Math.sin(event.note * 0.61) * 18
        });
    }

    onNoteOff(event) {
        const id = this.getBodyId(event);
        const item = this.active.get(id);

        this.lastInteraction = performance.now();

        if (!item) return;

        item.releasedAt = performance.now();
        item.duration = Math.max(0.05, (item.releasedAt - item.born) / 1000);

        const memoryIndex = this.memory.length;
        const seed = item.note * 12.9898 + memoryIndex * 78.233;
        const randomX = (Math.sin(seed) * 43758.5453) % 1;
        const randomY = (Math.sin(seed + 19.19) * 43758.5453) % 1;

        this.memory.push({
            x: innerWidth * (0.10 + Math.abs(randomX) * 0.80),
            y: innerHeight * (0.12 + Math.abs(randomY) * 0.72),
            born: performance.now(),
            note: item.note,
            duration: item.duration,
            energy: item.velocity
        });

        if (this.memory.length > 240) {
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
                const dt = Math.min(
                    0.033,
                    Math.max(0.008, (now - (item.lastFrame ?? now)) / 1000)
                );

                let ax = 0;
                let ay = 0;

                for (const other of items) {
                    if (other === item) continue;

                    const dx = other.x - item.x;
                    const dy = other.y - item.y;
                    const distanceSq = Math.max(
                        1800,
                        dx * dx + dy * dy
                    );

                    const distance = Math.sqrt(distanceSq);
                    const force =
                        1150 /
                        distanceSq;

                    ax += (dx / distance) * force * 100;
                    ay += (dy / distance) * force * 100;
                }

                const pulse =
                    Math.sin(elapsed * 0.8 + item.phase) * 4;

                item.vx += (ax + pulse) * dt;
                item.vy += (ay - pulse * 0.7) * dt;

                const speed = Math.hypot(item.vx, item.vy);
                const maxSpeed = 150;

                if (speed > maxSpeed) {
                    item.vx =
                        (item.vx / speed) * maxSpeed;
                    item.vy =
                        (item.vy / speed) * maxSpeed;
                }

                item.vx *= 0.998;
                item.vy *= 0.998;

                item.x += item.vx * dt;
                item.y += item.vy * dt;

                const margin = 80;

                if (item.x < margin || item.x > innerWidth - margin) {
                    item.vx *= -0.82;
                    item.x = Math.max(
                        margin,
                        Math.min(innerWidth - margin, item.x)
                    );
                }

                if (item.y < margin || item.y > innerHeight - margin) {
                    item.vy *= -0.82;
                    item.y = Math.max(
                        margin,
                        Math.min(innerHeight - margin, item.y)
                    );
                }

                item.lastFrame = now;
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
                const releaseProgress =
                    Math.min(1, (now - item.releasedAt) / 5200);

                item.releaseLife =
                    1 - (releaseProgress * releaseProgress * (3 - 2 * releaseProgress));

                if (releaseProgress >= 1) {
                    this.active.delete(item.id);
                }
            } else {
                item.releaseLife = 1;
            }
        }
    }

    drawMemory(ctx, now) {
        const memoryLifetime = 120;

        const visibleStars = this.memory.filter(star => {
            const age = (now - star.born) / 1000;
            return age < memoryLifetime;
        });

        const linked = new Set();

        for (let i = 0; i < visibleStars.length; i++) {
            const a = visibleStars[i];
            const ageA = (now - a.born) / 1000;
            const lifeA = Math.max(0, 1 - ageA / memoryLifetime);

            let nearest = null;
            let nearestDistance = Infinity;

            for (let j = 0; j < visibleStars.length; j++) {
                if (i === j) continue;

                const b = visibleStars[j];
                const distance = Math.hypot(b.x - a.x, b.y - a.y);

                if (distance < nearestDistance) {
                    nearest = b;
                    nearestDistance = distance;
                }
            }

            if (!nearest || nearestDistance > 250) continue;

            const pairKey = [a.born, nearest.born].sort().join(":");
            if (linked.has(pairKey)) continue;
            linked.add(pairKey);

            const ageB = (now - nearest.born) / 1000;
            const lifeB = Math.max(0, 1 - ageB / memoryLifetime);
            const alpha =
                0.10 *
                lifeA *
                lifeB *
                (1 - nearestDistance / 250);

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(nearest.x, nearest.y);
            ctx.strokeStyle =
                `rgba(185, 205, 235, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }

        for (const star of this.memory) {
            const age = (now - star.born) / 1000;
            const life = Math.max(0, 1 - age / memoryLifetime);

            if (life <= 0) continue;

            const radius =
                1.4 +
                Math.min(1.8, star.duration * 0.38) +
                star.energy * 0.7;

            ctx.beginPath();
            ctx.arc(star.x, star.y, radius, 0, Math.PI * 2);
            ctx.fillStyle =
                `hsla(${this.getNoteHue(star.note || 48)}, 62%, 82%, ${0.72 * life})`;
            ctx.fill();

            if (star.duration > 1.4) {
                ctx.beginPath();
                ctx.arc(star.x, star.y, radius * 5.5, 0, Math.PI * 2);
                ctx.strokeStyle =
                    `hsla(${this.getNoteHue(star.note || 48)}, 52%, 78%, ${0.10 * life})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    }

    drawIdle(ctx, now) {
        const idle =
            now - this.lastInteraction > 5000;

        const idleMessage =
            document.getElementById("idle-message");

        if (idleMessage) {
            idleMessage.classList.toggle("visible", idle);
        }

        if (!idle) return;

        const elapsed = now / 1000;
        const points = [];

        for (let index = 0; index < this.idleBodies.length; index++) {
            const body = this.idleBodies[index];
            const angle =
                body.angle +
                elapsed * body.speed +
                Math.sin(elapsed * 0.13 + body.phase) * 0.20;

            const x =
                innerWidth * (0.08 + (index % 4) * 0.28) +
                Math.sin(elapsed * 0.11 + body.phase) * 55;

            const y =
                innerHeight * (0.16 + Math.floor(index / 4) * 0.34) +
                Math.cos(angle) * 48;

            const alpha =
                0.34 +
                0.10 * Math.sin(elapsed * 0.55 + body.phase);

            const hue = (205 + body.phase * 58) % 360;
            points.push({ x, y, hue, body, alpha });

            ctx.beginPath();
            ctx.arc(x, y, body.size * 8, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${hue}, 65%, 75%, ${alpha * 0.10})`;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(x, y, body.size * 1.35, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${hue}, 62%, 82%, ${alpha})`;
            ctx.fill();
        }

        for (let i = 0; i < points.length; i++) {
            let nearest = null;
            let nearestDistance = Infinity;

            for (let j = 0; j < points.length; j++) {
                if (i === j) continue;
                const distance = Math.hypot(
                    points[i].x - points[j].x,
                    points[i].y - points[j].y
                );

                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearest = points[j];
                }
            }

            if (!nearest || nearestDistance > 360) continue;

            ctx.beginPath();
            ctx.moveTo(points[i].x, points[i].y);
            ctx.lineTo(nearest.x, nearest.y);
            ctx.strokeStyle =
                `rgba(175, 195, 225, ${0.16 * points[i].alpha * (1 - nearestDistance / 360)})`;
            ctx.lineWidth = 0.9;
            ctx.stroke();
        }
    }

    indexHue(phase) {
        return ((phase * 95) % 300 + 300) % 300;
    }

    drawActiveBodies(ctx, now) {
        const items = [...this.active.values()];

        for (const item of items) {
            const radius =
                11 +
                item.velocity * 13 +
                (item.duration ? Math.min(item.duration, 3) * 1.8 : 0);

            const life = item.releaseLife;

            ctx.beginPath();
            ctx.arc(item.x, item.y, radius * 3.8, 0, Math.PI * 2);
            ctx.strokeStyle =
                `hsla(${item.hue}, 58%, 62%, ${0.16 * life})`;
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(item.x, item.y, radius, 0, Math.PI * 2);
            ctx.fillStyle =
                `hsla(${item.hue}, 68%, 68%, ${0.92 * life})`;
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
                    `hsla(${(item.hue + 35) % 360}, 62%, 64%, ${0.72 * life})`;
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
                    `hsla(${item.hue}, 68%, 72%, ${0.22 * life})`;
                ctx.stroke();
            }
        }

        // A chord becomes a short-lived celestial event.
        // The event is driven by its onset, not by a permanent central glow.

        if (items.length >= 2) {
            const center = this.getSystemCenter();
            const chordAge = this.chordStartedAt
                ? (now - this.chordStartedAt) / 1000
                : 10;

            if (chordAge >= 0 && chordAge < 4.5) {
                const impact = Math.max(0, 1 - chordAge / 4.5);
                const pulse =
                    Math.sin(chordAge * Math.PI * 2.2) * 0.5 + 0.5;
                const strength =
                    Math.min(1, (this.chordSize - 1) / 3);

                // The chord briefly illuminates the space between the stars.
                const fieldRadius =
                    90 +
                    strength * 90 +
                    Math.sin(chordAge * 2.4) * 18;

                const field = ctx.createRadialGradient(
                    center.x,
                    center.y,
                    0,
                    center.x,
                    center.y,
                    fieldRadius
                );

                field.addColorStop(
                    0,
                    `rgba(235, 245, 255, ${0.16 * impact})`
                );
                field.addColorStop(
                    0.25,
                    `rgba(195, 220, 255, ${0.07 * impact})`
                );
                field.addColorStop(
                    1,
                    "rgba(195, 220, 255, 0)"
                );

                ctx.beginPath();
                ctx.arc(center.x, center.y, fieldRadius, 0, Math.PI * 2);
                ctx.fillStyle = field;
                ctx.fill();

                // Expanding wave: the visual equivalent of the chord ringing.
                const waveRadius =
                    30 + chordAge * (170 + strength * 130);
                const waveAlpha =
                    (0.18 + pulse * 0.08) * impact;

                ctx.beginPath();
                ctx.arc(center.x, center.y, waveRadius, 0, Math.PI * 2);
                ctx.strokeStyle =
                    `rgba(220, 235, 255, ${waveAlpha})`;
                ctx.lineWidth = 1.2 + strength * 1.4;
                ctx.stroke();

                if (items.length >= 3) {
                    // Three or more notes produce a second, slower wave.
                    const outerWave =
                        55 + chordAge * (105 + strength * 95);

                    ctx.beginPath();
                    ctx.arc(
                        center.x,
                        center.y,
                        outerWave,
                        0,
                        Math.PI * 2
                    );
                    ctx.strokeStyle =
                        `rgba(185, 215, 255, ${0.10 * impact})`;
                    ctx.lineWidth = 0.9;
                    ctx.stroke();
                }

                // Connect every star in the chord: the geometry itself
                // becomes visible for the duration of the event.
                for (let i = 0; i < items.length; i++) {
                    for (let j = i + 1; j < items.length; j++) {
                        const a = items[i];
                        const b = items[j];
                        const distance = Math.hypot(
                            b.x - a.x,
                            b.y - a.y
                        );

                        if (distance > 420) continue;

                        const alpha =
                            (0.12 + strength * 0.10) *
                            impact *
                            (1 - distance / 420);

                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.strokeStyle =
                            `rgba(220, 232, 250, ${alpha})`;
                        ctx.lineWidth = 1 + strength * 0.7;
                        ctx.stroke();
                    }
                }
            }
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
