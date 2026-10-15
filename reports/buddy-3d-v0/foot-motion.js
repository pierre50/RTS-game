(() => {
  // Both viewers use the same GLB and the same foot spacing and walk motion.
  const inwardOffset = new Map([
    ['Cube.001_Material.017_0', 0.25],
    ['Cube.001_Material.020_0', -0.25],
  ]);
  window.buddyFootNames = new Set(inwardOffset.keys());
  window.tuneBuddyFeet = (result, scene) => {
    const walk = result.animationGroups.find(group => group.name === 'Walk');
    if (!walk) return;
    for (const mesh of result.meshes) {
      const offset = inwardOffset.get(mesh.name);
      if (offset === undefined) continue;
      const pivot = new BABYLON.TransformNode(`${mesh.name} closer pivot`, scene);
      pivot.parent = mesh.parent;
      pivot.position.y = offset;
      mesh.parent = pivot;

      const { minimum, maximum } = mesh.getBoundingInfo().boundingBox;
      mesh.setPivotPoint(new BABYLON.Vector3(
        minimum.x + (maximum.x - minimum.x) * 0.34,
        (minimum.y + maximum.y) / 2,
        maximum.z - (maximum.z - minimum.z) * 0.18,
      ));
      const restRotation = mesh.rotationQuaternion?.clone() ?? BABYLON.Quaternion.Identity();
      mesh.rotationQuaternion = restRotation.clone();
      const tilt = new BABYLON.Animation(
        `${mesh.name} walking roll`, 'rotationQuaternion', 60,
        BABYLON.Animation.ANIMATIONTYPE_QUATERNION,
        BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE,
      );
      const phaseOffset = offset > 0 ? 0 : Math.PI;
      tilt.setKeys(Array.from({ length: 17 }, (_, i) => {
        const phase = i * Math.PI / 8 + phaseOffset;
        const swing = Math.sin(phase);
        const angle = swing > 0 ? -0.48 * swing : -0.12 * swing;
        return {
          frame: walk.from + (walk.to - walk.from) * i / 16,
          value: restRotation.multiply(BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, angle)),
        };
      }));
      walk.addTargetedAnimation(tilt, mesh);
    }
    for (const { animation, target } of walk.targetedAnimations) {
      if (!inwardOffset.has(target.name) || animation.targetProperty !== 'position') continue;
      animation.setKeys(animation.getKeys().map(key => {
        const value = key.value.clone();
        value.x *= 2.6;
        value.z *= 2.3;
        return { ...key, value };
      }));
    }
  };

  // A stopped AnimationGroup can leave its targets at the last sampled frame.
  // Keep that exact pose, then plant each shoe in its known rest socket.
  window.createBuddyFootSettler = result => {
    const feet = result.meshes.filter(mesh => inwardOffset.has(mesh.name)).map(mesh => ({
      mesh,
      restPosition: mesh.position.clone(),
      restRotation: mesh.rotationQuaternion?.clone() ?? BABYLON.Quaternion.Identity(),
    }));
    let settling = null;
    let resumePhase = null;
    const duration = 0.18;
    return {
      start(group, speed) {
        const phase = settling ? resumePhase : null;
        settling = null;
        group?.start(true, speed);
        if (phase !== null && group) group.goToFrame(group.from + (group.to - group.from) * phase);
        resumePhase = null;
      },
      stop(group) {
        if (group?.isStarted) {
          const frame = group.getCurrentFrame();
          resumePhase = Number.isFinite(frame) && group.to > group.from
            ? Math.max(0, Math.min(1, (frame - group.from) / (group.to - group.from))) : null;
        }
        const poses = feet.map(({ mesh }) => ({
          position: mesh.position.clone(),
          rotation: mesh.rotationQuaternion?.clone() ?? BABYLON.Quaternion.Identity(),
        }));
        if (group) {
          group.stop();
          // Sampling frame zero while the group is active also resets its body
          // and hand tracks; the shoes below keep their captured walk pose.
          group.start(false, 1);
          group.goToFrame(group.from);
          group.stop();
        }
        feet.forEach(({ mesh }, index) => {
          mesh.position.copyFrom(poses[index].position);
          mesh.rotationQuaternion = poses[index].rotation.clone();
        });
        settling = { elapsed: 0, poses };
      },
      update(dt) {
        if (!settling) return;
        settling.elapsed = Math.min(duration, settling.elapsed + dt);
        const t = settling.elapsed / duration;
        const ease = t * t * (3 - 2 * t);
        feet.forEach(({ mesh, restPosition, restRotation }, index) => {
          BABYLON.Vector3.LerpToRef(settling.poses[index].position, restPosition, ease, mesh.position);
          mesh.rotationQuaternion = BABYLON.Quaternion.Slerp(settling.poses[index].rotation, restRotation, ease);
        });
        if (t === 1) {
          settling = null;
          resumePhase = null;
        }
      },
    };
  };
})();
