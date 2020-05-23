/**
 * Convert cartesian to isometric
 * @param {number} x 
 * @param {number} y 
 */
function cartesianToIsometric(x, y){
	return [
		Math.floor((x - y) * cellWidth / 2),
		Math.floor((x + y) * cellHeight / 2)
	]
}

/**
 * Convert isometric position to cartesian
 * @param {number} x 
 * @param {number} y 
 */
function isometricToCartesian(x, y){
	return [
		Math.round(((x / (cellWidth / 2)) + (y / (cellHeight / 2))) / 2),
		Math.round(((y / (cellHeight / 2)) - (x / (cellWidth / 2))) / 2)
	]
}

/**
 * Get percentage with two numbers
 * @param {number} a 
 * @param {number} b 
 */
function getPercentage(a, b){
	return Math.floor(a / b * 100);
}

/**
 * Check if point is between two points can be used with line thickness
 * @param {object} line1 
 * @param {object} line2 
 * @param {object} pnt 
 * @param {number} lineThickness 
 */
function pointIsBetweenTwoPoint(line1, line2, pnt, lineThickness) {
	let L2 = (((line2.x - line1.x) * (line2.x - line1.x)) + ((line2.y - line1.y) * (line2.y - line1.y)));
	if (L2 == 0) return false;
	let r = (((pnt.x - line1.x) * (line2.x - line1.x)) + ((pnt.y - line1.y) * (line2.y - line1.y))) / L2;
	if (r < 0) {
	  	return (Math.sqrt(((line1.x - pnt.x) * (line1.x - pnt.x)) + ((line1.y - pnt.y) * (line1.y - pnt.y))) <= lineThickness);
	} else if ((0 <= r) && (r <= 1)) {
	  	let s = (((line1.y - pnt.y) * (line2.x - line1.x)) - ((line1.x - pnt.x) * (line2.y - line1.y))) / L2;
	  	return (Math.abs(s) * Math.sqrt(L2) <= lineThickness);
	} else {
	  	return (Math.sqrt(((line2.x - pnt.x) * (line2.x - pnt.x)) + ((line2.y - pnt.y) * (line2.y - pnt.y))) <= lineThickness);
	}
}

/**
 * Get a random cell on the grid
 * @param {object} grid 
 */
function getRandomCell(grid){
	return grid[Math.floor(Math.random()*size)][Math.floor(Math.random()*size)];
}

/**
 * Check a instance is in contact with another one
 * @param {object} a 
 * @param {object} b 
 */
function instanceContactInstance(a, b){
	return Math.floor(instancesDistance(a, b, true)) <= (b.size || 1);
}

/**
 * Get a random number between two numbers
 * @param {number} min 
 * @param {number} max 
 */
