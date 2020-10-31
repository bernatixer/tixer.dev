var speed = 2;
var particles = [];
var w = window.innerWidth;
var h = window.innerHeight;

var camera = new THREE.PerspectiveCamera(85, w/h, 1, 4000);
var scene = new THREE.Scene();
camera.position.z = 1000;
scene.add(camera);
var renderer = new THREE.CanvasRenderer();
var backgroundColor = new THREE.Color(0x020911);
renderer.setClearColor(backgroundColor, 1);
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);

createParticles();
update();

function createParticles() {
  var particle, material;
  for (var zpos = -1000; zpos < 1000; zpos += 5) {
    material = new THREE.ParticleCanvasMaterial({
      color: 0xF7E4BE,
      program: function(c){
        c.beginPath();
        c.arc(0, 0, .8, 0, Math.PI * 2, true);
        c.fill();
      }
    });
    particle = new THREE.Particle(material);
    particle.position.x = Math.random() * 1000 - 500;
    particle.position.y = Math.random() * 1000 - 500;
    particle.position.z = zpos;
    particle.scale.x = particle.scale.y = 1;
    scene.add(particle);
    particles.push(particle);
  }
}

function update() {
  requestAnimationFrame( update);  
  for (var i = 0; i < particles.length; i++) {
    particle = particles[i];
    particle.position.z += speed;
    if (particle.position.z > 1000) particle.position.z -= 2000;
      }
  renderer.render(scene, camera);
}

if (!window.requestAnimationFrame ) {
    window.requestAnimationFrame = ( function() {
        return window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function(callback, element ) {
            window.setTimeout( callback, 1000 / 60 );
        };
    })();
}