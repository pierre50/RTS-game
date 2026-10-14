(() => {
  const canvas = document.getElementById('renderCanvas');
  const status = document.getElementById('status');
  const toggleWalk = document.getElementById('toggleWalk');
  const walkSpeed = document.getElementById('walkSpeed');
  const speedValue = document.getElementById('speedValue');
  const models = {
    reference: {
      file: 'buddy-reference-walk.glb', front: Math.atan2(0.532, -0.847),
      targetY: 4.2, floorY: 2.10, radius: 6.5, atlas: 'buddy-simple-uv.png', result: null, animation: null,
    },
    original: {
      file: 'buddy.glb', front: Math.PI / 2,
      targetY: 1.30, floorY: -0.025, radius: 5.3, atlas: 'buddy-uv.png', result: null, animation: null,
    },
  };
  let current = null;
  let playing = true;
  if (!window.BABYLON) {
    status.textContent = 'Babylon.js ne s’est pas chargé.';
    return;
  }
  const engine = new BABYLON.Engine(canvas, true);
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.10, 0.15, 0.21, 1);
  const camera = new BABYLON.ArcRotateCamera(
    'orbit', models.reference.front - 0.35, 1.35, 7,
    new BABYLON.Vector3(0, models.reference.targetY, 0), scene
  );
  camera.lowerRadiusLimit = 2;
  camera.upperRadiusLimit = 12;
  camera.wheelPrecision = 45;
  camera.attachControl(canvas, true);
  const hemi = new BABYLON.HemisphericLight('sky', new BABYLON.Vector3(0, 1, 0.5), scene);
  hemi.intensity = 0.85;
  const sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.6, -1, -0.7), scene);
  sun.intensity = 0.5;
  const disc = BABYLON.MeshBuilder.CreateDisc('floor', { radius: 1.7, tessellation: 64 }, scene);
  disc.rotation.x = Math.PI / 2;
  disc.position.y = models.reference.floorY;
  const floorMaterial = new BABYLON.StandardMaterial('floor material', scene);
  floorMaterial.diffuseColor = new BABYLON.Color3(0.24, 0.34, 0.43);
  floorMaterial.specularColor = BABYLON.Color3.Black();
  disc.material = floorMaterial;

  async function selectModel(key) {
    const next = models[key];
    if (next === current) return;
    status.textContent = 'Chargement du modèle…';
    try {
      if (!next.result) {
        next.result = await BABYLON.SceneLoader.ImportMeshAsync('', './', next.file, scene);
        next.animation = next.result.animationGroups.find(group => group.name === 'Walk');
        scene.materials.forEach(material => {
          if (material.albedoTexture) {
            material.albedoTexture.updateSamplingMode(BABYLON.Texture.NEAREST_SAMPLINGMODE);
          }
        });
      }
      if (current) {
        current.animation?.stop();
        current.result.meshes[0].setEnabled(false);
      }
      current = next;
      current.result.meshes[0].setEnabled(true);
      current.animation?.stop();
      current.animation?.start(true, Number(walkSpeed.value));
      if (!playing) current.animation?.pause();
      camera.setTarget(new BABYLON.Vector3(0, next.targetY, 0));
      camera.radius = next.radius;
      camera.alpha = next.front - 0.35;
      camera.beta = 1.35;
      disc.position.y = next.floorY;
      document.getElementById('atlasPreview').src = `./${next.atlas}`;
      document.getElementById('atlasDownload').href = `./${next.atlas}`;
      document.querySelectorAll('[data-model]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.model === key));
      });
      status.textContent = current.animation
        ? (playing ? 'Animation Walk en cours.' : 'Animation en pause.')
        : 'Le modèle est chargé, mais l’animation Walk est absente.';
    } catch (error) {
      status.textContent = 'Impossible de charger le modèle 3D.';
      console.error(error);
    }
  }

  document.querySelectorAll('[data-model]').forEach(button => {
    button.addEventListener('click', () => selectModel(button.dataset.model));
  });
  toggleWalk.addEventListener('click', () => {
    if (!current?.animation) return;
    if (playing) {
      current.animation.pause();
      toggleWalk.textContent = 'Reprendre';
      status.textContent = 'Animation en pause.';
    } else {
      current.animation.play(true);
      toggleWalk.textContent = 'Pause';
      status.textContent = 'Animation Walk en cours.';
    }
    playing = !playing;
  });
  walkSpeed.addEventListener('input', () => {
    speedValue.textContent = `${Number(walkSpeed.value).toFixed(1).replace('.', ',')}×`;
    if (current?.animation) current.animation.speedRatio = Number(walkSpeed.value);
  });
  for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => {
    if (!current) return;
    camera.alpha = current.front + { front: 0, right: -Math.PI / 2, back: -Math.PI, left: Math.PI / 2 }[button.dataset.view];
    camera.beta = 1.35;
  });
  selectModel('reference');
  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', () => engine.resize());
})();
