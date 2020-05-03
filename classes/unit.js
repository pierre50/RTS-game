class Unit extends PIXI.Sprite{
	constructor(x, y, z){
		let texture = app.loader.resources['unit'].texture;//657
		super(texture);
		this.anchor.set(-1,.5);
		
		this.name = "unit"
		this.x = x;
		this.y = y;
		this.z = z;
		this.nextX = null;
		this.nextY = null;
		this.nextZ = null;
		this.dest = null;
		this.path = [];
		this.zIndex = getInstanceZIndex(this);
		this.normalSpeed = 1.5;
		this.speed = this.normalSpeed;
		this.slowSpeed = this.speed / 1.25;
		this.interactive = true;
		this.selected = false;
		this.radian = 0;
	}
	select(){
		this.selected = true;
		let selection = new PIXI.Graphics();
		selection.name = 'selection';
		selection.zIndex = 3;
		selection.lineStyle(1, 0xFF0000);
		selection.drawEllipse(30, 15, 15, 10);
		this.addChild(selection);
	}
	unselect(){
		this.selected = false;
		let selection = this.getChildByName('selection');
		if (selection){
			this.removeChild(selection);
		}
	}
	hasPath(){
		return this.path.length > 0;
	}
	step(){
		if (this.hasPath()){
			this.nextX = this.path[this.path.length - 1].x;
			this.nextY = this.path[this.path.length - 1].y;
			this.nextZ = this.path[this.path.length - 1].z;
			this.dest = this.path[0];
			//Change move speed depend on ground inclination
			let pos = isometricToCartesian(this.x,this.y + (this.z * cellDepth));
			if (map.grid[pos[0]][pos[1]].inclined){
				this.speed = this.slowSpeed;
			}else{
				this.speed = this.normalSpeed;
			}
			this.zIndex = getInstanceZIndex(this); 
			if (pointDistance(this.x, this.y, this.nextX, this.nextY) < this.speed){
				this.x = this.nextX;
				this.y = this.nextY;
				this.z = this.nextZ;
				this.zIndex = getInstanceZIndex(this); 
				this.path.pop();
			}else{
				moveTowardPoint(this, this.nextX, this.nextY, this.speed);
				this.rotation = this.radian;
			}
		}
	}
}