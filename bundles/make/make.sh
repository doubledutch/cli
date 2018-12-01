# Creates new base bundle for base.js, marked with the version in the package.json in this folder.

pushd ../..
yarn
popd

yarn

node make