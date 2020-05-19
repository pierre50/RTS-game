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
function getPercentage(a, b){
	return Math.floor(a/b*100);
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
	return Math.floor(instancesDistance(a, b, true)) <= b.size;
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
	for (let i = 1; i < 100; i++){
		let neighbours = getCellsAroundPoint(x, y, grid, i, true);
		if (neighbours.length){
			return neighbours[0];
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
	for (let i = 1; i < 50; i++){
		let paths = [];
		let neighbours = getCellsAroundPoint(x, y, map.grid, i, true);
		for (let n = 0; n < neighbours.length; n++){
			let path = getInstancePath(instance, neighbours[n].i, neighbours[n].j, map);
			if (path.length){
				paths.push(path);
			}
		}
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
	selection.drawEllipse(0, 0, cellHeight, 10);
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
	let cloneGrid = [];
	for(var i = 0; i < map.size; i++){
		for(var j = 0; j < map.size; j++){
			if(cloneGrid[i] == null){
				cloneGrid[i] = [];	
			}
			cloneGrid[i][j] = {
				i,
				j,
				x: map.grid[i][j].x,
				y: map.grid[i][j].y,
				z: map.grid[i][j].z,
				solid: map.grid[i][j].solid
			}
		}
	}
	//find neighbours
	for(var i = 0; i < map.size; i++){
		for(var j = 0; j < map.size; j++){
			cloneGrid[i][j].neighbours = getCellsAroundPoint(i, j, cloneGrid, 1);
		}
	}
	let isFinish = false;
	let path = [];
	let openCells = [];
	let closedCells = [];
	let startPos = isometricToCartesian(instance.x, instance.y+(instance.z * cellDepth));
	let end = cloneGrid[x][y];
	if (!cloneGrid[startPos[0]] && !cloneGrid[startPos[0]][startPos[1]]){
		return;
	}
	openCells.push(cloneGrid[startPos[0]][startPos[1]]);
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
			if(current === end){
				//reached the end cell
				isFinish = true;
			}
			//calculate path
			path = [end];
			let temp = current;
			while(temp.previous){
				path.push(temp.previous);
				temp = temp.previous;
			}
			openCells.splice(openCells.indexOf(current),1);
			closedCells.push(current);
			//check neighbours
			let neighbours = current.neighbours;
			for(let i = 0; i < neighbours.length; i++){
				let neighbour = neighbours[i];
				if(!closedCells.includes(neighbour) && !neighbour.solid && diff(current.z,neighbour.z) < 2 ){
					let tempG = current.g + instancesDistance(neighbour, current);
					if(!openCells.includes(neighbour)){
						openCells.push(neighbour);
					}else{
                        continue;
                    }
					neighbour.g = tempG;
					neighbour.h = instancesDistance(neighbour, end);
					neighbour.f = neighbour.g + neighbour.h;
					neighbour.previous = current
				}
			}
		}
		else{
			//no solution
			path = [];
			isFinish = true;
		}
	}
	path.pop();
	return [...path];
}
/**
 * Get all the cells around a point with a certain distance, can filter on solid.
 * @param {number} startX 
 * @param {number} startY 
 * @param {object} grid 
 * @param {number} dist 
 * @param {boolean} freeOnly 
 * @param {boolean} plain 
 */
function getCellsAroundPoint(startX, startY, grid, dist, freeOnly = false, plain = false){
	let result = [];

	coordinates = plain ? getPlainCoordinatesAroundPoint(startX, startY, dist) : getCoordinatesAroundPoint(startX, startY, dist);

	for(let i = 0; i < coordinates.length; i++){
		let neighbour = coordinates[i];
		if (grid[neighbour[0]] && grid[neighbour[0]][neighbour[1]]){
			if (freeOnly && !grid[neighbour[0]][neighbour[1]].solid){
				result.push(grid[neighbour[0]][neighbour[1]]);
			}else if (!freeOnly){
				result.push(grid[neighbour[0]][neighbour[1]]);
			}
		}
	}
	return result;
}
/**
 * Get all the coordinate around a point with a maximum distance
 * @param {number} startX 
 * @param {number} startY 
 * @param {number} dist 
 */
function getPlainCoordinatesAroundPoint(startX, startY, dist){
	if (!dist){
		return [[startX, startY]]
	}
	let result = [];
	for(let i = 0; i <= dist; i++){
		result = [
			...result,
			...getCoordinatesAroundPoint(startX, startY, i)
		]
	}
	return result;
}
/**
 * Get the coordinate around point at a certain distance
 * @param {number} startX 
 * @param {number} startY 
 * @param {number} dist 
 */
function getCoordinatesAroundPoint(startX, startY, dist){
	if (!dist){
		return [[startX, startY]]
	}
	let result = [];
	let x = startX - dist;
	let y = startY - dist;
	let loop = 0;
	let velX = 1;
	let velY = 0;
	let line = 0;
	for(let i = 0; i < 8+(dist-1)*8; i++){
		result.push([x+=velX, y+=velY]);
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
	return distances[0].target;
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
/**
 * UNUSED
 * @param {number} i 
 * @param {number} j 
 * @param {object} grid 
 * @param {boolean} allowDiag 
 */
function getCellNeighbours(i, j, grid, allowDiag){
	let results = []
	if(i-1 >= 0) {
		results.push(grid[i-1][j]);
	}
	if(i+1 < size){
		results.push(grid[i+1][j]);
	}
	if(j-1 >= 0){
		results.push(grid[i][j-1]);
	}
	if(j+1 < size){
		results.push(grid[i][j+1]);
	}
	if (allowDiag){
		if(i-1 >= 0 && j-1 >= 0) {
			results.push(grid[i-1][j-1]);
		}
		if(i+1 < size && j+1 < size){
			results.push(grid[i+1][j+1]);
		}
		if(i+1 < size && j-1 >= 0){
			results.push(grid[i+1][j-1]);
		}
		if(i-1 >= 0 && j+1 < size){
			results.push(grid[i-1][j+1]);
		}
	}
	return results;
}
