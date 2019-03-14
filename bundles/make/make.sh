# Creates new base bundle for base.js, marked with the version in the package.json in this folder.

pushd ../..
npm install
popd

npm install

node make