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
		this.queue = [];
		this.loading = null;
		this.visible = true;

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
			this.onBuilt();
		}

		//if (this.player.type === 'Human'){
			renderCellOnInstanceSight(this);
		//}
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
					this.onBuilt();
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
	placeUnit(type){
		this.player.population++;
		let spawnCell = getFreeCellAroundPoint(this.i, this.j, this.parent.grid);
		this.player.spawnUnit(spawnCell.i, spawnCell.j, type, this.parent);

		if (this.player.selectedBuilding){
			if (this.player.selectedBuilding.selected && this.player.selectedBuilding.type === 'House'){
				this.player.selectedBuilding.parent.interface.updateInfo('population', (element) => element.textContent = this.player.population + '/' + this.player.populationMax);
			}
		}
	}
	buyUnit(type){
		const unit = empires.units[type];
		if (this.isBuilt && canAfford(this.player, unit.cost)){	
			if (this.loading === null){
				let timesRun = 0;
				if (this.selected){
					this.parent.interface.updateInfo('loading', (element) => element.textContent = '0%');
				}
				if (this.player.population + 1 > this.player.populationMax ){
					return true;
				}
				this.loading = 0;
				let interval = setInterval(() => {
					timesRun += 1;
					this.loading = timesRun;
					if(timesRun === 100){
						payCost(this.player, unit.cost);
						this.parent.interface.updateTopbar();
						this.placeUnit(type)
						this.loading = null;
						this.queue.shift();
						if (this.queue.length){
							this.buyUnit(this.queue[0]);
						}
						clearInterval(interval);
						if (this.selected){
							this.parent.interface.updateButton(type,  (element) => element.textContent = this.queue.length);
							if (!this.queue.length){
								this.parent.interface.updateInfo('loading',  (element) => element.textContent = '');
							}
						}
						return;
					}
					if (this.selected){
						this.parent.interface.updateInfo('loading', (element) => element.textContent = this.loading + '%');
					}
				}, (unit.trainingTime * 1000) / 100);
			}
			return true;
		}
		return false;
	}
}

class TownCenter extends Building {
	constructor(i, j, map, player, isBuilt = false){
		const data = empires.buildings[player.civ][player.age]['TownCenter'];

		//Define sprite
		const texture = getTexture(data.images.build);
		let sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(texture.hitArea);

		super(i, j, map, player, {
			type: 'TownCenter',
			sprite,
			size: data.size,
			sight: data.sight,
			isBuilt,
			lifeMax: data.lifeMax,
			interface: {
				info: (element) => {
					let img = document.createElement('img');
					img.id = 'icon';
					img.src = getIconPath(data.icon);
					element.appendChild(img);
			
					let loading = document.createElement('div');
					loading.id = 'loading';
					loading.textContent = '';
					element.appendChild(loading);
				},
				menu: [
					map.interface.getUnitButton(player, 'Villager')
				]
			}
		});
	}
	onBuilt() {
		const data = empires.buildings[this.player.civ][this.player.age][this.type];

		let sprite = this.getChildByName('sprite');
		sprite.texture = getTexture(data.images.final);
		sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y);
		
		let spriteColor = new PIXI.Sprite(getTexture(data.images.color));
		spriteColor.name = 'color';
		changeSpriteColor(spriteColor, this.player.color);

		this.addChildAt(spriteColor, 0);	
	}
}

class Barracks extends Building {
	constructor(i, j, map, player, isBuilt = false){
		const data = empires.buildings[player.civ][player.age]['Barracks'];

		//Define sprite
		const texture = getTexture(data.images.build);
		let sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(texture.hitArea);

		super(i, j, map, player, {
			type: 'Barracks',
			sprite,
			size: data.size,
			sight: data.sight,
			isBuilt,
			lifeMax: data.lifeMax,
			interface: {
				info: (element) => {
					let img = document.createElement('img');
					img.id = 'icon';
					img.src = getIconPath(data.icon);
					element.appendChild(img);
			
					let loading = document.createElement('div');
					loading.id = 'loading';
					loading.textContent = '';
					element.appendChild(loading);
				},
				menu: [
					map.interface.getUnitButton(player, 'Clubman')
				]
			}
		});
	}
	onBuilt(){
		const data = empires.buildings[this.player.civ][this.player.age][this.type];
		let sprite = this.getChildByName('sprite');
		sprite.texture = getTexture(data.images.final);
		changeSpriteColor(sprite, this.player.color);
		sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y);
	}
}

