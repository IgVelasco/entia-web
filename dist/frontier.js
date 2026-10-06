(function(root){
'use strict';
// Read-only outer-world geometry and one-encounter-per-visit state.
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
function visibleTiles({width, height, scale, ox, oy, tile = 32}) {
  const left = Math.floor(-ox / scale / tile) * tile;
  const top = Math.floor(-oy / scale / tile) * tile;
  const right = Math.ceil((width - ox) / scale / tile) * tile;
  const bottom = Math.ceil((height - oy) / scale / tile) * tile;
  return {left, top, right, bottom, columns: (right - left) / tile, rows: (bottom - top) / tile};
}
const api={initialState,boundaryEvent,closeBoundary,visibleTiles};if(typeof module!=='undefined')module.exports=api;root.WorldFrontier=api;
})(typeof window!=='undefined'?window:globalThis);
