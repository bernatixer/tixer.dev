const dropArea = document.querySelector(".drop-area");
const inputFile = document.getElementById("input-file");

dropArea.addEventListener("click", function () {
  inputFile.click()
})

inputFile.addEventListener("change", function () {
  checkImageSizeAndType(this.files[0])
})

dropArea.addEventListener("dragover", function (e) {
  e.preventDefault();
  this.classList.add("dragover")

  const h3 = this.querySelector("h3");
  h3.textContent = "Release to upload image";
})

dropArea.addEventListener("drop", function (e) {
  e.preventDefault();

  inputFile.files = e.dataTransfer.files;
  const file = e.dataTransfer.files[0];

  checkImageSizeAndType(file)
})

const command = ["dragleave", "dragend"]
command.forEach(item=> {
  dropArea.addEventListener(item, function () {
    this.classList.remove("dragover")

    const h3 = this.querySelector("h3");
    h3.textContent = "Drag and drop";
  })
})

current_image = null
function create_thumbnail(file) {
  const img = document.querySelectorAll(".thumbnail");
  const imgName = document.querySelectorAll(".img-name");
  img.forEach(item => item.remove());
  imgName.forEach(item => item.remove());

  const reader = new FileReader();
  reader.onload = () => {
    const url = reader.result;
    current_image = url
    const img = document.createElement("img");
    img.src = url;
    img.className = "thumbnail";
    const span = document.createElement("span");
    span.className = "img-name";
    span.textContent = file.name;
    dropArea.appendChild(img);
    dropArea.appendChild(span);
    dropArea.style.borderColor = "transparent";
  }
  reader.readAsDataURL(file);
}

function checkImageSizeAndType(file) {
  if (file.type.startsWith("image/")) {
    if (file.size < 2000000) {
      create_thumbnail(file);
    } else {
      alert("Image size must be less than 2MB");
    }
  } else {
    alert("Must be image");
  }
}