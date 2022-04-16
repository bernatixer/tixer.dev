// Initialize constants
const backgroundColor = new THREE.Color(0x020911);
const starsStart = -1000;
const starsEnd = 1000;
const starsStep = 5;
const speed = 2;
const numParticles = (starsEnd - starsStart) / starsStep;

let scrolledPercentage = 0;

var particles = [];
var cloudParticles = [];

// Create scene
var scene = new THREE.Scene();

// Create camera
var camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 1, 5000);
camera.position.z = 1000;
scene.add(camera);

const light = new THREE.PointLight( 0xffffff, 1, 1000 );
light.position.set( 0, 0, 1000 );
scene.add( light );

let directionalLight = new THREE.DirectionalLight(0xff8c19);
directionalLight.position.set(0,0,1);
scene.add(directionalLight);

let orangeLight = new THREE.PointLight(0xcc6600,50,450,1.7);
orangeLight.position.set(200,300,500);
scene.add(orangeLight);
let redLight = new THREE.PointLight(0xd8547e,50,450,1.7);
redLight.position.set(100,300,400);
scene.add(redLight);
let blueLight = new THREE.PointLight(0x3677ac,50,450,1.7);
blueLight.position.set(300,300,600);
scene.add(blueLight);

// EL COLOR: 0x89E894

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
  // Initialize stars vectors
  const positions = new Float32Array(numParticles * 3);
  const scales = new Float32Array(numParticles);
 
  // Fill vectors with positions
  let i = 0, j = 0;
  for (var zpos = starsStart; zpos < starsEnd; zpos += starsStep) {
    positions[i] = Math.random() * 1000 - 500;
    positions[i + 1] = Math.random() * 1000 - 500;
    positions[i + 2] = zpos;
    scales[j] = 3;

    i += 3;
    j += 1;
  }

  // Create BufferGeometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

  // Create material
  const material = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(0xF7E4BE) },
    },
    vertexShader: document.getElementById('vertexshader').textContent,
    fragmentShader: document.getElementById('fragmentshader').textContent
  });

  // Add stars
  particles = new THREE.Points(geometry, material);
  scene.add(particles);

  // scene.add(generateTriangles());

  window.addEventListener('resize', onWindowResize, false);
}

function generateTriangles() {
  const triangles = 1000;
  const geometry = new THREE.BufferGeometry();
  const positions = [];

  const box = visibleBox(camera.position.z);
  const w = box.width, w2 = w/2;
  const h = 0.3*box.height, h2 = 0.6*box.height;

  for ( let i = 0; i < triangles; i ++ ) {
    const x = Math.random() * w - w2;
    const y = Math.random() * h - h2;

    const extraSize = (h + y)/h;
    const ts = 600*extraSize, ts2 = ts/2;

    const ax = x + Math.random() * ts - ts2;
    const ay = y + Math.random() * ts - ts2;

    const bx = x + Math.random() * ts - ts2;
    const by = y + Math.random() * ts - ts2;

    const cx = x + Math.random() * ts - ts2;
    const cy = y + Math.random() * ts - ts2;

    positions.push(ax, ay, 0);
    positions.push(bx, by, 0);
    positions.push(cx, cy, 0);
  }

  geometry.setAttribute( 'position', new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
  const mesh = new THREE.Mesh( geometry, material );
  return mesh;
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
  checkScroll();
  updateParticles();
  renderer.render(scene, camera);
}

function checkScroll() {
  const scrolled = document.documentElement.scrollTop;
  const height = window.innerHeight;
  const left = height - scrolled;
  scrolledPercentage = left/height;
}

function updateParticles() {
  const positions = particles.geometry.attributes.position.array;
  let i = 0;
  for (let pi = 0; pi < numParticles; ++pi) {
    positions[i + 2] += speed*scrolledPercentage;
    if (positions[i + 2] > 1000) positions[i + 2] -=1500;
    i += 3;
  }
  particles.geometry.attributes.position.needsUpdate = true;
}

function visibleBox(dist) {
  var vFOV = THREE.MathUtils.degToRad(camera.fov);
  var height = 2 * Math.tan(vFOV / 2) * dist;
  var width = height * camera.aspect;
  return {
    width: width,
    height: height
  }
}