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

// let orangeLight = new THREE.PointLight(0xcc6600,50,450,1.7);
// orangeLight.position.set(200,300,500);
// scene.add(orangeLight);
// let redLight = new THREE.PointLight(0xd8547e,50,450,1.7);
// redLight.position.set(100,300,400);
// scene.add(redLight);
// let blueLight = new THREE.PointLight(0x3677ac,50,450,1.7);
// blueLight.position.set(300,300,600);
// scene.add(blueLight);

// EL COLOR: 0x89E894

// Create renderer
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setClearColor(backgroundColor, 1);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight*0.9);
document.body.appendChild(renderer.domElement);

// Start animation


const simplex = new SimplexNoise();
// Bubble
const bubbleGeometry = new THREE.CircleGeometry(400, 128, 6, 6.3);
const bubbleVertices = bubbleGeometry.vertices.slice(1);
const bubbleMaterial = new THREE.ShaderMaterial({
    uniforms: {
        colora: { value: new THREE.Color(0x89E894) }
    },
    vertexShader: BUBBLE_VERTEX_SHADER,
    fragmentShader: BUBBLE_FRAGMENT_SHDAER
});

const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
scene.add(bubble);

const material = new THREE.LineBasicMaterial( { color: 0xffffff } );
const points = [];
points.push( new THREE.Vector3( - 100, 0, 0 ) );
points.push( new THREE.Vector3( 0, 100, 0 ) );
points.push( new THREE.Vector3( 100, 0, 0 ) );

const geometry = new THREE.BufferGeometry().setFromPoints( bubble.geometry.vertices.slice(1) );
var line = new THREE.Line( geometry, material );
scene.add(line)

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
    vertexShader: STAR_VERTEX_SHADER,
    fragmentShader: STAR_FRAGMENT_SHADER
  });

  // Add stars
  particles = new THREE.Points(geometry, material);
  scene.add(particles);

  window.addEventListener('resize', onWindowResize, false);
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

  const time =  performance.now() * 0.00001 * 15 * Math.pow(1, 3);
  const spikes = 0.5 * 1;

  for (let i = 0; i < bubble.geometry.vertices.length; i++) {
    const b = bubble.geometry.vertices[i]; // bubble vertices
    b.normalize().multiplyScalar(
      400 +
          70 *
              simplex.noise4D(
                  b.x * spikes,
                  b.y * spikes,
                  b.z * spikes + time,
                  3
              )
    );
  }

  bubble.geometry.computeVertexNormals();
  bubble.geometry.normalsNeedUpdate = true;
  bubble.geometry.verticesNeedUpdate = true;

  scene.remove(line)
  line = new THREE.Line( new THREE.BufferGeometry().setFromPoints( bubble.geometry.vertices.slice(1) ), material );
  scene.add(line)
  
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