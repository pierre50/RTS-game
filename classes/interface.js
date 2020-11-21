class Interface {
	constructor(player){
        this.style = {
            bar : {
                borderStyle: 'inset',
                borderColor: '#686769',
                background: '#3c3b3d',
                width: '100%',
            },
            box:  {
                height: '45px',
                width: '45px',
                position: 'relative',
                display: 'flex',
                marginRight: '2px',
                border: '1.5px inset #686769',
                borderRadius: '2px'
            },
            img: {
                objectFit: 'none',
                height: '45px',
                width: '45px'
            }
        } 
        this.player = player;
        this.topbar = document.createElement('div');
        this.topbar.id = 'topbar';
        this.icons = {
            'wood': 'data/interface/50732/000_50732.png',
            'food': 'data/interface/50732/002_50732.png',
            'stone': 'data/interface/50732/001_50732.png',
            'gold': 'data/interface/50732/003_50732.png',
        }
        Object.assign(this.topbar.style, {
            top: '0',
            padding: '0 5px',
            height: '20px',
            display: 'grid',
            fontWeight: 'bold',
            gridTemplateColumns: '1fr 1fr 1fr',
            ...this.style.bar
        });
        
        this.resources = document.createElement('div');
        Object.assign(this.resources.style, {
            display: 'flex'
        });
        ['wood', 'food', 'stone', 'gold'].forEach((res) => {
            this.setResourceBox(res)
        })

        this.age = document.createElement('div');
        Object.assign(this.age.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        });
        this.options = document.createElement('div');
    
        this.topbar.appendChild(this.resources);
        this.topbar.appendChild(this.age);
        this.topbar.appendChild(this.options);
        gamebox.prepend(this.topbar)

        const bottombar = document.createElement('div');
        Object.assign(bottombar.style, {
            bottom: '0',
            display: 'grid',
            height: '122px',
            gridTemplateColumns: '120px auto',
            gridGap: '10px',
            padding: '5px',
            marginBottom: '1px',
            ...this.style.bar
        });
        this.bottombarInfo = document.createElement('div');
        Object.assign(this.bottombarInfo.style, {
            height: '114px',
            width: '120px',
            position: 'relative',
            border: '4px inset #686769',
            borderRadius: '2px'
        })
        this.bottombarMenu = document.createElement('div');
        this.bottombarMenu.style.display = 'flex';
        bottombar.appendChild(this.bottombarInfo);
        bottombar.appendChild(this.bottombarMenu);
        gamebox.appendChild(bottombar);

        this.selection;
        this.updateTopbar();
    }
    getMessage(cost){
        const resource = Object.keys(cost).find(prop => (player[prop] < cost[prop]));
        return `You need more ${resource} !`;
    }
    showMessage(message){
        if (document.getElementById('msg')){
            document.getElementById('msg').remove();
        }
        const box = document.createElement('div');
        box.id = 'msg';
        Object.assign(box.style, {
            zIndex: '1000',
            bottom: (appBottom + 5) + 'px',
            position: 'fixed',
            width: '100%',
            textAlign: 'center'
        });
        const msg = document.createElement('span');
        msg.textContent = message;
        Object.assign(msg.style, {
            color: '#DA2424',
            background: 'rgba(0,0,0,.4)',
            padding: '3px'
        });
        
        box.appendChild(msg);
        gamebox.appendChild(box);
        setTimeout(() => {
            box.remove();
        }, 3000)
    }
    setResourceBox(name){
        const box = document.createElement('div');
        Object.assign(box.style, {
            display: 'flex',
            marginRight: '40px',
            alignItems: 'center',
        })
        const img = document.createElement('img');
        Object.assign(img.style, {
            objectFit: 'none',
            height: '13px',
            width: '20px',
            marginRight: '2px',
            border: '1.5px inset #686769',
            borderRadius: '2px'
        })
        img.src = this.icons[name];
        this[name] = document.createElement('div');
        box.appendChild(img);
        box.appendChild(this[name]);
        this.resources.appendChild(box);
    }
    updateTopbar(){
        ['wood', 'food', 'stone', 'gold', 'age'].forEach((prop) => {
            this[prop].textContent = this.player[prop];
        })
    }
    resetInfo(){
        this.bottombarInfo.textContent = '';
        this.bottombarInfo.style.background = 'transparent';
    }
    generateInfo(selection){
        this.resetInfo();
		this.bottombarInfo.style.background = 'black';
        if (typeof selection.interface.info === 'function'){
            selection.interface.info(this.bottombarInfo);
        }
    }
    updateInfo(target, action){
        const targetElement = this.bottombarInfo.querySelector(`[id=${target}]`);
        if (!targetElement || typeof action !== 'function'){
            return;
        }
        return action(targetElement);
    }
    updateButton(target, action){
        const targetElement = this.bottombarMenu.querySelector(`[id=${target}]`);
        if (!targetElement || typeof action !== 'function'){
            return;
        }
        const contentElement = targetElement.querySelector('[id=content');
        if (!contentElement){
            return;
        }
        return action(contentElement);
    }
    setBottombar(selection = null){
        let me = this;
        this.resetInfo();
        this.bottombarMenu.textContent = '';
        this.selection = selection;
        if (mouseBuilding){
            this.removeMouseBuilding();
        }
        if (selection && selection.interface){
            this.generateInfo(selection);
            if (selection.name === 'building'){
                if (!selection.isBuilt){
                    setMenuRecurs(selection, this.bottombarMenu, []);
                    return;
                }
            }
            setMenuRecurs(selection, this.bottombarMenu, selection.interface.menu || []);
        }
        function setMenuRecurs(selection, element, menu, parent){
            menu.forEach((btn) => {
                const box = document.createElement('div');
                box.id = btn.id;
                if (typeof btn.onCreate === 'function'){
                    btn.onCreate(selection, box);
                }else{
                    const img = document.createElement('img');
                    img.src = btn.icon;
                    Object.assign(img.style, me.style.img);
                    box.appendChild(img);
                }
                Object.assign(box.style, me.style.box);
                if (typeof btn.onUpdate === 'function'){
                    box.onUpdate = btn.onUpdate;
                }
                if (btn.children){
                    box.addEventListener('pointerdown', (evt) => {
                        element.textContent = '';
                        me.removeMouseBuilding();
                        setMenuRecurs(selection, element, btn.children, menu);
                    });
                }else {
                    box.addEventListener('pointerdown', (evt) => btn.onClick(selection, evt));
                }
                element.appendChild(box);
            })
            if (parent || selection.selected){
                const back = document.createElement('div');
                const img = document.createElement('img');
                back.id = 'interfaceBackBtn';
                img.src = 'data/interface/50721/010_50721.png';
                Object.assign(img.style, me.style.img);
                Object.assign(back.style, me.style.box);
                if (parent){
                    back.addEventListener('pointerdown', (evt) => {
                        element.textContent = '';
                        me.removeMouseBuilding();
                        setMenuRecurs(selection, element, parent);
                    })
                }else{
                    back.addEventListener('pointerdown', (evt) => {
                        me.removeMouseBuilding();
                        me.player.unselectAll();
                    })
                }
                back.appendChild(img);
                element.appendChild(back);
            }
        }
    }
    getUnitButton(type){
		const unit = empires.units[type];
        return {
            icon: getIconPath(unit.icon),
            id: type,
            onCreate: (selection, element) => {
                const img = document.createElement('img');
                img.src = getIconPath(unit.icon);
                debugger
                Object.assign(img.style, this.style.img);
                const queue = selection.queue.filter(queue => queue === type).length;
                const counter = document.createElement('div');
                counter.id = 'content';
                counter.style.padding = '1px';
                counter.textContent = queue || '';
                counter.style.position = 'absolute';
                element.appendChild(img);
                element.appendChild(counter);
            },
            onClick: (selection) => {
                if (canAfford(this.player, unit.cost)){
                    selection.buyUnit(type);
                }else{
                    this.showMessage(this.getMessage(unit.cost));
                }
            }
        }
    }
    getBuildingButton(type){
		const building = empires.buildings[this.player.civ][this.player.age][type];
        return {
            icon: getIconPath(building.icon),
            onClick: (selection, evt) => {
                this.removeMouseBuilding();
                if (canAfford(this.player, building.cost)){
                    mouseBuilding = new PIXI.Container();
                    const sprite = new PIXI.Sprite(getTexture(building.images.final));
                    sprite.name = 'sprite';
                    if (building.images.color){
                        const color = new PIXI.Sprite(getTexture(building.images.color));
                        color.name = 'color';
                        changeSpriteColor(color, this.player.color);
                        mouseBuilding.addChild(color);
                    }else{
                        changeSpriteColor(sprite, this.player.color);
                    }
                    mouseBuilding.addChild(sprite);
                    mouseBuilding.type = type;
                    mouseBuilding.size = building.size;
                    mouseBuilding.x = evt.x;
                    mouseBuilding.y = evt.y;
                    mouseBuilding.name = 'mouseBuilding';
                    app.stage.addChild(mouseBuilding);
                }else{
                    this.showMessage(this.getMessage(building.cost));
                }
            }
        }
    }
    removeMouseBuilding(){
        if (!mouseBuilding){
            return;
        }
        app.stage.removeChild(mouseBuilding);
        mouseBuilding.destroy();
        mouseBuilding = null;
    }
}