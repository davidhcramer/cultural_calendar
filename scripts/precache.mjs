import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const assets=readdirSync('dist/assets').map(x=>'assets/'+x);
const version=createHash('sha256').update(readFileSync('dist/index.html')).digest('hex').slice(0,12);
let worker=readFileSync('public/sw.js','utf8').replace('culture-shell-v1','culture-shell-'+version);
worker=worker.replace("[BASE,BASE+'manifest.webmanifest',BASE+'icon-192.png']",JSON.stringify(['','manifest.webmanifest','icon-192.png',...assets]).replace(/\[/,'[')+'.map(path=>BASE+path)');
writeFileSync('dist/sw.js',worker);
