import {resize} from './camera.ts';
import {$,site} from './context.ts';
import {requestDraw} from './loop.ts';
import {showDemo} from './portal.ts';
import {go} from './routing.ts';
import {spots} from './town.ts';

declare global {
  // Images the site has already decoded, keyed by asset name; the embedded demo reuses them through window.parent.
  interface Window { EntiaArtwork?: Record<string, HTMLImageElement> }
}
// The asset manifest maps each image name to its file under assets/.
interface AssetManifest { images: Record<string, string> }

function loadImage(path: string) {
  return new Promise<HTMLImageElement>((resolve,reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`Asset unavailable: ${path}`));
    im.src = path;
  });
}
export async function load() {
  $('#retry-load').hidden=true;
  $('#loading p').textContent='Opening the gates of Nix…';
  try {
    const response = await fetch('assets/site-assets.json?v=npcroles8');
    if(!response.ok) throw new Error('Asset manifest unavailable');
    const assets: AssetManifest = await response.json();
    await Promise.all(Object.entries(assets.images).map(async ([key,file]) => site.images[key] = await loadImage('assets/'+file)));
    window.EntiaArtwork=site.images;
    site.ready = true;
    $('#loading').hidden = true;
    const initial = spots[location.hash.slice(1)] ? location.hash.slice(1) : 'home';
    go(initial, {history:false, instant:true, announce:false});
    resize(); requestDraw();if(location.hash==='#demo')showDemo(false);
  } catch(error) {
    $('#loading p').textContent='Nix could not load. You can still explore using the navigation above.';
    $('#retry-load').hidden=false;
    console.error(error);
  }
}
