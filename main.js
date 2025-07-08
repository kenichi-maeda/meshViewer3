import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js?module';
import { OBJLoader } from 'https://unpkg.com/three@0.158.0/examples/jsm/loaders/OBJLoader.js?module';

const testCases = [
  { folder: 'data/', original: 'two_spheres.obj', repaired: 'two_spheres_fixed.obj', json: 'two_spheres_intersections.json' },
  { folder: 'data/', original: 'bend_cylinder.obj', repaired: 'bend_cylinder_fixed.obj', json: 'bend_cylinder_intersections.json' }
];

const rows = testCases.length;
const columns = 2;
const totalMeshes = rows * columns;

const headingHeight = 50;
const subH = 300;
const rowSpacing = 40;
const rowHeight = headingHeight + subH + rowSpacing;
const canvasHeight = rowHeight * rows + 20;

const container = document.getElementById('container');
container.style.height = canvasHeight + 'px';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, canvasHeight);
renderer.localClippingEnabled = true;
renderer.setScissorTest(true);
container.appendChild(renderer.domElement);

const scenes = [];
const cameras = [];

for (let i = 0; i < totalMeshes; i++) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);

  scenes.push(scene);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, 3, 3);
  cameras.push(camera);
}

const masterCamera = cameras[0];
const controls = new OrbitControls(masterCamera, renderer.domElement);
controls.enableDamping = true;

const clipPlanes = [];
for (let i = 0; i < rows; i++) {
  const plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  clipPlanes.push(plane);
}

const intersectingFacesDataArray = new Array(rows).fill(null);
const loader = new OBJLoader();

testCases.forEach((testCase, rowIndex) => {
  fetch(testCase.folder + testCase.json)
    .then(response => response.json())
    .then(data => {
      intersectingFacesDataArray[rowIndex] = data;
      loadMeshes(testCase, rowIndex, data);
    })
    .catch(err => console.error('Error loading JSON:', err));
});

function loadMeshes(testCase, rowIndex, intersectionData) {
  const meshFiles = [
    { file: testCase.original, label: 'Original', isOriginal: true },
    { file: testCase.repaired, label: 'Repaired', isOriginal: false }
  ];

  meshFiles.forEach((mesh, colIndex) => {
    const overallIndex = rowIndex * columns + colIndex;
    loader.load(testCase.folder + mesh.file, object => {
      object.traverse(child => {
        if (child.isMesh) {
          let geometry = child.geometry;
          if (geometry.index) geometry = geometry.toNonIndexed();
          geometry.computeVertexNormals();

          if (mesh.isOriginal && intersectionData) {
            const faceCount = geometry.attributes.position.count / 3;
            const colors = new Float32Array(faceCount * 3 * 3);

            for (let i = 0; i < faceCount; i++) {
              const isIntersecting = intersectionData.includes(i);
              const color = isIntersecting ? [1, 0, 0] : [1, 1, 1];

              for (let j = 0; j < 3; j++) {
                const vertexIndex = i * 3 + j;
                colors[vertexIndex * 3 + 0] = color[0];
                colors[vertexIndex * 3 + 1] = color[1];
                colors[vertexIndex * 3 + 2] = color[2];
              }
            }

            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            child.material = new THREE.MeshPhongMaterial({
              vertexColors: true,
              side: THREE.DoubleSide,
              polygonOffset: true,
              polygonOffsetFactor: 1,
              polygonOffsetUnits: 1,
              clippingPlanes: [clipPlanes[rowIndex]]
            });
          } else {
            child.material = new THREE.MeshPhongMaterial({
              color: 0xffffff,
              side: THREE.DoubleSide,
              polygonOffset: true,
              polygonOffsetFactor: 1,
              polygonOffsetUnits: 1,
              clippingPlanes: [clipPlanes[rowIndex]]
            });
          }

          const wireGeo = new THREE.WireframeGeometry(geometry);
          const wireMat = new THREE.LineBasicMaterial({ color: 0x000000, clippingPlanes: [clipPlanes[rowIndex]] });
          const wireframe = new THREE.LineSegments(wireGeo, wireMat);
          child.add(wireframe);

          child.geometry = geometry;
        }
      });

      scenes[overallIndex].add(object);
      renderAll();
    });
  });

  // Heading and slider
  const headingDiv = document.createElement('div');
  headingDiv.className = 'case-heading';
  headingDiv.style.top = (rowIndex * rowHeight + 10) + 'px';
  headingDiv.style.left = '20px';
  headingDiv.style.width = 'calc(100% - 40px)';

  const title = document.createElement('span');
  title.textContent = `Case ${rowIndex + 1}`;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '-5';
  slider.max = '5';
  slider.step = '0.1';
  slider.value = '0';
  slider.className = 'slider';
  slider.addEventListener('input', e => {
    clipPlanes[rowIndex].constant = parseFloat(e.target.value);
    renderAll();
  });

  headingDiv.appendChild(title);
  headingDiv.appendChild(slider);
  container.appendChild(headingDiv);
}

const labels = [];
for (let i = 0; i < totalMeshes; i++) {
  const label = document.createElement('div');
  label.className = 'subplot-label';
  label.innerText = i % 2 === 0 ? 'Original' : 'Repaired';
  container.appendChild(label);
  labels.push(label);
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, canvasHeight);
  renderAll();
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  for (let i = 1; i < totalMeshes; i++) {
    cameras[i].position.copy(masterCamera.position);
    cameras[i].quaternion.copy(masterCamera.quaternion);
    cameras[i].updateMatrixWorld();
  }

  renderAll();
}
animate();

function renderAll() {
  const width = container.clientWidth;
  const subW = width / columns;

  for (let i = 0; i < totalMeshes; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const rowTop = row * rowHeight + headingHeight;

    const viewportY = canvasHeight - (rowTop + subH);
    const viewportX = col * subW;

    cameras[i].aspect = subW / subH;
    cameras[i].updateProjectionMatrix();

    renderer.setViewport(viewportX, viewportY, subW, subH);
    renderer.setScissor(viewportX, viewportY, subW, subH);
    renderer.render(scenes[i], cameras[i]);

    labels[i].style.left = (viewportX + 5) + 'px';
    labels[i].style.top = (canvasHeight - viewportY - subH + 5) + 'px';
  }
}
