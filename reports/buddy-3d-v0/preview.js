(() => {
  const canvas = document.getElementById('renderCanvas');
  const status = document.getElementById('status');
  const toggleWalk = document.getElementById('toggleWalk');
  const animationSelect = document.getElementById('animationSelect');
  const walkSpeed = document.getElementById('walkSpeed');
  const speedValue = document.getElementById('speedValue');
  const swordSelect = document.getElementById('swordSelect');
  const swordSprite = document.getElementById('swordSprite');
  const shieldSelect = document.getElementById('shieldSelect');
  const shieldSprite = document.getElementById('shieldSprite');
  const models = {
    antiquity: {
      file: 'buddy-antiquity-pixel-actions-v23.glb', front: Math.atan2(0.532, -0.847),
      targetY: 3.85, floorY: 2.20, radius: 8.0, beta: 1.48, atlas: 'buddy-antiquity-pixel-uv.png',
    },
    reference: {
      file: 'buddy-reference-walk.glb', front: Math.atan2(0.532, -0.847),
      targetY: 4.2, floorY: 2.10, radius: 6.5, beta: 1.35, atlas: 'buddy-simple-uv.png',
    },
    original: {
      file: 'buddy.glb', front: Math.PI / 2,
      targetY: 1.30, floorY: -0.025, radius: 5.3, beta: 1.35, atlas: 'buddy-uv.png',
    },
  };
  if (!window.BABYLON || !window.tuneBuddyFeet || !window.createBuddySword || !window.createBuddyShield) {
    status.textContent = 'Babylon.js ou les éléments du personnage ne se sont pas chargés.';
    return;
  }

  const engine = new BABYLON.Engine(canvas, true);
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.10, 0.15, 0.21, 1);
  const camera = new BABYLON.ArcRotateCamera(
    'orbit', models.antiquity.front - 0.35, models.antiquity.beta, 7,
    new BABYLON.Vector3(0, models.antiquity.targetY, 0), scene,
  );
  camera.lowerRadiusLimit = 2;
  camera.upperRadiusLimit = 25;
  camera.wheelPrecision = 45;
  camera.attachControl(canvas, true);
  canvas.addEventListener('wheel', event => event.preventDefault(), { passive: false });
  const hemi = new BABYLON.HemisphericLight('sky', new BABYLON.Vector3(0, 1, 0.5), scene);
  hemi.intensity = 0.85;
  const sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.6, -1, -0.7), scene);
  sun.intensity = 0.5;
  const disc = BABYLON.MeshBuilder.CreateDisc('floor', { radius: 1.7, tessellation: 64 }, scene);
  disc.rotation.x = Math.PI / 2;
  const floorMaterial = new BABYLON.StandardMaterial('floor material', scene);
  floorMaterial.diffuseColor = new BABYLON.Color3(0.24, 0.34, 0.43);
  floorMaterial.specularColor = BABYLON.Color3.Black();
  disc.material = floorMaterial;

  let current = null;
  let playing = true;
  let selectedAnimation = 'Walk';
  let selectedSword = 'sword-iron';
  let selectedShield = 'iron';
  let previewShotFired = false;

  const animationSpeed = () => {
    const base = Number(walkSpeed.value);
    return selectedAnimation === 'Walk' ? base * controls.animationMultiplier : base;
  };

  function updateAnimationSpeed() {
    if (current?.animation) current.animation.speedRatio = animationSpeed();
    if (current?.rig?.walkLegs) current.rig.walkLegs.speedRatio = Number(walkSpeed.value) * controls.animationMultiplier;
  }
  const controls = window.bindBuddyActionKeys(() => {
    updateAnimationSpeed();
    syncBlock();
  });

  function syncBlock() {
    if (!current?.attack) return;
    if (controls.blocking) {
      if (current.attack.startBlock({
        walkSpeed: Number(walkSpeed.value) * controls.animationMultiplier,
        keepLegsMoving: selectedAnimation === 'Walk' && playing,
        stopCurrent: () => current.animation?.stop(),
      })) status.textContent = 'Blocage !';
    } else current.attack.releaseBlock();
  }

  function equipSword() {
    swordSelect.disabled = current !== models.antiquity;
    if (current?.sword) current.sword.setVariant(selectedSword);
    swordSelect.value = selectedSword;
    swordSprite.style.display = selectedSword === 'none' ? 'none' : '';
    if (selectedSword !== 'none') {
      swordSprite.src = `../../assets/icon-sources/icons/${window.buddyEquipmentIcon(selectedSword)}`;
      swordSprite.alt = `Icône : ${swordSelect.selectedOptions[0].textContent}`;
    }
  }

  function equipShield() {
    const ranged = window.buddyIsRangedEquipment(selectedSword);
    shieldSelect.disabled = current !== models.antiquity || ranged;
    current?.shield?.setVariant(ranged ? 'none' : selectedShield);
    shieldSelect.value = selectedShield;
    shieldSprite.style.display = ranged || selectedShield === 'none' ? 'none' : '';
    if (selectedShield !== 'none') {
      shieldSprite.src = `../../assets/icon-sources/icons/${window.buddyShieldIcon(selectedShield)}`;
      shieldSprite.alt = `Icône : ${shieldSelect.selectedOptions[0].textContent}`;
    }
  }

  function selectAnimation(name) {
    selectedAnimation = name;
    previewShotFired = false;
    animationSelect.value = name;
    if (!current) return;
    current.attack?.cancel();
    current.animation?.stop();
    current.animation = current.result.animationGroups.find(group => group.name === name) || null;
    if (current.animation) {
      current.animation.start(true, animationSpeed());
      if (!playing) current.animation.pause();
      status.textContent = playing ? `Animation ${name} en cours.` : 'Animation en pause.';
    } else {
      status.textContent = `Animation ${name} indisponible pour ce modèle.`;
    }
    toggleWalk.disabled = !current.animation;
    toggleWalk.textContent = playing ? 'Pause' : 'Reprendre';
  }

  async function selectModel(key) {
    const next = models[key];
    if (next === current) return;
    status.textContent = 'Chargement du modèle…';
    try {
      if (!next.result) {
        next.result = await BABYLON.SceneLoader.ImportMeshAsync('', './', next.file, scene);
        scene.materials.forEach(material => {
          material.albedoTexture?.updateSamplingMode(BABYLON.Texture.NEAREST_SAMPLINGMODE);
        });
        if (key === 'antiquity') {
          window.tuneBuddyFeet(next.result, scene);
          next.rig = window.createBuddyActionRig(next.result, scene);
          const wrist = next.result.transformNodes.find(node => node.name === 'Poignet droit');
          const offhand = next.result.transformNodes.find(node => node.name === 'Poignet gauche');
          if (wrist) next.sword = window.createBuddySword(scene, wrist, undefined, offhand);
          if (offhand) next.shield = window.createBuddyShield(
            scene, offhand, undefined, next.sword?.gripSockets.left);
          next.attack = window.createBuddyAttack(next.rig, next.sword, () => {
            if (current === next) selectAnimation(selectedAnimation);
          });
        }
      }
      if (current) {
        current.attack?.cancel();
        current.animation?.stop();
        current.result.meshes[0].setEnabled(false);
      }
      current = next;
      current.result.meshes[0].setEnabled(true);
      equipSword();
      equipShield();
      const slashAvailable = current.result.animationGroups.some(group => group.name === 'Slash');
      const sideSlashAvailable = current.result.animationGroups.some(group => group.name === 'SideSlash');
      const thrustAvailable = current.result.animationGroups.some(group => group.name === 'Thrust');
      const chopAvailable = current.result.animationGroups.some(group => group.name === 'Chop');
      const shotAvailable = current.result.animationGroups.some(group => group.name === 'Shot');
      animationSelect.querySelector('option[value="Slash"]').disabled = !slashAvailable;
      animationSelect.querySelector('option[value="SideSlash"]').disabled = !sideSlashAvailable;
      animationSelect.querySelector('option[value="Thrust"]').disabled = !thrustAvailable;
      animationSelect.querySelector('option[value="Chop"]').disabled = !chopAvailable;
      animationSelect.querySelector('option[value="Shot"]').disabled = !shotAvailable;
      selectAnimation(current.result.animationGroups.some(group => group.name === selectedAnimation) ? selectedAnimation : 'Walk');
      syncBlock();
      camera.setTarget(new BABYLON.Vector3(0, next.targetY, 0));
      camera.radius = next.radius;
      camera.alpha = next.front - 0.35;
      camera.beta = next.beta;
      disc.position.y = next.floorY;
      document.getElementById('atlasPreview').src = `./${next.atlas}`;
      document.getElementById('atlasDownload').href = `./${next.atlas}`;
      document.querySelectorAll('[data-model]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.model === key));
      });
    } catch (error) {
      console.error(error);
      status.textContent = 'Impossible de charger le modèle 3D.';
    }
  }

  document.querySelectorAll('[data-model]').forEach(button => {
    button.addEventListener('click', () => selectModel(button.dataset.model));
  });
  function triggerAttack(action) {
    if (action === 'ChargeSlash' || action === 'ChargeShot') {
      if (current?.attack?.startCharge({
        action: action === 'ChargeShot' ? 'Shot' : 'Slash',
        walkSpeed: Number(walkSpeed.value) * controls.animationMultiplier,
        keepLegsMoving: selectedAnimation === 'Walk' && playing,
        stopCurrent: () => current.animation?.stop(),
      })) status.textContent = action === 'ChargeShot' ? 'Tir : tends la corde…' : 'Grand slash : maintiens pour charger…';
      return;
    }
    if (action === 'ReleaseSlash' || action === 'ReleaseShot') {
      const power = current?.attack?.releaseCharge();
      if (power) status.textContent = `${action === 'ReleaseShot' ? 'Tir' : 'Grand slash'} ×${power.toFixed(1)} !`;
      return;
    }
    if (action === 'CancelCharge') {
      current?.attack?.cancelCharge();
      return;
    }
    if (current?.attack?.start({
      action,
      walkSpeed: Number(walkSpeed.value) * controls.animationMultiplier,
      keepLegsMoving: selectedAnimation === 'Walk' && playing,
      stopCurrent: () => current.animation?.stop(),
    })) status.textContent = {
      Chop: 'Coup vertical !', Thrust: 'Estoc !', Shot: 'Tir !',
      Slash: 'Grand slash !', SideSlash: 'Coup latéral !',
    }[action];
  }

  window.bindBuddyAttackPointer(canvas,
    () => current?.attack && !current.attack.attacking && !current.attack.charging && !current.attack.blocking
      ? window.buddyPointerActionsForEquipment(selectedSword) : null,
    triggerAttack,
    { onPointerDown: () => canvas.focus({ preventScroll: true }) });
  animationSelect.addEventListener('change', () => selectAnimation(animationSelect.value));
  swordSelect.addEventListener('change', () => {
    selectedSword = swordSelect.value;
    equipSword();
    equipShield();
  });
  shieldSelect.addEventListener('change', () => {
    selectedShield = shieldSelect.value;
    equipShield();
  });
  toggleWalk.addEventListener('click', () => {
    if (!current?.animation) return;
    if (current.attack?.attacking || current.attack?.charging || current.attack?.blocking) {
      playing = !playing;
      toggleWalk.textContent = playing ? 'Pause' : 'Reprendre';
      return;
    }
    if (playing) {
      current.animation.pause();
      toggleWalk.textContent = 'Reprendre';
      status.textContent = 'Animation en pause.';
    } else {
      current.animation.play(true);
      toggleWalk.textContent = 'Pause';
      status.textContent = `Animation ${selectedAnimation} en cours.`;
    }
    playing = !playing;
  });
  walkSpeed.addEventListener('input', () => {
    speedValue.textContent = `${Number(walkSpeed.value).toFixed(1).replace('.', ',')}×`;
    updateAnimationSpeed();
  });
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    if (!current) return;
    camera.alpha = current.front + { front: 0, right: -Math.PI / 2, back: -Math.PI, left: Math.PI / 2 }[button.dataset.view];
    camera.beta = current.beta;
  }));

  selectModel('antiquity');
  engine.runRenderLoop(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
    syncBlock();
    current?.attack?.update();
    if (current?.attack?.charging) status.textContent = `${window.buddyIsRangedEquipment(selectedSword) ? 'Tir' : 'Grand slash'} : charge ×${current.attack.chargePower.toFixed(1)}`;
    current?.rig?.updateCrouch(dt, controls.crouching);
    if (current?.sword) {
      const previewShotProgress = selectedAnimation === 'Shot' && current.animation?.isStarted
        ? (current.animation.getCurrentFrame() - current.animation.from)
          / (current.animation.to - current.animation.from)
        : null;
      if (previewShotProgress !== null) {
        if (previewShotProgress < .2) previewShotFired = false;
        if (previewShotProgress >= .66 && !previewShotFired) {
          current.sword.fire();
          previewShotFired = true;
        }
      }
      current.sword.updatePose(
        dt,
        selectedAnimation === 'Walk' && playing && !current.attack?.attacking && !current.attack?.charging && !current.attack?.blocking,
        animationSpeed(),
        current.attack?.guarding,
        current.attack?.sideSlashProgress,
        current.attack?.shotProgress ?? previewShotProgress,
      );
    }
    scene.render();
  });
  window.addEventListener('resize', () => engine.resize());
})();
