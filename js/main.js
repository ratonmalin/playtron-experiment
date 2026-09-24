console.log("================================");
console.log("MAIN.JS EST BIEN CHARGE");
console.log("================================");

const button = document.querySelector("#start-audio");
const status = document.querySelector("#status");

console.log("Bouton trouvé :", button);
console.log("Status trouvé :", status);

button.addEventListener("click", () => {

    console.log("MAIN.JS : bouton cliqué");

    button.textContent = "MAIN JS OK";
    status.textContent = "JAVASCRIPT OK";

});
