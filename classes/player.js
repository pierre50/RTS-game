class Player{
	constructor(){
		this.age = 'Stone Age';
		this.wood = 2000;
		this.food = 2000;
		this.stone = 1500;
		this.gold = 0;
		this.units = [];
		this.buildings = [];
		this.selectedUnits = [];
		this.population = 0;
		this.populationMax = 5;
	}
	createUnit(x, y, type, map){	
		const units = {
			Clubman,
			Villager
		}	
		let unit = new units[type](x, y, map, this);
		unit.on('pointertap', (evt) => {
			if (mouseBuilding){
				return;
			}
			this.unselectAllUnit();
			map.interface.setBottombar(unit);
			unit.select();
			this.selectedUnits.push(unit);
		})
		this.units.push(unit);
		return unit;
	}
	createBuilding(x, y, type, map, isBuilt){
		const buildings = {
			Barracks,
			TownCenter,
			House
		}			
		let building = new buildings[type](x, y, map, this, isBuilt);
		building.getChildByName('sprite').on('pointertap', (evt) => {
			if (mouseBuilding){
				return;
			}
			//Send villager to build the building
			if (!building.isBuilt){
				for (let i = 0; i < this.selectedUnits.length; i++){
					let unit = this.selectedUnits[i];
					if (unit.type === 'villager'){
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
			//Create unit - TEST
			if (!this.selectedUnits.length){
				map.interface.setBottombar(building);
				return;
			}
			//Send villager to give loading of ressources
			for (let i = 0; i < this.selectedUnits.length; i++){
				let unit = this.selectedUnits[i];
				if (unit.type === 'villager' && unit.loading > 0){
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
			return;
		})
		this.buildings.push(building);
		return building;
	}
	unselectAllUnit(){
		for (let i = 0; i < this.selectedUnits.length; i++){
			this.selectedUnits[i].unselect();
		}
		this.selectedUnits = [];
	}
}
