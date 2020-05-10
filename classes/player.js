class Player{
	constructor(){
		this.wood = 0;
		this.food = 0;
		this.units = [];
		this.buildings = [];
		this.selectedUnits = [];
	}
	createUnit(x, y, map){	
		let unit = new Unit(x, y, map, this);
		unit.on('click', (evt) => {
			this.unselectAllUnit();
			unit.select();
			this.selectedUnits.push(unit);
		})
		this.units.push(unit);
		return unit;
	}
	createBuilding(x, y, type, map){
		const buildings = {
			TownCenter
		}			
		let building = new buildings[type](x, y, map);
		building.getChildByName('sprite').on('click', (evt) => {
			if (!this.selectedUnits.length){
				let spawnCell = getFreeCellAroundPoint(x, y, map.grid);
				this.createUnit(spawnCell.i, spawnCell.j, map, this);
			}else{
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
			}
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
