function getSprites(url, name, count){
	return Array.apply(null, Array(count)).map((val, index) => {
		let finalIndex = index + 1;
		if (finalIndex < 10){
			finalIndex = '00' + finalIndex;
		}else if (finalIndex < 100){ 
			finalIndex = '0' + finalIndex;
		}
		return { name: `${finalIndex}_${name}`, url: `${url}/${finalIndex}_${name}.png` }
	});
}
function cartesianToIsometric(x, y){
	return [
		Math.floor((x - y) * cellWidth / 2),
		Math.floor((x + y) * cellHeight / 2)
	]
}
function pointIsBeetweenTwoPoint(line1, line2, pnt, lineThickness) {
	let L2 = (((line2.x - line1.x) * (line2.x - line1.x)) + ((line2.y - line1.y) * (line2.y - line1.y)));
	if (L2 == 0) return false;
	let r = (((pnt.x - line1.x) * (line2.x - line1.x)) + ((pnt.y - line1.y) * (line2.y - line1.y))) / L2;
	//Assume line thickness is circular
	if (r < 0) {
	  	//Outside line1
	  	return (Math.sqrt(((line1.x - pnt.x) * (line1.x - pnt.x)) + ((line1.y - pnt.y) * (line1.y - pnt.y))) <= lineThickness);
	} else if ((0 <= r) && (r <= 1)) {
	  	//On the line segment
	  	let s = (((line1.y - pnt.y) * (line2.x - line1.x)) - ((line1.x - pnt.x) * (line2.y - line1.y))) / L2;
	  	return (Math.abs(s) * Math.sqrt(L2) <= lineThickness);
	} else {
	  	//Outside line2
	  	return (Math.sqrt(((line2.x - pnt.x) * (line2.x - pnt.x)) + ((line2.y - pnt.y) * (line2.y - pnt.y))) <= lineThickness);
	}
}

function isometricToCartesian(x, y){
	return [
		Math.round(((x / (cellWidth / 2)) + (y / (cellHeight / 2))) / 2),
		Math.round(((y / (cellHeight / 2)) - (x / (cellWidth / 2))) / 2)
	]
}
function getRandomCell(grid){
	return grid[Math.floor(Math.random()*size)][Math.floor(Math.random()*size)];
}

function randomRange(min, max) {
	return Math.floor(Math.random() * (max - min + 1) + min);
}

function heuristic(a,b){
	return pointDistance(a.x, a.y, b.x, b.y);
}

function getInstanceZIndex(instance){
	let pos = isometricToCartesian(instance.x,instance.y + (instance.z * cellDepth));
	let ext = instance.name !== 'cell' ? (cellHeight / 2) : 0;
	return pos[0] + pos[1] + ext;
}
function diff(a,b){
	return Math.abs(a - b);
}
function moveTowardPoint(instance, x, y, speed){
	let dist = pointDistance(x,y,instance.x,instance.y);
	let tX = x - instance.x;
	let tY = y - instance.y;
	let velX = ((tX)/dist)*speed;
	let velY = ((tY)/dist)*speed;
	instance.radian = Math.atan2(tY, tX);
	instance.degree = Math.round(instance.radian * 180 / Math.PI + 180);
	instance.x += velX;
	instance.y += velY;
}
function pointDistance(x1, y1, x2, y2){
	let a = x1 - x2;
	let b = y1 - y2;
	return Math.sqrt( a*a + b*b );
}
function pointInRectangle(x, y, left, top, width, height) {
    return (x > left && x < left + width && y > top && y < top + height);
}
function getInstanceClosestFreeCell(instance, x, y, map){
	for (let i = 1; i < 50; i++){
		let paths = [];
		let neighbours = getCellAroundPoint(x, y, map.grid, i, true);
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
}
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
			cloneGrid[i][j].neighbours = getCellAroundPoint(i, j, cloneGrid, 1);
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
					let tempG = current.g + heuristic(neighbour, current);
					if(!openCells.includes(neighbour)){
						openCells.push(neighbour);
					}else{
                        continue;
                    }
					neighbour.g = tempG;
					neighbour.h = heuristic(neighbour, end);
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
	return [...path];
}
function getCellAroundPoint(startX, startY, grid, dist, freeOnly){
	let result = [];
	coordinates = getCoordinateAroundPoint(startX, startY, dist);

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
function getCoordinateAroundPoint(startX, startY, dist){
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