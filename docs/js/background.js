// Initialize constants
// EL COLOR: 0x89E894
const backgroundColor = new THREE.Color(0x020911);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 1, 5000);
camera.position.z = 1000;
scene.add(camera);

const light = new THREE.PointLight(0xffffff, 1, 1000);
light.position.set(0, 0, 1000);
scene.add(light);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setClearColor(backgroundColor, 1);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight*0.9);
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', onWindowResize, false);
initializeScene();

function initializeScene() {
  addBubbleToScene();
  createParticles();
  animate();
}

function onWindowResize() {
  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  updateParticles();
  updateBubble();
  
  renderer.render(scene, camera);
}
