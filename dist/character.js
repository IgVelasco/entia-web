/* Device-local character appearance shared by Nix and the offline demo. */
(function(root){
'use strict';
const KEY='entia-character-v1',looks=[{id:'hero',name:'Moonwarden',detail:'Midnight armour · crescent cape · ember staff'},{id:'mage',name:'Crimson sentinel',detail:'Bronze armour · crimson mantle · ember staff'}];
function normalize(value){return {name:typeof value?.name==='string'?value.name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,20)||'Avharot':'Avharot',body:looks.some(l=>l.id===value?.body)?value.body:'hero'};}
function read(){try{return normalize(JSON.parse(root.localStorage.getItem(KEY)));}catch{return normalize(null);}}
let current=read();const subscribers=[];
function publish(value){current=normalize(value);for(const fn of subscribers)fn({...current});}
function save(value){publish(value);try{root.localStorage.setItem(KEY,JSON.stringify(current));return true;}catch{return false;}}
function mount({assets,onChange,onOpen,onClose}){
 const q=s=>document.querySelector(s),dialog=q('#character-dialog'),name=q('#character-name'),preview=q('#character-preview'),c=preview.getContext('2d');let draft={...current},direction=2,walking=true,frame=0,raf=0;const images={};
 for(const look of looks){const im=new Image();im.onload=()=>{images[look.id]=im;};im.src=assets+look.id+'.png';}
 const apply=value=>{onChange(value);q('#character-button').setAttribute('aria-label','Change character: '+value.name);};subscribers.push(apply);apply(current);
 function draw(now){if(!dialog.open){raf=0;return;}c.clearRect(0,0,288,320);c.fillStyle='#11251d';c.fillRect(0,0,288,320);c.strokeStyle='#ba9a5266';c.beginPath();c.ellipse(144,278,91,23,0,0,Math.PI*2);c.stroke();c.imageSmoothingEnabled=false;const im=images[draft.body];frame=walking&&!matchMedia('(prefers-reduced-motion: reduce)').matches?1+Math.floor(now/100)%7:0;if(im)c.drawImage(im,frame*96,direction*160,96,160,48,-39,192,320);raf=requestAnimationFrame(draw);}
 function refresh(){const look=looks.find(l=>l.id===draft.body);q('#character-look-name').textContent=look.name;q('#character-look-detail').textContent=look.detail;for(const button of document.querySelectorAll('[data-character-look]'))button.setAttribute('aria-pressed',String(button.dataset.characterLook===draft.body));q('#character-preview-name').textContent=name.value.trim()||'Avharot';}
 q('#character-button').onclick=()=>{draft={...current};name.value=draft.name;refresh();onOpen();dialog.showModal();raf=requestAnimationFrame(draw);};
 name.addEventListener('input',refresh);
 for(const button of document.querySelectorAll('[data-character-look]'))button.onclick=()=>{draft.body=button.dataset.characterLook;refresh();};
 q('#character-turn-left').onclick=()=>{direction=(direction+3)%4;};q('#character-turn-right').onclick=()=>{direction=(direction+1)%4;};
 q('#character-walk').onclick=()=>{walking=!walking;q('#character-walk').setAttribute('aria-pressed',String(walking));};
 q('#character-cancel').onclick=()=>dialog.close();q('#character-close').onclick=()=>dialog.close();
 q('#character-form').addEventListener('submit',e=>{e.preventDefault();draft.name=name.value;const stored=save(draft);q('#character-save-status').textContent=stored?'Character saved on this device':'Character applied for this visit; browser storage is unavailable';dialog.close();});
 dialog.addEventListener('close',()=>{if(raf)cancelAnimationFrame(raf);raf=0;onClose();q('#character-button').focus();});
}
root.addEventListener('storage',e=>{if(e.key===KEY)publish(read());});
root.EntiaCharacter={get:()=>({...current}),normalize,save,mount,looks};
})(window);
