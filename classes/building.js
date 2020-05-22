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
		this.parent.grid[i][j].has = this;
		this.player = player;
		this.selected = false;

		Object.keys(options).forEach((prop) => {
			this[prop] = options[prop];
		})

		this.life = this.isBuilt ? this.lifeMax : 1;

		//Set solid zone
		const dist = this.size === 3 ? 1 : 0;
		let neighbours = getCellsAroundPoint(i, j, map.grid, dist, false, true);
		for (let n = 0; n < neighbours.length; n ++){
			neighbours[n].solid = true;
			neighbours[n].has = this;
		}
		
		if (this.sprite){
			this.addChild(this.sprite);
		}
		if (this.spriteColor){
			this.addChild(this.spriteColor);
		}
		if (!this.parent.revealEverything){
			renderCellOnInstanceSight(this);
		}
	}
	updateTexture(){
		if (!this.isBuilt){
			const buildSpritesheet = app.loader.resources[this.buildSpritesheetId].spritesheet;
			const finalSpritesheet = app.loader.resources[this.finalSpritesheetId].spritesheet;
			let sprite = this.getChildByName('sprite');
			let percentage = getPercentage(this.life, this.lifeMax);
			if (percentage >= 25 && percentage < 50){
				const textureName = `001_${this.buildSpritesheetId}.png`;
				sprite.texture = buildSpritesheet.textures[textureName];
			}
			if (percentage >= 50 && percentage < 75){
				const textureName = `002_${this.buildSpritesheetId}.png`;
				sprite.texture = buildSpritesheet.textures[textureName];
			}
			if (percentage >= 75 && percentage < 99){
				const textureName = `003_${this.buildSpritesheetId}.png`;
				sprite.texture = buildSpritesheet.textures[textureName];
			}
			if (percentage >= 100){
				const textureName = `000_${this.finalSpritesheetId}.png`;
				sprite.texture = finalSpritesheet.textures[textureName];
				sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y);
				//Set the color sprite if exist
				if (this.colorSpritesheetId){
					const spritesheetColor = app.loader.resources[this.colorSpritesheetId].spritesheet;
					const textureNameColor = `000_${this.colorSpritesheetId}.png`;
					const textureColor = spritesheetColor.textures[textureNameColor];
					this.addChild(new PIXI.Sprite(textureColor));	
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
		//Set player color
		let spriteColor;
		if (isBuilt){
			const spritesheetColor = app.loader.resources[colorSpritesheetId].spritesheet;
			const textureNameColor = `000_${colorSpritesheetId}.png`;
			const textureColor = spritesheetColor.textures[textureNameColor];
			spriteColor = new PIXI.Sprite(textureColor);	
		}

		super(i, j, map, player, {
			type: 'towncenter',
			sprite,
			size: 3,
			sight: 7,
			isBuilt,
			spriteColor,
			finalSpritesheetId,
			buildSpritesheetId,
			colorSpritesheetId,
			lifeMax: 1,//600,
			interface: {
				icon: 'assets/images/interface/50705/033_50705.png',
				menu: [
					{
						//Villager buy
						icon: 'assets/images/interface/50730/000_50730.png',
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
			finalSpritesheetId,
			buildSpritesheetId,
			lifeMax: 5,//350,
			interface: {
				icon: 'assets/images/interface/50705/003_50705.png',
				menu: [
					{
						//Clubman buy
						icon: 'assets/images/interface/50730/002_50730.png',
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

		//Set player color
		let spriteColor;
		if (isBuilt){
			const spritesheetColor = app.loader.resources[colorSpritesheetId].spritesheet;
			const textureNameColor = `000_${colorSpritesheetId}.png`;
			const textureColor = spritesheetColor.textures[textureNameColor];
			spriteColor = new PIXI.Sprite(textureColor);	
		}

		super(i, j, map, player, {
			type: 'house',
			sprite,
			size: 1,
			sight: 3,
			isBuilt,
			spriteColor,
			finalSpritesheetId,
			buildSpritesheetId,
			colorSpritesheetId,
			lifeMax: 75,
			interface: {
				icon: 'assets/images/interface/50705/015_50705.png',
			}
		});
	}
}