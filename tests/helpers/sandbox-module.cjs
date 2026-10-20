// Evaluates a TypeScript (or imported JSON) module inside a vm sandbox, so it sees the sandbox's fake browser globals
// and creates its objects in the sandbox realm, exactly as the page scripts under test do.
const { readFileSync } = require('node:fs');
const { dirname, resolve } = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

// A file's CommonJS output depends only on its contents, so each file is transformed once per process.
// JSON files become a module whose exports are the parsed document, as a bundler's JSON import provides.
const compiled = new Map();
function compile(path) {
  if (!compiled.has(path))
    compiled.set(
      path,
      path.endsWith('.json')
        ? `module.exports=${JSON.stringify(JSON.parse(readFileSync(path, 'utf8')))};`
        : transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'cjs', target: 'es2022', sourcefile: path })
            .code,
    );
  return compiled.get(path);
}

function loadSandboxModule(context, file, cache = new Map()) {
  const path = resolve(file);
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} };
  cache.set(path, module);
  const evaluate = vm.runInContext(`(function(module,exports,require){${compile(path)}\n})`, context, {
    filename: path,
  });
  evaluate(module, module.exports, (specifier) => loadSandboxModule(context, resolve(dirname(path), specifier), cache));
  return module.exports;
}
module.exports = { loadSandboxModule };
