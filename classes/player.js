//Unit
class Player{
	constructor(){
		this.wood = 0;
		this.food = 0;
		this.units = [];
		this.selectedUnits = [];
	}
	createUnit(x, y, z, map){	
		let unit = new Unit(x, y, z, map);
		unit.on('click', (evt) => {
			unit.select();
			this.selectedUnits.push(unit);
		})
		this.units.push(unit);
		return unit;
	}
}
