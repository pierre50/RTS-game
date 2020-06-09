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
		cell.has = this;
		
		if (this.sprite){
			//Change mouse icon if mouseover/mouseout events
			this.sprite.on('mouseover', () => { 
				if (this.parent.player.selectedUnits.length && this.visible){
					if (this.parent.player.selectedUnits.some(unit => unit.type === 'Villager')){
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
	die(){
		if (this.parent){
			if (typeof this.onDie === 'function'){
				this.onDie();
			}
			let listName = 'founded' + this.type + 's';
			for (let i = 0; i < this.parent.players.length; i++){
				let list = this.parent.players[i][listName];
				let index = list.indexOf(this);
				list.splice(index, 1);
			}
			this.parent.grid[this.i][this.j].has = null;
			this.parent.grid[this.i][this.j].solid = false;
			this.parent.removeChild(this);
			this.destroy();
		}
	}
}

class Tree extends resource{
	constructor(i, j, map, textureNames){
		//Define sprite
		const randomSpritesheet = randomItem(textureNames);
		const spritesheet = app.loader.resources[randomSpritesheet].spritesheet;
		const textureName = '000_' + randomSpritesheet + '.png';
		const texture = spritesheet.textures[textureName];
		let sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(spritesheet.data.frames[textureName].hitArea);
		sprite.on('pointerup', () => {
			//If we are placing a building don't permit click
			if (mouseBuilding){
				return;
			}
			//Send Villager to cut the tree
			let hasVillager = false;
			let dest = this;
			for(let i = 0; i < map.player.selectedUnits.length; i++){
				let unit = map.player.selectedUnits[i];
				if (instanceIsSurroundedBySolid(this)){
					let newDest = getNewInstanceClosestFreeCellPath(unit, this, this.parent);
					if (newDest){
						dest = newDest.target;
					}
				}
				if (unit.type === 'Villager'){
					hasVillager = true;
					unit.sendToTree(dest);
				}else{
					unit.sendTo(dest);
				}
			}
			if (hasVillager){
				drawInstanceBlinkingSelection(dest);
			}
		})

		super(i, j, map, {
			type: 'Tree',
			sprite: sprite,
			size: 1,
			quantity: 300,
			life: 25,
		});
	}
	onDie(){
		const spritesheet = app.loader.resources['623'].spritesheet;
		const textureName = `00${randomRange(0,3)}_623.png`;
		const texture = spritesheet.textures[textureName];
		let sprite = new PIXI.Sprite(texture);
		sprite.name = 'stump';
		this.parent.grid[this.i][this.j].addChild(sprite);
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
		sprite.on('pointerup', () => {
			//If we are placing a building don't permit click
			if (mouseBuilding){
				return;
			}
			//Send Villager to forage the berry
			let hasVillager = false;
			for(let i = 0; i < map.player.selectedUnits.length; i++){
				let unit = map.player.selectedUnits[i];
				if (unit.type === 'Villager'){
					hasVillager = true;
					unit.sendToBerrybush(this);
				}else{
					unit.sendTo(this)
				}
			}
			if (hasVillager){
				drawInstanceBlinkingSelection(this);
			}
		})

		super(i, j, map, {
			type: 'Berrybush',
			sprite: sprite,
			size: 1,
			quantity: 200,
		});
	}
}