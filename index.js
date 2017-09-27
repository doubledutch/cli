#!/usr/bin/env node

// Notify user of any updates to the CLI
const updateNotifier = require('update-notifier')
const pkg = require('./package.json')
updateNotifier({pkg}).notify()

// Parse CLI
const program = require('commander').name('doubledutch').version(pkg.version)

program
  .command('init')
  .description('initializes a new DoubleDutch feature in the current empty folder')
  .action(require('./init'))

program
  .command('install <eventID>')
  .description('installs the DoubleDutch feature to an event')
  .action(require('./install'))

program
  .command('login')
  .description('sets your doubledutch developer account credentials')
  .action(require('./login'))

program
  .command('publish')
  .description('publishes the DoubleDutch feature in the current folder')
  .action(require('./publish'))

program.parse(process.argv.length > 2 ? process.argv : [...process.argv, '--help'])