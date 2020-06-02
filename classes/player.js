class Player{
	constructor(map, age, civ, color){
		this.parent = map;
		this.civ = civ;
		this.age = age;
		this.wood = 2000;
		this.food = 2000;
		this.stone = 1500;
		this.gold = 0;
		this.units = [];
		this.buildings = [];
		this.selectedUnits = [];
		this.selectedBuilding = null;
		this.population = 0;
		this.populationMax = 5;
		this.color = color;
	}
	
}

class Human extends Player{
	constructor(map, age, civ, color){
		super(map, age, civ, color)
	}
	createUnit(x, y, type, map){	
		const units = {
			Clubman,
			Villager
		}	
		let unit = new units[type](x, y, map, this);
		unit.on('pointertap', (evt) => {
			//If we are placing a building don't permit click
			if (mouseBuilding || mouseRectangle){
				return;
			}
			this.unselectAll();
			unit.select();
			map.interface.setBottombar(unit);
			this.selectedUnits.push(unit);
		})
		this.units.push(unit);
		return unit;
	}
	createBuilding(x, y, type, map, isBuilt){
		const buildings = {
			Barracks,
			TownCenter,
			House,
			StoragePit,
			Granary
		}			
		let building = new buildings[type](x, y, map, this, isBuilt);
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
						if (unit.work !== 'builder'){
							unit.loading = 0;
							unit.work = 'builder';
							unit.actionSheet = app.loader.resources['628'].spritesheet;
							unit.standingSheet = app.loader.resources['419'].spritesheet;
							unit.walkingSheet = app.loader.resources['658'].spritesheet;
						}
						unit.previousDest = null;
						unit.setDestination(building, 'build');
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
		})
		this.buildings.push(building);
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