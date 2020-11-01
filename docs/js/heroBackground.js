var speed = 2;
var particles = [];

var camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 1, 5000);
var scene = new THREE.Scene();
camera.position.z = 1000;
console.log(camera.position)
scene.add(camera);
var renderer = new THREE.WebGLRenderer({
  antialias: true
});
var backgroundColor = new THREE.Color(0x020911);
renderer.setClearColor(backgroundColor, 1);
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild(renderer.domElement);

const numParticles = 400;
createParticles();
update();

function createParticles() {
  const positions = new Float32Array( numParticles * 3 );
  const scales = new Float32Array( numParticles );
  let i = 0, j = 0;

  for (var zpos = -1000; zpos < 1000; zpos += 5) {
    positions[ i ] = Math.random() * 1000 - 500; // x
    positions[ i + 1 ] = Math.random() * 1000 - 500; // y
    positions[ i + 2 ] = zpos; // z
    scales[ j ] = 3;

    i += 3;
    j ++;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
  geometry.setAttribute( 'scale', new THREE.BufferAttribute( scales, 1 ) );

  const material = new THREE.ShaderMaterial( {

    uniforms: {
      color: { value: new THREE.Color( 0xF7E4BE ) },
    },
    vertexShader: document.getElementById( 'vertexshader' ).textContent,
    fragmentShader: document.getElementById( 'fragmentshader' ).textContent

  } );

  particles = new THREE.Points( geometry, material );
  scene.add( particles );

}

function update() {
  requestAnimationFrame(update);
  const positions = particles.geometry.attributes.position.array;
  let i = 0;
  for (let pi = 0; pi < numParticles; ++pi) {
    positions[ i + 2 ] += speed;
    if (positions[ i + 2 ] > 1000) positions[ i + 2 ] -=1500;
    i += 3;
  }
  particles.geometry.attributes.position.needsUpdate = true;
  renderer.render(scene, camera);
}
