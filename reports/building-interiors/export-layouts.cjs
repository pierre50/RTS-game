const fs = require('node:fs')
const { loadTsModule } = require('../../tests/helpers/loadTsModule.cjs')
const { furnishInterior } = require('../../tests/helpers/interiorFurnitureFixture.cjs')
const { createIsometricInteriorBlueprint } = loadTsModule('app/classes/map/generation/LocalMapBlueprint.ts')
const { getInteriorWallGeometry } = loadTsModule('app/lib/terrain/interiorWallGeometry.ts')
const { createInteriorWallOcclusionCheck } = loadTsModule('app/lib/terrain/interiorWallOcclusion.ts')
const { getBuildingAsset } = loadTsModule('app/lib/graphics/assets.ts')
const { getInteriorFloorDecorations } = loadTsModule('app/lib/buildings/furniture/interiorFloorDecorations.ts')
const config = require('../../public/assets/data/gameplay/buildings.json')
const types = {TownCenter:'Town Center',Barracks:'Caserne',Temple:'Temple',Granary:'Grenier',StoragePit:'Dépôt',Stable:'Écurie',WatchTower:'Tour de guet'}
const data=Object.entries(types).map(([type,name])=>{
 const size=config[type].size*2+7
 const bp=createIsometricInteriorBlueprint({size,terrain:[],exits:[],resources:[],interiorType:type})
 const occludes=createInteriorWallOcclusionCheck(bp)
 const walls=bp.walls.filter(w=>bp.floorMask[w.i][w.j]&&!bp.exits.some(e=>e.i===w.i&&e.j===w.j)).map(w=>{const g=getInteriorWallGeometry(bp,w);return {...g,low:w.side>=2||occludes(g)}})
 const furniture=furnishInterior(type).owner.buildings.map(b=>({...b,asset:getBuildingAsset(b.assetType||b.type,{},{}),z:b.i+b.j+(config[b.type].zIndexOffset||0)}))
 return {type,name,size,bp,walls,furniture,rugs:getInteriorFloorDecorations(type),cells:bp.floorMask.flat().filter(Boolean).length}
})
fs.writeFileSync(__dirname+'/layouts.json',JSON.stringify(data))
console.log(data.map(d=>`${d.name}: ${d.cells} cases, ${d.furniture.length} meubles`).join('\n'))
