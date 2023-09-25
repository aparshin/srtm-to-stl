import { fromArrayBuffer } from 'geotiff'
import { readFileSync, writeFileSync } from 'fs'
import geokeysToProj4 from 'geotiff-geokeys-to-proj4'

function multScalar(p, num) {
    return [-p[0] * num, -p[1] * num, -p[2] * num]
}

function norm(p) {
    const len = Math.sqrt(p[0]*p[0] + p[1]*p[1] + p[2]*p[2])
    return [p[0] / len, p[1] / len, p[2] / len]
}

function sub(p1, p2) {
    return [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]]
} 

function multComponents(p1, p2) {
    return [p1[0] * p2[0], p1[1] * p2[1], p1[2] * p2[2]]
}

function dotProduct(p1, p2) {
    return p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2]
}

function crossProduct(p1, p2) {
    return [
        p1[1]*p2[2] - p1[2]*p2[1],
        p1[2]*p2[0] - p1[0]*p2[2],
        p1[0]*p2[1] - p1[1]*p2[0]
    ]
}

function createFacet(p1, p2, p3, positiveDirection) {
    let n = norm(crossProduct(sub(p2, p1), sub(p3, p1)))
    n = multScalar(n, Math.sign(dotProduct(n, positiveDirection)))

    return `facet normal ${n.join(' ')}
        outer loop
            vertex ${p1.join(' ')}
            vertex ${p2.join(' ')}
            vertex ${p3.join(' ')}
        endloop
    endfacet
    `
}

function quadrangleToSTL(p1, p2, p3, p4, positiveDirection) {
    const f1 = createFacet(
        multComponents(p1, scaleVec),
        multComponents(p2, scaleVec),
        multComponents(p3, scaleVec),
        positiveDirection
    )
    const f2 = createFacet(
        multComponents(p1, scaleVec),
        multComponents(p3, scaleVec),
        multComponents(p4, scaleVec),
        positiveDirection
    )
    return [f1, f2]
}

function calcBase(data) {
    let min = +Infinity
    let max = -Infinity
    for (let p of data) {
        min = Math.min(min, p)
        max = Math.max(max, p)
    }

    return min - 0.1 * (max - min)
}

function toSTL(data, xDim, yDim, base) {

    const facets = []
    for (let x = 0; x < xDim - 1; x++) {
        for (let y = 0; y < yDim - 1; y++) {
            facets.push(...quadrangleToSTL(
                [x, yDim - y, data[y * xDim + x]],
                [x + 1, yDim - y, data[y * xDim + x + 1]],
                [x + 1, yDim - y - 1, data[(y + 1) * xDim + x + 1]],
                [x, yDim - y - 1, data[(y + 1) * xDim + x]],
                [0, 0, 1]
            ))
        }
    }

    for (let x = 0; x < xDim - 1; x++) {
        facets.push(...quadrangleToSTL(
            [x, yDim, data[x]],
            [x + 1, yDim, data[x + 1]],
            [x + 1, yDim, base],
            [x, yDim, base],
            [0, 1, 0]
        ))
    }

    for (let x = 0; x < xDim - 1; x++) {
        facets.push(...quadrangleToSTL(
            [x, 1, data[(yDim - 1) * xDim + x]],
            [x + 1, 1, data[(yDim - 1) * xDim + x + 1]],
            [x + 1, 1, base],
            [x, 1, base],
            [0, -1, 0]
        ))
    }

    for (let y = 0; y < yDim - 1; y++) {
        facets.push(...quadrangleToSTL(
            [0, y + 1, data[(yDim - 1 - y) * xDim]],
            [0, y + 2, data[(yDim - 1 - y - 1) * xDim]],
            [0, y + 2, base],
            [0, y + 1, base],
            [1, 0, 0]
        ))
    }
    for (let y = 0; y < yDim - 1; y++) {
        facets.push(...quadrangleToSTL(
            [xDim - 1, y + 1, data[(yDim - 1 - y) * xDim + xDim - 1]],
            [xDim - 1, y + 2, data[(yDim - 1 - y - 1) * xDim + xDim - 1]],
            [xDim - 1, y + 2, base],
            [xDim - 1, y + 1, base],
            [-1, 0, 0]
        ))
    }
    facets.push(...quadrangleToSTL(
        [0, 1, base],
        [xDim - 1, 1, base],
        [xDim - 1, yDim, base],
        [0, yDim, base],
        [0, 0, -1]
    ))

    return `solid test
        ${facets.join('\n')}
    endsolid
    `
}

const configFilename = process.argv[2]
const config = JSON.parse(readFileSync(configFilename, 'utf8'));
const centerLng = (config.minLng + config.maxLng) / 2

// Y-size in meters of a pixel in SRTM file
const scaleY = 6357000 * 2 * Math.PI / 360 / 3600
const scaleX = Math.cos(centerLng / 180 * Math.PI) * scaleY
const scaleVec = [scaleX, scaleY, config.heightScale ?? 1.0]

const file = readFileSync(config.filename)

const geoTiff = await fromArrayBuffer(file.buffer)
const image = await geoTiff.getImage()
const bbox = image.getBoundingBox()

console.log(`Dimentions: ${image.getWidth()}x${image.getHeight()}`)
console.log(`Samples per pixel: ${image.getSamplesPerPixel()}`)
console.log(`Sample format: ${image.getSampleFormat()}`)
console.log(`Origin: ${image.getOrigin()}`)
console.log(`Resolution: ${image.getResolution()}`)
console.log(`Bbox: ${bbox}`)

const geoKeys = image.getGeoKeys()
const projObj = geokeysToProj4.toProj4(geoKeys)

console.log(`Projection: ${projObj.proj4}`)

let minX = Math.round((config.minLat - bbox[0]) / (bbox[2] - bbox[0]) * image.getWidth())
let maxX = Math.round((config.maxLat - bbox[0]) / (bbox[2] - bbox[0]) * image.getWidth())
let maxY = Math.round((bbox[3] - config.minLng) / (bbox[3] - bbox[1]) * image.getHeight())
let minY = Math.round((bbox[3] - config.maxLng) / (bbox[3] - bbox[1]) * image.getHeight())

// maxX = minX + 200
// maxY = minY + 200

const window = [minX, minY, maxX, maxY]
const [globalData] = await image.readRasters({window})
const base = calcBase(globalData)

console.log(`Global window: ${window}`)

const chunksCountX = config.chunksCountX ?? 1
const chunksCountY = config.chunksCountY ?? 1

const chunkSizeX = (maxX - minX) / chunksCountX
const chunkSizeY = (maxY - minY) / chunksCountY
for (let nx = 0; nx < chunksCountX; nx++) {
    for (let ny = 0; ny < chunksCountY; ny++) {
        const curWindow = [
            minX + (nx ? Math.floor(nx * chunkSizeX) + 1 : 0),
            minY + (ny ? Math.floor(ny * chunkSizeY) + 1 : 0),
            minX + Math.floor((nx + 1) * chunkSizeX),
            minY + Math.floor((ny + 1) * chunkSizeY)
        ]
        console.log(`Window: ${curWindow}`)
        const [data] = await image.readRasters({window: curWindow})

        const stl = toSTL(data, curWindow[2] - curWindow[0], curWindow[3] - curWindow[1], base)

        writeFileSync(`res_${nx}_${ny}.stl`, stl)
    }
}