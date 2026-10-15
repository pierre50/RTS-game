(() => {
  const FOOT_NAMES = window.buddyFootNames;
  const CHOP_TOOLS = new Set(['axe', 'hammer', 'pickaxe']);
  const THRUST_EQUIPMENT = new Set(['spear', 'dagger', 'longstick', 'catchingPole']);
  window.buddyIsRangedEquipment = equipment => equipment === 'slingshot' || equipment.startsWith('bow');

  window.buddyActionForEquipment = equipment => {
    if (window.buddyIsRangedEquipment(equipment)) return 'Shot';
    const shape = equipment.split('-')[0];
    return CHOP_TOOLS.has(shape) ? 'Chop' : THRUST_EQUIPMENT.has(shape) ? 'Thrust' : 'Slash';
  };
  window.buddyPointerActionsForEquipment = equipment => equipment.startsWith('sword-')
    ? { tap: 'SideSlash', hold: 'ChargeSlash', holdRelease: 'ReleaseSlash', holdCancel: 'CancelCharge' }
    : window.buddyIsRangedEquipment(equipment)
      ? { tap: 'Shot', hold: 'ChargeShot', holdRelease: 'ReleaseShot', holdCancel: 'CancelCharge', holdDelay: 120 }
      : { tap: window.buddyActionForEquipment(equipment) };

  const animationLayer = (scene, source, name, includeTarget) => {
    const group = new BABYLON.AnimationGroup(name, scene);
    source.targetedAnimations.forEach(({ animation, target }) => {
      if (includeTarget(target)) group.addTargetedAnimation(animation, target);
    });
    return group;
  };

  const reversedAnimationLayer = (scene, source, name) => {
    if (!source) return null;
    const group = new BABYLON.AnimationGroup(name, scene);
    source.targetedAnimations.forEach(({ animation, target }) => {
      const reversed = animation.clone();
      const keys = animation.getKeys();
      const first = keys[0].frame;
      const last = keys[keys.length - 1].frame;
      reversed.setKeys(keys.map(key => ({ ...key, frame: first + last - key.frame })).reverse());
      group.addTargetedAnimation(reversed, target);
    });
    return group;
  };

  window.createBuddyActionRig = (result, scene) => {
    const bodySway = result.transformNodes.find(node => node.name === 'Balancement du corps');
    let crouchPose = null;
    let crouchBody = null;
    if (bodySway) {
      // The model's local Z is vertical. Shoes stay outside this body pivot.
      const bodyParts = bodySway.getChildren().filter(child =>
        child.name !== 'Poignet droit' && child.name !== 'Poignet gauche');
      crouchBody = new BABYLON.TransformNode('compressed crouch body', scene);
      crouchBody.parent = bodySway;
      for (const part of bodyParts) part.parent = crouchBody;
      crouchPose = new BABYLON.TransformNode('crouch pose', scene);
      crouchPose.parent = bodySway.parent;
      bodySway.parent = crouchPose;
    }

    const walk = result.animationGroups.find(group => group.name === 'Walk');
    const slash = result.animationGroups.find(group => group.name === 'Slash');
    const sideSlash = result.animationGroups.find(group => group.name === 'SideSlash');
    const thrust = result.animationGroups.find(group => group.name === 'Thrust');
    const chop = result.animationGroups.find(group => group.name === 'Chop');
    const block = result.animationGroups.find(group => group.name === 'Block');
    const shot = result.animationGroups.find(group => group.name === 'Shot');
    const walkLegs = walk
      ? animationLayer(scene, walk, 'Walk — feet during attack', target => FOOT_NAMES.has(target.name))
      : null;
    const slashUpper = walk && slash
      ? animationLayer(scene, slash, 'Slash — upper body', target => !FOOT_NAMES.has(target.name))
      : null;
    const sideSlashUpper = walk && sideSlash
      ? animationLayer(scene, sideSlash, 'SideSlash — upper body', target => !FOOT_NAMES.has(target.name))
      : null;
    const thrustUpper = walk && thrust
      ? animationLayer(scene, thrust, 'Thrust — upper body', target => !FOOT_NAMES.has(target.name))
      : null;
    const chopUpper = walk && chop
      ? animationLayer(scene, chop, 'Chop — upper body', target => !FOOT_NAMES.has(target.name))
      : null;
    const blockUpper = walk && block
      ? animationLayer(scene, block, 'Block — upper body', target => !FOOT_NAMES.has(target.name))
      : null;
    const shotUpper = walk && shot
      ? animationLayer(scene, shot, 'Shot — upper body', target => !FOOT_NAMES.has(target.name))
      : null;
    const blockRelease = reversedAnimationLayer(scene, blockUpper, 'Block release — upper body');
    const footSettler = window.createBuddyFootSettler?.(result);
    let crouchAmount = 0;
    return {
      bodySway, crouchPose, crouchBody, walk, slash, sideSlash, thrust, chop, block, shot,
      walkLegs, slashUpper, sideSlashUpper, thrustUpper, chopUpper, blockUpper, blockRelease, shotUpper,
      startWalk: speed => footSettler?.start(walk, speed),
      stopWalk: () => footSettler?.stop(walk),
      startLegs: speed => footSettler?.start(walkLegs, speed),
      stopLegs: () => footSettler?.stop(walkLegs),
      updateFootPlant: dt => footSettler?.update(dt),
      updateCrouch(dt, crouching) {
        crouchAmount += (Number(crouching) - crouchAmount) * Math.min(1, dt * 10);
        if (crouchPose) crouchPose.position.z = -crouchAmount * 0.4;
        if (crouchBody) crouchBody.scaling.z = 1 - crouchAmount * 0.22;
      },
    };
  };

  window.bindBuddyActionKeys = onChange => {
    let running = false;
    let crouching = false;
    let blocking = false;
    const notify = () => onChange?.();
    window.addEventListener('keydown', event => {
      const key = event.key.toLowerCase();
      if (key !== 'shift' && key !== 'c' && event.code !== 'Space') return;
      if (event.target instanceof HTMLElement && event.target.closest('input, select, button')) return;
      if (key === 'shift') running = true;
      else if (key === 'c') crouching = true;
      else blocking = true;
      notify();
      event.preventDefault();
    });
    window.addEventListener('keyup', event => {
      const key = event.key.toLowerCase();
      if (key === 'shift') running = false;
      else if (key === 'c') crouching = false;
      else if (event.code === 'Space') blocking = false;
      else return;
      notify();
    });
    window.addEventListener('blur', () => {
      running = false;
      crouching = false;
      blocking = false;
      notify();
    });
    return {
      get crouching() { return crouching; },
      get blocking() { return blocking; },
      get running() { return running && !crouching; },
      get animationMultiplier() { return crouching ? 0.68 : running ? 1.6 : 1; },
      get movementMultiplier() { return crouching ? 0.48 : running ? 1.75 : 1; },
    };
  };

  window.bindBuddyAttackPointer = (canvas, getActions, trigger,
                                   { holdDelay = 240, dragTolerance = 6, onPointerDown } = {}) => {
    let pending = null;
    const clear = () => {
      if (pending?.timer) clearTimeout(pending.timer);
      if (pending?.fired && pending.actions.holdCancel) trigger(pending.actions.holdCancel);
      pending = null;
    };
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 || pending) return;
      onPointerDown?.(event);
      const actions = getActions();
      if (!actions) return;
      pending = { id: event.pointerId, x: event.clientX, y: event.clientY,
        actions, fired: false, dragged: false, timer: null };
      if (actions.hold) {
        pending.timer = setTimeout(() => {
          if (!pending || pending.id !== event.pointerId || pending.dragged) return;
          pending.fired = true;
          trigger(actions.hold);
        }, actions.holdDelay ?? holdDelay);
      }
    });
    window.addEventListener('pointermove', event => {
      if (!pending || event.pointerId !== pending.id) return;
      if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > dragTolerance) {
        pending.dragged = true;
        if (pending.timer) clearTimeout(pending.timer);
      }
    });
    const release = event => {
      if (!pending || event.pointerId !== pending.id) return;
      const { actions, fired, dragged } = pending;
      if (pending.timer) clearTimeout(pending.timer);
      pending = null;
      if (fired && actions.holdRelease) trigger(actions.holdRelease);
      else if (!fired && !dragged) trigger(actions.tap);
    };
    canvas.addEventListener('pointerup', release);
    window.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', clear);
    window.addEventListener('blur', clear);
    return clear;
  };

  window.createBuddyAttack = (rig, sword, onEnd) => {
    let attacking = false;
    let charging = false;
    let chargingAction = null;
    let chargeEndFrame = 0;
    let chargeStartedAt = 0;
    let lastPower = 1;
    let blocking = false;
    let releasingBlock = false;
    let legsMoving = false;
    let activeGroup = null;
    let currentAction = null;
    let projectileFired = false;
    const setLegsMoving = (moving, speed) => {
      if ((!attacking && !charging && !blocking) || !rig.walkLegs) return;
      if (moving && !legsMoving) rig.startLegs(speed);
      if (!moving && legsMoving) {
        rig.stopLegs();
      }
      legsMoving = moving;
      if (moving) rig.walkLegs.speedRatio = speed;
    };
    const finishAttack = () => {
      if (!attacking) return;
      if (currentAction === 'Shot' && !projectileFired) {
        projectileFired = true;
        sword?.fire(lastPower);
      }
      attacking = false;
      currentAction = null;
      activeGroup?.stop();
      activeGroup = null;
      rig.stopLegs();
      legsMoving = false;
      onEnd?.();
    };
    rig.slashUpper?.onAnimationGroupEndObservable.add(() => {
      if (!charging) finishAttack();
    });
    rig.sideSlashUpper?.onAnimationGroupEndObservable.add(finishAttack);
    rig.thrustUpper?.onAnimationGroupEndObservable.add(finishAttack);
    rig.chopUpper?.onAnimationGroupEndObservable.add(finishAttack);
    rig.shotUpper?.onAnimationGroupEndObservable.add(() => {
      if (!charging) finishAttack();
    });
    rig.blockRelease?.onAnimationGroupEndObservable.add(() => {
      if (!releasingBlock) return;
      releasingBlock = false;
      blocking = false;
      rig.stopLegs();
      legsMoving = false;
      onEnd?.();
    });
    return {
      get attacking() { return attacking; },
      get spriteAction() { return charging ? chargingAction : currentAction; },
      get spriteProgress() {
        if (!activeGroup || (!attacking && !charging)) return null;
        const frame = activeGroup.isStarted ? activeGroup.getCurrentFrame() : chargeEndFrame;
        return BABYLON.Scalar.Clamp((frame - activeGroup.from) / (activeGroup.to - activeGroup.from), 0, 1);
      },
      get sideSlashProgress() {
        if (!attacking || currentAction !== 'SideSlash' || !activeGroup?.isStarted) return null;
        return (activeGroup.getCurrentFrame() - activeGroup.from) / (activeGroup.to - activeGroup.from);
      },
      get shotProgress() {
        if (charging && chargingAction === 'Shot') {
          const frame = activeGroup?.isStarted ? activeGroup.getCurrentFrame() : chargeEndFrame;
          return (frame - activeGroup.from) / (activeGroup.to - activeGroup.from);
        }
        if (!attacking || currentAction !== 'Shot' || !activeGroup?.isStarted) return null;
        return (activeGroup.getCurrentFrame() - activeGroup.from) / (activeGroup.to - activeGroup.from);
      },
      get charging() { return charging; },
      get chargePower() { return charging ? 1 + Math.min(1, (performance.now() - chargeStartedAt) / 1250) : lastPower; },
      get blocking() { return blocking; },
      get guarding() { return blocking && !releasingBlock; },
      start({ action = 'Slash', attackSpeed = 2.4, walkSpeed = 2.2, keepLegsMoving = false, prepare, stopCurrent } = {}) {
        const group = {
          Slash: rig.slashUpper, SideSlash: rig.sideSlashUpper,
          Thrust: rig.thrustUpper, Chop: rig.chopUpper, Shot: rig.shotUpper,
        }[action];
        if (attacking || charging || blocking || !group) return false;
        group.stop();
        group.goToFrame(0);
        sword?.pointForward();
        prepare?.();
        stopCurrent?.();
        attacking = true;
        currentAction = action;
        lastPower = 1;
        projectileFired = false;
        activeGroup = group;
        setLegsMoving(keepLegsMoving, walkSpeed);
        // The longer circular wind-up needs room to read; the contact phase
        // is still quick within the animation itself.
        group.start(false, action === 'Slash' ? attackSpeed * 0.72 : attackSpeed);
        return true;
      },
      update() {
        if (currentAction === 'Shot' && !projectileFired && this.shotProgress >= .66) {
          projectileFired = true;
          sword?.fire(lastPower);
        }
      },
      startCharge({ action = 'Slash', walkSpeed = 2.2, keepLegsMoving = false, prepare, stopCurrent } = {}) {
        const group = action === 'Shot' ? rig.shotUpper : rig.slashUpper;
        if (attacking || charging || blocking || !group) return false;
        group.stop(true);
        sword?.pointForward();
        prepare?.();
        stopCurrent?.();
        charging = true;
        chargingAction = action;
        chargeStartedAt = performance.now();
        activeGroup = group;
        chargeEndFrame = group.from + (group.to - group.from) * (action === 'Shot' ? .60 : .51);
        setLegsMoving(keepLegsMoving, walkSpeed);
        group.start(false, action === 'Shot' ? 1.8 : 2.2, group.from, chargeEndFrame);
        return true;
      },
      releaseCharge() {
        if (!charging) return false;
        lastPower = 1 + Math.min(1, (performance.now() - chargeStartedAt) / 1250);
        const group = activeGroup;
        const raisedFrame = group.isStarted ? group.getCurrentFrame() : chargeEndFrame;
        group.stop(true);
        charging = false;
        attacking = true;
        currentAction = chargingAction;
        chargingAction = null;
        projectileFired = false;
        group.start(false, 2.0 + 1.6 * (lastPower - 1), raisedFrame, group.to);
        return lastPower;
      },
      cancelCharge() {
        if (!charging) return false;
        charging = false;
        chargingAction = null;
        activeGroup?.stop(true);
        activeGroup?.start(false, 1);
        activeGroup?.goToFrame(activeGroup.from);
        activeGroup?.stop(true);
        activeGroup = null;
        rig.stopLegs();
        legsMoving = false;
        onEnd?.();
        return true;
      },
      startBlock({ walkSpeed = 2.2, keepLegsMoving = false, prepare, stopCurrent } = {}) {
        if (attacking || charging || blocking || !rig.blockUpper) return false;
        rig.blockUpper.stop(true);
        sword?.pointForward();
        prepare?.();
        stopCurrent?.();
        blocking = true;
        setLegsMoving(keepLegsMoving, walkSpeed);
        rig.blockUpper.start(false, 1.5);
        return true;
      },
      releaseBlock() {
        if (!blocking || releasingBlock) return;
        releasingBlock = true;
        const group = rig.blockUpper;
        const raisedFrame = group.isStarted ? group.getCurrentFrame() : group.to;
        group.stop(true);
        if (raisedFrame <= group.from + 0.01) {
          releasingBlock = false;
          blocking = false;
          rig.stopLegs();
          legsMoving = false;
          onEnd?.();
          return;
        }
        const release = rig.blockRelease;
        const from = Math.max(release.from,
          release.to - (raisedFrame - group.from));
        release.start(false, 2, from, release.to);
      },
      setLegsMoving,
      cancel() {
        attacking = false;
        charging = false;
        currentAction = null;
        blocking = false;
        releasingBlock = false;
        legsMoving = false;
        activeGroup?.stop();
        activeGroup = null;
        rig.blockUpper?.stop(true);
        rig.blockRelease?.stop(true);
        rig.stopLegs();
      },
    };
  };
})();
