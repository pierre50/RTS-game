class Player{
	constructor(map, age, civ, color, type){
		this.name = 'player';
		this.parent = map;
		this.civ = civ;
		this.age = age;
		this.wood = 200;
		this.food = 200;
		this.stone = 150;
		this.gold = 0;
		this.type = type;
		this.units = [];
		this.buildings = [];
		this.population = 0;
		this.populationMax = 5;
		this.color = color;

		this.foundedTrees = [];
		this.foundedBerrybushs = [];
		this.foundedEnemyBuildings = [];

		let cloneGrid = [];
		for (let i = 0; i <= map.size; i++){
			for (let j = 0; j <= map.size; j++){
				if(cloneGrid[i] == null){
					cloneGrid[i] = [];	
				}
				cloneGrid[i][j] = {
					i,
					j,
					viewedBy: [],
					viewed: false
				}
			}
		}
		this.views = cloneGrid;
	}
	buyBuilding(i, j, type, map){
		const building = empires.buildings[this.civ][this.age][type];
		if (canAfford(this, building.cost)){	
			this.spawnBuilding(i, j, type, map);
			payCost(this, building.cost);
			if (this.type === 'Human'){
				this.parent.interface.updateTopbar();
			}
			return true;
		}
		return false;
	}
	createUnit(x, y, type, map){	
		const units = {
			Clubman,
			Villager
		}	
		let unit = new units[type](x, y, map, this);
		this.units.push(unit);
		return unit;
	}
	createBuilding(x, y, type, map, isBuilt = false){
		const buildings = {
			Barracks,
			TownCenter,
			House,
			StoragePit,
			Granary
		}			
		let building = new buildings[type](x, y, map, this, isBuilt);
		this.buildings.push(building);
		return building;
	}
}

