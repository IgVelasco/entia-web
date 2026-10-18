// model.js creates the API and exports it through module.exports, so its type is derived from the source.
// tutorial.js and navigation.js add members later with Object.assign; TypeScript does not track those additions.
declare var EssenceDemo: typeof import('../dist/demo/model.js');

// Chromium's non-standard InputDeviceCapabilities; demo.js reads it to ignore clicks synthesized from touches.
interface UIEvent { readonly sourceCapabilities?: { readonly firesTouchEvents: boolean } | null }
