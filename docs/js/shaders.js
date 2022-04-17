const BUBBLE_VERTEX_SHADER = `
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}`;

const BUBBLE_FRAGMENT_SHDAER = `
uniform vec3 color;

void main() {
  gl_FragColor = vec4(color, 1.0);
}`;

const STAR_VERTEX_SHADER = `
attribute float scale;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = scale * (500.0 / - mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}`;

const STAR_FRAGMENT_SHADER = `
uniform vec3 color;

void main() {
  if (length(gl_PointCoord - vec2(0.5, 0.5)) > 0.550) discard;
  gl_FragColor = vec4(color, 1.0);
}`;