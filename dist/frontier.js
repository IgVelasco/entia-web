(function(root){
'use strict';
// Outer-world geometry, rearmed boundary encounters and shared escort paths.
const EDGES = ['west', 'east', 'north', 'south'];
function distances(point, width, height) {
  return {west: point.x, east: width - point.x, north: point.y, south: height - point.y};
}
function initialState() { return {seen: false, open: false, edge: null}; }
function boundaryEvent(state, {from, to, kind = 'move', explore = true, blocked = false, width = 1440, height = 900, threshold = 96, inset = 30}) {
  if (state.seen || state.open || blocked || !explore || !from || !to) return state;
  if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) return state;
  const a = distances(from, width, height), b = distances(to, width, height);
  // A blocked attempt is relevant only at the physical world edge, not at a tree.
  const candidates = EDGES.filter(edge => kind === 'attempt'
    ? a[edge] <= threshold && b[edge] < inset && b[edge] < a[edge]
    : b[edge] <= threshold && b[edge] >= 0 && b[edge] < a[edge] - .001);
  if (!candidates.length) return state;
  candidates.sort((left, right) => a[left] - a[right]);
  return {seen: true, open: true, edge: candidates[0]};
}
function closeBoundary(state) { return state.open ? {...state, open: false} : state; }
function rearm(state, point, width=1440, height=900) {
  return !state.open && state.seen && Math.min(point.x,width-point.x,point.y,height-point.y)>128 ? initialState() : state;
}
function pathLength(points){let length=0;for(let i=1;i<points.length;i++)length+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);return length;}
function samplePath(points,distance){for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.y-a.y);if(distance<=length&&length)return {x:a.x+(b.x-a.x)*distance/length,y:a.y+(b.y-a.y)*distance/length};distance-=length;}return {...points.at(-1)};}
function visibleTiles({width, height, scale, ox, oy, tile = 32}) {
  const left = Math.floor(-ox / scale / tile) * tile;
  const top = Math.floor(-oy / scale / tile) * tile;
  const right = Math.ceil((width - ox) / scale / tile) * tile;
  const bottom = Math.ceil((height - oy) / scale / tile) * tile;
  return {left, top, right, bottom, columns: (right - left) / tile, rows: (bottom - top) / tile};
}
const api={initialState,boundaryEvent,closeBoundary,rearm,pathLength,samplePath,visibleTiles};if(typeof module!=='undefined')module.exports=api;root.WorldFrontier=api;
})(typeof window!=='undefined'?window:globalThis);
