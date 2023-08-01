
import ProgressBar from 'progress';
import request from "request";
import * as fs from 'fs';
import { get as getProjection } from 'ol/proj.js';
import { getWidth } from 'ol/extent.js';

const key = "lirfd6Fegsjkvs0lshxe";
const url = "https://api.maptiler.com/tiles/satellite/{level}/{row}/{col}.jpg?key=" + key;
// crs: "3857"  or "4326"  
const wkid = "3857";
// const extent =  [xMin, yMax, xMax, yMin];
// target extent
const extent = [-20037508.342789244, 20037508.342789244, 20037508.342789244, -20037508.342789244];
const levelinterval = [1, 6];

(function main() {

  function __getOrigin(wkid) {
    const projExtent = getProjection('EPSG:' + wkid).getExtent();
    return [projExtent[0], projExtent[3]]
  }

  function __getResolutions(wkid) {
    const projExtent = getProjection('EPSG:' + wkid).getExtent();
    const startResolution = getWidth(projExtent) / 256;

    const resolutions = new Array(24);

    for (let i = 0, ii = resolutions.length; i < ii; ++i) {
      resolutions[i] = startResolution / Math.pow(2, i);
    }

    return resolutions;
  }

  const origin = __getOrigin(wkid);
  function __rowcol(re, xy) {
    const [x0, y0] = origin

    const tileSize = 256;

    const resolution = re;

    const [x, y] = xy;

    let col = Math.floor(Math.abs(x0 - x) / (tileSize * resolution))

    let row = Math.floor(Math.abs(y0 - y) / (tileSize * resolution))

    return [col, row];
  }

  const promisePool = async function (functions, n) {
    await Promise.all([...new Array(n)].map(async () => {
      while (functions.length) {
        await functions.shift()()
      }
    }))
  };

  function sleep(time) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, time);
    })
  }

  const resolutions = __getResolutions(wkid);

  // 创建目录
  async function makedir() {
    const dir = "./map_" + (new Date()).getTime() + "/";
    await fs.mkdirSync(dir);
    for (let lod = levelinterval[0]; lod <= levelinterval[1]; lod++) {
      const resolution = resolutions[lod];
      const level = lod;
      const [left, top] = __rowcol(resolution, [extent[0], extent[1]]);
      const [right, bottom] = __rowcol(resolution, [extent[2], extent[3]]);
      await fs.mkdirSync(dir + level);
      for (let i = top; i <= bottom; i++) {
        await fs.mkdirSync(dir + level + "/" + i);
      }
    }
    return dir;
  }

  async function getTiles() {
    const dir = await makedir();
    let functionss = [];
    for (let lod = levelinterval[0]; lod <= levelinterval[1]; lod++) {
      const resolution = resolutions[lod];
      const level = lod;
      const [left, top] = __rowcol(resolution, [extent[0], extent[1]]);
      const [right, bottom] = __rowcol(resolution, [extent[2], extent[3]]);
      // console.log('level:' + level + ';extent:' + left, top, right, bottom)
      for (let i = top; i <= bottom; i++) {
        for (let j = left; j <= right; j++) {

          functionss.push(
            () => new Promise(res => {
              let urlTarget = url.replace("{level}", level).replace("{row}", i).replace("{col}", j);
              // console.log("当前处理目标:" + urlTarget)
              const writeStream = fs.createWriteStream(dir + level + "/" + i + "/" + j + '.jpg')
              const readStream = request(urlTarget)
              readStream.pipe(writeStream);
              readStream.on('end', function (response) {
                // console.log('文件写入成功');
                writeStream.end();
              });

              writeStream.on("finish", function () {
                // console.log("ok");
                bar.tick();
                res();
              });

            })
          );

        }
      }
    }
    var bar = new ProgressBar('  downloading [:bar] :rate/bps :percent :etas', {
      complete: '=',
      incomplete: ' ',
      width: 20,
      total: functionss.length
    });
    promisePool(functionss, 10);
  }
  getTiles();
}())
