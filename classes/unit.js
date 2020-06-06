class Unit extends PIXI.Container {
	constructor(i, j, map, player, options = {}){
		super();

		this.setParent(map);
		this.id = this.parent.children.length;
		this.name = 'unit'
		this.i = i;
		this.j = j;
		this.x = this.parent.grid[i][j].x;
		this.y = this.parent.grid[i][j].y;
		this.z = this.parent.grid[i][j].z;
		this.next = null;
		this.dest = null;
		this.previousDest = null;
		this.path = [];
		this.player = player;
		this.zIndex = getInstanceZIndex(this);
		this.interactive = true;
		this.selected = false;
		this.degree = randomRange(1,360);
		this.currentFrame = randomRange(0, 4);
		this.action = null;
		this.work = null;
		this.loading = 0;
		this.maxLoading = 10;
		this.currentSheet = null;
		this.size = 1;
		this.visible = true;
		this.currentCell = this.parent.grid[this.i][this.j];
		this.currentCell.has = this;
		this.currentCell.solid = true;

		Object.keys(options).forEach((prop) => {
			this[prop] = options[prop];
		})

		this.life = this.lifeMax;
		
		this.originalSpeed = this.speed;		
		this.actionSheet = null;
		this.deliverySheet = null;
		this.inactif = true;

		let sprite = new PIXI.AnimatedSprite(this.standingSheet.animations['south']);
		sprite.name = 'sprite';
		changeSpriteColor(sprite, player.color);

		sprite.updateAnchor = true;
		this.addChild(sprite);
		this.stop();
		//if (this.player.type === 'Human'){
			renderCellOnInstanceSight(this);
		//}
	}
	select(){
		if (this.selected){
			return;
		}
		this.selected = true;
		let selection = new PIXI.Graphics();
		selection.name = 'selection';
		selection.zIndex = 3;
		selection.lineStyle(1, 0xffffff);		
		const path = [(-32*.5), 0, 0,(-16*.5), (32*.5),0, 0,(16*.5)];
		selection.drawPolygon(path);
		this.addChildAt(selection, 0);
	}
	unselect(){
		this.selected = false;
		let selection = this.getChildByName('selection');
		if (selection){
			this.removeChild(selection);
		}
	}
	hasPath(){
		return this.path.length > 0;
	}
	setDestination(dest, action){
		this.inactif = false;
		this.dest = dest;
		this.path = [];
		this.action = action;
		//No instance we cancel the destination
		if (!dest){
			this.stop();
			return false;
		}
		//Unit is already beside our target
		if (action && instanceContactInstance(this, dest)){
			this.degree = getInstanceDegree(this, dest.x, dest.y);
			this.getAction(action);
			return true;
		}
		//Set unit path
		if (this.parent.grid[dest.i][dest.j].solid){
			this.path = getInstanceClosestFreeCellPath(this, dest, this.parent);
		}else{
			this.path = getInstancePath(this, dest.i, dest.j, this.parent);
		}
		//Unit found a path, set the action and play walking animation
		if (this.path.length){
			this.setAnimation('walkingSheet');
			return true;
		}
		this.stop();
		return false;
	}
	moveToNearestEnemy(){
		this.stop();
		setTimeout(() => {
			const targets = findInstancesInSight(this, (instance) => instance.name === 'unit' && instance.life > 0 && instance.player === this.player);
			if (targets.length){
				const target = getClosestInstance(this, targets);
				this.setDestination(target, 'build');
			}else{
				this.stop();
			}
		}, 150);
	}
	getAction(name){
		let sprite = this.getChildByName('sprite');
		switch (name){
			case 'chopwood':
				if (!this.dest || this.dest.type !== 'Tree' || this.dest.quantity <= 0){
					this.moveToNearestTree();
					return;
				}
				sprite.onLoop = () => {
					//Villager is full we send him delivery first
					if (this.loading === this.maxLoading || !this.dest){
						let targets = this.player.buildings.filter((building) => {
							return building.life > 0 && building.isBuilt && building.type === 'TownCenter' || building.type === 'StoragePit';
						});
						let target = getClosestInstance(this, targets);
						if (this.dest){
							this.previousDest = this.dest;
						}else{
							this.previousDest = this.parent.grid[this.i][this.j];
						}
						this.setDestination(target, 'deliverywood');
						return;
					}
					//Tree destination is still alive we cut him until it's dead
					if (this.dest.life > 0){
						this.dest.life--;
						if (this.dest.life <= 0){
							//Set cutted tree texture
							let sprite = this.dest.getChildByName('sprite');
							const spritesheet = app.loader.resources['636'].spritesheet;
							const textureName = `00${randomRange(0,3)}_636.png`;
							const texture = spritesheet.textures[textureName];
							sprite.texture = texture;
							const points = [-32, 0, 0,-16, 32,0, 0,16];
							sprite.hitArea = new PIXI.Polygon(points);
							sprite.anchor.set(texture.defaultAnchor.x, texture.defaultAnchor.y);
						}
						return;
					}
					//Villager cut the stump
					this.loading++;
					this.dest.quantity--;
					//Destroy tree if stump out of quantity
					if (this.dest.quantity <= 0){
						this.dest.destroy();
						this.dest = null;
					}
					//Set the walking with wood animation
					if (this.loading > 1){
						this.walkingSheet = app.loader.resources['273'].spritesheet;
						this.standingSheet = null;
					}
				}
				this.setAnimation('actionSheet');
				break;
			case 'deliverywood':
				this.player.wood += this.loading;
				this.parent.interface.updateTopbar();
				this.loading = 0;
				this.walkingSheet = app.loader.resources['682'].spritesheet;
				this.standingSheet = app.loader.resources['440'].spritesheet;
				if (this.previousDest){
					this.setDestination(this.previousDest, 'chopwood');
				}else{
					this.stop()
				}
				break;
			case 'forageberry':
				if (!this.dest || this.dest.type !== 'Berrybush' || this.dest.quantity <= 0){
					this.moveToNearestBerrybush();
					return;
				}
				sprite.onLoop = () => {
					//Villager is full we send him delivery first
					if (this.loading === this.maxLoading || !this.dest){
						let targets = this.player.buildings.filter((building) => {
							return building.life > 0 && building.isBuilt && building.type === 'TownCenter' || building.type === 'Granary';
						});
						let target = getClosestInstance(this, targets);
						if (this.dest){
							this.previousDest = this.dest;
						}else{
							this.previousDest = this.parent.grid[this.i][this.j];
						}
						this.setDestination(target, 'deliveryberry');
						return;
					}
					//Villager forage the berrybush
					this.loading++;
					this.dest.quantity--;
					//Destroy berrybush if it out of quantity
					if (this.dest.quantity <= 0){
						this.dest.destroy();
						this.dest = null;
					}
				}
				this.setAnimation('actionSheet');
				break;
			case 'deliveryberry':
				this.player.food += this.loading;
				this.parent.interface.updateTopbar();
				this.loading = 0;
				if (this.previousDest){
					this.setDestination(this.previousDest, 'forageberry');
				}else{
					this.stop()
				}
				break;
			case 'build':
				if (!this.dest || this.dest.isBuilt){
					this.moveToNearestConstruction();
					return;
				}
				sprite.onLoop = () => {
					if (this.dest.name !== 'building'){
						this.stop()
						return;
					}
					if (this.dest.life < this.dest.lifeMax){
						this.dest.life += this.attack;
						this.dest.updateTexture();
					}else{
						if (!this.dest.isBuilt){
							this.dest.updateTexture();
							this.dest.isBuilt = true;
						}
						this.moveToNearestConstruction();
					}
				}
				this.setAnimation('actionSheet');
				break;
			case 'attack':
				if (!this.dest || this.dest.life < 0){
					this.stop();
					return;
				}
				sprite.onLoop = () => {
					if (this.dest.name !== 'unit' && this.dest.name !== 'building'){
						this.stop()
						return;
					}
					if (this.dest.life > 0){
						this.dest.life -= this.attack;
					}else{
						this.dest.die();
						if (this.type === 'Villager'){
							this.stop();
						}else{
							this.moveToNearestEnemy();
						}
					}
				}
				this.setAnimation('actionSheet');
				break;
			default: 
				this.stop()	
		}
	}
	moveToPath(){
		this.next = this.path[this.path.length - 1];
		const nextCell = this.parent.grid[this.next.i][this.next.j];
		let sprite = this.getChildByName('sprite');
		//Collision with another walking unit, we block the mouvement
		if (nextCell.has && nextCell.has.name === 'unit' && nextCell.has !== this
			&& nextCell.has.hasPath() && instancesDistance(this, nextCell.has, true) <= 1
			&& nextCell.has.getChildByName('sprite').playing){ 
			sprite.stop();
			return;
		}
		//Next cell is a solid
		if (this.action && instanceContactInstance(this, this.dest)){
			this.degree = getInstanceDegree(this, this.dest.x, this.dest.y);
			this.getAction(this.action);
		}else if (nextCell.solid && this.path.length === 1){
			const targets = findInstancesInSight(this, (cell) => cell.type === this.dest.type);
			if (targets.length){
				const target = getClosestInstanceWithPath(this, targets);
				if (target){ 
					this.inactif = false;
					this.dest = target.instance;
					this.path = target.path;
					return;
				}
			}
			this.stop();
			return;
		}

		if (!sprite.playing){
			sprite.play();
		}

		this.zIndex = getInstanceZIndex(this); 

		if (instancesDistance(this, this.next) < 10){
			clearCellOnInstanceSight(this);

			this.z = this.next.z;
			this.i = this.next.i;
			this.j = this.next.j;
	
			if (this.currentCell.has === this){
				this.currentCell.has = null;
				this.currentCell.solid = false;
			}
			this.currentCell = this.parent.grid[this.i][this.j];
			if (this.currentCell.has === null){
				this.currentCell.has = this;
				this.currentCell.solid = true;
			}
	
			renderCellOnInstanceSight(this);
			this.path.pop();

			if (this.action && instanceContactInstance(this, this.dest)){
				this.degree = getInstanceDegree(this, this.dest.x, this.dest.y);
				this.getAction(this.action);
			}else if (!this.path.length){
				this.stop()
			}
		}else{
			//Move to next
			const oldDeg = this.degree;
			let speed = this.speed;
			if (this.loading > 1){
				speed*=.75;
			}
			moveTowardPoint(this, this.next.x, this.next.y, speed);
			if (oldDeg !== this.degree){	
				//Change animation according to degree
				this.setAnimation('walkingSheet');
			}
		}
	}
	stop(){
		if (this.currentCell.has !== this && this.currentCell.solid){
			this.setDestination(this.currentCell);
			return;
		}
		this.inactif = true;
		this.action = null;
		this.currentCell.has = this;
		this.currentCell.solid = true;
		this.path = [];
		this.setAnimation('standingSheet');
	}
	step(){
		if (this.hasPath()){
			this.moveToPath();
		}
	}
	explore(){
		let dest;
		for (let i = 3; i < 50; i++){
			getCellsAroundPoint(this.i, this.j, this.parent.grid, i, (cell) => {
				if (!this.player.views[cell.i][cell.j].viewed && !cell.solid){
					dest = this.player.views[cell.i][cell.j];
					return;
				}
			});
			if (dest){
				this.setDestination(dest);
				break;
			}
		}
	}
	runaway(){
		let dest;
		for (let i = 5; i < 50; i++){
			getCellsAroundPoint(this.i, this.j, this.parent.grid, i, (cell) => {
				if (!cell.solid){
					dest = this.player.views[cell.i][cell.j];
					return;
				}
			});
			if (dest){
				this.setDestination(dest);
				break;
			}
		}
	}
	runaway(){
		let dest;
		for (let i = 5; i < 50; i++){
			getCellsAroundPoint(this.i, this.j, this.parent.grid, i, (cell) => {
				if (!cell.solid){
					dest = this.player.views[cell.i][cell.j];
					return;
				}
			});
			if (dest){
				this.setDestination(dest);
				break;
			}
		}
	}
	die(){
		if (this.currentSheet === 'dyingSheet'){
			return;
		}
		this.setAnimation('dyingSheet');
		let sprite = this.getChildByName('sprite');
		sprite.onLoop = () => {
			if (this.parent){
				this.parent.grid[this.i][this.j].has = null;
				this.parent.grid[this.i][this.j].solid = false;
	
				//Remove from player units
				let index = this.player.units.indexOf(this);
				if (index >= 0){
					this.player.units.splice(index, 1);
				}
				//Remove from player selected units
				if (this.player.selectedUnits){
					index = this.player.selectedUnits.indexOf(this);
					if (index >= 0){
						this.player.selectedUnits.splice(index, 1);
					}
				}

				this.parent.removeChild(this);
			}
		}
	}
	setAnimation(sheet){
		let sprite = this.getChildByName('sprite');
		//Sheet don't exist we just block the current sheet
		if (!this[sheet]){
			if (this.currentSheet !== 'walkingSheet' && this.walkingSheet){
				sprite.textures = [this.walkingSheet.textures[Object.keys(this.walkingSheet.textures)[0]]];
			}else{
				sprite.textures = [sprite.textures[sprite.currentFrame]];
			}
			this.currentSheet = 'walkingSheet';
			sprite.stop();
			sprite.anchor.set(sprite.textures[sprite.currentFrame].defaultAnchor.x, sprite.textures[[sprite.currentFrame]].defaultAnchor.y)
			return;
		}
		//Reset action loop
		if (sheet !== 'actionSheet'){
			sprite.onLoop = () => {};
		}
		this.currentSheet = sheet;
		sprite.animationSpeed = this[sheet].data.animationSpeed || ( sheet === 'standingSheet' ? .1 : .2);
		if (this.degree > 67.5 && this.degree < 112.5){
			sprite.scale.x = 1;
			sprite.textures = this[sheet].animations['north']
		}else if (this.degree > 247.5 && this.degree < 292.5){
			sprite.scale.x = 1;
			sprite.textures = this[sheet].animations['south']
		}else if (this.degree > 337.5 || this.degree < 22.5){
			sprite.scale.x = 1;			
			sprite.textures = this[sheet].animations['west']
		}else if (this.degree >= 22.5 && this.degree <= 67.5){
			sprite.scale.x = 1;
			sprite.textures = this[sheet].animations['northwest'];
		}else if (this.degree >= 292.5 && this.degree <= 337.5){
			sprite.scale.x = 1;			
			sprite.textures = this[sheet].animations['southwest'];
		}else if (this.degree > 157.5 && this.degree < 202.5){
			sprite.scale.x = -1;
			sprite.textures = this[sheet].animations['west'];
		}else if (this.degree > 112.5 && this.degree < 157.5){
			sprite.scale.x = -1;
			sprite.textures = this[sheet].animations['northwest'];
		}else if (this.degree > 202.5 && this.degree < 247.5){
			sprite.scale.x = -1;
			sprite.textures = this[sheet].animations['southwest'];
		}
		sprite.play();
	}
}

