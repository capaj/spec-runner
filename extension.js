const vscode = require('vscode')
const {
  // StatusBarItem,
  StatusBarAlignment,
  window,
  workspace
} = vscode
const path = require('path')
const fs = require('mz/fs')
const {spawn} = require('child_process')

let suffix = 'spec.js'

function getSpecFileName (file) {
  if (file.endsWith(suffix)) {
    return file
  }
  const ext = path.extname(file)
  return file.substring(0, file.length - ext.length) + '.' + suffix
}

function activate (context) {
  if (!workspace.rootPath) {
    return
  }
  fs.readFile(path.join(workspace.rootPath, 'package.json'), 'utf8')
    .then(JSON.parse)
    .then((pckg) => {
      const { jest, ava } = pckg.devDependencies
      if (pckg.specRunner) {
        suffix = pckg.specRunner.suffix
      }
      let testRunner
      if (ava) {
        testRunner = 'ava'
      } else if (jest) {
        testRunner = 'jest'
      }
      const runSpecIfExists = (file) => {
        const specFile = getSpecFileName(file)
        const basename = path.basename(file, path.extname(file))
        return fs.stat(specFile).then((stats) => {
          const runner = spawn(testRunner, [basename], {cwd: workspace.rootPath})
          runner.stdout.on('data', (data) => {
            const msg = data.toString()
            console.log('out', msg)
          })

          runner.stderr.on('data', (data) => {
            const msg = data.toString()
            console.log(msg)
            if (msg.includes('failed')) {
              statusBarItem.text = 'Spec failing'
              statusBarItem.color = 'red'
            } else {
              statusBarItem.text = 'Passing'
              statusBarItem.color = 'greenyellow'
            }
          })

          runner.on('exit', (code) => {
            console.log(`Child exited with code ${code}`)
          })
        })
      }

      let statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 1000)
      statusBarItem.text = 'No spec'
      // statusBarItem.command = 'standard.showOutputChannel'
      statusBarItem.show()

      window.onDidChangeActiveTextEditor((editor) => {
        runSpecIfExists(editor.document.fileName)
      })

      workspace.onDidSaveTextDocument((textDocument) => {
        runSpecIfExists(textDocument.fileName)
      })
    })
}
exports.activate = activate

// this method is called when your extension is deactivated
function deactivate () {
}
exports.deactivate = deactivate
