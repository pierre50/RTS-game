class Ressource extends PIXI.Container{
	constructor(i, j, map, options){
		super();

		this.setParent(map);
		this.id = this.parent.children.length;
		this.name = 'ressource';
		this.i = i;
		this.j = j;
		this.x = this.parent.grid[i][j].x;
		this.y = this.parent.grid[i][j].y;
		this.z = this.parent.grid[i][j].z;
		this.zIndex = getInstanceZIndex(this);
		this.parent.grid[i][j].has = this;

		this.renderable = false;

		this.type = options.type;
		this.size = options.size;
		this.life = options.life;
		this.addChild(options.sprite);
	}
}

class Tree extends Ressource{
	constructor(i, j, map){
		//Define sprite
		const randomSpritesheet = randomItem(['492', '493', '494', '503', '509'])
		const spritesheet = app.loader.resources[randomSpritesheet].spritesheet;
		const textureName = '000_' + randomSpritesheet + '.png';
		const texture = spritesheet.textures[textureName];
		let sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(spritesheet.data.frames[textureName].hitArea);
		sprite.on('mouseover', () => { 
			if (this.parent.player.selectedUnits.length){
				if (this.parent.player.selectedUnits.some(unit => unit.type === 'villager')){
					gamebox.style.cursor = hoverIcon;
				}
			}
		})
		sprite.on('mouseout', () => {
			gamebox.style.cursor = defaultIcon;
		})
		sprite.on('click', () => {
			if (mouseBuilding){
				return;
			}
			if (this.parent.player.selectedUnits.length){
				if (this.parent.player.selectedUnits.some(unit => unit.type === 'villager')){
					drawInstanceBlinkingSelection(this);
				}
			}
			for(let i = 0; i < this.parent.player.selectedUnits.length; i++){
				let unit = this.parent.player.selectedUnits[i];
				if (unit.type === 'villager'){
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
					unit.setDestination(this)
				}
			}
		})
		//Set solid zone
		let cell = map.grid[i][j];
		cell.solid = true;

		super(i, j, map, {
			type: 'tree',
			sprite: sprite,
			size: 1,
			life: 200,
		});
	}
}

class Berrybush extends Ressource{
	constructor(i, j, map){
		//Define sprite
		const spritesheet = app.loader.resources['240'].spritesheet;
		const texture = spritesheet.textures['000_240.png'];
		let sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(spritesheet.data.frames['000_240.png'].hitArea);
		sprite.on('mouseover', () => { 
			if (this.parent.player.selectedUnits.length){
				if (this.parent.player.selectedUnits.some(unit => unit.type === 'villager')){
					gamebox.style.cursor = hoverIcon;
				}
			}
		})
		sprite.on('mouseout', () => {
			gamebox.style.cursor = defaultIcon;
		})
		sprite.on('click', () => {
			if (mouseBuilding){
				return;
			}
			if (this.parent.player.selectedUnits.length){
				drawInstanceBlinkingSelection(this);
			}
			for(let i = 0; i < this.parent.player.selectedUnits.length; i++){
				let unit = this.parent.player.selectedUnits[i];
				if (unit.type === 'villager'){
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
		})
		//Set solid zone
		let cell = map.grid[i][j];
		cell.solid = true;

		super(i, j, map, {
			type: 'berrybush',
			sprite: sprite,
			size: 1,
			life: 200,
		});
	}
}