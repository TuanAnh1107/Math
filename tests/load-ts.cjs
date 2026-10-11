const fs = require('node:fs');
const ts = require('typescript');

// Run focused source regressions with the installed compiler and Node test runner.
// No build artifacts or extra dependencies are needed.
function compile(module, filename) {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(result.outputText, filename);
}

require.extensions['.ts'] = compile;
require.extensions['.tsx'] = compile;
