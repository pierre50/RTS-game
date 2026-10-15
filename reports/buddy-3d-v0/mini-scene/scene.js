(() => {
  const canvas = document.getElementById('renderCanvas');
  const status = document.getElementById('status');
  const weaponSelect = document.getElementById('weaponSelect');
  const weaponIcon = document.getElementById('weaponIcon');
  const shieldSelect = document.getElementById('shieldSelect');
  const shieldIcon = document.getElementById('shieldIcon');
  if (!window.BABYLON) {
    status.textContent = 'Babylon.js ne s’est pas chargé.';
    return;
  }

  const engine = new BABYLON.Engine(canvas, false, { preserveDrawingBuffer: true, stencil: true });
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = BABYLON.Color4.FromHexString('#92c878ff');
  scene.ambientColor = new BABYLON.Color3(0.75, 0.75, 0.75);

  // Orthographic projection gives the same scale everywhere, like a 2D isometric game.
  const alpha = Math.atan2(0.532, -0.847) - 0.35;
  const camera = new BABYLON.ArcRotateCamera('fixed view', alpha, 0.84, 25,
    new BABYLON.Vector3(0, 0.65, 0), scene);
  camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
  camera.minZ = 0.1;
  function fitCamera() {
    const halfHeight = 7.4;
    const halfWidth = halfHeight * engine.getRenderWidth() / engine.getRenderHeight();
    camera.orthoLeft = -halfWidth;
    camera.orthoRight = halfWidth;
    camera.orthoTop = halfHeight;
    camera.orthoBottom = -halfHeight;
  }
  fitCamera();

  const hemi = new BABYLON.HemisphericLight('soft sky', new BABYLON.Vector3(0.25, 1, 0.2), scene);
  hemi.intensity = 0.68;
  const sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.6, -1, 0.55), scene);
  sun.position = new BABYLON.Vector3(9, 14, -8);
  sun.intensity = 0.92;
  sun.autoCalcShadowZBounds = true;
  const shadows = new BABYLON.ShadowGenerator(2048, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = BABYLON.ShadowGenerator.QUALITY_LOW;
  shadows.bias = 0.0005;
  shadows.normalBias = 0.02;

  function castShadow(mesh) {
    shadows.addShadowCaster(mesh);
  }
  const buddyOutline = BABYLON.Color3.FromHexString('#261d20');
  function castBuddyShadow(mesh) {
    mesh.renderOutline = true;
    mesh.outlineColor = buddyOutline;
    mesh.outlineWidth = 0.08;
    castShadow(mesh);
  }

  function mat(name, hex) {
    const material = new BABYLON.StandardMaterial(name, scene);
    material.diffuseColor = BABYLON.Color3.FromHexString(hex);
    material.specularColor = BABYLON.Color3.Black();
    return material;
  }
  const grass = new BABYLON.StandardMaterial('game grass', scene);
  const grassTexture = new BABYLON.Texture('./grass-ground.png', scene);
  grassTexture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
  grassTexture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
  grassTexture.updateSamplingMode(BABYLON.Texture.NEAREST_SAMPLINGMODE);
  grassTexture.uScale = 200 / 6.4;
  grassTexture.vScale = 200 / 6.4;
  grass.diffuseTexture = grassTexture;
  grass.specularColor = BABYLON.Color3.Black();
  const path = mat('sand path', '#caa776');
  const treeTrunk = mat('tree trunk', '#806345');
  const treeLeaf = mat('tree leaves', '#4c9c62');
  const treeLeafLight = mat('tree highlights', '#6db773');
  const rockMat = mat('stone', '#a6aaa0');
  const flowerWhite = mat('white flowers', '#fff7dc');
  const flowerPink = mat('pink flowers', '#f5a7aa');
  const flowerCenter = mat('flower centres', '#f0c849');
  const lawn = BABYLON.MeshBuilder.CreateGround('continuous lawn', { width: 200, height: 200 }, scene);
  lawn.material = grass;
  lawn.receiveShadows = true;

  function pathStone(x, z, radius, stretch = 1) {
    const tile = BABYLON.MeshBuilder.CreateCylinder('path', { diameter: radius * 2, height: 0.025, tessellation: 24 }, scene);
    tile.position.set(x, 0.024, z);
    tile.scaling.z = stretch;
    tile.material = path;
    tile.receiveShadows = true;
  }
  // A curved clearing through the centre gives the character room to move.
  for (let i = -8; i <= 8; i++) {
    const z = i * 0.88;
    const x = Math.sin(i * 0.35) * 1.1;
    pathStone(x, z, 1.16, 0.76);
  }
  pathStone(0, 0, 2.3, 0.78);

  function tree(x, z, scale = 1) {
    const trunk = BABYLON.MeshBuilder.CreateCylinder('tree trunk', { diameter: 0.47 * scale, height: 1.65 * scale, tessellation: 8 }, scene);
    trunk.position.set(x, 0.83 * scale, z);
    trunk.material = treeTrunk;
    castShadow(trunk);
    const crown = BABYLON.MeshBuilder.CreateSphere('rounded tree', { diameter: 2.1 * scale, segments: 10 }, scene);
    crown.position.set(x, 2.14 * scale, z);
    crown.scaling.y = 0.9;
    crown.material = treeLeaf;
    castShadow(crown);
    const crownTop = BABYLON.MeshBuilder.CreateSphere('tree top', { diameter: 1.45 * scale, segments: 10 }, scene);
    crownTop.position.set(x - 0.22 * scale, 2.65 * scale, z + 0.12 * scale);
    crownTop.material = treeLeafLight;
    castShadow(crownTop);
  }
  [[-6.2,-5.3,1.0],[-7.5,-1.8,0.8],[-6.7,3.2,0.95],[-4.5,6.6,0.75],[5.9,-5.5,0.85],[7.4,-2.1,0.95],[6.7,3.4,0.83],[4.7,6.4,1.0]].forEach(args => tree(...args));

  function rock(x, z, size) {
    const mesh = BABYLON.MeshBuilder.CreateSphere('rock', { diameter: size, segments: 6 }, scene);
    mesh.position.set(x, size * 0.31, z);
    mesh.scaling.y = 0.58;
    mesh.rotation.y = x * 0.7;
    mesh.material = rockMat;
    castShadow(mesh);
  }
  [[-4.8,-2.5,0.9],[-5.4,-2.1,0.55],[4.8,2.5,0.75],[5.4,2.1,0.45],[-3.6,4.8,0.5],[3.3,-5.5,0.65]].forEach(args => rock(...args));

  function flower(x, z, pink) {
    const petals = pink ? flowerPink : flowerWhite;
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      const petal = BABYLON.MeshBuilder.CreateSphere('petal', { diameter: 0.18, segments: 6 }, scene);
      petal.position.set(x + Math.cos(angle) * 0.13, 0.10, z + Math.sin(angle) * 0.13);
      petal.scaling.y = 0.45;
      petal.material = petals;
    }
    const centre = BABYLON.MeshBuilder.CreateSphere('flower centre', { diameter: 0.13, segments: 6 }, scene);
    centre.position.set(x, 0.13, z);
    centre.material = flowerCenter;
  }
  [[-3.8,-4.3,1],[-3.3,-4.5,0],[3.9,-3.8,0],[4.3,-3.5,1],[-4.2,2.4,0],[-3.8,2.1,1],[3.7,4.6,1],[4.1,4.3,0]].forEach(args => flower(...args));

  let player = null;
  let rig = null;
  let attack = null;
  let torsoAim = null;
  let wristAim = null;
  let wristRest = null;
  let sword = null;
  let shield = null;
  let swordRoot = null;
  let bowAimYawOffset = alpha;
  weaponSelect.addEventListener('change', () => {
    sword?.setVariant(weaponSelect.value);
    const ranged = window.buddyIsRangedEquipment(weaponSelect.value);
    shield?.setVariant(ranged ? 'none' : shieldSelect.value);
    shieldSelect.disabled = ranged;
    shieldIcon.hidden = ranged || shieldSelect.value === 'none';
    weaponIcon.hidden = weaponSelect.value === 'none';
    if (!weaponIcon.hidden) {
      weaponIcon.src = `../../../assets/icon-sources/icons/${window.buddyEquipmentIcon(weaponSelect.value)}`;
      weaponIcon.alt = `Icône : ${weaponSelect.selectedOptions[0].textContent}`;
    }
  });
  shieldSelect.addEventListener('change', () => {
    shield?.setVariant(window.buddyIsRangedEquipment(weaponSelect.value) ? 'none' : shieldSelect.value);
    shieldIcon.hidden = shieldSelect.value === 'none';
    if (!shieldIcon.hidden) {
      shieldIcon.src = `../../../assets/icon-sources/icons/${window.buddyShieldIcon(shieldSelect.value)}`;
      shieldIcon.alt = `Icône : ${shieldSelect.selectedOptions[0].textContent}`;
    }
  });
  const MOVE_SPEED = 1.7;
  const WALK_ANIMATION_SPEED = 1.4;
  const ATTACK_ANIMATION_SPEED = 2.4;
  let moveAnimationSpeed = WALK_ANIMATION_SPEED;
  let moving = false;
  let pointerPosition = null;
  let cursorPoint = null;
  const controls = window.bindBuddyActionKeys(() => syncBlock());
  const keys = new Set();
  const moveKeys = new Set(['z', 'q', 's', 'd', 'w', 'a', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright']);
  window.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (moveKeys.has(key)) {
      keys.add(key);
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  function updateCursorPoint() {
    if (!player || !pointerPosition) return;
    const bounds = canvas.getBoundingClientRect();
    const hit = scene.pick(pointerPosition.x - bounds.left, pointerPosition.y - bounds.top,
      mesh => mesh === lawn);
    if (hit?.hit) {
      cursorPoint = hit.pickedPoint;
      sword?.setProjectileTarget(cursorPoint);
    }
  }
  function aimAtPointer(event) {
    pointerPosition = { x: event.clientX, y: event.clientY };
    updateCursorPoint();
  }
  canvas.addEventListener('pointermove', aimAtPointer);

  function equipSword(result, offhand) {
    const wrist = result.transformNodes.find(node => node.name === 'Poignet droit');
    if (!wrist) return;
    sword = window.createBuddySword(scene, wrist, castBuddyShadow, offhand);
    sword.setVariant(weaponSelect.value);
    sword.setProjectileTarget(cursorPoint);
    swordRoot = sword.root;
  }

  function aimSword(lerp) {
    if (!cursorPoint || !wristAim || !swordRoot || !player || attack?.attacking || attack?.charging || attack?.blocking) return;
    if (window.buddyIsRangedEquipment(weaponSelect.value)) {
      // Bow and draw hand must share the body's aiming axis.
      wristAim.rotation.z = 0;
      positionSwordHand();
      return;
    }
    const dx = cursorPoint.x - player.position.x;
    const dz = cursorPoint.z - player.position.z;
    if (Math.hypot(dx, dz) < 0.3) return;
    const toCursor = new BABYLON.Vector3(dx, 0, dz).normalize();
    wristAim.parent.computeWorldMatrix(true);
    const fromWorld = wristAim.parent.getWorldMatrix().clone().invert();
    const targetLocal = BABYLON.Vector3.TransformNormal(toCursor, fromWorld).normalize();
    const bladeWorld = sword.aimDirectionWorld();
    const bladeLocal = BABYLON.Vector3.TransformNormal(bladeWorld, fromWorld).normalize();
    const targetAngle = Math.atan2(targetLocal.y, targetLocal.x);
    const bladeAngle = Math.atan2(bladeLocal.y, bladeLocal.x);
    const delta = (targetAngle - bladeAngle + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    wristAim.rotation.z = BABYLON.Scalar.Clamp(wristAim.rotation.z + delta * lerp, -Math.PI * 2 / 3, Math.PI * 2 / 3);
    positionSwordHand();
  }

  function positionSwordHand() {
    if (!wristAim || !wristRest) return;
    // Carry the hand around the pill so the blade does not cut through the torso.
    const handAngle = wristAim.rotation.z;
    wristAim.position.x = Math.cos(handAngle) * wristRest.x - Math.sin(handAngle) * wristRest.y;
    wristAim.position.y = Math.sin(handAngle) * wristRest.x + Math.cos(handAngle) * wristRest.y;
  }

  function updateSwordPose(dt) {
    if (!sword) return;
    if (moving && !attack?.attacking && !attack?.charging && !attack?.blocking) {
      if (wristAim) {
        wristAim.rotation.z += (0 - wristAim.rotation.z) * Math.min(1, dt * 10);
        positionSwordHand();
      }
    }
    sword.updatePose(dt, moving && !attack?.attacking && !attack?.charging && !attack?.blocking,
      moveAnimationSpeed, attack?.guarding, attack?.sideSlashProgress, attack?.shotProgress);
  }

  function syncBlock() {
    if (!attack) return;
    if (controls.blocking) {
      if (attack.startBlock({
        walkSpeed: moveAnimationSpeed,
        keepLegsMoving: moving,
        prepare: () => {
          if (wristAim) {
            wristAim.rotation.z = 0;
            positionSwordHand();
          }
        },
        stopCurrent: () => rig.stopWalk(),
      })) {
        status.textContent = 'Blocage !';
        status.classList.remove('ready');
      }
    } else attack.releaseBlock();
  }

  function triggerAttack(action) {
    if (!attack) return;
    if (action === 'ChargeSlash' || action === 'ChargeShot') {
      if (attack.startCharge({
        action: action === 'ChargeShot' ? 'Shot' : 'Slash',
        walkSpeed: moveAnimationSpeed,
        keepLegsMoving: moving,
        prepare: () => aimSword(1),
        stopCurrent: () => rig.stopWalk(),
      })) status.classList.remove('ready');
      return;
    }
    if (action === 'ReleaseSlash' || action === 'ReleaseShot') {
      const power = attack.releaseCharge();
      if (power) status.textContent = `${action === 'ReleaseShot' ? 'Tir' : 'Grand slash'} ×${power.toFixed(1)} !`;
      return;
    }
    if (action === 'CancelCharge') {
      attack.cancelCharge();
      return;
    }
    if (attack.start({
      action,
      attackSpeed: ATTACK_ANIMATION_SPEED,
      walkSpeed: moveAnimationSpeed,
      keepLegsMoving: moving,
      prepare: () => aimSword(1),
      stopCurrent: () => rig.stopWalk(),
    })) {
      status.textContent = {
        Chop: 'Coup vertical !', Thrust: 'Estoc !', Shot: 'Tir !',
        Slash: 'Grand slash !', SideSlash: 'Coup latéral !',
      }[action];
      status.classList.remove('ready');
    }
  }
  window.bindBuddyAttackPointer(canvas,
    () => attack && !attack.attacking && !attack.charging && !attack.blocking
      ? window.buddyPointerActionsForEquipment(weaponSelect.value) : null,
    triggerAttack,
    {
      dragTolerance: Infinity,
      onPointerDown: event => {
        aimAtPointer(event);
        canvas.focus({ preventScroll: true });
      },
    });

  async function loadBuddy() {
    try {
      const result = await BABYLON.SceneLoader.ImportMeshAsync('', '../', 'buddy-antiquity-pixel-actions-v23.glb', scene);
      player = new BABYLON.TransformNode('buddy movement pivot', scene);
      player.scaling.setAll(0.34);
      result.meshes[0].parent = player;
      result.meshes[0].position.y = -2.20;
      result.meshes.forEach(mesh => {
        if (mesh.getTotalVertices() > 0) castBuddyShadow(mesh);
      });
      result.animationGroups.forEach(group => { group.stop(); group.goToFrame(0); });
      window.tuneBuddyFeet(result, scene);
      rig = window.createBuddyActionRig(result, scene);
      const { bodySway, crouchPose } = rig;
      if (bodySway) {
        torsoAim = new BABYLON.TransformNode('limited torso aim', scene);
        torsoAim.parent = crouchPose;
        torsoAim.position.z = 0.4;
        const torsoOffset = new BABYLON.TransformNode('torso aim offset', scene);
        torsoOffset.parent = torsoAim;
        torsoOffset.position.z = -0.4;
        bodySway.parent = torsoOffset;
        const wrist = result.transformNodes.find(node => node.name === 'Poignet droit');
        if (wrist) {
          wristRest = wrist.position.clone();
          wristAim = new BABYLON.TransformNode('right hand aim', scene);
          wristAim.parent = bodySway;
          wristAim.position.copyFrom(wristRest);
          const wristOffset = new BABYLON.TransformNode('right hand aim offset', scene);
          wristOffset.parent = wristAim;
          wristOffset.position.copyFrom(wristRest).scaleInPlace(-1);
          wrist.parent = wristOffset;
        }
      }
      const offhand = result.transformNodes.find(node => node.name === 'Poignet gauche');
      equipSword(result, offhand);
      if (sword && rig.shotUpper) {
        // Measure the actual bow axis in the fully drawn pose. The imported
        // model and hand pivots add rotations that a camera-based yaw ignores.
        const selectedEquipment = weaponSelect.value;
        sword.setVariant('bow');
        const shot = rig.shotUpper;
        shot.start(false, 1);
        shot.goToFrame(shot.from + (shot.to - shot.from) * .60);
        shot.pause();
        sword.updatePose(1, false, 1, false, null, .60);
        const bowAxis = sword.aimDirectionWorld();
        bowAimYawOffset = Math.atan2(bowAxis.z, bowAxis.x);
        shot.stop();
        shot.start(false, 1);
        shot.goToFrame(0);
        shot.stop();
        sword.setVariant(selectedEquipment);
        sword.updatePose(1, false, 1);
      }
      if (offhand) {
        shield = window.createBuddyShield(scene, offhand, castBuddyShadow, sword?.gripSockets.left);
        shield.setVariant(window.buddyIsRangedEquipment(weaponSelect.value) ? 'none' : shieldSelect.value);
      }
      attack = window.createBuddyAttack(rig, sword, () => {
        if (moving) rig.startWalk(moveAnimationSpeed);
        else rig.stopWalk();
        status.textContent = 'Prêt.';
        status.classList.add('ready');
      });
      scene.materials.forEach(material => material.albedoTexture?.updateSamplingMode(BABYLON.Texture.NEAREST_SAMPLINGMODE));
      status.classList.add('ready');
      canvas.focus({ preventScroll: true });
      syncBlock();
    } catch (error) {
      console.error(error);
      status.textContent = 'Impossible de charger le personnage.';
    }
  }
  loadBuddy();

  const cameraTarget = camera.target.clone();
  engine.runRenderLoop(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
    if (player) {
      let horizontal = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('q') || keys.has('a') || keys.has('arrowleft'));
      let vertical = Number(keys.has('z') || keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
      const shouldMove = horizontal !== 0 || vertical !== 0;
      if (shouldMove) {
        const length = Math.hypot(horizontal, vertical);
        horizontal /= length;
        vertical /= length;
      }
      // Screen axes projected onto the ground plane.
      const towardCamera = new BABYLON.Vector3(Math.cos(alpha), 0, Math.sin(alpha));
      const screenRight = new BABYLON.Vector3(-Math.sin(alpha), 0, Math.cos(alpha));
      const dx = screenRight.x * horizontal - towardCamera.x * vertical;
      const dz = screenRight.z * horizontal - towardCamera.z * vertical;
      const aimYawOffset = weaponSelect.value.startsWith('bow') ? bowAimYawOffset : alpha;
      const movementAimDx = cursorPoint ? cursorPoint.x - player.position.x : 0;
      const movementAimDz = cursorPoint ? cursorPoint.z - player.position.z : 0;
      const movementAimDistance = Math.hypot(movementAimDx, movementAimDz);
      const backwardAmount = shouldMove && movementAimDistance > .3
        ? Math.max(0, -(dx * movementAimDx + dz * movementAimDz) / movementAimDistance) : 0;
      const backpedalScale = 1 - .45 * backwardAmount;
      const movementSpeed = MOVE_SPEED * controls.movementMultiplier * backpedalScale;
      moveAnimationSpeed = WALK_ANIMATION_SPEED * controls.animationMultiplier * backpedalScale;
      syncBlock();
      rig?.updateCrouch(dt, controls.crouching);
      if (shouldMove) {
        const nextX = player.position.x + dx * movementSpeed * dt;
        const nextZ = player.position.z + dz * movementSpeed * dt;
        if (Math.hypot(nextX, nextZ) < 8.4) {
          player.position.x = nextX;
          player.position.z = nextZ;
        }
      }
      cameraTarget.set(player.position.x, 0.65, player.position.z);
      // Project the fixed screen cursor with the camera's current position,
      // including its smooth follow movement, before aiming or firing.
      camera.setTarget(
        BABYLON.Vector3.Lerp(camera.target, cameraTarget, Math.min(1, dt * 3.4)),
        false, false, true,
      );
      updateCursorPoint();
      const aimDx = cursorPoint ? cursorPoint.x - player.position.x : 0;
      const aimDz = cursorPoint ? cursorPoint.z - player.position.z : 0;
      const aimDistance = Math.hypot(aimDx, aimDz);
      const hasAim = aimDistance > .3;
      const facingX = hasAim ? aimDx / aimDistance : dx;
      const facingZ = hasAim ? aimDz / aimDistance : dz;
      attack?.update();
      if (attack?.charging) status.textContent = `${window.buddyIsRangedEquipment(weaponSelect.value) ? 'Tir' : 'Grand slash'} : charge ×${attack.chargePower.toFixed(1)}`;
      if (shouldMove || hasAim) {
        // The model's local +X points toward its face. Aim can turn through
        // the full circle; opposite movement becomes a slower backpedal.
        const desiredYaw = aimYawOffset - Math.atan2(facingZ, facingX);
        let angle = (desiredYaw - player.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        player.rotation.y += angle * Math.min(1, dt * 13);
      }
      if (shouldMove !== moving) {
        moving = shouldMove;
        if (attack?.attacking || attack?.charging || attack?.blocking) {
          attack.setLegsMoving(moving, moveAnimationSpeed);
        } else if (rig?.walk) {
          if (moving) rig.startWalk(moveAnimationSpeed);
          else rig.stopWalk();
        }
      }
      if (moving) {
        if (attack?.attacking || attack?.charging || attack?.blocking) attack.setLegsMoving(true, moveAnimationSpeed);
        else if (rig?.walk) rig.walk.speedRatio = moveAnimationSpeed;
      }
      rig?.updateFootPlant(dt);
      if (torsoAim) {
        let targetAngle = 0;
        if (cursorPoint) {
          const dx = cursorPoint.x - player.position.x;
          const dz = cursorPoint.z - player.position.z;
          if (Math.hypot(dx, dz) > 0.3) {
            const worldYaw = aimYawOffset - Math.atan2(dz, dx);
            const relativeYaw = (worldYaw - player.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI;
            targetAngle = BABYLON.Scalar.Clamp(relativeYaw, -Math.PI / 3, Math.PI / 3);
          }
        }
        // The source model's local Z axis has the opposite yaw sign in Babylon.
        torsoAim.rotation.z += (-targetAngle - torsoAim.rotation.z) * Math.min(1, dt * 9);
      }
      if (!moving && !attack?.attacking && !attack?.charging && !attack?.blocking) aimSword(Math.min(1, dt * 12));
      updateSwordPose(dt);
    }
    scene.render();
  });
  window.addEventListener('resize', () => { engine.resize(); fitCamera(); });
})();
