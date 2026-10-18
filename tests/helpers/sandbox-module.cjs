// Evaluates a TypeScript module inside a vm sandbox, so it sees the sandbox's fake browser globals
// and creates its objects in the sandbox realm, exactly as the page scripts under test do.
const {readFileSync}=require('node:fs');
const {dirname,resolve}=require('node:path');
const vm=require('node:vm');
const {transformSync}=require('esbuild');

function loadSandboxModule(context,file,cache=new Map()){
  const path=resolve(file);
  if(cache.has(path))return cache.get(path).exports;
  const module={exports:{}};cache.set(path,module);
  const {code}=transformSync(readFileSync(path,'utf8'),{loader:'ts',format:'cjs',target:'es2022',sourcefile:path});
  const evaluate=vm.runInContext(`(function(module,exports,require){${code}\n})`,context,{filename:path});
  evaluate(module,module.exports,specifier=>loadSandboxModule(context,resolve(dirname(path),specifier),cache));
  return module.exports;
}
module.exports={loadSandboxModule};
