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
            player.views[cell.i][cell.j].viewBy.push(this);
            if (player.isPlayed && !this.parent.revealEverything){
                cell.removeFog();
            }
		});
		
		if (this.sprite){
			this.addChild(this.sprite);
		}

		if (this.isBuilt){
            this.updateTexture();
            if (typeof this.onBuilt === 'function'){
                this.onBuilt();
            }
		}
        renderCellOnInstanceSight(this);
    }
    updateTexture(){
        const sprite = this.getChildByName('sprite');
        const percentage = getPercentage(this.life, this.lifeMax);
        const buildSpritesheetId = sprite.texture.textureCacheIds[0].split('_')[1].split('.')[0];
        const buildSpritesheet = app.loader.resources[buildSpritesheetId].spritesheet;

        if (percentage >= 25 && percentage < 50){
            const textureName = `001_${buildSpritesheetId}.png`;
            sprite.texture = buildSpritesheet.textures[textureName];
        }else if (percentage >= 50 && percentage < 75){
            const textureName = `002_${buildSpritesheetId}.png`;
            sprite.texture = buildSpritesheet.textures[textureName];
        }else if (percentage >= 75 && percentage < 99){
            const textureName = `003_${buildSpritesheetId}.png`;
            sprite.texture = buildSpritesheet.textures[textureName];
        }else if (percentage >= 100){
            this.finalTexture();
        }
    }
	updateLife(action){
		if (this.life > this.lifeMax){
			this.life = this.lifeMax;
		}		
		const percentage = getPercentage(this.life, this.lifeMax);

		if (this.life <= 0){
			this.die();
		}
		if (action === 'build' && !this.isBuilt){
            if (this.player.isPlayed || instanceIsInPlayerSight(this, player) || this.parent.revealEverything){
                this.updateTexture();
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
				const fire = this.getChildByName('fire');
				if (fire){
					this.removeChild(fire);
				}
			}
		}
		function generateFire(building, spriteId){
			const fire = building.getChildByName('fire');
			const spritesheetFire = app.loader.resources[spriteId].spritesheet;
			if (fire){
				for (let i = 0; i < fire.children.length; i++){
					fire.children[i].textures = spritesheetFire.animations['fire'];
					fire.children[i].play();
				}
			}else{
				const newFire = new PIXI.Container();
				newFire.name = 'fire';
				let poses = [[0,0]]
				if (building.size === 3){
					poses = [[0,-32],[-64,0],[0,32],[64,0]];
				}
				for (let i = 0; i < poses.length; i++){
					const spriteFire = new PIXI.AnimatedSprite(spritesheetFire.animations['fire']);
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
            if (this.selected && player){
                player.unselectAll();
            }
			//Remove solid zone
			const dist = this.size === 3 ? 1 : 0;
			getPlainCellsAroundPoint(this.i, this.j, this.parent.grid, dist, (cell) => {
				cell.has = this;
				cell.solid = true;
			});
			//Remove from player buildings
			const index = this.player.buildings.indexOf(this);
			if (index >= 0){
				this.player.buildings.splice(index, 1);
			}
			//Remove from view of others players
			for (let i = 0; i < this.parent.players.length; i++){
				const list = this.parent.players[i].foundedEnemyBuildings;
				list.splice(list.indexOf(this), 1);
			}
			const rubble = new PIXI.Sprite(getTexture(data.images.rubble));
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
		const selection = new PIXI.Graphics();
		selection.name = 'selection';
		selection.zIndex = 3;
		selection.lineStyle(1, 0xffffff);
		const path = [(-32*this.size), 0, 0,(-16*this.size), (32*this.size),0, 0,(16*this.size)];
        selection.drawPolygon(path);
        if (this.loading && this.player.isPlayed){
            this.player.interface.updateInfo('loading', (element) => element.textContent = this.loading + '%');
        }
		this.addChildAt(selection, 0);
	}
	unselect(){
		this.selected = false;
		const selection = this.getChildByName('selection');
		if (selection){
			this.removeChild(selection);
		}
	}
	placeUnit(type){
		this.player.population++;
		const spawnCell = getFreeCellAroundPoint(this.i, this.j, this.parent.grid);
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
				let hasShowedMessage = false;
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
                    if (timesRun < 100){
						if (this.player.population < this.player.populationMax){
							timesRun += 1;
							this.loading = timesRun;
						}else if (this.player.isPlayed && !hasShowedMessage){
							this.player.interface.showMessage('You need to build more houses');
							hasShowedMessage = true;
						}
                    }
                    if (timesRun === 100){
                        this.placeUnit(type);
                        this.loading = null;
                        this.queue.shift();
                        if (this.queue.length){
                            this.buyUnit(this.queue[0], true);
                        }
                        clearInterval(interval);
						interval = null;
						hasShowedMessage = false;
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
	setDefaultInterface(element, data){
		const civ = document.createElement('div');
		civ.id = 'civ';
		civ.textContent = this.player.civ;
		element.appendChild(civ);

		const type = document.createElement('div');
		type.id = 'type';
		type.textContent = this.type;
		element.appendChild(type);

		const img = document.createElement('img');
		img.id = 'icon';
		img.src = getIconPath(data.icon);
		element.appendChild(img);

		const life = document.createElement('div');
		life.id = 'life';
		life.textContent = this.life + '/' + this.lifeMax;
		element.appendChild(life);

		if (this.player.isPlayed){
			const loading = document.createElement('div');
			loading.id = 'loading';
			loading.textContent = this.loading ? this.loading + '%': '';
			element.appendChild(loading);
		}
	}
}

class TownCenter extends Building {
	constructor(i, j, map, player, isBuilt = false){
		const type = 'TownCenter';
		const data = empires.buildings[player.civ][player.age][type];

		//Define sprite
		const texture = getTexture(data.images.build);
		const sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(texture.hitArea);

		super(i, j, map, player, {
			type,
			sprite,
			size: data.size,
			sight: data.sight,
			isBuilt,
			lifeMax: data.lifeMax,
			interface: {
				info: (element) => {
					this.setDefaultInterface(element, data);
				},
				menu: player.isPlayed ? [
					player.interface.getUnitButton('Villager')
				]: []
			}
		});
	}
	finalTexture(){
        const data = empires.buildings[this.player.civ][this.player.age][this.type];
        
		const sprite = this.getChildByName('sprite');
		sprite.texture = getTexture(data.images.final);
		sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y);
        
        const spriteColor = new PIXI.Sprite(getTexture(data.images.color));
        spriteColor.name = 'color';
        
        changeSpriteColor(spriteColor, this.player.color);
        
		this.addChildAt(spriteColor, 0);
	}
}

class Barracks extends Building {
	constructor(i, j, map, player, isBuilt = false){
		const type = 'Barracks';
		const data = empires.buildings[player.civ][player.age][type];

		//Define sprite
		const texture = getTexture(data.images.build);
		const sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(texture.hitArea);

		super(i, j, map, player, {
			type,
			sprite,
			size: data.size,
			sight: data.sight,
			isBuilt,
			lifeMax: data.lifeMax,
			interface: {
				info: (element) => {
					this.setDefaultInterface(element, data);
				},
				menu: player.isPlayed ? [
					player.interface.getUnitButton('Clubman')
				]: []
			}
		});
	}
	finalTexture(){
		const data = empires.buildings[this.player.civ][this.player.age][this.type];
        
        const sprite = this.getChildByName('sprite');
		sprite.texture = getTexture(data.images.final);
		changeSpriteColor(sprite, this.player.color);
		sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y);
	}
}

class House extends Building {
	constructor(i, j, map, player, isBuilt = false){
		const type = 'House';
		const data = empires.buildings[player.civ][player.age][type];

		//Define sprite
		const texture = getTexture(data.images.build);
		const sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(texture.hitArea);

		super(i, j, map, player, {
			type,
			sprite,
			size: data.size,
			sight: data.sight,
			isBuilt,
			lifeMax: data.lifeMax,
			interface: {
				info: (element) => {
					this.setDefaultInterface(element, data);

                    if (player.isPlayed && this.isBuilt){
						const population = document.createElement('div');
						population.id = 'population';
						population.textContent = player.population + '/' + player.populationMax;
						element.appendChild(population);
                    }
				}
			}
		});
    }
    finalTexture(){
		const data = empires.buildings[this.player.civ][this.player.age][this.type];

		const sprite = this.getChildByName('sprite');
		sprite.texture = getTexture(data.images.final);
		sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y);

		const spriteColor = new PIXI.Sprite(getTexture(data.images.color));
		spriteColor.name = 'color';
		changeSpriteColor(spriteColor, this.player.color);
		this.addChildAt(spriteColor, 0);	
		
		const spritesheetFire = app.loader.resources["347"].spritesheet;
		const spriteFire = new PIXI.AnimatedSprite(spritesheetFire.animations['fire']);
		spriteFire.name = 'deco';
		spriteFire.x = 10;
		spriteFire.y = 5;
		spriteFire.play();
		spriteFire.animationSpeed = .2;

		this.addChild(spriteFire);
    }
	onBuilt(){
		//Increase player population and continue all unit creation that was paused
		this.player.populationMax += 4;
		//Update bottombar with populationmax if house selected
		if (this.selected && this.player.isPlayed && player){
            player.interface.updateInfo('population', (element) => 
                element.textContent = player.population + '/' + player.populationMax
            );
		}
	}
}

class Granary extends Building {
	constructor(i, j, map, player, isBuilt = false){
		const type = 'Granary';
		const data = empires.buildings[player.civ][player.age][type];

		//Define sprite
		const texture = getTexture(data.images.build);
		const sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(texture.hitArea);

		super(i, j, map, player, {
			type,
			sprite,
			size: data.size,
			sight: data.sight,
			isBuilt,
			lifeMax: data.lifeMax,
			interface: {
				info: (element) => {
					this.setDefaultInterface(element, data);
				}
			}
		});
	}
	finalTexture(){
		const data = empires.buildings[this.player.civ][this.player.age][this.type];

		const sprite = this.getChildByName('sprite');
		sprite.texture = getTexture(data.images.final);
		sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y);

		const spriteColor = new PIXI.Sprite(getTexture(data.images.color));
		spriteColor.name = 'color';
		changeSpriteColor(spriteColor, this.player.color);
		this.addChildAt(spriteColor, 0);
	}
}

class StoragePit extends Building {
	constructor(i, j, map, player, isBuilt = false){
		const type = 'StoragePit';
		const data = empires.buildings[player.civ][player.age][type];

		//Define sprite
		const texture = getTexture(data.images.build);
		const sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(texture.hitArea);

		super(i, j, map, player, {
			type,
			sprite,
			size: data.size,
			sight: data.sight,
			isBuilt,
			lifeMax: data.lifeMax,
			interface: {
				info: (element) => {
					this.setDefaultInterface(element, data);
				}
			}
		});
	}
	finalTexture(){
		const data = empires.buildings[this.player.civ][this.player.age][this.type];
		
		const sprite = this.getChildByName('sprite');
		sprite.texture = getTexture(data.images.final);
		sprite.anchor.set(sprite.texture.defaultAnchor.x, sprite.texture.defaultAnchor.y);

		const spriteColor = new PIXI.Sprite(getTexture(data.images.color));
		spriteColor.name = 'color';
		changeSpriteColor(spriteColor, this.player.color);
		this.addChild(spriteColor);	
	}
}