function randomRange(min, max) {
	return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Get a random item from a array
 * @param {array} array 
 */
function randomItem(array){
	return array[Math.round(Math.random() * (array.length - 1))];
}

/**
 * Get distance between two instances, can use iso (x, y) or cartesian (i, j)
 * @param {object} a 
 * @param {object} b 
 * @param {boolean} useCartesian
 */
function instancesDistance(a, b, useCartesian = false){
	return useCartesian ? pointsDistance(a.i, a.j, b.i, b.j) : pointsDistance(a.x, a.y, b.x, b.y);
}

/**
 * Get the instance zIndex according to his position
 * @param {object} instance 
 */
function getInstanceZIndex(instance){
	let pos = isometricToCartesian(instance.x,instance.y + (instance.z * cellDepth));
	let ext = instance.name !== 'cell' ? (cellHeight / 2) : 0;
	return pos[0] + pos[1] + ext;
}

/**
 * Get the difference between two number
 * @param {number} a 
 * @param {number} b 
 */
function diff(a, b){
	return Math.abs(a - b);
}

/**
 * Get degree of instance according to a point
 * @param {object} instance 
 * @param {number} x 
 * @param {number} y 
 */
function getInstanceDegree(instance, x, y){
	let tX = x - instance.x;
	let tY = y - instance.y;
	return Math.round(Math.atan2(tY, tX) * 180 / Math.PI + 180);
}

/**
 * Move instance straight to a position
 * @param {object} instance 
 * @param {number} x 
 * @param {number} y 
 * @param {number} speed 
 */
function moveTowardPoint(instance, x, y, speed){
	let dist = pointsDistance(x, y ,instance.x, instance.y);
	let tX = x - instance.x;
	let tY = y - instance.y;
	let velX = ((tX)/dist)*speed;
	let velY = ((tY)/dist)*speed;
	instance.degree = getInstanceDegree(instance, x, y);
	instance.x += velX;
	instance.y += velY;
}

/**
 * Get distance between two points
 * @param {number} x1 
 * @param {number} y1 
 * @param {number} x2 
 * @param {number} y2 
 */
function pointsDistance(x1, y1, x2, y2){
	let a = x1 - x2;
	let b = y1 - y2;
	return Math.sqrt( a*a + b*b );
}

/**
 * Check if point is in a rectangle or not
 * @param {number} x 
 * @param {number} y 
 * @param {number} left 
 * @param {number} top 
 * @param {number} width 
 * @param {number} height 
 */
function pointInRectangle(x, y, left, top, width, height) {
    return (x > left && x < left + width && y > top && y < top + height);
}

/**
 * Get the first free cell coordinate around a point
 * @param {number} x 
 * @param {number} y 
 * @param {object} grid 
 */
function getFreeCellAroundPoint(x, y, grid){
	let founded;
	for (let i = 1; i < 100; i++){
		getCellsAroundPoint(x, y, grid, i, (cell) => {
			if (!cell.solid){
				founded = cell;
			}
		});
		if (founded){
			return founded;
		}
	}
	return null;
}

/**
 * Get the closest available path for a instance to a destination 
 * @param {object} instance 
 * @param {number} x 
 * @param {number} y 
 * @param {object} map 
 */
function getInstanceClosestFreeCellPath(instance, x, y, map){
	for (let i = 1; i < 5; i++){
		let paths = [];
		getPlainCellsAroundPoint(x, y, map.grid, i, (cell) => {
			let path = getInstancePath(instance, cell.i, cell.j, map);
			if (path.length){
				paths.push(path);
			}
		});
		paths.sort((a, b) => a.length - b.length);
		if (paths[0]){
			return paths[0];
		}
	}
	return [];
}

/**
 * Drawing selection blinking on instance
 * @param {object} instance 
 */
function drawInstanceBlinkingSelection(instance){
	let selection = new PIXI.Graphics();
	selection.name = 'selection';
	selection.zIndex = 3;
	selection.lineStyle(1, 0x00FF00);		
	const path = [(-32*instance.size), 0, 0,(-16*instance.size), (32*instance.size),0, 0,(16*instance.size)];
	selection.drawPolygon(path);
	instance.addChildAt(selection, 0);
	setTimeout(() => {
		selection.alpha = 0;
		setTimeout(() => {
			selection.alpha = 1;
			setTimeout(() => {
				selection.alpha = 0;
				setTimeout(() => {
					selection.alpha = 1;
					setTimeout(() => {
						instance.removeChild(selection);
					}, 300)
				}, 300)
			}, 300)
		}, 500)
	}, 500)
}

/**
 * Get the shortest path for a instance to a destination
 * @param {object} instance 
 * @param {number} x 
 * @param {number} y 
 * @param {object} map 
 */
function getInstancePath(instance, x, y, map){
	const maxZone = 10;
	const end = map.grid[x][y];
	const start = map.grid[instance.i][instance.j];
	let minX = Math.min(start.i, end.i) - maxZone;
	let maxX = Math.max(start.i, end.i) + maxZone;
	let minY = Math.min(start.j, end.j) - maxZone;
	let maxY = Math.max(start.j, end.j) + maxZone;
	if (minX < 0){
		minX = 0;
	}
	if (maxX > map.size){
		maxX = map.size;
	}
	if (minY < 0){
		minY = 0;
	}
	if (maxY > map.size){
		maxY = map.size;
	}
	let cloneGrid = [];
	for(var i = minX; i <= maxX; i++){
		for(var j = minY; j <= maxY; j++){
			if(cloneGrid[i] == null){
				cloneGrid[i] = [];	
			}
			cloneGrid[i][j] = {
				i,
				j,
				x: map.grid[i][j].x,
				y: map.grid[i][j].y,
				z: map.grid[i][j].z,
				solid: map.grid[i][j].solid,
			}
		}
	}
	let isFinish = false;
	let path = [];
	let openCells = [];
	let closedCells = [];
	const cloneEnd = cloneGrid[end.i][end.j];
	const cloneStart = cloneGrid[start.i][start.j];
	openCells.push(cloneStart);
	while (!isFinish) {
		if(openCells.length > 0){
			//find the lowest f in open cells
			let lowestF = 0;
			for(let i = 0; i < openCells.length; i++){
				if(openCells[i].f < openCells[lowestF].f){
					lowestF = i;
				}
				
				if (openCells[i].f == openCells[lowestF].f) {
					if (openCells[i].g > openCells[lowestF].g) {
						lowestF = i;
					}
				}
			}
			let current = openCells[lowestF];
			if (current === cloneEnd){
				//reached the end cell
				isFinish = true;
			}
			//calculate path
			path = [cloneEnd];
			let temp = current;
		
			while(temp.previous){
				path.push(temp.previous);
				temp = temp.previous;
			}
			openCells.splice(openCells.indexOf(current),1);
			closedCells.push(current);
			//check neighbours
			let neighbours = getCellsAroundPoint(current.i, current.j, cloneGrid, 1);//current.neighbours;
			for(let i = 0; i < neighbours.length; i++){
				let neighbour = neighbours[i];
				if(!closedCells.includes(neighbour) && !neighbour.solid && diff(current.z, neighbour.z) < 2 ){
					let tempG = current.g + instancesDistance(neighbour, current);
					if(!openCells.includes(neighbour)){
						openCells.push(neighbour);
					}else{
                        continue;
                    }
					neighbour.g = tempG;
					neighbour.h = instancesDistance(neighbour, cloneEnd);
					neighbour.f = neighbour.g + neighbour.h;
					neighbour.previous = current
				}
			}
		}else{
			//no solution
			path = [];
			isFinish = true;
		}
	}
	path.pop();
	return [...path];
}

/**
 * Allow to find all the instances around and instance with his sight
 * @param {object} instance 
 * @param {function} condition 
 */
function findInstancesInSight(instance, condition){
	let instances = [];
	for (let i = instance.i - instance.sight; i < instance.i + instance.sight; i++){
		for (let j = instance.j - instance.sight; j < instance.j + instance.sight; j++){
			if (pointsDistance(instance.i, instance.j, i, j) <= instance.sight && instance.parent.grid[i] && instance.parent.grid[i][j]){
				let cell = instance.parent.grid[i][j];
				if (cell.has && typeof condition === 'function' && condition(cell.has)){
					instances.push(cell.has);
				}
			}
		}
	}
	return instances;
}

/**
 * Render cell if is on sight of instance
 * @param {object} instance 
 */
function renderCellOnInstanceSight(instance){
	getPlainCellsAroundPoint(instance.i, instance.j, instance.parent.grid, instance.sight, (cell) => {
		if (pointsDistance(instance.i, instance.j, cell.i, cell.j) <= instance.sight){
			cell.visible = true;
			if (cell.has){
				cell.has.visible = true;
			}
		}
	})
}

/**
 * Get all the coordinate around a point with a maximum distance
 * @param {number} startX 
 * @param {number} startY 
 * @param {number} dist 
 */
function getPlainCellsAroundPoint(startX, startY, grid, dist, callback){
	let result = [];
	if (!dist){
		const cell = grid[startX][startY];
		if (typeof callback === 'function'){
			if (callback(cell)){
				result.push(cell);
			}
		}else{
			result.push(cell);
		}
		return result;
	}
	for (let i = startX - dist; i <= startX + dist; i++){
		for (let j = startY - dist; j <= startY + dist; j++){
			if (grid[i] && grid[i][j]){
				const cell = grid[i][j];
				if (typeof callback === 'function'){
					if (callback(cell)){
						result.push(cell);
					}
				}else{
					result.push(cell);
				}
			}
		}
	}
	return result;
}

/**
 * Get the coordinate around point at a certain distance
 * @param {number} startX 
 * @param {number} startY 
 * @param {number} dist 
 */
function getCellsAroundPoint(startX, startY, grid, dist, callback){
	let result = [];
	if (!dist){
		const cell = grid[startX][startY];
		if (typeof callback === 'function'){
			if (callback(cell)){
				result.push(cell);
			}
		}else{
			result.push(cell);
		}
		return result;
	}
	let x = startX - dist;
	let y = startY - dist;
	let loop = 0;
	let velX = 1;
	let velY = 0;
	let line = 0;
	for(let i = 0; i < 8+(dist-1)*8; i++){
		x += velX;
		y += velY;
		if (grid[x] && grid[x][y]){
			const cell = grid[x][y];
			if (typeof callback === 'function'){
				if (callback(cell)){
					result.push(cell);
				}
			}else{
				result.push(cell);
			}
		}
		line++;
		if (line === dist * 2 ){
			let speed = loop > 0 ? -1 : 1;
			if (loop%2){
				velX = speed;
				velY = 0;
			}else{
				velX = 0;
				velY = speed;
			}
			line = 0;
			loop++;						
		}
	}
	return result;
}

/**
 * Get the closest instances to another instance
 * @param {object} instance 
 * @param {object} instances 
 */
function getClosestInstance(instance, instances){
	let distances = [];
	for (let i = 0; i < instances.length; i++){
		distances.push({
			target: instances[i],
			dist: instancesDistance(instance, instances[i])
		})
	}
	distances.sort((a, b) => a.dist - b.dist);
	return distances.length && distances[0].target;
}

/**
 * Allow to filter instances by a array of types
 * @param {object} instances 
 * @param {array} types 
 */
function filterInstancesByTypes(instances, types){
	let filtered = [];
	for (let i = 0; i < instances.length; i++){
		if (types.indexOf(instances[i].type) >= 0){
			filtered.push(instances[i]);
		}
	}
	return filtered;
}