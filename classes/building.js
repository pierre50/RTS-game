class Building extends PIXI.Container {
	constructor(i, j, map, player, options = {}){
		super();

		this.setParent(map);
		this.id = this.parent.children.length;
        this.name = 'building';
		this.i = i;
		this.j = j;
		this.x = this.parent.grid[i][j].x;
		this.y = this.parent.grid[i][j].y;
		this.z = this.parent.grid[i][j].z;
		this.zIndex = getInstanceZIndex(this);
		this.player = player;
		this.selected = false;

		Object.keys(options).forEach((prop) => {
			this[prop] = options[prop];
		})

		this.life = this.isBuilt ? this.lifeMax : 1;

		//Set solid zone
		const dist = this.size === 3 ? 1 : 0;
		getPlainCellsAroundPoint(i, j, map.grid, dist, (cell) => {
			const set = cell.getChildByName('set');
			if (set){
				cell.removeChild(set);
			}
			cell.has = this;
			cell.solid = true;
		});
		
		if (this.sprite){
			this.addChild(this.sprite);
		}

		if (this.isBuilt && typeof this.onBuilt === 'function'){
			this.onBuilt(this);
		}

		if (!this.parent.revealEverything){
			renderCellOnInstanceSight(this);
		}
	}
	updateTexture(){
		if (!this.isBuilt){
			let sprite = this.getChildByName('sprite');
			const buildSpritesheetId = sprite.texture.textureCacheIds[0].split('_')[1].split('.')[0];
			const buildSpritesheet = app.loader.resources[buildSpritesheetId].spritesheet;
			let percentage = getPercentage(this.life, this.lifeMax);
			if (percentage >= 25 && percentage < 50){
				const textureName = `001_${buildSpritesheetId}.png`;
				sprite.texture = buildSpritesheet.textures[textureName];
			}
			if (percentage >= 50 && percentage < 75){
				const textureName = `002_${buildSpritesheetId}.png`;
				sprite.texture = buildSpritesheet.textures[textureName];
			}
			if (percentage >= 75 && percentage < 99){
				const textureName = `003_${buildSpritesheetId}.png`;
				sprite.texture = buildSpritesheet.textures[textureName];
			}
			if (percentage >= 100){
				if (typeof this.onBuilt === 'function'){
					this.onBuilt(this);
				}
			}
		}
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
		const path = [(-32*this.size), 0, 0,(-16*this.size), (32*this.size),0, 0,(16*this.size)];
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
}

class TownCenter extends Building {
	constructor(i, j, map, player, isBuilt = false){
		//Define sprite
		const finalSpritesheetId = '280';
		const buildSpritesheetId = '261';
		const colorSpritesheetId = '230';
		const spritesheetId = isBuilt ? finalSpritesheetId : buildSpritesheetId;
		const spritesheet = app.loader.resources[spritesheetId].spritesheet;
		const textureName = `000_${spritesheetId}.png`;
		const texture = spritesheet.textures[textureName];
		let sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(spritesheet.data.frames[textureName].hitArea);

		super(i, j, map, player, {
			type: 'towncenter',
			sprite,
			size: 3,
			sight: 7,
			isBuilt,
			lifeMax: 5,//600,
			onBuilt: (building) => {
				let sprite = building.getChildByName('sprite');
				const textureName = `000_${finalSpritesheetId}.png`;
				const finalSpritesheet = app.loader.resources[finalSpritesheetId].spritesheet;
				sprite.texture = finalSpritesheet.textures[textureName];
				sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y);

				const spritesheetColor = app.loader.resources[colorSpritesheetId].spritesheet;
				const textureNameColor = `000_${colorSpritesheetId}.png`;
				const textureColor = spritesheetColor.textures[textureNameColor];
				let spriteColor =new PIXI.Sprite(textureColor);
				spriteColor.name = 'color';
				building.addChild(spriteColor);	
			},
			interface: {
				icon: 'data/interface/50705/033_50705.png',
				menu: [
					{
						//Villager buy
						icon: 'data/interface/50730/000_50730.png',
						onClick: (selection) => {
							if (this.player.food > 30){
								this.player.food -= 30;
								this.parent.interface.updateTopbar();
								let spawnCell = getFreeCellAroundPoint(selection.i, selection.j, selection.parent.grid);
								this.player.createUnit(spawnCell.i, spawnCell.j, 'Villager', selection.parent);
							}
						}
					}
				]
			}
		});
	}
}

class Barracks extends Building {
	constructor(i, j, map, player, isBuilt = false){
		//Define sprite
		const finalSpritesheetId = '254';
		const buildSpritesheetId = '261';
		const spritesheetId = isBuilt ? finalSpritesheetId : buildSpritesheetId;
		const spritesheet = app.loader.resources[spritesheetId].spritesheet;
		const textureName = `000_${spritesheetId}.png`;
		const texture = spritesheet.textures[textureName];
		let sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(spritesheet.data.frames[textureName].hitArea);

		super(i, j, map, player, {
			type: 'barracks',
			sprite,
			size: 3,
			sight: 5,
			isBuilt,
			lifeMax: 5,//350,
			onBuilt: (building) => {
				let sprite = building.getChildByName('sprite');
				const textureName = `000_${finalSpritesheetId}.png`;
				const finalSpritesheet = app.loader.resources[finalSpritesheetId].spritesheet;
				sprite.texture = finalSpritesheet.textures[textureName];
				sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y);
			},
			interface: {
				icon: 'data/interface/50705/003_50705.png',
				menu: [
					{
						//Clubman buy
						icon: 'data/interface/50730/002_50730.png',
						onClick: (selection) => {
							if (this.player.food > 50){
								this.player.food -= 50;
								this.parent.interface.updateTopbar();
								let spawnCell = getFreeCellAroundPoint(selection.i, selection.j, selection.parent.grid);
								this.player.createUnit(spawnCell.i, spawnCell.j, 'Clubman', selection.parent);
							}
						}
					}
				]
			}
		});
	}
}

