(() => {
  window.buddyEquipmentIcon = kind => {
    if (kind === 'slingshot') return 'ranged-weapons/slingshot.png';
    if (kind.startsWith('bow')) return `ranged-weapons/${kind.replace('-', '_')}.png`;
    const [shape, metal] = kind.split('-');
    if (shape === 'longstick' || shape === 'catchingPole') return `tools/${shape}.png`;
    const folder = ['axe', 'hammer', 'pickaxe', 'scythe'].includes(shape) ? 'tools' : 'melee-weapons';
    return `${folder}/${shape}_${metal}.png`;
  };
  window.createBuddySword = (scene, wrist, castShadow = () => {}, offhand = null) => {
    const handMeshes = wrist.getChildren().slice();
    const handPose = new BABYLON.TransformNode('sword hand pose', scene);
    handPose.parent = wrist;
    handPose.rotationQuaternion = BABYLON.Quaternion.Identity();
    for (const mesh of handMeshes) mesh.parent = handPose;
    // Permanent grip anchor in the visible C-shaped opening of the right hand.
    // Equipment attached here follows every wrist and hand animation.
    const rightGripSocket = new BABYLON.TransformNode('right-hand-grip-socket', scene);
    rightGripSocket.parent = handPose;
    rightGripSocket.position.set(0, 0, .20);
    const offhandPose = offhand ? new BABYLON.TransformNode('bow string hand pose', scene) : null;
    if (offhandPose) {
      const offhandMeshes = offhand.getChildren().slice();
      offhandPose.parent = offhand;
      offhandPose.rotationQuaternion = BABYLON.Quaternion.Identity();
      for (const mesh of offhandMeshes) mesh.parent = offhandPose;
    }
    const leftGripSocket = offhandPose
      ? new BABYLON.TransformNode('left-hand-grip-socket', scene) : null;
    if (leftGripSocket) {
      leftGripSocket.parent = offhandPose;
      leftGripSocket.position.set(0, 0, .20);
    }
    // The string touches a slightly shallower point in the same hand.
    const leftStringSocket = offhandPose
      ? new BABYLON.TransformNode('left-hand-string-socket', scene) : null;
    if (leftStringSocket) {
      leftStringSocket.parent = offhandPose;
      leftStringSocket.position.set(0, 0, -.12);
    }

    // All right-hand equipment shares the same physical grip. Individual
    // models only choose their angle and length relative to this point.
    const root = new BABYLON.TransformNode('equipped right-hand item', scene);
    root.parent = rightGripSocket;
    // The C-shaped palm opens off the shaft axis. Use one offset for every
    // rigid handle so it sits between the fingers instead of inside the skin.
    const shaftGripOffset = -.20;
    const bladeAxis = new BABYLON.Vector3(0, 0, -1);
    const pointBlade = direction => {
      const target = direction.normalize();
      return BABYLON.Quaternion.RotationAxis(
        BABYLON.Vector3.Cross(bladeAxis, target).normalize(),
        Math.acos(BABYLON.Scalar.Clamp(BABYLON.Vector3.Dot(bladeAxis, target), -1, 1)),
      );
    };
    const handSide = Math.sign(wrist.position.y) || -1;
    const forwardDirection = new BABYLON.Vector3(0.94, 0.24 * handSide, 0.22).normalize();
    const raisedDirection = new BABYLON.Vector3(0.32, 0.28 * handSide, 0.90).normalize();
    // Guard points up and across the body. The wrist turns the broad face
    // outward without changing the direction of the blade.
    const guardDirection = new BABYLON.Vector3(0.25, -0.52 * handSide, 0.82).normalize();
    const forwardRotation = pointBlade(forwardDirection.clone());
    const bowGripRotation = BABYLON.Quaternion.RotationAxis(
      BABYLON.Vector3.Cross(forwardDirection, BABYLON.Axis.Z).normalize(),
      Math.acos(BABYLON.Scalar.Clamp(BABYLON.Vector3.Dot(forwardDirection, BABYLON.Axis.Z), -1, 1)),
    );
    // The open side of the C-shaped hand faces the bow and the drawn string.
    const stringGripRotation = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, -Math.PI * .46);
    const raisedHandRotation = BABYLON.Quaternion.RotationAxis(
      BABYLON.Vector3.Cross(forwardDirection, raisedDirection).normalize(),
      Math.acos(BABYLON.Scalar.Clamp(BABYLON.Vector3.Dot(forwardDirection, raisedDirection), -1, 1)),
    );
    const guardLift = BABYLON.Quaternion.RotationAxis(
      BABYLON.Vector3.Cross(forwardDirection, guardDirection).normalize(),
      Math.acos(BABYLON.Scalar.Clamp(BABYLON.Vector3.Dot(forwardDirection, guardDirection), -1, 1)),
    );
    const guardHandRotation = BABYLON.Quaternion.RotationAxis(guardDirection, Math.PI / 4)
      .multiply(guardLift);
    const restingHandRotation = BABYLON.Quaternion.Identity();
    // Roll the hand around the blade axis during the quick lateral cut.
    // This lays the broad face nearly horizontal and puts the edge outside.
    const flatSlashRotation = BABYLON.Quaternion.RotationAxis(forwardDirection, -Math.PI * 0.31);
    root.rotationQuaternion = forwardRotation.clone();
    let walkPhase = 0;

    const material = (name, hex) => {
      const value = new BABYLON.StandardMaterial(name, scene);
      value.diffuseColor = BABYLON.Color3.FromHexString(hex);
      value.specularColor = BABYLON.Color3.Black();
      value.backFaceCulling = false;
      return value;
    };
    const grip = material('weapon grip', '#633b26');
    const iron = material('weapon iron', '#8b9dab');
    const bronze = material('weapon bronze', '#bc7b2c');
    const ceramic = material('tool ceramic', '#d7ccb2');
    const ironGuard = material('iron guard', '#52616b');
    const bronzeGuard = material('bronze guard', '#9b5b20');
    const makeCord = (name, parent, color, segmentCount = 2) => {
      const cordMaterial = material(`${name} cord material`, color);
      const segments = Array.from({ length: segmentCount }, (_, index) => {
        const segment = BABYLON.MeshBuilder.CreateCylinder(`${name} cord ${index}`, {
          height: 1, diameter: .06, tessellation: 6,
        }, scene);
        segment.parent = parent;
        segment.material = cordMaterial;
        return segment;
      });
      return points => {
        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i];
          const end = points[i];
          const center = points[i + 1];
          const span = end.subtract(center);
          segment.position.copyFrom(end.add(center).scale(.5));
          segment.scaling.y = span.length();
          const direction = span.normalize();
          const axis = BABYLON.Vector3.Cross(BABYLON.Axis.Y, direction);
          const dot = BABYLON.Scalar.Clamp(BABYLON.Vector3.Dot(BABYLON.Axis.Y, direction), -1, 1);
          segment.rotationQuaternion = axis.lengthSquared() < 1e-8
            ? BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, dot < 0 ? Math.PI : 0)
            : BABYLON.Quaternion.RotationAxis(axis.normalize(), Math.acos(dot));
        }
      };
    };

    const makeBlade = (name, weapon, sections) => {
      const blade = new BABYLON.Mesh(`${name} blade`, scene);
      blade.parent = weapon;
      const positions = [];
      for (const [z, halfWidth, ridge] of sections) {
        positions.push(ridge, 0, z, 0, halfWidth, z, -ridge, 0, z, 0, -halfWidth, z);
      }
      const indices = [];
      for (let section = 0; section < sections.length - 1; section++) {
        for (let edge = 0; edge < 4; edge++) {
          const a = section * 4 + edge;
          const b = section * 4 + (edge + 1) % 4;
          const c = (section + 1) * 4 + (edge + 1) % 4;
          const d = (section + 1) * 4 + edge;
          indices.push(a, b, c, a, c, d);
        }
      }
      indices.push(0, 2, 1, 0, 3, 2);
      const normals = [];
      BABYLON.VertexData.ComputeNormals(positions, indices, normals);
      const data = new BABYLON.VertexData();
      data.positions = positions;
      data.indices = indices;
      data.normals = normals;
      data.applyToMesh(blade);
      return blade;
    };

    const makeWeapon = (name, sections, widthScale) => {
      const weapon = new BABYLON.TransformNode(name, scene);
      weapon.parent = root;
      weapon.position.x = shaftGripOffset;
      weapon.position.z = .13;
      const handle = BABYLON.MeshBuilder.CreateCylinder(`${name} handle`, {
        height: 0.52, diameter: 0.13 * widthScale, tessellation: 8,
      }, scene);
      handle.parent = weapon;
      handle.position.z = -0.25;
      handle.rotation.x = Math.PI / 2;
      handle.material = grip;

      const guard = BABYLON.MeshBuilder.CreateBox(`${name} guard`, {
        width: 0.13 * widthScale, height: 0.48 * widthScale, depth: 0.11 * widthScale,
      }, scene);
      guard.parent = weapon;
      guard.position.z = -0.46;
      const pommel = BABYLON.MeshBuilder.CreateSphere(`${name} pommel`, {
        diameter: 0.18 * widthScale, segments: 8,
      }, scene);
      pommel.parent = weapon;
      pommel.position.z = 0.12;

      const blade = makeBlade(name, weapon, sections);
      for (const mesh of [handle, guard, pommel, blade]) castShadow(mesh);
      return { weapon, guard, pommel, blade };
    };
    const dagger = makeWeapon('dagger', [
      [-0.51, 0.15, 0.045], [-1.57, 0.14, 0.04], [-1.93, 0, 0.008],
    ], 1);
    const sword = makeWeapon('sword', [
      [-0.51, 0.18, 0.054], [-3.06, 0.17, 0.048], [-3.92, 0, 0.01],
    ], 1.2);
    // The sword's broad faces should follow the grip, with its cutting edge
    // in the same plane as the hand when the arm lifts for walking.
    sword.weapon.rotation.z = Math.PI / 2;
    const spearWeapon = new BABYLON.TransformNode('spear', scene);
    spearWeapon.parent = root;
    spearWeapon.position.x = shaftGripOffset;
    const spearShaft = BABYLON.MeshBuilder.CreateCylinder('spear wooden shaft', {
      height: 6.1, diameter: 0.2, tessellation: 8,
    }, scene);
    spearShaft.parent = spearWeapon;
    spearShaft.position.z = -1.65;
    spearShaft.rotation.x = Math.PI / 2;
    spearShaft.material = grip;
    const spearCollar = BABYLON.MeshBuilder.CreateCylinder('spear collar', {
      height: 0.18, diameter: 0.25, tessellation: 8,
    }, scene);
    spearCollar.parent = spearWeapon;
    spearCollar.position.z = -4.65;
    spearCollar.rotation.x = Math.PI / 2;
    const spearButt = BABYLON.MeshBuilder.CreateSphere('spear butt', {
      diameter: 0.23, segments: 8,
    }, scene);
    spearButt.parent = spearWeapon;
    spearButt.position.z = 1.4;
    const spearHead = makeBlade('spear', spearWeapon, [
      [-4.72, 0.09, 0.045], [-5.06, 0.19, 0.075], [-5.95, 0, 0.008],
    ]);
    for (const mesh of [spearShaft, spearCollar, spearButt, spearHead]) castShadow(mesh);
    const spear = { weapon: spearWeapon, blade: spearHead, guard: spearCollar, pommel: spearButt };

    const toolRoot = (name, headZ, headYaw = 0) => {
      const weapon = new BABYLON.TransformNode(name, scene);
      weapon.parent = root;
      weapon.position.x = shaftGripOffset;
      const headPivot = new BABYLON.TransformNode(`${name} head direction`, scene);
      headPivot.parent = weapon;
      headPivot.position.z = headZ;
      headPivot.rotation.y = headYaw;
      return { weapon, headPivot, metalParts: [] };
    };
    const addShaft = (tool, name, length, center, diameter = 0.23) => {
      const shaft = BABYLON.MeshBuilder.CreateCylinder(`${name} wooden shaft`, {
        height: length, diameter, tessellation: 8,
      }, scene);
      shaft.parent = tool.weapon;
      shaft.position.z = center;
      shaft.rotation.x = Math.PI / 2;
      shaft.material = grip;
      castShadow(shaft);
      return shaft;
    };
    const addHead = (tool, name, dimensions, position) => {
      const head = BABYLON.MeshBuilder.CreateBox(name, dimensions, scene);
      head.parent = tool.headPivot;
      head.position.set(position[0], position[1], position[2] - tool.headPivot.position.z);
      tool.metalParts.push(head);
      castShadow(head);
      return head;
    };

    const axe = toolRoot('axe', -2.38, Math.PI);
    addShaft(axe, 'axe', 2.9, -1.08);
    addHead(axe, 'axe socket', { width: 0.38, height: 0.31, depth: 0.48 }, [0, 0, -2.38]);
    const axeBlade = new BABYLON.Mesh('axe beveled blade', scene);
    axeBlade.parent = axe.headPivot;
    const axeVertices = [
      0.13, -0.12, -0.23, 0.13, 0.12, -0.23, 0.13, 0.12, 0.23, 0.13, -0.12, 0.23,
      1.02, -0.02, -0.44, 1.02, 0.02, -0.44, 1.02, 0.02, 0.44, 1.02, -0.02, 0.44,
    ];
    const axeIndices = [
      0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6,
      0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2,
      2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0,
    ];
    const axeNormals = [];
    BABYLON.VertexData.ComputeNormals(axeVertices, axeIndices, axeNormals);
    const axeData = new BABYLON.VertexData();
    axeData.positions = axeVertices;
    axeData.indices = axeIndices;
    axeData.normals = axeNormals;
    axeData.applyToMesh(axeBlade);
    axe.metalParts.push(axeBlade);
    castShadow(axeBlade);

    const hammer = toolRoot('hammer', -2.18);
    addShaft(hammer, 'hammer', 2.65, -0.96);
    addHead(hammer, 'hammer head', { width: 1.08, height: 0.39, depth: 0.44 }, [0, 0, -2.18]);
    addHead(hammer, 'hammer left face', { width: 0.18, height: 0.49, depth: 0.53 }, [-0.58, 0, -2.18]);
    addHead(hammer, 'hammer right face', { width: 0.18, height: 0.49, depth: 0.53 }, [0.58, 0, -2.18]);

    const pickaxe = toolRoot('pickaxe', -2.38);
    addShaft(pickaxe, 'pickaxe', 2.85, -1.07);
    addHead(pickaxe, 'pickaxe socket', { width: 0.6, height: 0.29, depth: 0.38 }, [0, 0, -2.38]);
    for (const side of [-1, 1]) {
      const point = BABYLON.MeshBuilder.CreateCylinder(`pickaxe point ${side}`, {
        height: 0.78, diameterTop: 0, diameterBottom: 0.31, tessellation: 4,
      }, scene);
      point.parent = pickaxe.headPivot;
      point.position.set(side * 0.68, 0, 0);
      point.rotation.z = -side * Math.PI / 2;
      pickaxe.metalParts.push(point);
      castShadow(point);
    }

    const scythe = toolRoot('scythe', -3.1);
    // Roll the blade around the shaft: its crescent sweeps across the ground
    // instead of pointing vertically up or down when the tool is held forward.
    scythe.headPivot.rotation.z = handSide * Math.PI / 2;
    addShaft(scythe, 'scythe', 3.45, -1.36, 0.21);
    const scytheBlade = BABYLON.MeshBuilder.CreateRibbon('scythe curved blade', {
      pathArray: [
        [[0, 0, -3.1], [0.32, 0, -3.49], [0.72, 0, -3.58], [1.11, 0, -3.43], [1.43, 0, -3.05]].map(([x, y, z]) => new BABYLON.Vector3(x, y, z + 3.1)),
        [[0, 0, -2.92], [0.32, 0, -3.2], [0.72, 0, -3.28], [1.11, 0, -3.25], [1.43, 0, -3.05]].map(([x, y, z]) => new BABYLON.Vector3(x, y, z + 3.1)),
      ],
      sideOrientation: BABYLON.Mesh.DOUBLESIDE,
    }, scene);
    scytheBlade.parent = scythe.headPivot;
    scythe.metalParts.push(scytheBlade);
    castShadow(scytheBlade);

    const longstick = toolRoot('longstick', 0);
    addShaft(longstick, 'longstick', 4.1, -1.65, 0.27);
    const catchingPole = toolRoot('catchingPole', -3.12);
    addShaft(catchingPole, 'catching pole', 3.6, -1.4);
    const catchingRing = BABYLON.MeshBuilder.CreateTorus('catching pole ring', {
      diameter: 0.75, thickness: 0.12, tessellation: 12,
    }, scene);
    catchingRing.parent = catchingPole.headPivot;
    catchingRing.position.set(0.28, 0, 0);
    catchingPole.metalParts.push(catchingRing);
    castShadow(catchingRing);

    // The bow and arrow point along the character's forward axis. Both hands
    // occupy the same lateral line at full draw, so the arrow travels straight.
    const bowForward = BABYLON.Axis.X.clone();
    // Carry the limbs front-to-back beside the body, clear of the capsule.
    const carriedBowRotation = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, Math.PI * .36);
    const bowPoint = (depth, height) => new BABYLON.Vector3(
      bowForward.x * depth, bowForward.y * depth, height,
    );
    const makeBow = (name, length, bend, recurveTip = 0) => {
      const weapon = new BABYLON.TransformNode(name, scene);
      weapon.parent = root;
      weapon.rotationQuaternion = forwardRotation.clone().invert();
      // The bow's central wrap sits directly on the shared grip socket.
      const limbPoint = u => {
        const tip = Math.abs(u);
        // Ease into a short recurve near each end, leaving the long limbs
        // smoothly curved without the old rounded hooks or sharp corners.
        const limbBend = recurveTip ? tip ** 1.25 : tip * tip;
        const centerCurve = recurveTip && tip < .6
          ? .35 * Math.sin(Math.PI * tip / .6) ** 2 : 0;
        const returnProgress = Math.max(0, (tip - .72) / .28);
        const terminalReturn = recurveTip * returnProgress * returnProgress;
        const depth = -bend * limbBend + centerCurve + terminalReturn;
        return bowPoint(depth, length * u);
      };
      const points = Array.from({ length: 33 }, (_, i) => limbPoint(-1 + i / 16));
      const wood = BABYLON.MeshBuilder.CreateTube(`${name} curved wood`, {
        path: points, radius: name === 'bow-great' ? .105 : .09, tessellation: 6,
      }, scene);
      wood.parent = weapon;
      wood.material = grip;
      castShadow(wood);
      const wrap = recurveTip
        ? BABYLON.MeshBuilder.CreateTube(`${name} leather grip`, {
          path: Array.from({ length: 9 }, (_, i) => limbPoint((i - 4) * .035)),
          radius: .11, tessellation: 8,
        }, scene)
        : BABYLON.MeshBuilder.CreateCylinder(`${name} leather grip`, {
          height: .5, diameter: .22, tessellation: 8,
        }, scene);
      wrap.parent = weapon;
      if (!recurveTip) wrap.rotation.x = Math.PI / 2;
      wrap.material = grip;
      castShadow(wrap);
      const tipDepth = -bend + recurveTip;
      // On the recurve, tie the string halfway through each returned end.
      // The wooden tips continue past these attachment points.
      const recurveNockU = .86;
      const recurveNockDepth = recurveTip ? limbPoint(recurveNockU).x - .055 : tipDepth;
      const stringNock = side => recurveTip
        ? bowPoint(recurveNockDepth, side * length * recurveNockU)
        : bowPoint(tipDepth, side * (length + .065));
      for (const side of [-1, 1]) {
        const nock = BABYLON.MeshBuilder.CreateSphere(`${name} brass nock`, {
          diameter: name === 'bow-great' ? .16 : .13, segments: 6,
        }, scene);
        nock.parent = weapon;
        nock.position.copyFrom(recurveTip
          ? limbPoint(side * recurveNockU)
          : bowPoint(tipDepth, side * length));
        nock.material = bronzeGuard;
        castShadow(nock);
      }
      // The string attaches only at the two nocks. At rest its two halves
      // form one straight line; while drawing, they meet at the pulling hand.
      const restCenter = bowPoint(recurveNockDepth, 0);
      const stringCenter = (draw, handPoint) => handPoint
        ? BABYLON.Vector3.Lerp(restCenter, handPoint, draw)
        : bowPoint(recurveNockDepth - 2.0 * draw, .45 * draw);
      const stringPoints = (draw, handPoint) => [
        stringNock(-1),
        stringCenter(draw, handPoint),
        stringNock(1),
      ];
      const updateString = makeCord(`${name} bowstring`, weapon, '#e3d4ab');
      updateString(stringPoints(0));
      const nockedArrow = new BABYLON.TransformNode(`${name} nocked arrow`, scene);
      nockedArrow.parent = weapon;
      nockedArrow.rotationQuaternion = BABYLON.Quaternion.Identity();
      const arrowShaft = BABYLON.MeshBuilder.CreateCylinder(`${name} arrow shaft`, {
        height: 1, diameter: .055, tessellation: 6,
      }, scene);
      arrowShaft.parent = nockedArrow;
      arrowShaft.material = grip;
      const arrowTip = BABYLON.MeshBuilder.CreateCylinder(`${name} nocked arrow tip`, {
        height: .20, diameterTop: 0, diameterBottom: .14, tessellation: 6,
      }, scene);
      arrowTip.parent = nockedArrow;
      arrowTip.material = iron;
      nockedArrow.setEnabled(false);
      const arrowRest = bowPoint(.10, .28);
      return { weapon, metalParts: [], projectileDirection: bowForward,
        projectileOrigin: arrowRest, setDraw(draw, handPoint) {
        updateString(stringPoints(draw, handPoint));
        const tail = stringCenter(draw, handPoint);
        const span = arrowRest.subtract(tail);
        const length = span.length();
        const direction = span.scale(1 / Math.max(length, .001));
        nockedArrow.position.copyFrom(tail);
        const axis = BABYLON.Vector3.Cross(BABYLON.Axis.Y, direction);
        const dot = BABYLON.Scalar.Clamp(BABYLON.Vector3.Dot(BABYLON.Axis.Y, direction), -1, 1);
        nockedArrow.rotationQuaternion.copyFrom(axis.lengthSquared() < 1e-8
          ? BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, dot < 0 ? Math.PI : 0)
          : BABYLON.Quaternion.RotationAxis(axis.normalize(), Math.acos(dot)));
        arrowShaft.scaling.y = Math.max(.01, length - .10);
        arrowShaft.position.y = (length - .10) / 2;
        arrowTip.position.y = length - .10;
        this.projectileDirection.copyFrom(draw > .05 ? direction : bowForward);
        nockedArrow.setEnabled(draw > .05);
      } };
    };
    const bow = makeBow('bow', 1.75, .72);
    const recurveBow = makeBow('bow-recurve', 2.02, 1.15, .5);
    const greatBow = makeBow('bow-great', 2.38, .54);

    const slingWeapon = new BABYLON.TransformNode('slingshot', scene);
    slingWeapon.parent = rightGripSocket;
    slingWeapon.rotationQuaternion = BABYLON.Quaternion.Identity();
    slingWeapon.scaling.setAll(1.22);
    const slingCarryRotation = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, Math.PI / 2);
    // The fingers open toward local -Z. During a shot, turn that opening
    // toward the character's forward +X while the fork becomes vertical.
    const slingAimHandRotation = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, -Math.PI / 2);
    // The right hand sits beside the face. Bend the fork outward so neither
    // prong crosses the eye, while the short stem stays inside the palm.
    const slingForkOffset = -.21;
    const slingJunction = new BABYLON.Vector3(.03, slingForkOffset, .43);
    const slingTips = [
      new BABYLON.Vector3(.05, slingForkOffset - .22, .78),
      new BABYLON.Vector3(.05, slingForkOffset + .22, .78),
    ];
    const slingPath = [
      [new BABYLON.Vector3(0, 0, -.16), BABYLON.Vector3.Zero(),
        new BABYLON.Vector3(.02, slingForkOffset * .55, .24), slingJunction],
      [slingJunction, slingTips[0]],
      [slingJunction, slingTips[1]],
    ];
    slingPath.forEach((path, index) => {
      const fork = BABYLON.MeshBuilder.CreateTube(`slingshot fork ${index}`, {
        path, radius: .09, tessellation: 6,
      }, scene);
      fork.parent = slingWeapon;
      fork.material = grip;
      castShadow(fork);
    });
    const slingRestCenter = new BABYLON.Vector3(.05, slingForkOffset, .60);
    const slingCenter = (draw, handPoint) => handPoint
      ? BABYLON.Vector3.Lerp(slingRestCenter, handPoint, draw)
      : new BABYLON.Vector3(.05 - 1.70 * draw, 0, .44 + .54 * draw);
    const slingPoints = (draw, handPoint) => [
      slingTips[0],
      slingCenter(draw, handPoint),
      slingTips[1],
    ];
    const updateElastic = makeCord('slingshot elastic', slingWeapon, '#483323');
    updateElastic(slingPoints(0));
    const pouch = BABYLON.MeshBuilder.CreateSphere('slingshot pouch', {
      diameter: .20, segments: 6,
    }, scene);
    pouch.parent = slingWeapon;
    pouch.material = grip;
    const slingshot = { weapon: slingWeapon, metalParts: [], setDraw(draw, handPoint) {
      updateElastic(slingPoints(draw, handPoint));
      pouch.position.copyFrom(slingCenter(draw, handPoint));
      pouch.setEnabled(draw > .05);
    } };

    const shapes = { dagger, sword, spear, axe, hammer, pickaxe, scythe, longstick, catchingPole,
      bow, 'bow-recurve': recurveBow, 'bow-great': greatBow, slingshot };
    let selectedKind = 'sword-iron';
    const projectiles = [];
    let projectileTarget = null;
    const setVariant = kind => {
      shapes[selectedKind]?.setDraw?.(0);
      selectedKind = kind;
      root.setEnabled(kind !== 'none');
      const shapeName = kind.startsWith('bow') ? kind : kind.split('-')[0];
      const shape = shapes[shapeName] || sword;
      for (const entry of Object.values(shapes)) entry.weapon.setEnabled(entry === shape);
      const metal = kind.endsWith('bronze') ? bronze : kind.endsWith('ceramic') ? ceramic : iron;
      if (shape.metalParts) {
        for (const part of shape.metalParts) part.material = metal;
      } else {
        shape.blade.material = metal;
        shape.guard.material = shape.pommel.material = kind.endsWith('bronze') ? bronzeGuard : ironGuard;
      }
    };
    const fire = (power = 1) => {
      if (!window.buddyIsRangedEquipment?.(selectedKind)) return false;
      const shape = shapes[selectedKind];
      const weapon = shape.weapon;
      weapon.computeWorldMatrix(true);
      const matrix = weapon.getWorldMatrix();
      const position = BABYLON.Vector3.TransformCoordinates(
        shape.projectileOrigin || new BABYLON.Vector3(.35, 0, .12), matrix);
      const isBow = selectedKind.startsWith('bow');
      // Use the rigid bow axis as the fallback; the drawn string changes shape
      // during the animation and is not a stable projectile direction.
      const direction = BABYLON.Vector3.TransformNormal(
        isBow ? BABYLON.Axis.X : shape.projectileDirection || BABYLON.Axis.X, matrix);
      direction.y = 0;
      direction.normalize();
      // Arrows follow the bow itself. The mini scene aligns the whole pose to
      // the pointer, so the projectile must never compensate for a mis-aimed bow.
      if (!isBow && projectileTarget) {
        const towardTarget = projectileTarget.subtract(position);
        towardTarget.y = 0;
        if (towardTarget.lengthSquared() > .04) direction.copyFrom(towardTarget.normalize());
      }
      const size = BABYLON.Vector3.TransformNormal(
        new BABYLON.Vector3(0, 0, 1), matrix).length();
      const stone = selectedKind === 'slingshot';
      const mesh = stone
        ? BABYLON.MeshBuilder.CreateSphere('fired stone', { diameter: .24 * size, segments: 6 }, scene)
        : BABYLON.MeshBuilder.CreateCylinder('fired arrow', {
          height: 1.4 * size, diameter: .07 * size, tessellation: 6,
        }, scene);
      mesh.position.copyFrom(position);
      if (!stone) {
        const tip = BABYLON.MeshBuilder.CreateCylinder('arrow iron tip', {
          height: .22 * size, diameterTop: 0, diameterBottom: .15 * size,
          tessellation: 6,
        }, scene);
        tip.parent = mesh;
        tip.position.y = .78 * size;
        tip.material = iron;
        const axis = BABYLON.Axis.Y;
        mesh.rotationQuaternion = BABYLON.Quaternion.RotationAxis(
          BABYLON.Vector3.Cross(axis, direction).normalize(),
          Math.acos(BABYLON.Scalar.Clamp(BABYLON.Vector3.Dot(axis, direction), -1, 1)),
        );
      }
      mesh.material = stone ? ceramic : grip;
      projectiles.push({ mesh, direction, age: 0, speed: 13 * power });
      return true;
    };
    const aimDirectionWorld = () => {
      const shape = shapes[selectedKind];
      if (shape?.projectileDirection) {
        shape.weapon.computeWorldMatrix(true);
        return BABYLON.Vector3.TransformNormal(
          selectedKind.startsWith('bow') ? BABYLON.Axis.X : shape.projectileDirection,
          shape.weapon.getWorldMatrix()).normalize();
      }
      root.computeWorldMatrix(true);
      return BABYLON.Vector3.TransformNormal(
        new BABYLON.Vector3(0, 0, -1), root.getWorldMatrix()).normalize();
    };
    const pointForward = () => {
      if (!selectedKind.startsWith('bow')) handPose.rotationQuaternion.copyFrom(restingHandRotation);
    };
    const updatePose = (dt, walking, walkSpeed, guarding = false,
      sideSlashProgress = null, shotProgress = null) => {
      const draw = shotProgress === null ? 0
        : BABYLON.Scalar.Clamp((shotProgress - .12) / .46, 0, 1)
          * BABYLON.Scalar.Clamp((.70 - shotProgress) / .10, 0, 1);
      const drawnShape = shapes[selectedKind];
      offhandPose?.rotationQuaternion.copyFrom(BABYLON.Quaternion.Slerp(
        BABYLON.Quaternion.Identity(), stringGripRotation,
        window.buddyIsRangedEquipment?.(selectedKind) ? draw : 0,
      ));
      const updateDraw = () => {
        let offhandPoint = null;
        if (draw > 0 && leftStringSocket && drawnShape?.setDraw) {
          leftStringSocket.computeWorldMatrix(true);
          drawnShape.weapon.computeWorldMatrix(true);
          const toWeapon = drawnShape.weapon.getWorldMatrix().clone().invert();
          offhandPoint = BABYLON.Vector3.TransformCoordinates(
            leftStringSocket.getAbsolutePosition(), toWeapon);
        }
        drawnShape?.setDraw?.(draw, offhandPoint);
      };
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        projectile.age += dt;
        projectile.mesh.position.addInPlace(projectile.direction.scale(dt * projectile.speed));
        if (projectile.age > 1.4) {
          projectile.mesh.dispose();
          projectiles.splice(i, 1);
        }
      }
      if (sideSlashProgress !== null) {
        const enter = BABYLON.Scalar.Clamp((sideSlashProgress - 0.08) / 0.20, 0, 1);
        const leave = BABYLON.Scalar.Clamp((1 - sideSlashProgress) / 0.22, 0, 1);
        handPose.rotationQuaternion.copyFrom(BABYLON.Quaternion.Slerp(
          restingHandRotation, flatSlashRotation, enter * leave,
        ));
        updateDraw();
        return;
      }
      const rangedAim = window.buddyIsRangedEquipment?.(selectedKind) && shotProgress !== null
        ? BABYLON.Scalar.Clamp(shotProgress / .30, 0, 1)
          * BABYLON.Scalar.Clamp((1 - shotProgress) / .24, 0, 1)
        : 0;
      let targetRotation = guarding ? guardHandRotation
        : selectedKind === 'slingshot' ? BABYLON.Quaternion.Slerp(
          restingHandRotation, slingAimHandRotation, rangedAim)
        : selectedKind.startsWith('bow') ? BABYLON.Quaternion.Slerp(
          carriedBowRotation, BABYLON.Quaternion.Identity(), rangedAim).multiply(bowGripRotation)
        : restingHandRotation;
      if (walking && !guarding && !window.buddyIsRangedEquipment?.(selectedKind)) {
        walkPhase += dt * walkSpeed * Math.PI * 2;
        const sway = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, Math.sin(walkPhase) * 0.12);
        targetRotation = sway.multiply(raisedHandRotation);
      }
      handPose.rotationQuaternion.copyFrom(BABYLON.Quaternion.Slerp(
        handPose.rotationQuaternion, targetRotation, Math.min(1, dt * 10),
      ));
      // Lower the fork hand slightly while aiming, without pulling it below the body.
      handPose.position.z = selectedKind === 'slingshot' ? -.38 * rangedAim : 0;
      if (selectedKind.startsWith('bow')) {
        // The palm stays wrapped around the wood in both carry and shot poses.
        // Only the bow's world orientation changes between those poses.
        drawnShape.weapon.rotationQuaternion.copyFrom(forwardRotation.clone().invert()
          .multiply(bowGripRotation.clone().invert()));
      } else if (selectedKind === 'slingshot') {
        slingWeapon.rotationQuaternion.copyFrom(slingCarryRotation);
        slingWeapon.scaling.z = 1.22 * (1 - .30 * rangedAim);
      }
      updateDraw();
    };
    setVariant('sword-iron');
    const setProjectileTarget = point => { projectileTarget = point?.clone() || null; };
    return { root, gripSockets: { right: rightGripSocket, left: leftGripSocket,
      leftString: leftStringSocket },
      setVariant, pointForward, updatePose, fire, aimDirectionWorld, setProjectileTarget };
  };
})();
