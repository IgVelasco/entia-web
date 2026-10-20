// EssenceDemo is declared by src/demo/globals.ts, which the demo project includes.

// Chromium's non-standard InputDeviceCapabilities; demo.js reads it to ignore clicks synthesized from touches.
interface UIEvent { readonly sourceCapabilities?: { readonly firesTouchEvents: boolean } | null }
