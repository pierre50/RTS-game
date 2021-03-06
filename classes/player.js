class Player{
	constructor(i, j, map, age, civ, color, type, isPlayed = false){
		this.name = 'player';
		this.parent = map;
		this.i = i;
		this.j = j;
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
		this.isPlayed = isPlayed;

		if (this.isPlayed){
			player = this;
			this.interface = new Interface(this);
		}

		const cloneGrid = [];
		for (let i = 0; i <= map.size; i++){
			for (let j = 0; j <= map.size; j++){
				if(cloneGrid[i] == null){
					cloneGrid[i] = [];	
				}
				cloneGrid[i][j] = {
					i,
                    j,
                    has: null,
					viewBy: [],
					viewed: false
				}
			}
		}
		this.views = cloneGrid;
    }
    spawnUnit(...args){
        const unit = this.createUnit(...args);
        if (this.isPlayed){
            unit.on('pointertap', () => {
                if (mouseBuilding || mouseRectangle || !mouseIsInApp()){
                    return;
                }
                this.unselectAll();
                unit.select();
				this.interface.setBottombar(unit);
				this.selectedUnit = unit;
                this.selectedUnits.push(unit);
            });
        }else{
            unit.on('pointertap', () => {
                if (!player || mouseBuilding || mouseRectangle || !mouseIsInApp()){
                    return;
                }
                if (player.selectedUnits.length){
                    drawInstanceBlinkingSelection(unit);
                    for(let i = 0; i < player.selectedUnits.length; i++){
                        const playerUnit = player.selectedUnits[i];
                        if (playerUnit.type === 'Villager'){
                            playerUnit.sendToAttack(unit);
                        }else{
                            playerUnit.sendTo(unit, 'attack');
                        }
                    }
                    return;
                }
                if (instanceIsInPlayerSight(unit, player) || this.parent.revealEverything){
                    player.unselectAll();
                    unit.select();
                    player.interface.setBottombar(unit);
                    player.selectedOther = unit;
                }
            });
        }
		return unit;
	}
    spawnBuilding(...args){
        const building = this.createBuilding(...args);
        const sprite = building.getChildByName('sprite');
        if (this.isPlayed){
            for(let u = 0; u < this.selectedUnits.length; u++){
                const unit = this.selectedUnits[u];
                if (unit.type === 'Villager'){
                    drawInstanceBlinkingSelection(building);
                    unit.sendToBuilding(building);
                }
            }
            sprite.on('pointertap', () => {
                if (mouseBuilding || mouseRectangle || !mouseIsInApp()){
                    return;
                }
                //Send Villager to build the building
                if (!building.isBuilt){
                    let hasVillager = false;
                    for (let i = 0; i < this.selectedUnits.length; i++){
                        const unit = this.selectedUnits[i];
                        if (unit.type === 'Villager'){
                            hasVillager = true;
                            drawInstanceBlinkingSelection(building);
                            unit.sendToBuilding(building);
                        }
                    }
                    if (hasVillager){
                        return;
                    }
                }else if (this.selectedUnits){
                    //Send Villager to give loading of resources
                    let hasVillagerLoaded = false;
                    for (let i = 0; i < this.selectedUnits.length; i++){
                        const unit = this.selectedUnits[i];
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
								case 'stoneminer':
									unit.sendTo(building, 'deliverystone');
									break;
								case 'goldminer':
									unit.sendTo(building, 'deliverygold');
									break;
                            }
                        }
                    }
                    if (hasVillagerLoaded){
                        return;
                    }
                }
                this.unselectAll();
                building.select();
                this.interface.setBottombar(building);
                this.selectedBuilding = building;
            });
        }else{
            sprite.on('pointertap', () => {
                if (!player || mouseBuilding || mouseRectangle || !mouseIsInApp()){
                    return;
                }
                if (player.selectedUnits.length){
                    drawInstanceBlinkingSelection(building);
                    for(let i = 0; i < player.selectedUnits.length; i++){
                        const playerUnit = player.selectedUnits[i];
                        if (playerUnit.type === 'Villager'){
                            playerUnit.sendToAttack(building);
                        }else{
                            playerUnit.sendTo(building, 'attack');
                        }
                    }
                    return;
                }
                if (instanceIsInPlayerSight(building, player) || this.parent.revealEverything){
                    player.unselectAll();
                    building.select();
                    player.interface.setBottombar(building);
                    player.selectedOther = building;
                }
            });
        }
		return building;
	}
	otherPlayers(){
		const others = [ ...this.parent.players];
		others.splice(this.parent.players.indexOf(this), 1);
		return others;
	}
	buyBuilding(i, j, type, map){
		const building = empires.buildings[this.civ][this.age][type];
		if (canAfford(this, building.cost)){	
			this.spawnBuilding(i, j, type, map);
			payCost(this, building.cost);
			if (this.isPlayed){
				this.interface.updateTopbar();
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
		const unit = new units[type](x, y, map, this);
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
		const building = new buildings[type](x, y, map, this, isBuilt);
		this.buildings.push(building);
		return building;
	}
}

class AI extends Player{
	constructor(i, j, map, age, civ, color){
		super(i, j, map, age, civ, color, 'AI');
		this.foundedTrees = [];
		this.foundedBerrybushs = [];
		this.foundedEnemyBuildings = [];
		this.interval = setInterval(() => this.step(), 4000);
	}
	step(){
		const maxVillagers = 20;
		const maxVillagersOnConstruction = 4;
		const maxClubmans = 10;
		const howManyVillagerBeforeBuyingABarracks = 10;
		const howManySoldiersBeforeAttack = 5;
		const villagers = this.units.filter(unit => unit.type === 'Villager' && unit.life > 0);
		const clubmans = this.units.filter(unit => unit.type === 'Clubman' && unit.life > 0);
		const towncenters = this.buildings.filter(building => building.type === 'TownCenter');
		const storagepits = this.buildings.filter(building => building.type === 'StoragePit');
		const granarys = this.buildings.filter(building => building.type === 'Granary');
		const barracks = this.buildings.filter(building => building.type === 'Barracks');
		const notBuiltBuildings = this.buildings.filter(building => !building.isBuilt || (building.life > 0 && building.life < building.lifeMax));
		const notBuiltHouses = notBuiltBuildings.filter(building => building.type === 'House');
		const builderVillagers = villagers.filter(villager => !villager.inactif && villager.work === 'builder');
		const villagersOnWood = villagers.filter(villager => !villager.inactif && villager.work === 'woodcutter');
		const villagersOnFood = villagers.filter(villager => !villager.inactif && (villager.work === 'gatherer'));
		const inactifVillagers = villagers.filter(villager => villager.inactif && villager.action !== 'attack');
		const inactifClubmans = clubmans.filter(clubman => clubman.inactif && clubman.action !== 'attack' && clubman.assault);
		const waitingClubmans = clubmans.filter(clubman => clubman.inactif && clubman.action !== 'attack' && !clubman.assault);
		const maxVillagersOnWood = getValuePercentage(villagers.length, 30);
		const maxVillagersOnFood = getValuePercentage(villagers.length, 70);

		//Player loosing
		if (this.buildings.length === 0 && this.units.length === 0){
			this.die();
			return;
		}

		/**
		 * Units action
		 */
		//Look for food
		if (villagersOnFood.length <= maxVillagersOnFood && (towncenters.length || granarys.length)){
			if (this.foundedBerrybushs.length){
				for (let i = 0; i < Math.min(maxVillagersOnFood, inactifVillagers.length); i ++){
					const bush = getClosestInstance(inactifVillagers[i], this.foundedBerrybushs);
					inactifVillagers[i].sendToBerrybush(bush);
					//Build a granary close to it, if to far
					const closestTownCenter = getClosestInstance(bush, towncenters);
					const closestGranary = getClosestInstance(bush, granarys);
					if (instancesDistance(closestTownCenter, bush) > 6 && (!instancesDistance(closestGranary, bush) || instancesDistance(closestGranary, bush) > 15)){
						const bushNeighbours = getPlainCellsAroundPoint(bush.i, bush.j, this.parent.grid, 2, (cell) => cell.has && cell.has.type === 'Berrybush');
						if (bushNeighbours.length > 3){
							const pos = getPositionInZoneAroundInstance(bush, this.parent.grid, [0, 6], 2);
							if (pos){
								this.buyBuilding(pos.i, pos.j, 'Granary', this.parent);
							}
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
		if (villagersOnWood.length <= maxVillagersOnWood && (towncenters.length || storagepits.length)){
			if (this.foundedTrees.length){
				for (let i = 0; i < Math.min(maxVillagersOnWood, inactifVillagers.length); i ++){
					const tree = getClosestInstance(inactifVillagers[i], this.foundedTrees);
					inactifVillagers[i].sendToTree(tree);
					//Build a storagepit close to it, if to far
					const closestTownCenter = getClosestInstance(tree, towncenters);
					const closestStoragepit = getClosestInstance(tree, storagepits);
					if (instancesDistance(closestTownCenter, tree) > 6 && (!instancesDistance(closestStoragepit, tree) || instancesDistance(closestStoragepit, tree) > 15)){
						const treeNeighbours = getPlainCellsAroundPoint(tree.i, tree.j, this.parent.grid, 2, (cell) => cell.has && cell.has.type === 'Tree');
						if (treeNeighbours.length > 5){
							const pos = getPositionInZoneAroundInstance(tree, this.parent.grid, [0, 6], 2);
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
				const noWorkers = villagers.filter(villager => (villager.action !== 'attack' && villager.work !== 'builder') || villager.inactif);
				const villager = getClosestInstance(notBuiltBuildings[i], noWorkers);
				if (villager){
					villager.sendToBuilding(notBuiltBuildings[i]);
				}
			}
		}
		//Send clubman to attack
		if (waitingClubmans.length >= howManySoldiersBeforeAttack){
			if (!this.foundedEnemyBuildings.length){
				const targetIndex = randomRange(0, this.otherPlayers().length - 1);
				const target = this.otherPlayers()[targetIndex];
				const i = target.i + randomRange(-5, 5);
				const j = target.j + randomRange(-5, 5);
				if (this.parent.grid[i] && this.parent.grid[i][j]){
					const cell = this.parent.grid[i][j];
					for (let i = 0; i < waitingClubmans.length; i++){
						waitingClubmans[i].assault = true;
						waitingClubmans[i].sendTo(cell, 'attack');
					}
				}
			}else{
				for (let i = 0; i < waitingClubmans.length; i++){
					waitingClubmans[i].sendTo(this.foundedEnemyBuildings[0], 'attack');
				}
			}
		}
		if (inactifClubmans.length){
			if (!this.foundedEnemyBuildings.length){
				for (let i = 0; i < inactifClubmans.length; i++){
					inactifClubmans[i].explore();
				}
			}else{
				for (let i = 0; i < inactifClubmans.length; i++){
					inactifClubmans[i].sendTo(this.foundedEnemyBuildings[0], 'attack');
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
		if (this.population + 3 > this.populationMax && !notBuiltHouses.length){
			const pos = getPositionInZoneAroundInstance(towncenters[0], this.parent.grid, [3, 12], 2);
			if (pos){
				this.buyBuilding(pos.i, pos.j, 'House', this.parent);
			}
		}
		//Buy a barracks
		if (villagers.length > howManyVillagerBeforeBuyingABarracks && barracks.length === 0){
			const pos = getPositionInZoneAroundInstance(towncenters[0], this.parent.grid, [4, 20], 3, false, (cell) => {
				let isMiddle = true;
				for (let i = 0; i < this.otherPlayers().length; i++){
					if (instancesDistance(cell, this.otherPlayers()[i]) > instancesDistance(towncenters[0], this.otherPlayers()[i])){
						isMiddle = false;
					}
				}
				return isMiddle;
			});
			if (pos){
				this.buyBuilding(pos.i, pos.j, 'Barracks', this.parent);
			}
		}
	}
	die(){
		clearInterval(this.interval);
		this.parent.players.splice(this.parent.players.indexOf(this), 1);
	}
}

class Human extends Player{
	constructor(i, j, map, age, civ, color, isPlayed){
		super(i, j, map, age, civ, color, 'Human', isPlayed);
		this.selectedUnits = [];
		this.selectedUnit = null;
        this.selectedBuilding = null;
        this.selectedOther = null;
	}
	unselectAllUnits(){
		for (let i = 0; i < this.selectedUnits.length; i++){
			this.selectedUnits[i].unselect();
		}
		this.selectedUnit = null;
		this.selectedUnits = [];
		this.interface.setBottombar();
	}
	unselectAll(){
		if (this.selectedBuilding){
			this.selectedBuilding.unselect();
			this.selectedBuilding = null;
        }
        if (this.selectedOther){
            this.selectedOther.unselect();
            this.selectedOther = null;
        }
		this.unselectAllUnits();
		this.interface.setBottombar();
	}
}