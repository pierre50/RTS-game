(() => {
  const canvases = {
    front: document.getElementById('source'),
    back: document.getElementById('sourceBack'),
    side: document.getElementById('sourceSide')
  };
  const canvas = document.getElementById('renderCanvas');
  const status = document.getElementById('status');
  const depthControl = document.getElementById('depth');
  const alphaControl = document.getElementById('alpha');
  const shadeControl = document.getElementById('shade');
  const spinControl = document.getElementById('spin');
  const depthValue = document.getElementById('depthValue');
  const alphaValue = document.getElementById('alphaValue');
  const shadeValue = document.getElementById('shadeValue');
  const sprites = {};
  let body = null;

  if (!window.BABYLON) {
    status.textContent = 'Babylon.js ne s’est pas chargé. Vérifier la connexion Internet.';
    return;
  }

  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true });
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.12, 0.16, 0.22, 1);
  const camera = new BABYLON.ArcRotateCamera(
    'orbit', -Math.PI / 2 + 0.28, Math.PI / 2.5, 4.6,
    new BABYLON.Vector3(0, 1.0, 0), scene
  );
  camera.lowerRadiusLimit = 1.4;
  camera.upperRadiusLimit = 12;
  camera.wheelPrecision = 45;
  camera.attachControl(canvas, true);

  const light = new BABYLON.HemisphericLight('soft light', new BABYLON.Vector3(0.2, 1, 0.7), scene);
  light.intensity = 1.15;
  const directional = new BABYLON.DirectionalLight('key light', new BABYLON.Vector3(-0.5, -1, -0.7), scene);
  directional.intensity = 0.55;
  const ground = BABYLON.MeshBuilder.CreateDisc('ground', { radius: 1.55, tessellation: 64 }, scene);
  ground.rotation.x = Math.PI / 2;
  ground.position.y = -0.035;
  const groundMaterial = new BABYLON.StandardMaterial('ground material', scene);
  groundMaterial.diffuseColor = new BABYLON.Color3(0.24, 0.31, 0.40);
  groundMaterial.specularColor = BABYLON.Color3.Black();
  ground.material = groundMaterial;

  function pixelAt(image, x, y) {
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) return [0, 0, 0, 0];
    const index = (y * image.width + x) * 4;
    return image.data.subarray(index, index + 4);
  }

  function bounds(image, cutoff) {
    let minX = image.width, minY = image.height, maxX = -1, maxY = -1;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      if (pixelAt(image, x, y)[3] < cutoff) continue;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    return maxX < 0 ? null : { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  // Each voxel belongs to both the front and side silhouettes. Exposed
  // surfaces receive colors from the matching orthographic sprite.
  function createMesh(front, back, side, thickness, cutoff, sideShade) {
    const frontBounds = bounds(front, cutoff), sideBounds = bounds(side, cutoff);
    if (!frontBounds || !sideBounds) throw new Error('La face et le profil doivent avoir des pixels opaques.');
    const width = front.width, height = front.height, depthCells = 24;
    const pixelSize = 2.3 / Math.max(frontBounds.width, frontBounds.height);
    const sideYShift = sideBounds.maxY - frontBounds.maxY;
    const sideColumn = z => sideBounds.maxX - Math.min(sideBounds.width - 1, Math.floor((z + 0.5) * sideBounds.width / depthCells));
    const cellIndex = (x, y, z) => (y * width + x) * depthCells + z;
    const solid = new Uint8Array(width * height * depthCells);
    let voxelCount = 0;
    for (let y = frontBounds.minY; y <= frontBounds.maxY; y++) for (let x = frontBounds.minX; x <= frontBounds.maxX; x++) {
      if (pixelAt(front, x, y)[3] < cutoff) continue;
      for (let z = 0; z < depthCells; z++) {
        if (pixelAt(side, sideColumn(z), y + sideYShift)[3] < cutoff) continue;
        solid[cellIndex(x, y, z)] = 1;
        voxelCount++;
      }
    }
    if (!voxelCount) throw new Error('Les silhouettes de face et de profil ne se croisent pas.');
    const occupied = (x, y, z) => x >= 0 && x < width && y >= 0 && y < height && z >= 0 && z < depthCells && solid[cellIndex(x, y, z)] === 1;

    const positions = [], colors = [], indices = [], normals = [];
    const addQuad = (corners, color) => {
      const start = positions.length / 3;
      for (const corner of corners) {
        positions.push(...corner);
        colors.push(color[0], color[1], color[2], 1);
      }
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    };
    const rgb = (sample, dim = 0) => [sample[0] / 255 * (1 - dim), sample[1] / 255 * (1 - dim), sample[2] / 255 * (1 - dim)];
    const xCenter = (frontBounds.minX + frontBounds.maxX + 1) / 2;
    for (let y = frontBounds.minY; y <= frontBounds.maxY; y++) for (let x = frontBounds.minX; x <= frontBounds.maxX; x++) for (let z = 0; z < depthCells; z++) {
      if (!occupied(x, y, z)) continue;
      const l = (x - xCenter) * pixelSize, r = l + pixelSize;
      const t = (frontBounds.maxY - y + 1) * pixelSize, b = t - pixelSize;
      const zb = (z / depthCells - 0.5) * thickness;
      const zf = ((z + 1) / depthCells - 0.5) * thickness;
      const frontPixel = pixelAt(front, x, y);
      const backPixel = pixelAt(back, x, y);
      const sidePixel = pixelAt(side, sideColumn(z), y + sideYShift);
      const frontColor = rgb(frontPixel);
      const backColor = rgb(backPixel[3] >= cutoff ? backPixel : frontPixel);
      const sideColor = rgb(sidePixel, sideShade);
      const capColor = rgb(frontPixel, Math.min(0.55, sideShade + 0.16));
      if (!occupied(x, y, z + 1)) addQuad([[l,b,zf],[r,b,zf],[r,t,zf],[l,t,zf]], frontColor);
      if (!occupied(x, y, z - 1)) addQuad([[l,b,zb],[l,t,zb],[r,t,zb],[r,b,zb]], backColor);
      if (!occupied(x, y - 1, z)) addQuad([[l,t,zf],[r,t,zf],[r,t,zb],[l,t,zb]], capColor);
      if (!occupied(x, y + 1, z)) addQuad([[l,b,zb],[r,b,zb],[r,b,zf],[l,b,zf]], capColor);
      if (!occupied(x - 1, y, z)) addQuad([[l,b,zb],[l,b,zf],[l,t,zf],[l,t,zb]], sideColor);
      if (!occupied(x + 1, y, z)) addQuad([[r,b,zf],[r,b,zb],[r,t,zb],[r,t,zf]], sideColor);
    }
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    const mesh = new BABYLON.Mesh('sprite volume', scene);
    const geometry = new BABYLON.VertexData();
    geometry.positions = positions;
    geometry.indices = indices;
    geometry.normals = normals;
    geometry.colors = colors;
    geometry.applyToMesh(mesh);
    const material = new BABYLON.StandardMaterial('sprite colors', scene);
    material.diffuseColor = BABYLON.Color3.White();
    material.emissiveColor = new BABYLON.Color3(0.55, 0.55, 0.55);
    material.specularColor = BABYLON.Color3.Black();
    material.useVertexColors = true;
    material.backFaceCulling = true;
    mesh.material = material;
    mesh.metadata = { voxelCount, faceCount: indices.length / 6, height: frontBounds.height * pixelSize };
    return mesh;
  }

  function rebuild() {
    depthValue.textContent = Number(depthControl.value).toFixed(2).replace('.', ',');
    alphaValue.textContent = alphaControl.value;
    shadeValue.textContent = `${shadeControl.value} %`;
    if (!sprites.front || !sprites.back || !sprites.side) return;
    try {
      const next = createMesh(sprites.front, sprites.back, sprites.side, Number(depthControl.value), Number(alphaControl.value), Number(shadeControl.value) / 100);
      if (body) { body.material.dispose(); body.dispose(); }
      body = next;
      camera.target = new BABYLON.Vector3(0, next.metadata.height / 2, 0);
      status.textContent = `${next.metadata.voxelCount} voxels · ${next.metadata.faceCount} faces visibles`;
    } catch (error) {
      status.textContent = error.message;
    }
  }

  function setSprite(kind, image, sourceFrame) {
    const target = canvases[kind];
    const context = target.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, 64, 64);
    const scale = Math.min(64 / sourceFrame.width, 64 / sourceFrame.height);
    const outputWidth = Math.max(1, Math.round(sourceFrame.width * scale));
    const outputHeight = Math.max(1, Math.round(sourceFrame.height * scale));
    const offsetX = Math.floor((64 - outputWidth) / 2);
    context.drawImage(image, sourceFrame.x, sourceFrame.y, sourceFrame.width, sourceFrame.height, offsetX, 64 - outputHeight, outputWidth, outputHeight);
    sprites[kind] = context.getImageData(0, 0, 64, 64);
    rebuild();
  }

  function loadDefault() {
    const atlas = new Image();
    atlas.onload = () => {
      // LPC walking rows: back 0–8, side 9–17, front 18–26.
      setSprite('back', atlas, { x: 4 * 65, y: 0, width: 64, height: 64 });
      setSprite('side', atlas, { x: 13 * 65, y: 0, width: 64, height: 64 });
      setSprite('front', atlas, { x: 22 * 65, y: 0, width: 64, height: 64 });
    };
    atlas.onerror = () => { status.textContent = 'Sprites du jeu introuvables.'; };
    atlas.src = '../../public/assets/graphics/units/villager/latium/male/texture.png';
  }

  document.getElementById('reset').addEventListener('click', loadDefault);
  for (const [kind, inputId] of [['front', 'uploadFront'], ['back', 'uploadBack'], ['side', 'uploadSide']]) {
    document.getElementById(inputId).addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        setSprite(kind, image, { x: 0, y: 0, width: image.width, height: image.height });
        URL.revokeObjectURL(url);
      };
      image.onerror = () => { status.textContent = 'Impossible de lire cette image.'; URL.revokeObjectURL(url); };
      image.src = url;
    });
  }
  for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => {
    camera.alpha = { front: -Math.PI / 2, right: 0, back: Math.PI / 2, left: Math.PI }[button.dataset.view];
    camera.beta = Math.PI / 2.5;
  });
  for (const control of [depthControl, alphaControl, shadeControl]) control.addEventListener('input', rebuild);

  engine.runRenderLoop(() => {
    if (spinControl.checked && body) camera.alpha += engine.getDeltaTime() * 0.0004;
    scene.render();
  });
  window.addEventListener('resize', () => engine.resize());
  loadDefault();
})();
