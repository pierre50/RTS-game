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
		this.foundedEnemyBase = [];

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
		this.foundedEnemyBase = [this.parent.player.buildings[0]];
		this.step();
	}
	spawnUnit(...args){
		let unit = this.createUnit(...args);
		unit.on('mouseover', () => { 
			if (unit.parent.player.selectedUnits.length && unit.visible){
				gamebox.setCursor('hover');
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
						playerUnit.loading = 0;
						playerUnit.work = null;
						playerUnit.actionSheet = app.loader.resources['224'].spritesheet;
						playerUnit.standingSheet = app.loader.resources['418'].spritesheet;
						playerUnit.walkingSheet = app.loader.resources['657'].spritesheet;
						playerUnit.previousDest = null;
						playerUnit.setDestination(unit, 'attack')
					}else{
						playerUnit.setDestination(unit, 'attack');
					}
				}
			}
		});
		return unit;
	}
	spawnBuilding(...args){
		let building = this.createBuilding(...args);
		return building;
	}
	step(){
		/*
			12-14 on food
			6 on wood
		*/
		setInterval(() => {
			const maxVillagers = 20;
			const maxVillagersOnConstruction = 4;
			const maxVillagersOnWood = 20;
			const maxVillagersOnFood = 80;
			const maxClubmans = 10;
			const howManyVillagerBeforeBuyingABarracks = 10;
			const howManySoldiersBeforeAttack = 10;
			const villagers = this.units.filter(unit => unit.type === 'Villager');
			const clubmans = this.units.filter(unit => unit.type === 'Clubman');
			const towncenters = this.buildings.filter(building => building.type === 'TownCenter');
			const barracks = this.buildings.filter(building => building.type === 'Barracks');
			const notBuiltBuildings = this.buildings.filter(building => !building.isBuilt);
			const builderVillagers = villagers.filter(villager => !villager.inactif && villager.work === 'builder');
			const villagersOnWood = villagers.filter(villager => !villager.inactif && villager.work === 'woodcutter');
			const villagersOnFood = villagers.filter(villager => !villager.inactif && (villager.work === 'gatherer'));
			const inactifVillagers = villagers.filter(villager => villager.inactif);
			
			/**
			 * Units action
			 */
			//Look for food
			if (villagersOnFood.length < getValuePercentage(villagers.length, maxVillagersOnFood)){
				const availableBerrybushs = this.foundedBerrybushs;
				if (availableBerrybushs.length){
					for (let i = 0; i < inactifVillagers.length; i ++){
						let bush = getClosestInstance(inactifVillagers[i], availableBerrybushs);
						inactifVillagers[i].sendToBerrybush(bush);
					}
				}else{
					for (let i = 0; i < Math.min(maxVillagersOnFood, inactifVillagers.length); i ++){
						inactifVillagers[i].explore();
					}
				}
			}
			//Look for wood
			if (villagersOnWood.length < getValuePercentage(villagers.length, maxVillagersOnWood)){
				const availableTrees = this.foundedTrees;
				if (availableTrees.length){
					for (let i = 0; i < inactifVillagers.length; i ++){
						let tree = getClosestInstance(inactifVillagers[i], availableTrees);
						inactifVillagers[i].sendToTree(tree);
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
			if (clubmans.length > howManySoldiersBeforeAttack){
				const foundedEnemyBase = this.foundedEnemyBase;
				if (!foundedEnemyBase.length){
					
				}else{
					for (let i = 0; i < clubmans.length; i++){
						clubmans[i].setDestination(foundedEnemyBase[0], 'search&destroy');
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
				const around = 8;
				const zone = {
					minX: towncenters[0].i - around,
					minY: towncenters[0].j - around,
					maxX: towncenters[0].i + around,
					maxY: towncenters[0].j + around
				}
				let pos = getZoneInZoneWithCondition(zone, this.parent.grid, 1, (cell) => {
					return (
						cell.i > 0 && cell.j > 0 && cell.i < cell.parent.size && cell.j < cell.parent.size && 
						instancesDistance(towncenters[0], cell, true) > 3 &&
						instancesDistance(towncenters[0], cell, true) < around && 
						!cell.solid && !cell.border && !cell.inclined);
				});
				if (pos){
					this.buyBuilding(pos.i, pos.j, 'House', this.parent);
				}
			}
			//Buy a barracks
			if (villagers.length > howManyVillagerBeforeBuyingABarracks && barracks.length === 0 && !notBuiltBuildings.length){
				const around = 14;
				const zone = {
					minX: towncenters[0].i - around,
					minY: towncenters[0].j - around,
					maxX: towncenters[0].i + around,
					maxY: towncenters[0].j + around
				}
				let pos = getZoneInZoneWithCondition(zone, this.parent.grid, 3, (cell) => {
					return (
                    	cell.i > 0 && cell.j > 0 && cell.i < cell.parent.size && cell.j < cell.parent.size &&
						instancesDistance(towncenters[0], cell, true) > 3 &&
						instancesDistance(towncenters[0], cell, true) < around && 
						!cell.solid && !cell.border && !cell.inclined);
				});
				if (pos){
					this.buyBuilding(pos.i, pos.j, 'Barracks', this.parent);
				}
			}
		}, 1000)
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
								unit.setDestination(building, 'deliverywood');
								break;
							case 'gatherer':
								unit.setDestination(building, 'deliveryberry');
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