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
		this.dest = null;
		this.realDest = null;
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
		this.loadingMax = 10;
		this.currentSheet = null;
		this.size = 1;
		this.visible = false;
		this.currentCell = this.parent.grid[this.i][this.j];
		this.currentCell.has = this;
		this.currentCell.solid = true;

		Object.keys(options).forEach((prop) => {
			this[prop] = options[prop];
		})

		this.life = this.lifeMax;
		
		this.originalSpeed = this.speed;		
		this.inactif = true;

		const sprite = new PIXI.AnimatedSprite(this.standingSheet.animations['south']);
		sprite.name = 'sprite';
		sprite.on('mouseover', () => { 
			mouse.hover = this;
		})
		sprite.on('mouseout', () => {
			mouse.hover = null;
		})
		changeSpriteColor(sprite, player.color);

		this.interval = setInterval(() => this.step(), 15);
		sprite.updateAnchor = true;
		this.addChild(sprite);
		this.stop();

		renderCellOnInstanceSight(this);
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
		const path = [(-32*.5), 0, 0,(-16*.5), (32*.5),0, 0,(16*.5)];
		selection.drawPolygon(path);
		this.addChildAt(selection, 0);
	}
	unselect(){
		this.selected = false;
		const selection = this.getChildByName('selection');
		if (selection){
			this.removeChild(selection);
		}
	}
	hasPath(){
		return this.path.length > 0;
	}
	setDest(dest){
		if (!dest){
			this.stop();
			return;
		}
		this.dest = dest;
		this.realDest = {
			i: dest.i,
			j: dest.j
		}
	}
	setPath(path){
		if (!path.length){
			this.stop();
			return;
		}
		this.inactif = false;
		this.setTextures('walkingSheet');
		this.path = path;
	}
	sendTo(dest, action){
		let path = [];
		//No instance we cancel the destination
		if (!dest){
			return false;
		}
		//Unit is already beside our target
		if (action && instanceContactInstance(this, dest)){
			this.setDest(dest);
			this.action = action;
			this.degree = getInstanceDegree(this, dest.x, dest.y);
			this.getAction(action);
			return true;
		}
		//Set unit path
		if (this.parent.grid[dest.i][dest.j].solid){
			path = getInstanceClosestFreeCellPath(this, dest, this.parent);
			if (!path.length && this.work){
				this.action = action;
				this.affectNewDest();
				return;
			}
		}else{
			path = getInstancePath(this, dest.i, dest.j, this.parent);
		}
		//Unit found a path, set the action and play walking animation
		if (path.length){
			this.setDest(dest);
			this.action = action;
			this.setPath(path);
			return true;
		}
		this.stop();
		return false;
	}
	getActionCondition(target){
		if (!this.action){
			return;
		}
		const conditions = {
			'chopwood': (instance) => instance && instance.type === 'Tree' && instance.quantity > 0 && !instance.isDestroyed,
			'forageberry': (instance) => instance && instance.type === 'Berrybush' && instance.quantity > 0 && !instance.isDestroyed,
			'minestone': (instance) => instance && instance.type === 'Stone' && instance.quantity > 0 && !instance.isDestroyed,
			'minegold': (instance) => instance && instance.type === 'Gold' && instance.quantity > 0 && !instance.isDestroyed,
			'build': (instance) => instance && instance.player === this.player && instance.name === 'building' && instance.life > 0 && (!instance.isBuilt || instance.life < instance.lifeMax) && !instance.isDestroyed,
			'attack': (instance) => instance && instance.player !== this.player && (instance.name === 'building' || instance.name === 'unit') && instance.life > 0 && !instance.isDestroyed
		}
		return conditions[this.action] ? conditions[this.action](target) : this.stop();
	}
	getAction(name){
		const sprite = this.getChildByName('sprite');
		if (!sprite){
			return;
		}
		switch (name){
			case 'chopwood':
				if (!this.getActionCondition(this.dest)){
					this.affectNewDest();
					return;
				}
				sprite.onLoop = () => {
					if (!this.getActionCondition(this.dest)){
						this.affectNewDest();
						return;
					}
					//Villager is full we send him delivery first
					if (this.loading === this.loadingMax || !this.dest){
						this.sendToDelivery('StoragePit', 'deliverywood');
						return;
					}
					//Tree destination is still alive we cut him until it's dead
					if (this.dest.life > 0){
						this.dest.life -= this.attack;
						if (this.dest.selected && player){
                            player.interface.updateInfo('life', (element) => this.dest.life > 0 ? (element.textContent = this.dest.life + '/' + this.dest.lifeMax) : (element.textContent = ''));
                        }
						if (this.dest.life <= 0){
							//Set cutted tree texture
							this.dest.life = 0;
							if (instanceIsInPlayerSight(this.dest, player)){
								this.setCuttedTreeTexture();
							}
						}
						return;
					}
					//Villager cut the stump
					this.loading++;
					this.updateInterfaceLoading();

					this.dest.quantity--;
					if (this.dest.selected && player){
						player.interface.updateInfo('quantity-text', (element) => element.textContent = this.dest.quantity);
					}
					//Destroy tree if stump out of quantity
					if (this.dest.quantity <= 0){
						this.dest.die();
						this.affectNewDest();
					}
					//Set the walking with wood animation
					if (this.loading > 1){
						this.walkingSheet = app.loader.resources['273'].spritesheet;
						this.standingSheet = null;
					}
				}
				this.setTextures('actionSheet');
				break;
			case 'deliverywood':
				this.player.wood += this.loading;
				if (this.player.isPlayed){
					this.player.interface.updateTopbar();
				}
				this.loading = 0;
				this.updateInterfaceLoading();

				this.walkingSheet = app.loader.resources['682'].spritesheet;
				this.standingSheet = app.loader.resources['440'].spritesheet;
				if (this.previousDest){
					this.sendTo(this.previousDest, 'chopwood');
				}else{
					this.stop()
				}
				break;
			case 'forageberry':
				if (!this.getActionCondition(this.dest)){
					this.affectNewDest();
					return;
				}
				sprite.onLoop = () => {
					if (!this.getActionCondition(this.dest)){
						this.affectNewDest();
						return;
					}
					//Villager is full we send him delivery first
					if (this.loading === this.loadingMax || !this.dest){
						this.sendToDelivery('Granary', 'deliveryberry');
						return;
					}
					//Villager forage the berrybush
					this.loading++;
					this.updateInterfaceLoading();

					this.dest.quantity--;
					if (this.dest.selected && player){
						player.interface.updateInfo('quantity-text', (element) => element.textContent = this.dest.quantity);
					}
					//Destroy berrybush if it out of quantity
					if (this.dest.quantity <= 0){
						this.dest.die();
						this.affectNewDest();
					}
				}
				this.setTextures('actionSheet');
				break;
			case 'deliveryberry':
				this.player.food += this.loading;
				if (this.player.isPlayed){
					this.player.interface.updateTopbar();
				}
				this.loading = 0;
				this.updateInterfaceLoading();

				if (this.previousDest){
					this.sendTo(this.previousDest, 'forageberry');
				}else{
					this.stop()
				}
				break;
			case 'minestone':
				if (!this.getActionCondition(this.dest)){
					this.affectNewDest();
					return;
				}
				sprite.onLoop = () => {
					if (!this.getActionCondition(this.dest)){
						this.affectNewDest();
						return;
					}
					//Villager is full we send him delivery first
					if (this.loading === this.loadingMax || !this.dest){
						this.sendToDelivery('StoragePit', 'deliverystone');
						return;
					}
					//Villager mine the stone
					this.loading++;
					this.updateInterfaceLoading();

					this.dest.quantity--;
					if (this.dest.selected && player){
						player.interface.updateInfo('quantity-text', (element) => element.textContent = this.dest.quantity);
					}
					//Destroy stone if it out of quantity
					if (this.dest.quantity <= 0){
						this.dest.die();
						this.affectNewDest();
					}
					//Set the walking with stone animation
					if (this.loading > 1){
						this.walkingSheet = app.loader.resources['274'].spritesheet;
						this.standingSheet = null;
					}
				}
				this.setTextures('actionSheet');
				break;
			case 'deliverystone':
				this.player.stone += this.loading;
				if (this.player.isPlayed){
					this.player.interface.updateTopbar();
				}
				this.loading = 0;
				this.updateInterfaceLoading();

				this.walkingSheet = app.loader.resources['683'].spritesheet;
				this.standingSheet = app.loader.resources['441'].spritesheet;
				if (this.previousDest){
					this.sendTo(this.previousDest, 'minestone');
				}else{
					this.stop()
				}
				break;
			case 'minegold':
				if (!this.getActionCondition(this.dest)){
					this.affectNewDest();
					return;
				}
				sprite.onLoop = () => {
					if (!this.getActionCondition(this.dest)){
						this.affectNewDest();
						return;
					}
					//Villager is full we send him delivery first
					if (this.loading === this.loadingMax || !this.dest){
						this.sendToDelivery('StoragePit', 'deliverygold');
						return;
					}
					//Villager mine the gold
					this.loading++;
					this.updateInterfaceLoading();

					this.dest.quantity--;
					if (this.dest.selected && player){
						player.interface.updateInfo('quantity-text', (element) => element.textContent = this.dest.quantity);
					}
					//Destroy gold if it out of quantity
					if (this.dest.quantity <= 0){
						this.dest.die();
						this.affectNewDest();
					}
					//Set the walking with gold animation
					if (this.loading > 1){
						this.walkingSheet = app.loader.resources['281'].spritesheet;
						this.standingSheet = null;
					}
				}
				this.setTextures('actionSheet');
				break;
			case 'deliverygold':
				this.player.gold += this.loading;
				if (this.player.isPlayed){
					this.player.interface.updateTopbar();
				}
				this.loading = 0;
				this.updateInterfaceLoading();

				this.walkingSheet = app.loader.resources['683'].spritesheet;
				this.standingSheet = app.loader.resources['441'].spritesheet;
				if (this.previousDest){
					this.sendTo(this.previousDest, 'minegold');
				}else{
					this.stop()
				}
				break;
			case 'build':
				if (!this.getActionCondition(this.dest)){
					this.affectNewDest();
					return;
				}
				sprite.onLoop = () => {
					if (!this.getActionCondition(this.dest)){
						this.affectNewDest();
						return;
					}
					if (this.dest.life < this.dest.lifeMax){
                        this.dest.life += this.attack;
                        if (this.dest.selected && player){
                            player.interface.updateInfo('life', (element) => element.textContent = Math.min(this.dest.life, this.dest.lifeMax) + '/' + this.dest.lifeMax);
                        }
						this.dest.updateLife(this.action);
					}else{
						if (!this.dest.isBuilt){
							this.dest.updateLife(this.action);
							this.dest.isBuilt = true;
						}
						this.affectNewDest();
					}
				}
				this.setTextures('actionSheet');
				break;
			case 'attack':
				if (!this.getActionCondition(this.dest)){
					this.affectNewDest();
					return;
				}
				sprite.onLoop = () => {
					if (!this.getActionCondition(this.dest)){
						this.affectNewDest();
						return;
					}
					if (!instanceContactInstance(this, this.dest)){
						this.sendTo(this.dest, 'attack');
						return;
					}
					if (this.dest.life > 0){
                        this.dest.life -= this.attack;
                        if (this.dest.selected && player && player.selectedUnit === this.dest){
                            player.interface.updateInfo('life', (element) => element.textContent = this.dest.life + '/' + this.dest.lifeMax);
                        }
						if (this.dest.name === 'building'){
							this.dest.updateLife(this.action);							
						}else{
							this.dest.isAttacked(this);
						}
					}else{
						this.dest.die();
						this.affectNewDest();
					}
				}
				this.setTextures('actionSheet');
				break;
			default: 
				this.stop()	
		}
	}
	affectNewDest(){
		const targets = findInstancesInSight(this, (instance) => this.getActionCondition(instance));
		if (targets.length){
			const target = getClosestInstanceWithPath(this, targets);
			if (target){
				if (instanceContactInstance(this, target)){
					this.degree = getInstanceDegree(this, target.x, target.y);
					this.getAction(this.action);
					return;
				}
				this.setDest(target.instance);
				this.setPath(target.path);
				return;
			}
		}
		if (this.loading){
			switch(this.work){
				case 'woodcutter':
					this.sendToDelivery('StoragePit', 'deliverywood');
					return;
				case 'gatherer':
					this.sendToDelivery('Granary', 'deliveryberry')
					return;
				case 'stoneminer':
					this.sendToDelivery('StoragePit', 'deliverystone');
					return;
				case 'goldminer':
					this.sendToDelivery('StoragePit', 'deliverygold');
					return;
			}
		}
		this.stop();
		return;
	}
	moveToPath(){
		const next = this.path[this.path.length - 1];
		const nextCell = this.parent.grid[next.i][next.j];
		const sprite = this.getChildByName('sprite');
		if (!sprite){
			return;
		}
		if (!this.dest || this.dest.isDestroyed){
			this.affectNewDest();
			return;
		}
		//Collision with another walking unit, we block the mouvement
		if (nextCell.has && nextCell.has.name === 'unit' && nextCell.has !== this
			&& nextCell.has.hasPath() && instancesDistance(this, nextCell.has) <= 1
			&& nextCell.has.getChildByName('sprite').playing){ 
			sprite.stop();
			return;
		}
		if (nextCell.solid && this.dest){
			this.sendTo(this.dest, this.action);
			return;
		}

		if (!sprite.playing){
			sprite.play();
		}

		this.zIndex = getInstanceZIndex(this); 

		if (instancesDistance(this, nextCell, false) < 10){
			clearCellOnInstanceSight(this);

			this.z = nextCell.z;
			this.i = nextCell.i;
			this.j = nextCell.j;
	
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
            
            //Destination moved
			if (this.dest.i !== this.realDest.i || this.dest.j !== this.realDest.j){
				if (this.player.views[this.dest.i][this.dest.j].viewBy.length > 1){
                    this.sendTo(this.dest, this.action);
                    return;
				}
			}
			if (this.action && instanceContactInstance(this, this.dest)){
                this.degree = getInstanceDegree(this, this.dest.x, this.dest.y);
                this.getAction(this.action);
                return;
			}
			
			if (!this.path.length){
				this.stop();
			}			
		}else{
			//Move to next
			const oldDeg = this.degree;
			let speed = this.speed;
			if (this.loading > 1){
				speed *= .80;
			}
			moveTowardPoint(this, nextCell.x, nextCell.y, speed);
			if (oldDeg !== this.degree){	
				//Change animation according to degree
				this.setTextures('walkingSheet');
			}
		}
	}
	isAttacked(instance){
		if (!instance || (this.dest && this.dest.name === 'unit' && this.action === 'attack')){
			return;
		}
		if (this.type === 'Villager'){
			this.sendToAttack(instance, 'attack');
		}else{
			this.sendTo(instance, 'attack');
		}
	}
	stop(){
		if (this.currentCell.has !== this && this.currentCell.solid){
			this.sendTo(this.currentCell);
			return;
		}
		this.inactif = true;
		this.action = null;
		this.dest = null;
		this.realDest = null;
		this.currentCell.has = this;
		this.currentCell.solid = true;
		this.path = [];
		this.setTextures('standingSheet');
	}
	step(){
		if (this.life <= 0){
			this.die();
		}
		if (this.work === 'attacker' && this.inactif){
			this.action = 'attack';
			this.affectNewDest();
		}
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
				this.sendTo(dest);
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
				this.sendTo(dest);
				break;
			}
		}
	}
	die(){
		if (this.currentSheet === 'dyingSheet'){
			return;
		}
		if (this.selected && player){
            player.unselectAll();
		}
		this.path = [];
		this.action = null;
		this.setTextures('dyingSheet');
		const sprite = this.getChildByName('sprite');
		if (!sprite){
			return;
		}
		sprite.onLoop = () => {
			if (this.parent){
                this.player.population--;
                
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
			clearCellOnInstanceSight(this);
			this.isDestroyed = true;
			this.destroy({ child: true, texture: true });
			clearInterval(this.interval);
		}
	}
	setTextures(sheet){
		const sprite = this.getChildByName('sprite');
		if (!sprite){
			return;
		}
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
		sprite.animationSpeed = this[sheet].data.animationSpeed || (sheet === 'standingSheet' ? .1 : .2);
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
	}
}

