/*
 * Playtron Experiment
 *
 * Chaque module reçoit le même paramètre de version.
 * Cela évite que le navigateur conserve une ancienne
 * version d'un module ES.
 */

const VERSION = new URL(import.meta.url).searchParams.get("v") || "unknown";

console.log("[MAIN] Engine version:", VERSION);

const keyboardModule = await import(`./config/keyboard.js?v=${VERSION}`);
const eventBusModule = await import(`./core/event-bus.js?v=${VERSION}`);
const keyboardInputModule = await import(`./input/keyboard.js?v=${VERSION}`);
const touchInputModule = await import(`./input/touch.js?v=${VERSION}`);
const audioModule = await import(`./audio/audio.js?v=${VERSION}`);
const midiModule = await import(`./input/midi.js?v=${VERSION}`);
const visualModule = await import(`./visuals/visual-engine.js?v=${VERSION}`);

const {
    KEYBOARD_MAPPING,
    midiToNoteName
} = keyboardModule;

const { ScaleManager } =
    await import(`./config/scales.js?v=${VERSION}`);

const { EventBus } = eventBusModule;
const { KeyboardInput } = keyboardInputModule;
const { TouchInput } = touchInputModule;
const { AudioEngine } = audioModule;
const { MidiInput } = midiModule;
const { VisualEngine } = visualModule;

const eventBus = new EventBus();
const scaleManager = new ScaleManager();

const scaledInputBus = {
    emit(event) {
        eventBus.emit(
            scaleManager.transform(event)
        );
    }
};

const keyboardElement = document.querySelector("#keyboard");
const keyboard = new KeyboardInput(scaledInputBus);
const touch = new TouchInput(
    scaledInputBus,
    keyboardElement,
    KEYBOARD_MAPPING
);
const audioEngine = new AudioEngine(eventBus);
const midiInput = new MidiInput(scaledInputBus);
const visualEngine = new VisualEngine(eventBus);

const fullscreenButton = document.querySelector("#fullscreen-button");
const scaleButton = document.querySelector("#scale-button");

function updateFullscreenButton() {
    if (!fullscreenButton) return;

    fullscreenButton.setAttribute(
        "aria-label",
        document.fullscreenElement
            ? "Quitter le plein écran"
            : "Passer en plein écran"
    );
}

function updateScaleButton() {
    if (!scaleButton) return;

    scaleButton.textContent =
        `GAMME · ${scaleManager.label}`;

    scaleButton.setAttribute(
        "aria-label",
        `Changer de gamme · actuelle : ${scaleManager.label}`
    );
}

if (scaleButton) {
    scaleButton.addEventListener("click", () => {
        const { releases } =
            scaleManager.next();

        for (const event of releases) {
            eventBus.emit(event);
        }

        updateScaleButton();
    });

    createKeyboardUI();
    updateScaleButton();
}

if (fullscreenButton) {
    fullscreenButton.addEventListener("click", async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            } else {
                await document.documentElement.requestFullscreen();
            }
        } catch (error) {
            console.warn("[UI] Fullscreen unavailable:", error);
        }

        updateFullscreenButton();
    });

    document.addEventListener("fullscreenchange", updateFullscreenButton);
    updateFullscreenButton();
}

console.log("[MAIN] Application initialisée.");
console.log("[MAIN] Version:", VERSION);

function createKeyboardUI() {
    keyboardElement.innerHTML = "";

    for (const [key, midiNote] of Object.entries(KEYBOARD_MAPPING)) {
        const element = document.createElement("div");

        element.className = "key";
        element.dataset.key = key;

        const mappedNote =
            scaleManager.mapKeyboardNote(midiNote);

        element.innerHTML = `
            <span class="key-note">
                ${midiToNoteName(mappedNote)}
            </span>
        `;

        keyboardElement.appendChild(element);
    }
}

const activeKeyboardNotes = new Map();

function updateKeyboardKey(event) {
    if (
        event.source !== "keyboard" &&
        event.source !== "touch"
    ) {
        return;
    }

    const key = findKeyForNote(
        Number.isFinite(event.rawNote)
            ? event.rawNote
            : event.note
    );

    if (!key) {
        return;
    }

    const element =
        keyboardElement.querySelector(`[data-key="${key}"]`);

    if (!element) {
        return;
    }

    if (event.type === "noteon") {
        const count =
            activeKeyboardNotes.get(event.note) || 0;

        activeKeyboardNotes.set(
            event.note,
            count + 1
        );

        element.classList.add("active");
    }

    if (event.type === "noteoff") {
        const count =
            Math.max(
                0,
                (activeKeyboardNotes.get(event.note) || 1) - 1
            );

        if (count === 0) {
            activeKeyboardNotes.delete(event.note);
            element.classList.remove("active");
        } else {
            activeKeyboardNotes.set(event.note, count);
        }
    }
}

function findKeyForNote(note) {
    for (const [key, midiNote] of Object.entries(KEYBOARD_MAPPING)) {
        if (midiNote === note) {
            return key;
        }
    }

    return null;
}

eventBus.on("noteon", event => {
    updateKeyboardKey(event);
});

eventBus.on("noteoff", event => {
    updateKeyboardKey(event);
});

createKeyboardUI();

keyboard.start();
touch.start();
midiInput.start();
visualEngine.start();

console.log("[MAIN] Prêt.");
