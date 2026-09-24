console.log("MAIN.JS CHARGÉ");

const button = document.querySelector("#test-button");
const result = document.querySelector("#result");

button.addEventListener("click", () => {

    console.log("BOUTON CLIQUÉ");

    result.textContent = "MAIN.JS FONCTIONNE";

});
