class resource extends PIXI.Container{
	constructor(i, j, map, options){
		super();

		this.setParent(map);
		this.id = this.parent.children.length;
		this.name = 'resource';
		this.i = i;
		this.j = j;
		this.x = this.parent.grid[i][j].x;
		this.y = this.parent.grid[i][j].y;
		this.z = this.parent.grid[i][j].z;
		this.zIndex = getInstanceZIndex(this);
		this.parent.grid[i][j].has = this;

		this.visible = false;

		Object.keys(options).forEach((prop) => {
			this[prop] = options[prop];
		})

		//Set solid zone
		let cell = map.grid[i][j];
		cell.solid = true;
		
		if (this.sprite){
			//Change mouse icon if mouseover/mouseout events
			this.sprite.on('mouseover', () => { 
				if (this.parent.player.selectedUnits.length && this.visible){
					if (this.parent.player.selectedUnits.some(unit => unit.type === 'villager')){
						gamebox.setCursor('hover');
					}
				}
			})
			this.sprite.on('mouseout', () => {
				gamebox.setCursor('default');
			})

			this.addChild(this.sprite);
		}
	}
	destroy(){
		if (this.parent){
			const resIndex = this.parent.resources.indexOf(this);
			this.parent.grid[this.i][this.j].has = null;
			this.parent.grid[this.i][this.j].solid = false;
			this.parent.resources.splice(resIndex, 1);
			this.parent.removeChild(this);
		}
	}
}

class Tree extends resource{
	constructor(i, j, map){
		//Define sprite
		const randomSpritesheet = randomItem(['492', '493', '494', '503', '509']);
		const spritesheet = app.loader.resources[randomSpritesheet].spritesheet;
		const textureName = '000_' + randomSpritesheet + '.png';
		const texture = spritesheet.textures[textureName];
		let sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(spritesheet.data.frames[textureName].hitArea);
		sprite.on('pointerdown', () => {
			//If we are placing a building don't permit click
			if (mouseBuilding){
				return;
			}
			//Send villager to cut the tree
			let hasVillager = false;
			for(let i = 0; i < this.parent.player.selectedUnits.length; i++){
				let unit = this.parent.player.selectedUnits[i];
				if (unit.type === 'villager'){
					hasVillager = true;
					if (unit.work !== 'woodcutter'){
						unit.loading = 0;
						unit.work = 'woodcutter';
						unit.actionSheet = app.loader.resources['625'].spritesheet;
						unit.standingSheet = app.loader.resources['440'].spritesheet;
						unit.walkingSheet = app.loader.resources['682'].spritesheet;
					}
					unit.previousDest = null;
					unit.setDestination(this, 'chopwood')
				}else{
					unit.setDestination(this);
				}
			}
			if (hasVillager){
				drawInstanceBlinkingSelection(this);
			}
		})

		super(i, j, map, {
			type: 'tree',
			sprite: sprite,
			size: 1,
			quantity: 3,//300,
			life: 1//25,
		});
	}
}

class Berrybush extends resource{
	constructor(i, j, map){
		//Define sprite
		const spritesheet = app.loader.resources['240'].spritesheet;
		const texture = spritesheet.textures['000_240.png'];
		let sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(spritesheet.data.frames['000_240.png'].hitArea);
		sprite.on('pointerdown', () => {
			//If we are placing a building don't permit click
			if (mouseBuilding){
				return;
			}
			//Send villager to forage the berry
			let hasVillager = false;
			for(let i = 0; i < this.parent.player.selectedUnits.length; i++){
				let unit = this.parent.player.selectedUnits[i];
				if (unit.type === 'villager'){
					hasVillager = true;
					if (unit.work !== 'gatherer'){
						unit.loading = 0;
						unit.work = 'gatherer';
						unit.actionSheet = app.loader.resources['632'].spritesheet;
						unit.standingSheet = app.loader.resources['432'].spritesheet;
						unit.walkingSheet = app.loader.resources['672'].spritesheet;
					}
					unit.previousDest = null;
					unit.setDestination(this, 'forageberry')
				}else{
					unit.setDestination(this)
				}
			}
			if (hasVillager){
				drawInstanceBlinkingSelection(this);
			}
		})

		super(i, j, map, {
			type: 'berrybush',
			sprite: sprite,
			size: 1,
			quantity: 15,//200,
		});
	}
}