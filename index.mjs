
import request from "request";
import * as fs from 'fs';
import { get as getProjection } from 'ol/proj.js';
import { getWidth } from 'ol/extent.js';

const url = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{level}/{row}/{col}"
// "3857"  or "4326"  
const wkid = "3857";
// const extent =  [xMin, yMax, xMax, yMin];
const extent = [12545410, 4177852, 12717504, 4046797];
const levelinterval = [5, 6];

if (true) {
  main();
}

function main() {

  function getOrigin(wkid) {
    const projExtent = getProjection('EPSG:' + wkid).getExtent();
    return [projExtent[0], projExtent[3]]
  }

  function getResolutions(wkid) {
    const projExtent = getProjection('EPSG:' + wkid).getExtent();
    const startResolution = getWidth(projExtent) / 256;

    const resolutions = new Array(24);

    for (let i = 0, ii = resolutions.length; i < ii; ++i) {
      resolutions[i] = startResolution / Math.pow(2, i);
    }

    return resolutions;
  }

  const origin = getOrigin(wkid);
  function rowcol(re, xy) {
    const [x0, y0] = origin

    const tileSize = 256;

    const resolution = re;

    const [x, y] = xy;

    let col = Math.floor(Math.abs(x0 - x) / (tileSize * resolution))

    let row = Math.floor(Math.abs(y0 - y) / (tileSize * resolution))

    return [col, row];
  }

  function sleep(time) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, time);
    })
  }

  const resolutions = getResolutions(wkid);
  async function getTiles() {
    const dir = "./map_" + (new Date()).getSeconds() + "/";
    await fs.mkdirSync(dir);
    for (let lod = levelinterval[0]; lod < levelinterval[1]; lod++) {
      const resolution = resolutions[lod];
      const level = lod;
      const [left, top] = rowcol(resolution, [extent[0], extent[1]]);
      const [right, bottom] = rowcol(resolution, [extent[2], extent[3]]);
      console.log(left, top, right, bottom)
      await fs.mkdirSync(dir + level);
      for (let i = top; i <= bottom; i++) {
        await fs.mkdirSync(dir + level + "/" + i);
        for (let j = left; j <= right; j++) {
          console.log(level, i, j);
          let urlTarget = url.replace("{level}", level).replace("{row}", i).replace("{col}", j);
          console.log(urlTarget)
          request({
            url: urlTarget
          })
            .pipe(fs.createWriteStream(dir + level + "/" + i + "/" + j + '.png'))
          await sleep(200);
        }
      }
    }
  }
  getTiles();
}