class Villager extends Unit {
	constructor(i, j, map, player){
		const type = 'Villager';
		const data = empires.units[type];
		super(i, j, map, player, {
			type,
			lifeMax: data.lifeMax,
			sight: data.sight,
			speed: data.speed,
			attack: data.attack,
			standingSheet: app.loader.resources['418'].spritesheet,
			walkingSheet: app.loader.resources['657'].spritesheet,
			dyingSheet: app.loader.resources['314'].spritesheet,
			interface: {
				info: (element) => {
					this.setDefaultInterface(element, data);
					if (player.isPlayed){
						element.appendChild(this.getLoadingElement());
					}
				},
				menu: player.isPlayed ? [
					{
						icon: 'data/interface/50721/002_50721.png',
						children : [
							player.interface.getBuildingButton('House'),
							player.interface.getBuildingButton('Barracks'),
							player.interface.getBuildingButton('Granary'),
							player.interface.getBuildingButton('StoragePit'),
						]
					},
				] : []
			}
		})
	}
	updateInterfaceLoading(){
		if (this.selected && player && player.selectedUnit === this){
			if (this.loading === 1){
				player.interface.updateInfo('loading', (element) => element.innerHTML = this.getLoadingElement().outerHTML);
			}else if (this.loading > 1){
				player.interface.updateInfo('loading-text', (element) => element.textContent = this.loading);
			}else{
				player.interface.updateInfo('loading', (element) => element.innerHTML = '');
			}
		}
	}
	getLoadingElement(){
		const loading = document.createElement('div');
		Object.assign(loading.style, {
			display: 'flex',
			alignItems: 'center',
		})
		loading.id = 'loading';
		if (this.loading){
			let iconToUse;
			switch (this.work){
				case 'woodcutter':
					iconToUse = player.interface.icons['wood'];
					break;
				case 'gatherer':
					iconToUse = player.interface.icons['food'];
					break;
			} 
			const icon = document.createElement('img');
			Object.assign(icon.style, {
				objectFit: 'none',
				height: '13px',
				width: '20px',
				marginRight: '2px',
				border: '1.5px inset #686769',
				borderRadius: '2px'
			})
			icon.src = iconToUse;
			const text = document.createElement('div');
			text.id = 'loading-text';
			text.textContent = this.loading;
			loading.appendChild(icon);
			loading.appendChild(text);
		}
		return loading;
	}
	sendToAttack(target){
		this.loading = 0;
		if (this.selected && player){
			player.interface.updateInfo('loading', (element) => element.innerHTML = '');
		}
		this.work = null;
		this.actionSheet = app.loader.resources['224'].spritesheet;
		this.standingSheet = app.loader.resources['418'].spritesheet;
		this.walkingSheet = app.loader.resources['657'].spritesheet;
		this.previousDest = null;
		return this.sendTo(target, 'attack');
	}
	sendToDelivery(type, action){
		const targets = this.player.buildings.filter((building) => {
			return building.life > 0 && building.isBuilt && (building.type === 'TownCenter' || building.type === type);
		});
		const target = getClosestInstance(this, targets);
		if (this.dest){
			this.previousDest = this.dest;
		}else{
			this.previousDest = this.parent.grid[this.i][this.j];
		}
		this.sendTo(target, action);
	}
	sendToBuilding(building){
		if (this.work !== 'builder'){
			this.loading = 0;
			this.updateInterfaceLoading();
			this.work = 'builder';
			this.actionSheet = app.loader.resources['628'].spritesheet;
			this.standingSheet = app.loader.resources['419'].spritesheet;
			this.walkingSheet = app.loader.resources['658'].spritesheet;
		}
		this.previousDest = null;
		return this.sendTo(building, 'build');
	}
	sendToTree(tree){
		if (this.work !== 'woodcutter'){
			this.loading = 0;
			this.updateInterfaceLoading();
			this.work = 'woodcutter';
			this.actionSheet = app.loader.resources['625'].spritesheet;
			this.standingSheet = app.loader.resources['440'].spritesheet;
			this.walkingSheet = app.loader.resources['682'].spritesheet;
		}
		this.previousDest = null;
		return this.sendTo(tree, 'chopwood')
	}
	sendToBerrybush(berrybush){
		if (this.work !== 'gatherer'){
			this.loading = 0;
			this.updateInterfaceLoading();
			this.work = 'gatherer';
			this.actionSheet = app.loader.resources['632'].spritesheet;
			this.standingSheet = app.loader.resources['432'].spritesheet;
			this.walkingSheet = app.loader.resources['672'].spritesheet;
		}
		this.previousDest = null;
		return this.sendTo(berrybush, 'forageberry')
	}
	sendToStone(stone){
		if (this.work !== 'stoneminer'){
			this.loading = 0;
			this.updateInterfaceLoading();
			this.work = 'stoneminer';
			this.actionSheet = app.loader.resources['633'].spritesheet;
			this.standingSheet = app.loader.resources['441'].spritesheet;
			this.walkingSheet = app.loader.resources['683'].spritesheet;
		}
		this.previousDest = null;
		return this.sendTo(stone, 'minestone')
	}
	sendToGold(gold){
		if (this.work !== 'goldminer'){
			this.loading = 0;
			this.updateInterfaceLoading();
			this.work = 'goldminer';
			this.actionSheet = app.loader.resources['633'].spritesheet;
			this.standingSheet = app.loader.resources['441'].spritesheet;
			this.walkingSheet = app.loader.resources['683'].spritesheet;
		}
		this.previousDest = null;
		return this.sendTo(gold, 'minegold')
	}
}

class Clubman extends Unit {
	constructor(i, j, map, player){
		const type = 'Clubman';
		const data = empires.units[type];
		super(i, j, map, player, {
			type,
			lifeMax: data.lifeMax,
			sight: data.sight,
			speed: data.speed,
			attack: data.attack,
			work: 'attacker',
			standingSheet: app.loader.resources['425'].spritesheet,
			walkingSheet: app.loader.resources['664'].spritesheet,
			actionSheet: app.loader.resources['212'].spritesheet,
			dyingSheet: app.loader.resources['321'].spritesheet,
			interface: {
				info: (element) => {
					this.setDefaultInterface(element, data);
				},
			}
		})
	}
}