class House extends Building {
	constructor(i, j, map, player, isBuilt = false){
		//Define sprite
		const finalSpritesheetId = '218';
		const buildSpritesheetId = '489';
		const colorSpritesheetId = '233';
		const spritesheetId = isBuilt ? finalSpritesheetId : buildSpritesheetId;
		const spritesheet = app.loader.resources[spritesheetId].spritesheet;
		const textureName = `000_${spritesheetId}.png`;
		const texture = spritesheet.textures[textureName];
		let sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(spritesheet.data.frames[textureName].hitArea);

		super(i, j, map, player, {
			type: 'house',
			sprite,
			size: 1,
			sight: 3,
			isBuilt,
			lifeMax: 5,//75,
			onBuilt: (building) => {
				let sprite = building.getChildByName('sprite');
				const textureName = `000_${finalSpritesheetId}.png`;
				const finalSpritesheet = app.loader.resources[finalSpritesheetId].spritesheet;
				sprite.texture = finalSpritesheet.textures[textureName];
				sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y);

				const spritesheetColor = app.loader.resources[colorSpritesheetId].spritesheet;
				const textureNameColor = `000_${colorSpritesheetId}.png`;
				const textureColor = spritesheetColor.textures[textureNameColor];
				let spriteColor = new PIXI.Sprite(textureColor);
				spriteColor.name = 'color';
				building.addChild(spriteColor);	
				
				const spritesheetFire = app.loader.resources["347"].spritesheet;
				let spriteFire = new PIXI.AnimatedSprite(spritesheetFire.animations['fire']);
				spriteFire.name = 'fire';
				spriteFire.x = 10;
				spriteFire.y = 5;
				spriteFire.play();
				spriteFire.animationSpeed = .2;
				building.addChild(spriteFire);
			},
			interface: {
				icon: 'data/interface/50705/015_50705.png',
			}
		});
	}
}

class Granary extends Building {
	constructor(i, j, map, player, isBuilt = false){
		//Define sprite
		const finalSpritesheetId = '64';
		const buildSpritesheetId = '261';
		const colorSpritesheetId = '83';
		const spritesheetId = isBuilt ? finalSpritesheetId : buildSpritesheetId;
		const spritesheet = app.loader.resources[spritesheetId].spritesheet;
		const textureName = `000_${spritesheetId}.png`;
		const texture = spritesheet.textures[textureName];
		let sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(spritesheet.data.frames[textureName].hitArea);

		super(i, j, map, player, {
			type: 'granary',
			sprite,
			size: 3,
			sight: 5,
			isBuilt,
			lifeMax: 5,//350,
			onBuilt: (building) => {
				let sprite = building.getChildByName('sprite');
				const textureName = `000_${finalSpritesheetId}.png`;
				const finalSpritesheet = app.loader.resources[finalSpritesheetId].spritesheet;
				sprite.texture = finalSpritesheet.textures[textureName];
				sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y);

				const spritesheetColor = app.loader.resources[colorSpritesheetId].spritesheet;
				const textureNameColor = `000_${colorSpritesheetId}.png`;
				const textureColor = spritesheetColor.textures[textureNameColor];
				let spriteColor = new PIXI.Sprite(textureColor);
				spriteColor.name = 'color';
				building.addChild(spriteColor);
			},
			interface: {
				icon: 'data/interface/50705/011_50705.png',
			}
		});
	}
}

class StoragePit extends Building {
	constructor(i, j, map, player, isBuilt = false){
		//Define sprite
		const finalSpritesheetId = '527';
		const buildSpritesheetId = '261';
		const colorSpritesheetId = '235';
		const spritesheetId = isBuilt ? finalSpritesheetId : buildSpritesheetId;
		const spritesheet = app.loader.resources[spritesheetId].spritesheet;
		const textureName = `000_${spritesheetId}.png`;
		const texture = spritesheet.textures[textureName];
		let sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(spritesheet.data.frames[textureName].hitArea);

		super(i, j, map, player, {
			type: 'storagepit',
			sprite,
			size: 3,
			sight: 5,
			isBuilt,
			lifeMax: 5,//75,
			onBuilt: (building) => {
				let sprite = building.getChildByName('sprite');
				const textureName = `000_${finalSpritesheetId}.png`;
				const finalSpritesheet = app.loader.resources[finalSpritesheetId].spritesheet;
				sprite.texture = finalSpritesheet.textures[textureName];
				sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y);

				const spritesheetColor = app.loader.resources[colorSpritesheetId].spritesheet;
				const textureNameColor = `000_${colorSpritesheetId}.png`;
				const textureColor = spritesheetColor.textures[textureNameColor];
				let spriteColor = new PIXI.Sprite(textureColor);
				spriteColor.name = 'color';
				building.addChild(spriteColor);	
			},
			interface: {
				icon: 'data/interface/50705/028_50705.png',
			}
		});
	}
}