class AI extends Player{
	constructor(map, age, civ, color){
		super(map, age, civ, color, 'AI');
		this.interval = setInterval(() => this.step(), 1000);
	}
	spawnUnit(...args){
		let unit = this.createUnit(...args);
		unit.on('mouseover', () => { 
			if (unit.parent.player.selectedUnits.length && unit.visible){
				gamebox.setCursor('attack');
			}
		})
		unit.on('mouseout', () => {
			gamebox.setCursor('default');
		})
		unit.on('pointertap', (evt) => {
			//If we are placing a building don't permit click
			if (mouseBuilding || mouseRectangle){
				return;
			}
			if (map.player.selectedUnits.length){
				drawInstanceBlinkingSelection(unit);
				for(let i = 0; i < map.player.selectedUnits.length; i++){
					let playerUnit = map.player.selectedUnits[i];
					if (playerUnit.type === 'Villager'){
						playerUnit.sendToAttack(unit);
					}else{
						playerUnit.sendTo(unit, 'attack');
					}
				}
			}
		});
		return unit;
	}
	spawnBuilding(...args){
		let building = this.createBuilding(...args);
		let sprite = building.getChildByName('sprite');
		sprite.on('mouseover', () => { 
			if (building.parent.player.selectedUnits.length && building.visible){
				gamebox.setCursor('attack');
			}
		})
		sprite.on('mouseout', () => {
			gamebox.setCursor('default');
		})
		sprite.on('pointertap', (evt) => {
			//If we are placing a building don't permit click
			if (mouseBuilding || mouseRectangle){
				return;
			}
			if (map.player.selectedUnits.length){
				drawInstanceBlinkingSelection(building);
				for(let i = 0; i < map.player.selectedUnits.length; i++){
					let playerUnit = map.player.selectedUnits[i];
					if (playerUnit.type === 'Villager'){
						playerUnit.sendToAttack(building);
					}else{
						playerUnit.sendTo(building, 'attack');
					}
				}
			}
		});
		return building;
	}
	step(){
		const maxVillagers = 20;
		const maxVillagersOnConstruction = 4;
		const maxClubmans = 10;
		const howManyVillagerBeforeBuyingABarracks = 10;
		const howManySoldiersBeforeAttack = 2;
		const villagers = this.units.filter(unit => unit.type === 'Villager');
		const clubmans = this.units.filter(unit => unit.type === 'Clubman');
		const towncenters = this.buildings.filter(building => building.type === 'TownCenter');
		const storagepits = this.buildings.filter(building => building.type === 'StoragePit');
		const granarys = this.buildings.filter(building => building.type === 'Granary');
		const barracks = this.buildings.filter(building => building.type === 'Barracks');
		const notBuiltBuildings = this.buildings.filter(building => !building.isBuilt);
		const builderVillagers = villagers.filter(villager => !villager.inactif && villager.work === 'builder');
		const villagersOnWood = villagers.filter(villager => !villager.inactif && villager.work === 'woodcutter');
		const villagersOnFood = villagers.filter(villager => !villager.inactif && (villager.work === 'gatherer'));
		const inactifVillagers = villagers.filter(villager => villager.inactif);
		const inactifClubmans = clubmans.filter(clubman => clubman.inactif);
		const maxVillagersOnWood = getValuePercentage(villagers.length, 30);
		const maxVillagersOnFood = getValuePercentage(villagers.length, 70);

		//Player loosing
		if (this.buildings.length === 0 && this.units.length === 0){
			this.die();
		}

		/**
		 * Units action
		 */
		//Look for food
		if (villagersOnFood.length < maxVillagersOnFood && (towncenters.length || granarys.length)){
			if (this.foundedBerrybushs.length){
				for (let i = 0; i < Math.min(maxVillagersOnFood, inactifVillagers.length); i ++){
					let bush = getClosestInstance(inactifVillagers[i], this.foundedBerrybushs);
					inactifVillagers[i].sendToBerrybush(bush);
					//Build a granary close to it, if to far
					let closestTownCenter = getClosestInstance(bush, towncenters);
					let closestGranary = getClosestInstance(bush, granarys);
					if (instancesDistance(closestTownCenter, bush) > 10 && (!instancesDistance(closestGranary, bush) || instancesDistance(closestGranary, bush) > 10)){
						let pos = getPositionInZoneAroundInstance(bush, this.parent.grid, [1, 5], 1);
						if (pos){
							this.buyBuilding(pos.i, pos.j, 'Granary', this.parent);
						}
					}
				}
			}else{
				for (let i = 0; i < Math.min(maxVillagersOnFood, inactifVillagers.length); i ++){
					inactifVillagers[i].explore();
				}
			}
		}
		//Look for wood
		if (villagersOnWood.length < maxVillagersOnWood && (towncenters.length || storagepits.length)){
			if (this.foundedTrees.length){
				for (let i = 0; i < Math.min(maxVillagersOnWood, inactifVillagers.length); i ++){
					let tree = getClosestInstance(inactifVillagers[i], this.foundedTrees);
					inactifVillagers[i].sendToTree(tree);
					//Build a storagepit close to it, if to far
					let closestTownCenter = getClosestInstance(tree, towncenters);
					let closestStoragepit = getClosestInstance(tree, storagepits);
					if (instancesDistance(closestTownCenter, tree) > 10 
						&& (!instancesDistance(closestStoragepit, tree) || instancesDistance(closestStoragepit, tree) > 10)){
						let treeNeighbours = getPlainCellsAroundPoint(tree.i, tree.j, this.parent.grid, 2, (cell) => cell.has && cell.has.type === 'Tree');
						if (treeNeighbours.length > 5){
							let pos = getPositionInZoneAroundInstance(tree, this.parent.grid, [1, 5], 1);
							if (pos){
								this.buyBuilding(pos.i, pos.j, 'StoragePit', this.parent);
							}
						}
					}
				}
			}else{
				for (let i = 0; i < Math.min(maxVillagersOnWood, inactifVillagers.length); i ++){
					inactifVillagers[i].explore();
				}
			}
		}
		//Send to construction
		if (notBuiltBuildings.length > 0){
			for (let i = 0; i < notBuiltBuildings.length; i++){
				if (builderVillagers.length >= maxVillagersOnConstruction){
					break;
				}
				const noWorkers = villagers.filter(villager => villager.work !== 'builder' || villager.inactif);
				let villager = getClosestInstance(notBuiltBuildings[i], noWorkers);
				if (villager){
					villager.sendToBuilding(notBuiltBuildings[i]);
				}
			}
		}
		//Send clubman to search and destroy
		if (inactifClubmans.length >= howManySoldiersBeforeAttack){
			if (!this.foundedEnemyBuildings.length){
				for (let i = 0; i < clubmans.length; i++){
					Math.random(0, this.parent.playerPos)
				}
			}else{
				for (let i = 0; i < clubmans.length; i++){
					clubmans[i].sendTo(this.foundedEnemyBuildings[0], 'search&destroy');
				}
			}
		}

		/**
		 * Units buying
		 */
		//Buy villager
		if (villagers.length < maxVillagers){
			for (let i = 0; i < maxVillagers - villagers.length; i++){
				if (towncenters[i]){
					towncenters[i].buyUnit('Villager');
				}
			}
		}
		//Buy clubman
		if (clubmans.length < maxClubmans){
			for (let i = 0; i < maxClubmans - clubmans.length; i++){
				if (barracks[i]){
					barracks[i].buyUnit('Clubman');
				}
			}
		}


		/**
		 * Building buying
		 */
		//Buy a house
		if (this.populationMax - this.population < 3 && !notBuiltBuildings.length){
			let pos = getPositionInZoneAroundInstance(towncenters[0], this.parent.grid, [3, 8], 2);
			if (pos){
				this.buyBuilding(pos.i, pos.j, 'House', this.parent);
			}
		}
		//Buy a barracks
		if (villagers.length > howManyVillagerBeforeBuyingABarracks && barracks.length === 0 && !notBuiltBuildings.length){
			let pos = getPositionInZoneAroundInstance(towncenters[0], this.parent.grid, [4, 16], 2);
			if (pos){
				this.buyBuilding(pos.i, pos.j, 'Barracks', this.parent);
			}
		}
	}
	die(){
		clearInterval(this.intervale);
		this.parent.players.splice(this.parent.players.indexOf(this), 1);
	}
}