class House extends Building {
	constructor(i, j, map, player, isBuilt = false){
		const data = empires.buildings[player.civ][player.age]['House'];

		//Define sprite
		const texture = getTexture(data.images.build);
		let sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(texture.hitArea);

		super(i, j, map, player, {
			type: 'House',
			sprite,
			size: data.size,
			sight: data.sight,
			isBuilt,
			lifeMax: data.lifeMax,
			interface: {
				info: (element) => {
					let img = document.createElement('img');
					img.id = 'icon';
					img.src = getIconPath(data.icon);
					element.appendChild(img);

					let population = document.createElement('div');
					population.id = 'population';
					population.textContent = player.population + '/' + player.populationMax;
					element.appendChild(population);
				}
			}
		});
	}
	onBuilt() {
		const data = empires.buildings[this.player.civ][this.player.age][this.type];
		let sprite = this.getChildByName('sprite');
		sprite.texture = getTexture(data.images.final);
		sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y);

		let spriteColor = new PIXI.Sprite(getTexture(data.images.color));
		spriteColor.name = 'color';
		changeSpriteColor(spriteColor, this.player.color);
		this.addChildAt(spriteColor, 0);	
		
		const spritesheetFire = app.loader.resources["347"].spritesheet;
		let spriteFire = new PIXI.AnimatedSprite(spritesheetFire.animations['fire']);
		spriteFire.name = 'fire';
		spriteFire.x = 10;
		spriteFire.y = 5;
		spriteFire.play();
		spriteFire.animationSpeed = .2;

		this.addChild(spriteFire);

		//Increase player population and continue all unit creation that was paused
		this.player.populationMax += 4;
		for (let i = 0; i < this.player.buildings.length; i++){
			let building = this.player.buildings[i];
			if (building.queue.length){
				building.buyUnit(building.queue[0]);
			}
		}
		//Update bottombar with populationmax if house selected
		if (this.player.selectedBuilding){
			if (this.player.selectedBuilding.selected && this.player.selectedBuilding.type === 'House'){
				this.player.selectedBuilding.parent.interface.updateInfo('population', (element) => 
					element.textContent = this.player.population + '/' + this.player.populationMax
				);
			}
		}
	}
}

class Granary extends Building {
	constructor(i, j, map, player, isBuilt = false){
		const data = empires.buildings[player.civ][player.age]['Granary'];

		//Define sprite
		const texture = getTexture(data.images.build);
		let sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(texture.hitArea);

		super(i, j, map, player, {
			type: 'Granary',
			sprite,
			size: data.size,
			sight: data.sight,
			isBuilt,
			lifeMax: data.lifeMax,
			interface: {
				info: (element) => {
					let img = document.createElement('img');
					img.id = 'icon';
					img.src = getIconPath(data.icon);
					element.appendChild(img);
				}
			}
		});
	}
	onBuilt(){
		const data = empires.buildings[this.player.civ][this.player.age][this.type];

		let sprite = this.getChildByName('sprite');
		sprite.texture = getTexture(data.images.final);
		sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y);

		let spriteColor = new PIXI.Sprite(getTexture(data.images.color));
		spriteColor.name = 'color';
		changeSpriteColor(spriteColor, this.player.color);
		this.addChildAt(spriteColor, 0);
	}
}

class StoragePit extends Building {
	constructor(i, j, map, player, isBuilt = false){
		const data = empires.buildings[player.civ][player.age]['StoragePit'];

		//Define sprite
		const texture = getTexture(data.images.build);
		let sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(texture.hitArea);

		super(i, j, map, player, {
			type: 'StoragePit',
			sprite,
			size: data.size,
			sight: data.sight,
			isBuilt,
			lifeMax: data.lifeMax,
			interface: {
				info: (element) => {
					let img = document.createElement('img');
					img.id = 'icon';
					img.src = getIconPath(data.icon);
					element.appendChild(img);
				}
			}
		});
	}
	onBuilt(){
		const data = empires.buildings[this.player.civ][this.player.age][this.type];
		
		let sprite = building.getChildByName('sprite');
		sprite.texture = getTexture(data.images.final);
		sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y);

		let spriteColor = new PIXI.Sprite(getTexture(data.images.color));
		spriteColor.name = 'color';
		changeSpriteColor(spriteColor, this.player.color);
		this.addChild(spriteColor);	
	}
}