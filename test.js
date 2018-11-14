const path = require('path')
const fs = require('fs')
const metro = require('metro')

const baseManifestFilename = path.join(__dirname, 'bundles', '0.46.4', `base.ios.0.46.4.manifest`)
const entry = './index.ios.js'
const manifestOut = `./build/bundle/index.ios.0.46.4.manifest`
const out = './build/bundle/index.ios.0.46.4.manifest.bundle'
const platform = 'ios'
const root = process.cwd()
console.log('root', root)

build()

async function build() {
  const baseManifest = fs.existsSync(baseManifestFilename) ? JSON.parse(fs.readFileSync(baseManifestFilename)) : null

  const config = {
    resolver: {
      providesModuleNodeModules: ['react-native'],
    },
    transformer: {
      // asyncRequireModulesPath: require.resolve('metro/src/lib/bundle-modules/asyncRequire'),
      babelTransformerPath: require.resolve('metro/src/reactNativeTransformer'),
    },
    serializer: {
      // createModuleIdFactory: idFactory(baseManifest, root),
      //postProcessModules: postProcessor(baseManifest, manifestOut, root),
    },
    server: {},
    projectRoot: root,
    watchFolders: [root, path.join(__dirname, 'node_modules', 'metro'), path.join(root, 'node_modules', 'react-native')],
  }

  const opts = {
    dev: false,
    entry,
    optimize: true,
    out,
    platform,
    // projectRoots: [root, path.join(root, 'node_modules')],
    sourceMap: true,
  }

  return await metro.runBuild(config, opts)
}

function idFactory(manifestFileContents, root) {
  const getPathForModule = pathForModuleProvider(root)
  return function createModuleIdFactory() {
    const fileToIdMap = new Map()
    let nextId = manifestFileContents ? getNextIdAfterBaseManifest(manifestFileContents) : 0

    return path => {
      const sourcePath = getPathForModule({path})

      // If module is in the base manifest, return its ID
      if (manifestFileContents && manifestFileContents.modules[sourcePath]) {
        return manifestFileContents.modules[sourcePath].id
      }

      // Otherwise, get it from the map or create a new ID
      if (!fileToIdMap.has(path)) {
        fileToIdMap.set(path, nextId)
        nextId += 1
      }
      return fileToIdMap.get(path)
    }
  }

  function getNextIdAfterBaseManifest(manifestFileContents) {
    return Object.keys(manifestFileContents.modules).reduce((id, key) => {
      if (manifestFileContents.modules[key].id > id) {
        return manifestFileContents.modules[key].id
      }
      return id
    }, 0) + 1
  }
}

function pathForModuleProvider(root) {
  return module => module.path
    .replace(root + '/node_modules/', '')
    .replace(root, '.')
}
