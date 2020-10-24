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
		this.visible = false;

		Object.keys(options).forEach((prop) => {
			this[prop] = options[prop];
		})

		this.life = this.isBuilt ? this.lifeMax : 1;

		//Set solid zone
		const dist = this.size === 3 ? 1 : 0;
		getPlainCellsAroundPoint(i, j, map.grid, dist, (cell) => {
			const set = cell.getChildByName('set');
			if (set){ cell.removeChild(set); }
			const rubble = cell.getChildByName('rubble');
			cell.zIndex = 0;
			if (rubble){ cell.removeChild(rubble); }
			cell.has = this;
			cell.solid = true;
            player.views[cell.i][cell.j].viewedBy.push(this);
            if (player.isPlayed){
                cell.removeFog();
            }
		});
		
		if (this.sprite){
			this.addChild(this.sprite);
		}

		if (this.isBuilt && typeof this.onBuilt === 'function'){
			this.onBuilt();
			renderCellOnInstanceSight(this);
		}

	}
	updateTexture(action){
		if (this.life > this.lifeMax){
			this.life = this.lifeMax;
		}		
		const percentage = getPercentage(this.life, this.lifeMax);

		if (this.life <= 0){
			this.die();
		}
		if (action === 'build' && !this.isBuilt){
			let sprite = this.getChildByName('sprite');
			const buildSpritesheetId = sprite.texture.textureCacheIds[0].split('_')[1].split('.')[0];
			const buildSpritesheet = app.loader.resources[buildSpritesheetId].spritesheet;
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
                this.isBuilt = true;
                if (this.player && this.player.isPlayed && this.selected){
                    this.player.interface.setBottombar(this);
                }
				if (typeof this.onBuilt === 'function'){
					this.onBuilt();
                }
                renderCellOnInstanceSight(this);
			}
		}
		if ((action === 'attack' && this.isBuilt) || (action === 'build' && this.isBuilt)){
			if (percentage > 0 && percentage < 25){
				generateFire(this, 450);
			}
			if (percentage >= 25 && percentage < 50){
				generateFire(this, 452);
			}
			if (percentage >= 50 && percentage < 75){
				generateFire(this, 347);
			}
			if (percentage >= 75){
				let fire = this.getChildByName('fire');
				if (fire){
					this.removeChild(fire);
				}
			}
		}
		function generateFire(building, spriteId){
			let fire = building.getChildByName('fire');
			const spritesheetFire = app.loader.resources[spriteId].spritesheet;
			if (fire){
				for (let i = 0; i < fire.children.length; i++){
					fire.children[i].textures = spritesheetFire.animations['fire'];
					fire.children[i].play();
				}
			}else{
				let newFire = new PIXI.Container();
				newFire.name = 'fire';
				let poses = [[0,0]]
				if (building.size === 3){
					poses = [[0,-32],[-64,0],[0,32],[64,0]];
				}
				for (let i = 0; i < poses.length; i++){
					let spriteFire = new PIXI.AnimatedSprite(spritesheetFire.animations['fire']);
					spriteFire.x = poses[i][0];
					spriteFire.y = poses[i][1];
					spriteFire.play();
					spriteFire.animationSpeed = .2;
					newFire.addChild(spriteFire);
				}
				building.addChild(newFire);
			}
		}
	}
	die(){
		if (this.parent){
			const data = empires.buildings[this.player.civ][this.player.age][this.type];
			if (this.isPlayed){
				this.parent.interface.setBottombar();
			}
			//Remove solid zone
			const dist = this.size === 3 ? 1 : 0;
			getPlainCellsAroundPoint(this.i, this.j, this.parent.grid, dist, (cell) => {
				cell.has = this;
				cell.solid = true;
			});
			//Remove from player buildings
			let index = this.player.buildings.indexOf(this);
			if (index >= 0){
				this.player.buildings.splice(index, 1);
			}
			//Remove from player selected units
			if (this.player.selectedBuilding){
				this.player.selectedBuilding = null;
			}
			//Remove from view of others players
			for (let i = 0; i < this.parent.players.length; i++){
				let list = this.parent.players[i].foundedEnemyBuildings;
				list.splice(list.indexOf(this), 1);
			}
			let rubble = new PIXI.Sprite(getTexture(data.images.rubble));
			rubble.name = 'rubble';
			this.parent.grid[this.i][this.j].addChild(rubble);
			this.parent.grid[this.i][this.j].zIndex++;
			this.parent.removeChild(this);
		}
		clearCellOnInstanceSight(this);
		this.isDestroyed = true;
		this.destroy({ child: true, texture: true });
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
        if (this.loading){
            this.player.interface.updateInfo('loading', (element) => element.textContent = this.loading + '%');
        }
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
				this.player.selectedBuilding.player.interface.updateInfo('population', (element) => element.textContent = this.player.population + '/' + this.player.populationMax);
			}
		}
	}
	buyUnit(type, alreadyPaid = false){
		const unit = empires.units[type];
		if (this.isBuilt && (canAfford(this.player, unit.cost) || alreadyPaid)){
            if (!alreadyPaid){
                if (this.player.type === 'AI' && this.loading === null){
                    payCost(this.player, unit.cost);
                } else {
                    payCost(this.player, unit.cost);
                    this.queue.push(type);
                    if (this.selected && this.player.isPlayed){
                        this.player.interface.updateButton(type, (element) => element.textContent = this.queue.length);
                    }
                }
                if (this.player.isPlayed){
                    this.player.interface.updateTopbar();
                }
            }
            if (this.loading === null){
                let timesRun = 0;
                this.loading = 0;
                if (this.selected && this.player.isPlayed){
                    this.player.interface.updateInfo('loading', (element) => element.textContent = this.loading + '%');
                }
                let interval = setInterval(() => {
                    //Building is dead while buying unit
                    if (!this.parent){
                        clearInterval(interval);
                        return;
                    }
                    if (timesRun < 100 && this.player.population < this.player.populationMax){
                        timesRun += 1;
                        this.loading = timesRun;
                    }
                    if (timesRun === 100){
                        this.placeUnit(type);
                        this.loading = null;
                        this.queue.shift();
                        if (this.queue.length){
                            this.buyUnit(this.queue[0], true);
                        }
                        clearInterval(interval);
                        if (this.selected && this.player.isPlayed){
                            this.player.interface.updateButton(type, (element) => element.textContent = this.queue.length || '');
                            this.player.interface.updateInfo('loading', (element) => element.textContent = '');
                        }
                    }else if (this.selected && this.player.isPlayed){
                        this.player.interface.updateInfo('loading', (element) => element.textContent = this.loading + '%');
                    }
                }, (unit.trainingTime * 1000) / 100);
            }
		}
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
            
                    if (player.isPlayed){
                        let loading = document.createElement('div');
                        loading.id = 'loading';
                        loading.textContent = this.loading ? this.loading + '%': '';
                        element.appendChild(loading);
                    }
				},
				menu: player.isPlayed ? [
					player.interface.getUnitButton('Villager')
				]: []
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
                    
                    if (player.isPlayed){
                        let loading = document.createElement('div');
                        loading.id = 'loading';
                        loading.textContent = this.loading ? this.loading + '%': '';
                        element.appendChild(loading);
                    }
				},
				menu: player.isPlayed ? [
					player.interface.getUnitButton('Clubman')
				]: []
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

                    if (player.isPlayed){
                        if (this.isBuilt){
                            let population = document.createElement('div');
                            population.id = 'population';
                            population.textContent = player.population + '/' + player.populationMax;
                            element.appendChild(population);
                        }
                    }
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
		
		const spritesheetFire = app.loader.resources["347"].spritesheet;
		let spriteFire = new PIXI.AnimatedSprite(spritesheetFire.animations['fire']);
		spriteFire.name = 'deco';
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
		
		let sprite = this.getChildByName('sprite');
		sprite.texture = getTexture(data.images.final);
		sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y);

		let spriteColor = new PIXI.Sprite(getTexture(data.images.color));
		spriteColor.name = 'color';
		changeSpriteColor(spriteColor, this.player.color);
		this.addChild(spriteColor);	
	}
}