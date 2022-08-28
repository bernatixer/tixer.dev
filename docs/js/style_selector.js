axios.get('http://37.187.122.100/api/styles')
  .then(function (response) {
    const styles = response.data.styles
    for (const style in styles) {
      const styleData = styles[style]
      createStyle(styleData.display_image, styleData.name, styleData.display_name)
    }
  });

current_selection = null
function createStyle(src, name, displayName) {
  const stylesDiv = document.getElementById("styles");
  const img = document.createElement("img");
  img.classList.add("style")
  img.width = "100px"
  img.height = "100px"
  img.src = "http://"+src
  img.id = name
  img.alt = displayName
  img.addEventListener("click", () => {
    if (current_selection) current_selection.classList.remove("selected-style")
    current_selection = img
    img.classList.add("selected-style")
    stylize()
  });
  stylesDiv.append(img)
}

function stylize() {
  var data = new FormData();
  data.append("file", document.getElementById("input-file").files[0]);
  data.append("style", current_selection.id)
  fetch('http://37.187.122.100/api/styles/transform', {
    method: 'POST',
    body: data,
  })
  .then((data) => {
    return data.blob()
  })
  .then((data) => {
      var reader = new FileReader();
      reader.onload = function() {
          var img = document.createElement('img');
          img.src = reader.result
          document.getElementById("results").appendChild(img);
      }
      reader.readAsDataURL(data)
  })
  .catch((error) => {
      error.text().then(errorMessage => {
          console.log(errorMessage)
      })
  })
}
