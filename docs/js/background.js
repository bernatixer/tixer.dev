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
renderer.setSize(window.innerWidth, window.innerHeight);
document.querySelector('.hero').prepend(renderer.domElement);

window.addEventListener('resize', onWindowResize, false);
initializeScene();

function initializeScene() {
  addBubbleToScene();
  createParticles();
  animate();
}

function onWindowResize() {
  const innerWidth = window.innerWidth;
  const innerHeight = window.innerHeight;

  windowHalfX = innerWidth / 2;
  windowHalfY = innerHeight / 2;

  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(innerWidth, innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  updateParticles();
  updateBubble();
  
  renderer.render(scene, camera);
}
