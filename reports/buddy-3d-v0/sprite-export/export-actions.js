(() => {
  const SIZE = 96;
  const FRAMES = 12;
  const DIRECTIONS = [
    ['up', 0, 1], ['up-right', 1, 1], ['right', 1, 0], ['down-right', 1, -1],
    ['down', 0, -1], ['down-left', -1, -1], ['left', -1, 0], ['up-left', -1, 1],
  ];
  const canvas = document.getElementById('renderCanvas');
  const status = document.getElementById('status');
  const makeSheet = () => {
    const sheet = document.createElement('canvas');
    sheet.width = SIZE * FRAMES;
    sheet.height = SIZE * DIRECTIONS.length;
    return { sheet, context: sheet.getContext('2d', { willReadFrequently: true }) };
  };
  const sheets = {
    side: { body: makeSheet(), sword: makeSheet() },
    slash: { body: makeSheet(), sword: makeSheet() },
  };

  function outline(source) {
    const outlined = new ImageData(SIZE, SIZE);
    const src = source.data;
    const dst = outlined.data;
    const occupied = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && src[(y * SIZE + x) * 4 + 3] > 32;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      if (occupied(x, y)) {
        for (let channel = 0; channel < 3; channel++)
          dst[i + channel] = Math.min(255, Math.round(src[i + channel] / 12) * 12);
        dst[i + 3] = 255;
      } else if (occupied(x - 1, y) || occupied(x + 1, y) || occupied(x, y - 1) || occupied(x, y + 1)) {
        dst[i] = 33;
        dst[i + 1] = 29;
        dst[i + 2] = 34;
        dst[i + 3] = 255;
      }
    }
    return outlined;
  }

  async function convert() {
    if (!window.BABYLON || !window.createBuddyActionRig || !window.createBuddySword || !window.createBuddyShield)
      throw new Error('Babylon et les éléments du personnage doivent être chargés.');
    const engine = new BABYLON.Engine(canvas, false, { preserveDrawingBuffer: true, premultipliedAlpha: false });
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
    const alpha = -Math.PI / 4;
    const camera = new BABYLON.ArcRotateCamera('sprite iso camera', alpha, Math.PI / 3, 12,
      new BABYLON.Vector3(0, 1.65, 0), scene);
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    camera.orthoLeft = -5;
    camera.orthoRight = 5;
    camera.orthoTop = 5;
    camera.orthoBottom = -5;
    camera.minZ = .1;
    camera.maxZ = 30;
    scene.activeCamera = camera;
    const sky = new BABYLON.HemisphericLight('sky', new BABYLON.Vector3(0, 1, .5), scene);
    sky.intensity = .85;
    const sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-.6, -1, -.7), scene);
    sun.intensity = .5;

    const result = await BABYLON.SceneLoader.ImportMeshAsync('', '../', 'buddy-antiquity-pixel-actions-v23.glb', scene);
    const root = new BABYLON.TransformNode('sprite hero', scene);
    result.meshes[0].parent = root;
    result.meshes[0].position.y = -2.20;
    result.animationGroups.forEach(group => { group.stop(); group.goToFrame(0); });
    window.tuneBuddyFeet(result, scene);
    const rig = window.createBuddyActionRig(result, scene);
    const rightHand = result.transformNodes.find(node => node.name === 'Poignet droit');
    const leftHand = result.transformNodes.find(node => node.name === 'Poignet gauche');
    if (!rightHand || !leftHand || !rig.sideSlashUpper || !rig.slashUpper)
      throw new Error('Animation ou mains manquantes dans le modèle.');
    const sword = window.createBuddySword(scene, rightHand, undefined, leftHand);
    sword.setVariant('sword-iron');
    const shield = window.createBuddyShield(scene, leftHand, undefined, sword.gripSockets.left);
    shield.setVariant('iron');
    scene.materials.forEach(material => material.albedoTexture?.updateSamplingMode(BABYLON.Texture.NEAREST_SAMPLINGMODE));
    await scene.whenReadyAsync();

    const heroMeshes = result.meshes.filter(mesh => mesh.getTotalVertices() > 0);
    const swordMeshes = sword.root.getChildMeshes();
    const shieldMeshes = shield.root.getChildMeshes();
    const occluder = new BABYLON.StandardMaterial('magenta cutout mask', scene);
    occluder.diffuseColor = BABYLON.Color3.Black();
    occluder.emissiveColor = new BABYLON.Color3(1, 0, 1);
    occluder.disableLighting = true;
    occluder.backFaceCulling = false;
    const savedMaterials = new Map([...heroMeshes, ...shieldMeshes].map(mesh => [mesh, mesh.material]));
    const copy = document.createElement('canvas');
    copy.width = SIZE;
    copy.height = SIZE;
    const copyContext = copy.getContext('2d', { willReadFrequently: true });

    function capture(layer) {
      const swordVisible = layer === 'sword';
      for (const mesh of swordMeshes) mesh.isVisible = swordVisible;
      for (const mesh of savedMaterials.keys()) mesh.material = swordVisible ? occluder : savedMaterials.get(mesh);
      scene.render();
      copyContext.clearRect(0, 0, SIZE, SIZE);
      copyContext.drawImage(canvas, 0, 0);
      const pixels = copyContext.getImageData(0, 0, SIZE, SIZE);
      if (swordVisible) for (let i = 0; i < pixels.data.length; i += 4) {
        if (pixels.data[i] > 245 && pixels.data[i + 1] < 10 && pixels.data[i + 2] > 245)
          pixels.data[i + 3] = 0;
      }
      return outline(pixels);
    }

    const forward = new BABYLON.Vector3(-Math.cos(alpha), 0, -Math.sin(alpha));
    const right = new BABYLON.Vector3(forward.z, 0, -forward.x);
    const modelAimYawOffset = Math.PI * 7 / 9;
    for (const [action, group] of [['side', rig.sideSlashUpper], ['slash', rig.slashUpper]]) {
      group.start(false, 1);
      group.pause();
      for (let row = 0; row < DIRECTIONS.length; row++) {
        const [, screenX, screenY] = DIRECTIONS[row];
        const direction = right.scale(screenX).add(forward.scale(screenY)).normalize();
        root.rotation.y = modelAimYawOffset - Math.atan2(direction.z, direction.x);
        for (let frame = 0; frame < FRAMES; frame++) {
          const progress = frame / (FRAMES - 1);
          group.goToFrame(group.from + (group.to - group.from) * progress);
          sword.updatePose(1, false, 1, false, action === 'side' ? progress : null);
          for (const layer of ['body', 'sword']) {
            sheets[action][layer].context.putImageData(capture(layer), frame * SIZE, row * SIZE);
          }
        }
      }
      group.stop();
    }
    // Restore the complete scene so the page can be used interactively after export.
    for (const mesh of swordMeshes) mesh.isVisible = true;
    for (const [mesh, material] of savedMaterials) mesh.material = material;
    for (const [action, layers] of Object.entries(sheets)) for (const [layer, { sheet }] of Object.entries(layers)) {
      const image = document.getElementById(`${layer}-${action}`);
      image.src = sheet.toDataURL('image/png');
      image.width = sheet.width;
      image.height = sheet.height;
    }
    status.textContent = `Prêt : coup rapide et coup chargé, ${DIRECTIONS.length} directions × ${FRAMES} images, héros et épée séparés.`;
    document.documentElement.dataset.ready = 'true';
    const preview = document.getElementById('animated').getContext('2d');
    preview.imageSmoothingEnabled = false;
    let tick = 0;
    setInterval(() => {
      const action = Math.floor(tick / FRAMES) % 2 ? 'slash' : 'side';
      const row = 3;
      const frame = tick % FRAMES;
      preview.clearRect(0, 0, SIZE, SIZE);
      for (const layer of ['body', 'sword'])
        preview.drawImage(sheets[action][layer].sheet, frame * SIZE, row * SIZE, SIZE, SIZE, 0, 0, SIZE, SIZE);
      tick++;
    }, 65);
  }

  convert().catch(error => {
    console.error(error);
    status.textContent = `Échec de l’export : ${error.message}`;
    document.documentElement.dataset.error = error.message;
  });
})();
