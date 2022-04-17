const starsStart = -1000;
const starsEnd = 1000;
const starsStep = 5;
const speed = 2;
const numParticles = (starsEnd - starsStart) / starsStep;

var particles = [];

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
