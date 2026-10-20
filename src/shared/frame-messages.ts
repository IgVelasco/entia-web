// Messages between the Nix site and the demo embedded in its iframe. Each receiver checks the sender's origin and
// window before reading one, so the payload is trusted to have these shapes.
export interface HostMessage { type: 'entia-demo-activate' | 'entia-demo-resume' | 'entia-demo-pause' | 'entia-demo-scale'; presentationScale?: number }
export interface DemoMessage { type: 'entia-demo-ready' | 'entia-demo-exit' | 'entia-demo-error' }
