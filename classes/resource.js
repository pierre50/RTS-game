class resource extends PIXI.Container{
	constructor(i, j, map, options){
		super();

		this.setParent(map);
		this.id = this.parent.children.length;
		this.name = 'resource';
		this.i = i;
		this.j = j;
		this.x = this.parent.grid[i][j].x;
		this.y = this.parent.grid[i][j].y;
		this.z = this.parent.grid[i][j].z;
		this.zIndex = getInstanceZIndex(this);
		this.parent.grid[i][j].has = this;
        this.selected = false;
		this.visible = false;

		Object.keys(options).forEach((prop) => {
			this[prop] = options[prop];
		})

		this.life = this.lifeMax;

		//Set solid zone
		const cell = map.grid[i][j];
		cell.solid = true;
		cell.has = this;
		
		if (this.sprite){
			//Change mouse icon if mouseover/mouseout events
            this.sprite.on('pointertap', () => {
                if (!player.selectedUnits.length){
                    player.unselectAll();
                    this.select();
                    player.interface.setBottombar(this);
                    player.selectedOther = this;
                }
            });
			this.addChild(this.sprite);
        }
    }
    select(){
        if (this.selected){
			return;
		}
		this.selected = true;
		const selection = new PIXI.Graphics();
		selection.name = 'selection';
		selection.zIndex = 3;
		selection.lineStyle(1, 0xffffff);
		const path = [(-32*this.size), 0, 0,(-16*this.size), (32*this.size),0, 0,(16*this.size)];
        selection.drawPolygon(path);
		this.addChildAt(selection, 0);
    }
    unselect(){
		this.selected = false;
		const selection = this.getChildByName('selection');
		if (selection){
			this.removeChild(selection);
		}
	}
	die(){
		if (this.parent){
			if (typeof this.onDie === 'function'){
				this.onDie();
			}
			const listName = 'founded' + this.type + 's';
			for (let i = 0; i < this.parent.players.length; i++){
				const list = this.parent.players[i][listName];
				const index = list.indexOf(this);
				list.splice(index, 1);
			}
			this.parent.grid[this.i][this.j].has = null;
			this.parent.grid[this.i][this.j].solid = false;
			this.parent.removeChild(this);
		}
		this.isDestroyed = true;
		this.destroy({ child: true, texture: true });
	}
	setDefaultInterface(element, data){
		const type = document.createElement('div');
		type.id = 'type';
		type.textContent = this.type;
		element.appendChild(type);

		const img = document.createElement('img');
		img.id = 'icon';
		img.src = getIconPath(data.icon);
		element.appendChild(img);

		if (this.life){
			const life = document.createElement('div');
			life.id = 'life';
			life.textContent = this.life + '/' + this.lifeMax;
			element.appendChild(life);
		}
		if (this.quantity){
			const quantity = document.createElement('div');
			Object.assign(quantity.style, {
				display: 'flex',
				alignItems: 'center',
			})
			quantity.id = 'quantity';
			let iconToUse;
			switch (this.type){
				case 'Tree':
					iconToUse = player.interface.icons['wood'];
					break;
				case 'Berrybush':
					iconToUse = player.interface.icons['food'];
					break;
			} 
			const icon = document.createElement('img');
			Object.assign(icon.style, {
				objectFit: 'none',
				height: '13px',
				width: '20px',
				marginRight: '2px',
				border: '1.5px inset #686769',
				borderRadius: '2px'
			})
			icon.src = iconToUse;
			const text = document.createElement('div');
			text.id = 'quantity-text';
			text.textContent = this.quantity;
			quantity.appendChild(icon);
			quantity.appendChild(text);
			element.appendChild(quantity);
		}
	}
}

class Tree extends resource{
	constructor(i, j, map, textureNames){
		const type = 'Tree';
		const data = empires.resources[type];

		//Define sprite
		const randomSpritesheet = randomItem(textureNames);
		const spritesheet = app.loader.resources[randomSpritesheet].spritesheet;
		const textureName = '000_' + randomSpritesheet + '.png';
		const texture = spritesheet.textures[textureName];
		const sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(spritesheet.data.frames[textureName].hitArea);
		sprite.on('pointerup', () => {
			if (!player || mouseBuilding || !mouseIsInApp()){
				return;
			}
			//Send Villager to cut the tree
			let hasVillager = false;
			let dest = this;
			for(let i = 0; i < player.selectedUnits.length; i++){
				const unit = player.selectedUnits[i];
				if (instanceIsSurroundedBySolid(this)){
					const newDest = getNewInstanceClosestFreeCellPath(unit, this, this.parent);
					if (newDest){
						dest = newDest.target;
					}
				}
				if (unit.type === 'Villager'){
					hasVillager = true;
					unit.sendToTree(dest);
				}else{
					unit.sendTo(dest);
				}
			}
			if (hasVillager){
				drawInstanceBlinkingSelection(dest);
			}
		})

		super(i, j, map, {
			type,
			sprite: sprite,
			size: 1,
			quantity: data.quantity,
			lifeMax: data.lifeMax,
            interface: {
				info: (element) => {
					this.setDefaultInterface(element, data);
				}
			}
		});
	}
	onDie(){
		const spritesheet = app.loader.resources['623'].spritesheet;
		const textureName = `00${randomRange(0,3)}_623.png`;
		const texture = spritesheet.textures[textureName];
		const sprite = new PIXI.Sprite(texture);
		sprite.name = 'stump';
		this.parent.grid[this.i][this.j].addChild(sprite);
	}
}

class Berrybush extends resource{
	constructor(i, j, map){
		const type = 'Berrybush';
		const data = empires.resources[type];

		//Define sprite
		const spritesheet = app.loader.resources['240'].spritesheet;
		const texture = spritesheet.textures['000_240.png'];
		const sprite = new PIXI.Sprite(texture);
		sprite.interactive = true;
		sprite.updateAnchor = true;
		sprite.name = 'sprite';
		sprite.hitArea = new PIXI.Polygon(spritesheet.data.frames['000_240.png'].hitArea);
		sprite.on('pointerup', () => {
			if (!player || mouseBuilding || !mouseIsInApp()){
				return;
			}
			//Send Villager to forage the berry
			let hasVillager = false;
			for(let i = 0; i < player.selectedUnits.length; i++){
				const unit = player.selectedUnits[i];
				if (unit.type === 'Villager'){
					hasVillager = true;
					unit.sendToBerrybush(this);
				}else{
					unit.sendTo(this)
				}
			}
			if (hasVillager){
				drawInstanceBlinkingSelection(this);
			}
		})

		super(i, j, map, {
			type,
			sprite: sprite,
			size: 1,
            quantity: data.quantity,
            interface: {
				info: (element) => {
					this.setDefaultInterface(element, data);
				}
			}
		});
	}
}