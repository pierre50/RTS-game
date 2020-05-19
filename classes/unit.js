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
		this.parent.grid[i][j].solid = true;
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
		this.old = {...this};

		Object.keys(options).forEach((prop) => {
			this[prop] = options[prop];
		})

		this.originalSpeed = this.speed;		
		this.actionSheet = null;
		this.deliverySheet = null;

		let sprite = new PIXI.AnimatedSprite(this.standingSheet.animations['south']);
		sprite.name = 'sprite';
		sprite.updateAnchor = true;
		this.addChild(sprite);
		this.setAnimation('standingSheet');
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
		selection.drawEllipse(0, 0, this.width - 5, 10);
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
	setDestination(instance, action){
		if (!instance){
			this.setAnimation('standingSheet');
			return;
		}
		this.getChildByName('sprite').onLoop = null;
		if (!action){
			this.dest = null;
			this.previousDest = null;
		}
		if (!this.hasPath()){
			this.parent.grid[this.i][this.j].solid = false;
		}
		if (this.parent.grid[instance.i][instance.j].solid){
			this.path = getInstanceClosestFreeCellPath(this, instance.i, instance.j, this.parent);
		}else{
			this.path = getInstancePath(this, instance.i, instance.j, this.parent);
		}

		if (this.path.length){
			this.dest = instance;
			this.action = action;
			this.setAnimation('walkingSheet');
		}else{
			this.parent.grid[this.i][this.j].solid = true;
			this.setAnimation('standingSheet');
		}
	}
	getAction(name){
		let sprite = this.getChildByName('sprite');
		switch (name){
			case 'chopwood':
				if (this.dest.type !== 'tree'){
					this.setAnimation('standingSheet');
					return;
				}
				sprite.onLoop = () => {
					if (this.loading === this.maxLoading){
						let targets = filterInstancesByTypes(this.player.buildings, ['towncenter']);
						let target = getClosestInstance(this, targets);
						this.previousDest = { i: this.dest.i, j: this.dest.j };
						this.setDestination(target, 'deliverywood');
					}else{
						this.loading++;
						this.dest.life--;
						if (this.loading > 1){
							this.walkingSheet = app.loader.resources['273'].spritesheet;
							this.standingSheet = null;
						}
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
					let previousCell = this.parent.grid[this.previousDest.i][this.previousDest.j];
					if (previousCell.has && previousCell.has.type === 'tree'){
						this.setDestination(previousCell.has, 'chopwood');
					}else{
						//TODO FIND ANOTHER TREE
					}
				}else{
					this.setAnimation('standingSheet');
				}
				break;
			case 'forageberry':
				if (this.dest.type !== 'berrybush'){
					this.setAnimation('standingSheet');
					return;
				}
				sprite.onLoop = () => {
					if (this.loading === this.maxLoading){
						let targets = filterInstancesByTypes(this.player.buildings, ['towncenter']);
						let target = getClosestInstance(this, targets);
						this.previousDest = { i: this.dest.i, j: this.dest.j };
						this.setDestination(target, 'deliveryberry');
					}else{
						this.loading++;
						this.dest.life--;
					}
				}
				this.setAnimation('actionSheet');
				break;
			case 'deliveryberry':
				this.player.food += this.loading;
				this.parent.interface.updateTopbar();
				this.loading = 0;
				if (this.previousDest){
					let previousCell = this.parent.grid[this.previousDest.i][this.previousDest.j];
					if (previousCell.has && previousCell.has.type === 'berrybush'){
						this.setDestination(previousCell.has, 'forageberry');
					}else{
						//TODO FIND ANOTHER BUSH
					}
				}else{
					this.setAnimation('standingSheet');
				}
				break;
			case 'build':
				sprite.onLoop = () => {
					if (this.dest.name !== 'building'){
						this.setAnimation('standingSheet');
						return;
					}
					if (this.dest.life < this.dest.lifeMax){
						this.dest.life++;
						this.dest.updateTexture();
					}else{
						if (!this.dest.isBuilt){
							this.dest.updateTexture();
							this.dest.isBuilt = true;
						}
						this.setAnimation('standingSheet');	
						//TODO FIND ANOTHER CONSTRUCTION
					}
		
				}
				this.setAnimation('actionSheet');
				break;
			default: 
				this.setAnimation('standingSheet');	
		}
	}
	moveToPath(){
		this.next = this.path[this.path.length - 1];
		if (this.path.length === 1 && this.parent.grid[this.next.i][this.next.j].solid){
			if (this.work && this.action){
				let targets = [];
				let target = null;
				switch(this.action){
					case 'chopwood' :
						targets = filterInstancesByTypes(this.parent.resources, ['tree']);
						target = getClosestInstance(this, targets);
						this.setDestination(target, 'chopwood');
						break;
					case 'forageberry':
						targets = filterInstancesByTypes(this.parent.resources, ['berrybush']);
						target = getClosestInstance(this, targets);
						this.setDestination(target, 'forageberry');
						break;
					default: 
						this.path = getInstanceClosestFreeCellPath(this, this.dest.i, this.dest.j, this.parent);
				}
				return;
			}else{
				this.path = getInstanceClosestFreeCellPath(this, this.dest.i, this.dest.j, this.parent);
			}
			return;
		}
		this.zIndex = getInstanceZIndex(this); 
		if (instancesDistance(this, this.next) < this.speed){
			this.x = this.next.x;
			this.y = this.next.y;
			this.z = this.next.z;
			this.i = this.next.i;
			this.j = this.next.j;
			if (this.parent.grid[this.i][this.j].inclined){
				this.speed = this.originalSpeed / 1.30;
			}else{
				this.speed = this.originalSpeed;
			}
			this.zIndex = getInstanceZIndex(this); 
			this.path.pop();
			if (!this.path.length){
				this.parent.grid[this.i][this.j].solid = true;
				if (this.action && instanceContactInstance(this, this.dest)){
					this.degree = getInstanceDegree(this, this.dest.x, this.dest.y);
					this.getAction(this.action);
				}else{
					this.setAnimation('standingSheet');
				}
				return;
			}
		}else{
			moveTowardPoint(this, this.next.x, this.next.y, this.speed);
			if (this.old.degree !== this.degree){	
				//Change animation
				this.setAnimation('walkingSheet');
			}
		}
	}
	step(){
		if (this.hasPath()){
			this.moveToPath();
		}
		this.old = {...this}
	}
	setAnimation(sheet){
		let sprite = this.getChildByName('sprite');
		if (!this[sheet]){
			sprite.textures = [sprite.textures[sprite.currentFrame]];
			return;
		}
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
		super(i, j, map, player, {
			type: 'villager',
			lifeMax: 25,
			speed: 1.1,
			standingSheet: app.loader.resources['418'].spritesheet,
			walkingSheet: app.loader.resources['657'].spritesheet,
			interface: {
				icon: 'assets/images/interface/50730/000_50730.png',
				menu: [
					{
						icon: 'assets/images/interface/50721/002_50721.png',
						children : [
							{
								//House buy
								icon: 'assets/images/interface/50705/015_50705.png',
								onClick: (selection) => {
									if (this.player.wood > 50){
										const spritesheet = app.loader.resources['489'].spritesheet;
										const textureName = '000_489.png';
										const texture = spritesheet.textures[textureName];
										map.interface.setMouseBuilding({
											size: 1,
											texture,
											type: 'House',
											onClick: () => {
												this.player.wood -= 50; 
												this.parent.interface.updateTopbar();
											}
										})
									}
								}
							},
							{
								//Barracks buy
								icon: 'assets/images/interface/50705/003_50705.png',
								onClick: (selection) => {
									if (this.player.wood > 125){
										const spritesheet = app.loader.resources['254'].spritesheet;
										const textureName = '000_254.png';
										const texture = spritesheet.textures[textureName];
										map.interface.setMouseBuilding({
											size: 2,
											texture,
											type: 'Barracks',
											onClick: () => {
												this.player.wood -= 125; 
												this.parent.interface.updateTopbar();
											}
										})
									}
								}
							},
							{
								//Towncenter buy
								icon: 'assets/images/interface/50705/033_50705.png',
								onClick: (selection) => {
									if (this.player.wood > 200){
										const spritesheet = app.loader.resources['280'].spritesheet;
										const textureName = '000_280.png';
										const texture = spritesheet.textures[textureName];
										map.interface.setMouseBuilding({
											size: 2,
											texture,
											type: 'TownCenter',
											onClick: () => {
												this.player.wood -= 200; 
												this.parent.interface.updateTopbar();
											}
										})
									}
								}
							}
						]
					},
				]
			}
		})
	}
}

class Clubman extends Unit {
	constructor(i, j, map, player){
		super(i, j, map, player, {
			type: 'clubman',
			lifeMax: 40,
			speed: 1.2,
			standingSheet: app.loader.resources['425'].spritesheet,
			walkingSheet: app.loader.resources['664'].spritesheet,
			actionSheet: app.loader.resources['212'].spritesheet,
			interface: {
				icon: 'assets/images/interface/50730/002_50730.png',
			}
		})
	}
}