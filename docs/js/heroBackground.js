// Initialize constants
const backgroundColor = new THREE.Color(0x020911);
const starsStart = -1000;
const starsEnd = 1000;
const starsStep = 5;
const speed = 2;
const numParticles = (starsEnd - starsStart) / starsStep;

var particles = [];

// Create scene
var scene = new THREE.Scene();

// Create camera
var camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 1, 5000);
camera.position.z = 1000;
scene.add(camera);

// Create renderer
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setClearColor(backgroundColor, 1);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Start animation
createParticles();
animate();

function createParticles() {
  const positions = new Float32Array(numParticles * 3);
  const scales = new Float32Array(numParticles);
 
  let i = 0, j = 0;
  for (var zpos = starsStart; zpos < starsEnd; zpos += starsStep) {
    positions[i] = Math.random() * 1000 - 500;
    positions[i + 1] = Math.random() * 1000 - 500;
    positions[i + 2] = zpos;
    scales[j] = 3;

    i += 3;
    j += 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(0xF7E4BE) },
    },
    vertexShader: document.getElementById('vertexshader').textContent,
    fragmentShader: document.getElementById('fragmentshader').textContent
  });

  particles = new THREE.Points(geometry, material);
  scene.add(particles);
}

function animate() {
  requestAnimationFrame(animate);
  updateParticles();
  renderer.render(scene, camera);
}

function updateParticles() {
  const positions = particles.geometry.attributes.position.array;
  let i = 0;
  for (let pi = 0; pi < numParticles; ++pi) {
    positions[i + 2] += speed;
    if (positions[i + 2] > 1000) positions[i + 2] -=1500;
    i += 3;
  }
  particles.geometry.attributes.position.needsUpdate = true;
}
