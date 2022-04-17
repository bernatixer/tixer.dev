const simplex = new SimplexNoise();
const bubbleGeometry = new THREE.CircleGeometry(400, 128, 6, 6.3);
const lineMaterial = new THREE.LineBasicMaterial( { color: 0xffffff } );
var line = new THREE.Line( new THREE.BufferGeometry().setFromPoints( bubbleGeometry.vertices.slice(1) ), lineMaterial );

function addBubbleToScene() {
    scene.add(line)
}

function updateBubble() {
    const time =  performance.now() * 0.00001 * 15 * Math.pow(1, 3);
    const spikes = 0.5 * 1;
  
    for (let i = 0; i < bubbleGeometry.vertices.length; i++) {
      const b = bubbleGeometry.vertices[i];
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
  
    scene.remove(line)
    line = new THREE.Line( new THREE.BufferGeometry().setFromPoints( bubbleGeometry.vertices.slice(1) ), lineMaterial );
    scene.add(line)
}
