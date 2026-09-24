import {
    KEYBOARD_MAPPING,
    midiToNoteName
} from "./config/keyboard.js";

import { EventBus } from "./core/event-bus.js";
import { KeyboardInput } from "./input/keyboard.js";
import { AudioEngine } from "./audio/audio.js";


/*
 * --------------------------------------------------
 * CORE
 * --------------------------------------------------
 */

const eventBus = new EventBus();

const keyboard =
    new KeyboardInput(eventBus);

const audioEngine =
    new AudioEngine(eventBus);


/*
 * --------------------------------------------------
 * UI ELEMENTS
 * --------------------------------------------------
 */

const keyboardElement =
    document.querySelector("#keyboard");

const mappingElement =
    document.querySelector("#mapping-list");

const lastEventElement =
    document.querySelector("#last-event");

const statusElement =
    document.querySelector("#status");

const startAudioButton =
    document.querySelector("#start-audio");


/*
 * --------------------------------------------------
 * KEYBOARD UI
 * --------------------------------------------------
 */

function createKeyboardUI() {

    keyboardElement.innerHTML = "";

    for (
        const [key, midiNote]
        of Object.entries(KEYBOARD_MAPPING)
    ) {

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


/*
 * --------------------------------------------------
 * MAPPING UI
 * --------------------------------------------------
 */

function createMappingUI() {

    mappingElement.innerHTML = "";

    for (
        const [key, midiNote]
        of Object.entries(KEYBOARD_MAPPING)
    ) {

        const element =
            document.createElement("div");

        element.className =
            "mapping-item";

        element.innerHTML = `
            <strong>${key.toUpperCase()}</strong>
            → ${midiToNoteName(midiNote)}
            <span>(${midiNote})</span>
        `;

        mappingElement.appendChild(element);
    }
}


/*
 * --------------------------------------------------
 * VISUAL KEY STATE
 * --------------------------------------------------
 */

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


/*
 * --------------------------------------------------
 * EVENT DISPLAY
 * --------------------------------------------------
 */

function displayEvent(event) {

    const noteName =
        midiToNoteName(event.note);

    const velocity =
        event.velocity.toFixed(2);

    lastEventElement.textContent =
        `${event.type} · ${noteName} · MIDI ${event.note} · velocity ${velocity} · ${event.source}`;
}


/*
 * --------------------------------------------------
 * EVENT BUS
 * --------------------------------------------------
 */

eventBus.on("noteon", event => {

    console.log(
        "[NOTE ON]",
        event
    );

    updateKeyboardKey(event);
    displayEvent(event);
});


eventBus.on("noteoff", event => {

    console.log(
        "[NOTE OFF]",
        event
    );

    updateKeyboardKey(event);
    displayEvent(event);
});


/*
 * --------------------------------------------------
 * AUDIO START
 * --------------------------------------------------
 */

async function startAudio() {

    try {

        await audioEngine.start();

        statusElement.textContent =
            "AUDIO READY";

        startAudioButton.textContent =
            "Son activé";

        startAudioButton.disabled = true;

        console.log(
            "[AUDIO]",
            "AudioContext started:",
            audioEngine.audioContext.state
        );

    } catch (error) {

        console.error(
            "[AUDIO ERROR]",
            error
        );

        statusElement.textContent =
            "AUDIO ERROR";

        startAudioButton.textContent =
            "Erreur — réessayer";
    }
}


startAudioButton.addEventListener(
    "click",
    startAudio
);


/*
 * --------------------------------------------------
 * INITIALIZATION
 * --------------------------------------------------
 */

createKeyboardUI();
createMappingUI();

keyboard.start();

statusElement.textContent =
    "AUDIO OFF";
