const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const RELEASE_DIR = path.join(ROOT_DIR, "release");
const VERSIONS_PATH = path.join(ROOT_DIR, "versions.json");

function runBuild() {
  const result = spawnSync(process.execPath, [path.join(__dirname, "build.js")], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function prepareRelease() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(DIST_DIR, "manifest.json"), "utf8"),
  );
  const version = manifest.version;
  const targetDir = path.join(RELEASE_DIR, version);

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });

  for (const filename of ["manifest.json", "main.js", "styles.css"]) {
    fs.copyFileSync(path.join(DIST_DIR, filename), path.join(targetDir, filename));
  }
  fs.copyFileSync(VERSIONS_PATH, path.join(targetDir, "versions.json"));
}

runBuild();
prepareRelease();