class Villager extends Unit {
	constructor(i, j, map, player){
		const data = empires.units['Villager'];
		super(i, j, map, player, {
			type: 'Villager',
			lifeMax: data.lifeMax,
			sight: data.sight,
			speed: data.speed,
			attack: data.attack,
			standingSheet: app.loader.resources['418'].spritesheet,
			walkingSheet: app.loader.resources['657'].spritesheet,
			dyingSheet: app.loader.resources['314'].spritesheet,
			interface: {
				info: (element) => {
					let img = document.createElement('img');
					img.id = 'icon';
					img.src = getIconPath(data.icon);
					element.appendChild(img);
				},
				menu: [
					{
						icon: 'data/interface/50721/002_50721.png',
						children : [
							map.interface.getBuildingButton(player, 'House'),
							map.interface.getBuildingButton(player, 'Barracks'),
							map.interface.getBuildingButton(player, 'Granary'),
							map.interface.getBuildingButton(player, 'StoragePit'),
						]
					},
				]
			}
		})
	}
	moveToNearestBerrybush(){
		const targets = findInstancesInSight(this, (instance) => instance.name === 'resource' && instance.type === 'Berrybush');
		if (targets.length){
			const target = getClosestInstanceWithPath(this, targets);
			if (target){
				this.inactif = false;
				this.dest = target.instance;
				this.path = target.path;
				return;
			}
		}
		this.stop()
	}
	moveToNearestConstruction(){
		const targets = findInstancesInSight(this, (instance) => instance.name === 'building' && !instance.isBuilt && instance.player === this.player);
		if (targets.length){
			const target = getClosestInstanceWithPath(this, targets);
			if (target){
				this.inactif = false;
				this.dest = target.instance;
				this.path = target.path;
				return;
			}
		}
		this.stop();
	}
	moveToNearestTree(){
		const targets = findInstancesInSight(this, (instance) => instance.name === 'resource' && instance.type === 'Tree' && instance.quantity > 0);
		if (targets.length){
			const target = getClosestInstanceWithPath(this, targets);
			if (target){
				this.inactif = false;
				this.dest = target.instance;
				this.path = target.path;
				return;
			}
		}
		this.stop();
	}
	sendToBuilding(building){
		if (this.work !== 'builder'){
			this.loading = 0;
			this.work = 'builder';
			this.actionSheet = app.loader.resources['628'].spritesheet;
			this.standingSheet = app.loader.resources['419'].spritesheet;
			this.walkingSheet = app.loader.resources['658'].spritesheet;
		}
		this.previousDest = null;
		return this.setDestination(building, 'build');
	}
	sendToTree(tree){
		if (this.work !== 'woodcutter'){
			this.loading = 0;
			this.work = 'woodcutter';
			this.actionSheet = app.loader.resources['625'].spritesheet;
			this.standingSheet = app.loader.resources['440'].spritesheet;
			this.walkingSheet = app.loader.resources['682'].spritesheet;
		}
		this.previousDest = null;
		return this.setDestination(tree, 'chopwood')
	}
	sendToBerrybush(berrybush){
		if (this.work !== 'gatherer'){
			this.loading = 0;
			this.work = 'gatherer';
			this.actionSheet = app.loader.resources['632'].spritesheet;
			this.standingSheet = app.loader.resources['432'].spritesheet;
			this.walkingSheet = app.loader.resources['672'].spritesheet;
		}
		this.previousDest = null;
		return this.setDestination(berrybush, 'forageberry')
	}
}

class Clubman extends Unit {
	constructor(i, j, map, player){
		const data = empires.units['Clubman'];
		super(i, j, map, player, {
			type: 'Clubman',
			lifeMax: data.lifeMax,
			sight: data.sight,
			speed: data.speed,
			attack: data.attack,
			standingSheet: app.loader.resources['425'].spritesheet,
			walkingSheet: app.loader.resources['664'].spritesheet,
			actionSheet: app.loader.resources['212'].spritesheet,
			interface: {
				info: (element) => {
					let img = document.createElement('img');
					img.id = 'icon';
					img.src = getIconPath(data.icon);
					element.appendChild(img);
				},
			}
		})
	}
}