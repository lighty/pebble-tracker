const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT_DIR, "src");
const DIST_DIR = path.join(ROOT_DIR, "dist");

function emptyDirectory(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true });
  fs.mkdirSync(directoryPath, { recursive: true });
}

function readSourceFile(filename) {
  return fs.readFileSync(path.join(SRC_DIR, filename), "utf8");
}

function writeDistFile(filename, content) {
  fs.writeFileSync(path.join(DIST_DIR, filename), content);
}

function buildMainJs() {
  const rendererSource = readSourceFile("pebble-renderer.js");
  const mainSource = readSourceFile("main.js");
  const rendererRequireLine =
    'const { renderPebbleTrackerView } = require("./pebble-renderer");';

  if (!mainSource.includes(rendererRequireLine)) {
    throw new Error("src/main.js does not contain the expected renderer import");
  }

  const bundledMainSource = mainSource.replace(
    rendererRequireLine,
    "const { renderPebbleTrackerView } = __pebbleRendererModule.exports;",
  );

  return `const __pebbleRendererModule = { exports: {} };
(() => {
  const module = __pebbleRendererModule;
  const exports = module.exports;
${rendererSource}
})();

${bundledMainSource}
`;
}

function build() {
  emptyDirectory(DIST_DIR);
  writeDistFile("main.js", buildMainJs());
  writeDistFile("styles.css", readSourceFile("styles.css"));
  writeDistFile("manifest.json", readSourceFile("manifest.json"));
}

build();
