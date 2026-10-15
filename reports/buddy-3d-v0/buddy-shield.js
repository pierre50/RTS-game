(() => {
  window.buddyShieldIcon = kind => `shields/round_shield_${kind}_slash.png`;

  window.createBuddyShield = (scene, wrist, castShadow = () => {}, handGripSocket = null) => {
    const gripSocket = handGripSocket || new BABYLON.TransformNode('left-hand-grip-socket', scene);
    if (!handGripSocket) {
      gripSocket.parent = wrist;
      gripSocket.position.set(0, 0, .20);
    }
    const root = new BABYLON.TransformNode('equipped round shield', scene);
    root.parent = gripSocket;
    // Keep the shield face in place while its handle moves into the palm.
    root.position.set(0.28, 0.14, -0.18);
    root.rotation.z = 0.95;
    // Enlarge the face without making the rim and core sausage-thick.
    root.scaling.set(1, 2, 2);

    const material = (name, hex) => {
      const value = new BABYLON.StandardMaterial(name, scene);
      value.diffuseColor = BABYLON.Color3.FromHexString(hex);
      value.specularColor = BABYLON.Color3.Black();
      return value;
    };
    const timber = material('shield dark timber', '#70452a');
    const lightTimber = material('shield light timber', '#8b5731');
    const iron = material('shield iron fittings', '#59636c');
    const bronze = material('shield bronze fittings', '#b97725');
    const wood = material('shield wooden fittings', '#59371e');
    const leather = material('shield leather handle', '#4b2d1e');

    // Put the grip in the actual left palm. The two brackets link it to the
    // shield's rear face, so the hand carries the handle rather than the disc.
    gripSocket.computeWorldMatrix(true);
    root.computeWorldMatrix(true);
    const palm = BABYLON.Vector3.TransformCoordinates(
      gripSocket.getAbsolutePosition(), root.getWorldMatrix().clone().invert());
    const handle = BABYLON.MeshBuilder.CreateCylinder('shield hand grip', {
      height: .36, diameter: .16, tessellation: 8,
    }, scene);
    handle.parent = root;
    handle.position.copyFrom(palm);
    handle.material = leather;
    castShadow(handle);
    const rearX = -.075;
    const posts = [];
    for (const side of [-1, 1]) {
      const post = BABYLON.MeshBuilder.CreateCylinder(`shield handle bracket ${side}`, {
        height: rearX - palm.x, diameter: .075, tessellation: 8,
      }, scene);
      post.parent = root;
      post.position.set((rearX + palm.x) / 2, palm.y + side * .15, palm.z);
      post.rotation.z = Math.PI / 2;
      posts.push(post);
      castShadow(post);
    }

    const disc = BABYLON.MeshBuilder.CreateCylinder('round shield wooden core', {
      diameter: 1.08, height: 0.12, tessellation: 16,
    }, scene);
    disc.parent = root;
    disc.rotation.z = -Math.PI / 2;
    disc.material = timber;
    castShadow(disc);

    for (const [index, lateral] of [-0.36, -0.12, 0.12, 0.36].entries()) {
      const plank = BABYLON.MeshBuilder.CreateBox(`shield plank ${index}`, {
        width: 0.035,
        height: 0.225,
        depth: 2 * Math.sqrt(0.48 ** 2 - lateral ** 2),
      }, scene);
      plank.parent = root;
      plank.position.set(0.085, lateral, 0);
      plank.material = index % 2 ? lightTimber : timber;
      castShadow(plank);
    }

    const rim = BABYLON.MeshBuilder.CreateTorus('round shield rim', {
      diameter: 1.08, thickness: 0.11, tessellation: 16,
    }, scene);
    rim.parent = root;
    rim.position.x = 0.11;
    rim.rotation.z = -Math.PI / 2;
    castShadow(rim);

    const boss = BABYLON.MeshBuilder.CreateSphere('round shield centre boss', {
      diameter: 0.36, segments: 8,
    }, scene);
    boss.parent = root;
    boss.position.x = 0.17;
    boss.scaling.x = 0.52;
    castShadow(boss);

    const bossRing = BABYLON.MeshBuilder.CreateTorus('round shield boss rim', {
      diameter: 0.38, thickness: 0.045, tessellation: 12,
    }, scene);
    bossRing.parent = root;
    bossRing.position.x = 0.14;
    bossRing.rotation.z = -Math.PI / 2;
    castShadow(bossRing);

    const rivets = [];
    for (let index = 0; index < 8; index++) {
      const angle = index * Math.PI / 4;
      const rivet = BABYLON.MeshBuilder.CreateSphere(`shield rivet ${index}`, {
        diameter: 0.055, segments: 6,
      }, scene);
      rivet.parent = root;
      rivet.position.set(0.135, Math.cos(angle) * 0.47, Math.sin(angle) * 0.47);
      rivets.push(rivet);
      castShadow(rivet);
    }

    const setVariant = kind => {
      root.setEnabled(kind !== 'none');
      const fittings = { iron, bronze, wood }[kind] || iron;
      for (const part of [rim, boss, bossRing, ...rivets, ...posts]) part.material = fittings;
    };
    setVariant('iron');
    return { root, gripSocket, setVariant };
  };
})();
