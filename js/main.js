import {
    KEYBOARD_MAPPING,
    midiToNoteName
} from "./config/keyboard.js";

import { EventBus } from "./core/event-bus.js";
import { KeyboardInput } from "./input/keyboard.js";
import { AudioEngine } from "./audio/audio.js";

const eventBus = new EventBus();

const keyboard = new KeyboardInput(eventBus);
const audioEngine = new AudioEngine(eventBus);

const keyboardElement =
    document.querySelector("#keyboard");

const mappingElement =
    document.querySelector("#mapping-list");

const lastEventElement =
    document.querySelector("#last-event");

const statusElement =
    document.querySelector("#status");


function createKeyboardUI() {

    keyboardElement.innerHTML = "";

    for (const [key, midiNote] of Object.entries(KEYBOARD_MAPPING)) {

        const element =
            document.createElement("div");

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

        const element =
            document.createElement("div");

        element.className = "mapping-item";

        element.innerHTML = `
            <strong>${key.toUpperCase()}</strong>
            → ${midiToNoteName(midiNote)}
            <span>(${midiNote})</span>
        `;

        mappingElement.appendChild(element);
    }
}


function updateKeyboardKey(event) {

    if (event.source !== "keyboard") {
        return;
    }

    const key =
        findKeyForNote(event.note);

    if (!key) {
        return;
    }

    const element =
        keyboardElement.querySelector(
            `[data-key="${key}"]`
        );

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

    for (
        const [key, midiNote]
        of Object.entries(KEYBOARD_MAPPING)
    ) {
        if (midiNote === note) {
            return key;
        }
    }

    return null;
}


function displayEvent(event) {

    const noteName =
        midiToNoteName(event.note);

    const velocity =
        event.velocity.toFixed(2);

    lastEventElement.textContent =
        `${event.type} · ${noteName} · MIDI ${event.note} · velocity ${velocity} · ${event.source}`;
}


eventBus.on("noteon", event => {

    console.log("[EVENT]", event);

    updateKeyboardKey(event);
    displayEvent(event);
});


eventBus.on("noteoff", event => {

    console.log("[EVENT]", event);

    updateKeyboardKey(event);
    displayEvent(event);
});


/*
 * AudioContext doit être démarré à la suite
 * d'une interaction utilisateur.
 *
 * Le bouton n'est pas encore dans l'interface :
 * on utilise donc le premier appui clavier.
 */
async function ensureAudioStarted() {

    if (audioEngine.started) {
        return;
    }

    try {

        await audioEngine.start();

        statusElement.textContent =
            "AUDIO READY";

    } catch (error) {

        console.error(
            "Unable to start audio:",
            error
        );

        statusElement.textContent =
            "AUDIO ERROR";
    }
}


/*
 * Le clavier reste la source d'événements.
 *
 * Avant de jouer une note, on initialise AudioContext.
 */
const originalHandleKeyDown =
    keyboard.handleKeyDown.bind(keyboard);

keyboard.handleKeyDown = async function(event) {

    if (!audioEngine.started) {
        await ensureAudioStarted();
    }

    originalHandleKeyDown(event);
};


createKeyboardUI();
createMappingUI();

keyboard.start();

statusElement.textContent =
    "PRESS A KEY";