class Human extends Player{
	constructor(map, age, civ, color){
		super(map, age, civ, color, 'Human');
		this.selectedUnits = [];
		this.selectedBuilding = null;
	}
	spawnUnit(...args){
		let unit = this.createUnit(...args);
		unit.on('pointertap', (evt) => {
			//If we are placing a building don't permit click
			if (mouseBuilding || mouseRectangle){
				return;
			}
			this.unselectAll();
			unit.select();
			map.interface.setBottombar(unit);
			this.selectedUnits.push(unit);
		});
		return unit;
	}
	spawnBuilding(...args){
		let building = this.createBuilding(...args);
		building.visible = true;
		for(let u = 0; u < this.selectedUnits.length; u++){
			let unit = this.selectedUnits[u];
			if (unit.type === 'Villager'){
				drawInstanceBlinkingSelection(building);
				unit.sendToBuilding(building);
			}
		}

		building.getChildByName('sprite').on('pointertap', (evt) => {
			//If we are placing a building don't permit click
			if (mouseBuilding || mouseRectangle){
				return;
			}
			//Send Villager to build the building
			if (!building.isBuilt){
				for (let i = 0; i < this.selectedUnits.length; i++){
					let unit = this.selectedUnits[i];
					if (unit.type === 'Villager'){
						drawInstanceBlinkingSelection(building);
						unit.sendToBuilding(building);
					}
				}
				return;
			}

			//Send Villager to give loading of resources
			if (this.selectedUnits){
				let hasVillagerLoaded = false;
				for (let i = 0; i < this.selectedUnits.length; i++){
					let unit = this.selectedUnits[i];
					if (unit.type === 'Villager' && unit.loading > 0){
						hasVillagerLoaded = true;
						drawInstanceBlinkingSelection(building);
						unit.previousDest = null;
						switch (unit.work){
							case 'woodcutter':
								unit.sendTo(building, 'deliverywood');
								break;
							case 'gatherer':
								unit.sendTo(building, 'deliveryberry');
								break;
						}
					}
				}
				if (hasVillagerLoaded){
					return;
				}
			}
		
			//Select
			this.unselectAll();
			building.select();
			map.interface.setBottombar(building);
			this.selectedBuilding = building;
		});
		return building;
	}
	unselectAllUnits(){
		for (let i = 0; i < this.selectedUnits.length; i++){
			this.selectedUnits[i].unselect();
		}
		this.selectedUnits = [];
	}
	unselectAll(){
		if (this.selectedBuilding){
			this.selectedBuilding.unselect();
			this.selectedBuilding = null;
		}
		this.unselectAllUnits();
		map.interface.setBottombar();
	}
}