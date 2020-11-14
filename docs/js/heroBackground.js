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

const light = new THREE.PointLight( 0xffffff, 1, 1000 );
light.position.set( 0, 0, 1000 );
scene.add( light );

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

  // scene.add(generateDelaunayTriangles());
  scene.add(generateTriangles());

  window.addEventListener('resize', onWindowResize, false);
}

function generateDelaunayTriangles() {
  const numPoints = 20;
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  
  const box = visibleBox(camera.position.z);
  const w = box.width, w2 = w/2;
  const h = 0.3*box.height, h2 = 0.5*box.height;
  const ha = 0.2*box.height, ha2 = 0.4*box.height;
  const hb = 0.1*box.height, hb2 = 0.3*box.height;
  
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const x = Math.random() * w - w2;
    const y = Math.random() * h - h2;
    points.push([x,y]);
  }
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * w - w2;
    const y = Math.random() * ha - ha2;
    points.push([x,y]);
  }
  for (let i = 0; i < 25; i++) {
    const x = Math.random() * w - w2;
    const y = Math.random() * hb - hb2;
    points.push([x,y]);
  }

  const delaunay = new Delaunator.from(points);
  
  for (let i = 0; i < delaunay.triangles.length; i += 6) {
    const aOffset = Math.random() * 8 - 4;
    const bOffset = Math.random() * 8 - 4;
    const cOffset = Math.random() * 8 - 4;
    const a = points[delaunay.triangles[i]];
    const b = points[delaunay.triangles[i+1]];
    const c = points[delaunay.triangles[i+2]];
    positions.push(
      b[0]+aOffset, b[1]+aOffset, 0,
      a[0]+bOffset, a[1]+bOffset, 0,
      c[0]+cOffset, c[1]+cOffset, 0
    );
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  
  geometry.computeBoundingSphere();
  
  const material = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
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

  console.log(positions);
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

function visibleBox(dist) {
  var vFOV = THREE.MathUtils.degToRad(camera.fov);
  var height = 2 * Math.tan(vFOV / 2) * dist;
  var width = height * camera.aspect;
  return {
    width: width,
    height: height
  }
}