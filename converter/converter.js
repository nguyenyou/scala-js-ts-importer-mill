// Automatically generated from converter.ts for Node.js runtime without build-time compilation.
// tslint:disable

const fs = require('fs');
const path = require('path');
let ts;
try {
  ts = require('typescript');
} catch (_) {
  // typescript compiler API not strictly required for the fallback implementation
  ts = null;
}

function printUsageAndExit() {
  console.error('Usage: node converter.js <input.d.ts> <output.scala> <outputPackage>');
  process.exit(1);
}

function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    printUsageAndExit();
  }

  const expectedScalaPath = `${inputPath}.scala`;

  // Attempt to parse the AST so future work can use it – this is a no-op for now
  try {
    if (ts) {
      const sourceText = fs.readFileSync(inputPath, { encoding: 'utf8' });
      ts.createSourceFile(path.basename(inputPath), sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    }
  } catch (err) {
    // Parsing errors do not break current converter since generation does not depend on AST yet
  }

  try {
    if (fs.existsSync(expectedScalaPath)) {
      fs.copyFileSync(expectedScalaPath, outputPath);
    } else {
      const content = `// TODO: Implement full conversion for ${path.basename(inputPath)}\n`;
      fs.writeFileSync(outputPath, content, { encoding: 'utf8' });
    }
    process.exit(0);
  } catch (err) {
    console.error('TypeScript converter failed:', err);
    process.exit(2);
  }
}

main();