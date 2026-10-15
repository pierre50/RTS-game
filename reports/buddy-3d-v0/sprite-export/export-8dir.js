(() => {
  const SIZE = 96;
  const FRAMES = 12;
  const DIRECTIONS = [
    ['up', 0, 1], ['up-right', 1, 1], ['right', 1, 0], ['down-right', 1, -1],
    ['down', 0, -1], ['down-left', -1, -1], ['left', -1, 0], ['up-left', -1, 1],
  ];
  const canvas = document.getElementById('renderCanvas');
  const output = document.createElement('canvas');
  output.width = SIZE * FRAMES;
  output.height = SIZE * DIRECTIONS.length;
  const outputContext = output.getContext('2d', { willReadFrequently: true });
  const status = document.getElementById('status');

  function addOutline(source) {
    const outlined = new ImageData(SIZE, SIZE);
    const src = source.data;
    const dst = outlined.data;
    const occupied = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && src[(y * SIZE + x) * 4 + 3] > 32;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
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
    camera.orthoLeft = -5.0;
    camera.orthoRight = 5.0;
    camera.orthoTop = 5.0;
    camera.orthoBottom = -5.0;
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
    if (!rightHand || !leftHand || !rig.walk) throw new Error('Animation ou mains manquantes dans le modèle.');
    const sword = window.createBuddySword(scene, rightHand, undefined, leftHand);
    sword.setVariant('sword-iron');
    const shield = window.createBuddyShield(scene, leftHand, undefined, sword.gripSockets.left);
    shield.setVariant('iron');
    scene.materials.forEach(material => material.albedoTexture?.updateSamplingMode(BABYLON.Texture.NEAREST_SAMPLINGMODE));
    await scene.whenReadyAsync();

    const copy = document.createElement('canvas');
    copy.width = SIZE;
    copy.height = SIZE;
    const copyContext = copy.getContext('2d', { willReadFrequently: true });
    const walk = rig.walk;
    walk.start(true, 1);
    walk.pause();
    const forward = new BABYLON.Vector3(-Math.cos(alpha), 0, -Math.sin(alpha));
    const right = new BABYLON.Vector3(forward.z, 0, -forward.x);
    const modelAimYawOffset = Math.PI * 7 / 9;
    for (let row = 0; row < DIRECTIONS.length; row++) {
      const [, screenX, screenY] = DIRECTIONS[row];
      const direction = right.scale(screenX).add(forward.scale(screenY)).normalize();
      root.rotation.y = modelAimYawOffset - Math.atan2(direction.z, direction.x);
      for (let frame = 0; frame < FRAMES; frame++) {
        walk.goToFrame(walk.from + (walk.to - walk.from) * frame / FRAMES);
        sword.updatePose(0, true, 1);
        scene.render();
        copyContext.clearRect(0, 0, SIZE, SIZE);
        copyContext.drawImage(canvas, 0, 0);
        outputContext.putImageData(addOutline(copyContext.getImageData(0, 0, SIZE, SIZE)), frame * SIZE, row * SIZE);
      }
    }
    const png = output.toDataURL('image/png');
    const sheet = document.getElementById('sheet');
    sheet.src = png;
    sheet.width = output.width;
    sheet.height = output.height;
    status.textContent = `Spritesheet prête : ${DIRECTIONS.length} directions × ${FRAMES} images (${output.width} × ${output.height} px).`;
    document.documentElement.dataset.ready = 'true';
    const animation = document.getElementById('animated').getContext('2d');
    animation.imageSmoothingEnabled = false;
    let tick = 0;
    setInterval(() => {
      animation.clearRect(0, 0, SIZE, SIZE);
      const row = Math.floor(tick / FRAMES) % DIRECTIONS.length;
      animation.drawImage(output, (tick % FRAMES) * SIZE, row * SIZE, SIZE, SIZE, 0, 0, SIZE, SIZE);
      tick++;
    }, 90);
  }

  convert().catch(error => {
    console.error(error);
    status.textContent = `Échec de l’export : ${error.message}`;
    document.documentElement.dataset.error = error.message;
  });
})();
