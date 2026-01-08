const body = document.getElementById("body");
const selector = document.getElementById("themeSelector");

selector.addEventListener("change", function () {
  body.className = "";            // remove old theme
  body.classList.add(this.value); // apply new theme
});

