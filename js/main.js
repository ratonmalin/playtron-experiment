import {
    KEYBOARD_MAPPING,
    midiToNoteName
} from "./config/keyboard.js";

import { EventBus } from "./core/event-bus.js";
import { KeyboardInput } from "./input/keyboard.js";

const eventBus = new EventBus();

const keyboard = new KeyboardInput(eventBus);

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
            → ${midiToNoteName(midiNote)}
            <span>(${midiNote})</span>
        `;

        mappingElement.appendChild(element);
    }
}

function updateKeyboardKey(event) {

    const key = event.source === "keyboard"
        ? findKeyForNote(event.note)
        : null;

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

    for (const [key, midiNote] of Object.entries(KEYBOARD_MAPPING)) {
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

    console.log(
        "[EVENT]",
        event
    );

    updateKeyboardKey(event);
    displayEvent(event);
});

eventBus.on("noteoff", event => {

    console.log(
        "[EVENT]",
        event
    );

    updateKeyboardKey(event);
    displayEvent(event);
});

createKeyboardUI();
createMappingUI();

keyboard.start();

statusElement.textContent = "KEYBOARD READY";
