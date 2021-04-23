//eanDebug make all "game" attributes compatible with Phaser 3
let GridSystem = (scene, settings) => {
    let error = (type) => {
        throw `Grid System needs: ${type}`
    }

    /* example model of occupantShell
        let occupantShellStruct = {
            sprite: phaserSprite,
            panX: 5, //panel location xoffset
            panY: 10, //panel location yoffset
            type: 0, //occupant type as it pertains game object identity
            inputs: {}, //inputs interface
            onPanel: [function], //callback occuring everytime occupant changes panels
            currentPanel: panelShell,
            gridId: 0,
            coolDownModifier: 0.75, //delta for next movement
            canMove: true
        }
    */

    
    let width        = settings.width || error("width");               //height of panel
    let height       = settings.height || error("height");             //width of panel
    let gridSprite   = settings.gridSprite || error("phaser sprite");  //phaser sprite of grid
    let rowAmount    = settings.rowAmount || error("rowAmount");      //width of entire grid
    let columnAmount = settings.columnAmount || error("columnAmount"); //height of entire grid
    

    let alpha        = settings.alpha || 1;  //grid opacity value
    let startX       = settings.startX || 0; //base x coordinate of grid
    let startY       = settings.startY || 0; //base y coordinate of grid
    let xGap         = settings.xGap || 0;   //horizonatal space between panels
    let yGap         = settings.yGap || 0;   //vertical space between panels
    
    //3D 'depth' attributes
    let depth = settings.depth || 0;  //amount of layers in depth (or z space)
    let zGap  = settings.zGap || 0; //space between panel floor levels
    //2d array of layers representing indexes that specify the offset of the respective layer
    //to give a 3D perspective
    let layerOffset = settings.layerOffset || [[0,0]]; 
    
    let layerOffsetError = (Array.isArray(layerOffset) === false) || layerOffset.length !== depth;
    if (layerOffsetError){
        error("a correct layer offset");
    }
    
    let gs = {};
    gs._occupantID = 0;
    gs._occupiedPanels = {}; //collection of signatures;
    
    gs._generateGridPanels = (depthIn) => {
        let panels = [];
        for (let r = 0; r < rowAmount; r++){
            panels.push([]);
            for (let c = 0; c < columnAmount; c++){
                let zOff = zGap * depthIn;
                let xPosition = startX + layerOffset[depthIn][0] + (xGap * c) + (c * width);
                let yPosition = startY + layerOffset[depthIn][1] + (yGap * r) + (r * height);
                // xPosition  += (xGap * c) + (c * width);
                // yPosition += (yGap * r) + (r * height);
                // xPosition += zOff; //give perspective angle from other layers
                // yPosition += zOff;
                let panelSprite = scene.add.sprite(xPosition, yPosition, gridSprite);
                panelSprite.displayWidth  = width;
                panelSprite.displayHeight = height;
                panelSprite.alpha = alpha;
                panelSprite.originX = 0.5;
                panelSprite.originY = 0.5;
                panelSprite.visible = true;
                let panelShell = {
                    sprite: panelSprite,
                    occupants: [], //collection of different scene objects on this panel
                    neighbors: {
                        up: null,
                        down: null,
                        left: null,
                        right: null
                    }, //adjacent grid panels
                    idAxis: [r, c], //grid coordinates for instant lookup in _occupiedPanels
                    positionUpdated: false,
                    gridSystem: gs,
                    status: 0, //arbitrary state of this panel, zero is assummed idle and empty
                };
                panels[r].push(panelShell);
            };
        };

        return panels;
    };

    gs._assignNeighbors = (depthIn) => {
        let test = gs.panels[depthIn];
        for (let row = 0; row < gs.panels[depthIn].length; row++){
            for (let col = 0; col < gs.panels[depthIn][row].length; col++){
                let panel = gs.panels[depthIn][row][col];
                if (row > 0){
                    panel.neighbors.up = gs.panels[depthIn][row - 1][col];
                }
                if (row < gs.panels[depthIn].length - 1){
                    panel.neighbors.down = gs.panels[depthIn][row + 1][col];
                }
                if (col > 0){
                    panel.neighbors.left = gs.panels[depthIn][row][col -1];
                }
                if (col < gs.panels[depthIn][row].length - 1){
                    panel.neighbors.right = gs.panels[depthIn][row][col + 1];
                }
            }
        }
    };
    
    gs.insertOccupant = (y, x, depthIn, occupantShell) => {
        let panel = gs.panels[depthIn][y][x];
        panel.occupants.push(occupantShell);
        occupantShell.currentPanel = panel;
        if (occupantShell.onPanel !== null && typeof occupantShell.onPanel === "function"){
            occupantShell.onPanel(panel);
        }
        gs._occupiedPanels[`y${y},x${x}`] = panel.idAxis
        return panel
    };

    gs.removeOccupant = (panel, occupant) => {
        for (let occ = 0; occ < panel.occupants.length; occ++){
            if (panel.occupants[occ] === occupant){
                let removed = panel.occupants.splice(occ, 1)[0];
                
                if (typeof removed.type !== "undefined"){
                    panel.status = 0;
                }
                break;
            }
        }

        const noOccupants = panel.occupants.length === 0
        if (noOccupants){
            let panelID = `y${panel.idAxis[0]},x${panel.idAxis[1]}`
            delete gs._occupiedPanels[panelID];
        }

        return noOccupants;
    }

    gs.destroyOccupant = (occupant) => {
        gs.removeOccupant(occupant.currentPanel, occupant);
        occupant.sprite.destroy();

        if (occupant.onDestroy !== null && typeof occupant.onDestroy === "function"){
            occupant.onDestroy();
        }

        return occupant.gridID;
    }

    gs.moveOccupantPanelDirection = (occupant, gridDirection, call = null) => {
        let destination
        if (occupant.canMove) {
             switch(gridDirection){
                case "up":
                    if (occupant.currentPanel.neighbors.up !== null){
                        destination = [
                            occupant,
                            occupant.currentPanel,
                            occupant.currentPanel.neighbors.up
                        ]                          
                    }
                break;
        
                case "down":
                    if (occupant.currentPanel.neighbors.down !== null){
                        destination = [
                            occupant,
                            occupant.currentPanel,
                            occupant.currentPanel.neighbors.down
                        ]
                    }
                break;
        
                case "left":
                    if (occupant.currentPanel.neighbors.left !== null){
                        destination = [
                            occupant,
                            occupant.currentPanel,
                            occupant.currentPanel.neighbors.left
                        ]
                    }
                break;
        
                case "right":
                    if (occupant.currentPanel.neighbors.right !== null){
                        destination = [
                            occupant,
                            occupant.currentPanel,
                            occupant.currentPanel.neighbors.right
                        ]
                    }
                break;
            }
            if (typeof destination !== "undefined" && call !== null && typeof call === "function"){
                gs.transferOccupant(...destination);
                call(...destination);
            } 
        }
    }

    gs.debugNeighbors = (panel) => {
        console.log("Me: ", panel);
        console.log(`x: ${panel.sprite.x}, y: ${panel.sprite.y}`);
        let neighbors = Object.keys(panel.neighbors);
        neighbors.forEach((n) => {
            let neighb = panel.neighbors[n]
            console.log(`Neighbor ${n}:`, neighb);

            if (neighb !== null){
                console.log(`x: ${neighb.sprite.x}, y: ${neighb.sprite.y}`);
            }
        });
    }

    gs.transferOccupant = (occupant, oldPanel, newPanel) => {
        gs.removeOccupant(oldPanel, occupant);
        let x = newPanel.idAxis[1];
        let y = newPanel.idAxis[0];
        gs.insertOccupant(y, x, occupant);
        return newPanel;
    }

    /**
     * Assign id to first time being on the grid
     * @param {object} occupant - shell representing game sprite
     * @returns {object} occupant
     */
    gs.registerOccupant = (occupant) => {
        occupant.gridID = gs._occupantID++;
        return occupant;
    }

    gs.resetMovement = (shell) => {
        shell.canMove = true;
    }

    gs.update = (depthIn) => {
        let oPanels = gs._occupiedPanels;
        for (let i in oPanels){
            let p = oPanels[i];
            let x = p[1];
            let y = p[0];
            let panel = gs.panels[depthIn][y][x];
            panel.occupants.forEach((shell) => {
                if (shell.onPanel !== null && typeof shell.onPanel === "function"){
                    shell.onPanel(panel);
                }
            });
        }
    };

    gs.panels = []
    for (let i = 0; i < depth; i++) {
        gs.panels.push(gs._generateGridPanels(i));
        gs._assignNeighbors(i);
    }
    console.log(gs.panels[0][0][0].sprite.x)
    console.log(gs.panels[1][0][0].sprite.x)
    console.log(gs.panels[2][0][0].sprite.x)
	return gs;
}

export default GridSystem;
