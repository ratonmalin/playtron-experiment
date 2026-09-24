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
const audioModule = await import(`./audio/audio.js?v=${VERSION}`);
const midiModule = await import(`./input/midi.js?v=${VERSION}`);
const visualModule = await import(`./visuals/visual-engine.js?v=${VERSION}`);

const {
    KEYBOARD_MAPPING,
    midiToNoteName
} = keyboardModule;

const { EventBus } = eventBusModule;
const { KeyboardInput } = keyboardInputModule;
const { AudioEngine } = audioModule;
const { MidiInput } = midiModule;
const { VisualEngine } = visualModule;


const eventBus = new EventBus();
const keyboard = new KeyboardInput(eventBus);
const audioEngine = new AudioEngine(eventBus);
const midiInput = new MidiInput(eventBus);
const visualEngine = new VisualEngine(eventBus);


const keyboardElement = document.querySelector("#keyboard");
const mappingElement = document.querySelector("#mapping-list");
const lastEventElement = document.querySelector("#last-event");
const statusElement = document.querySelector("#status");
const engineVersionElement = document.querySelector("#engine-version");


const fullscreenButton = document.querySelector("#fullscreen-button");

function updateFullscreenButton() {
    if (!fullscreenButton) return;

    fullscreenButton.setAttribute(
        "aria-label",
        document.fullscreenElement
            ? "Quitter le plein écran"
            : "Passer en plein écran"
    );
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


if (engineVersionElement) {
    engineVersionElement.textContent = `ENGINE ${VERSION}`;
}


function createKeyboardUI() {

    keyboardElement.innerHTML = "";

    for (const [key, midiNote] of Object.entries(KEYBOARD_MAPPING)) {

        const element = document.createElement("div");

        element.className = "key";
        element.dataset.key = key;

        element.innerHTML = `
            <span class="key-letter">
                ${key.toUpperCase()}
            </span>

            <span class="key-note">
                ${midiToNoteName(midiNote)}
            </span>
        `;

        keyboardElement.appendChild(element);
    }
}


function createMappingUI() {

    mappingElement.innerHTML = "";

    for (const [key, midiNote] of Object.entries(KEYBOARD_MAPPING)) {

        const element = document.createElement("div");

        element.className = "mapping-item";

        element.innerHTML = `
            <strong>${key.toUpperCase()}</strong>
            →
            ${midiToNoteName(midiNote)}
            <span>(${midiNote})</span>
        `;

        mappingElement.appendChild(element);
    }
}


function updateKeyboardKey(event) {

    if (event.source !== "keyboard") {
        return;
    }

    const key = findKeyForNote(event.note);

    if (!key) {
        return;
    }

    const element =
        keyboardElement.querySelector(`[data-key="${key}"]`);

    if (!element) {
        return;
    }

    if (event.type === "noteon") {
        element.classList.add("active");
    }

    if (event.type === "noteoff") {
        element.classList.remove("active");
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


function displayEvent(event) {

    const noteName = midiToNoteName(event.note);
    const velocity = event.velocity.toFixed(2);

    lastEventElement.textContent =
        `${event.type} · ${noteName} · MIDI ${event.note} · velocity ${velocity} · ${event.source}`;
}


eventBus.on("noteon", event => {

    console.log("[NOTE ON]", event);

    updateKeyboardKey(event);
    displayEvent(event);

    if (statusElement && event.type === "noteon") {
        statusElement.textContent = "LIVE";
    }
});


eventBus.on("noteoff", event => {

    console.log("[NOTE OFF]", event);

    updateKeyboardKey(event);
    displayEvent(event);
});


createKeyboardUI();
createMappingUI();

keyboard.start();
midiInput.start();
visualEngine.start();

statusElement.textContent = "AUDIO READY";

console.log("[MAIN] Prêt.");
