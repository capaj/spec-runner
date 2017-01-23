const vscode = require('vscode')
const {
  // StatusBarItem,
  StatusBarAlignment,
  window,
  workspace,
  Range
} = vscode
const path = require('path')
const fs = require('mz/fs')
const {spawn} = require('child_process')
const escapeRegExp = require('escape-string-regexp')
let suffix = 'spec.js'

function getSpecFileName (file) {
  if (file.endsWith(suffix)) {
    return file
  }
  const ext = path.extname(file)
  return file.substring(0, file.length - ext.length) + '.' + suffix
}
let outputChannel
let statusBarItem
let lastDecoration

function activate (context) {
  if (!workspace.rootPath) {
    return
  }
  statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 1000)

  let lastFile
  let lastSpecFile
  let testProcess
  outputChannel = window.createOutputChannel('specrunner')
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
        const isJSFile = file.endsWith('.js') || file.endsWith('.jsx')
        if (!isJSFile) {
          statusBarItem.hide()
          return
        }
        statusBarItem.text = 'No spec'
        if (lastFile === file) {
          return
        }
        lastDecoration && lastDecoration.dispose()
        statusBarItem.show()
        testProcess && testProcess.kill()
        lastFile = file
        lastSpecFile = getSpecFileName(file)
        let basename
        let args
        if (testRunner === 'jest') {
          basename = path.basename(file, path.extname(file))
          args = [basename, '-w']
        } else {
          basename = path.basename(lastSpecFile)
          args = [basename, '-w', '--verbose', '--fail-fast']
        }

        return fs.stat(lastSpecFile).then((stats) => {
          testProcess = spawn(testRunner, args, {cwd: workspace.rootPath})
          testProcess.stdout.on('data', (data) => {
            const msg = data.toString()
            outputChannel.append(msg)
          })

          testProcess.stderr.on('data', (data) => {
            const msg = data.toString()

            outputChannel.append(msg)
            if (msg.includes('failed')) {
              lastDecoration && lastDecoration.dispose()

              statusBarItem.text = 'Spec failing'
              statusBarItem.color = 'red'
              const indexOfErr = msg.lastIndexOf('Error: ')
              if (indexOfErr !== -1) {
                const outputAfterError = msg.substring(indexOfErr + 7)
                const firstNewLine = outputAfterError.indexOf('\n')
                const errorMessage = outputAfterError.substring(0, firstNewLine)
                const fileBasename = escapeRegExp(path.basename(file))

                const fileRegex = new RegExp(`${fileBasename}:(\\d*):(\\d*)`, 'g')
                const fileMatches = fileRegex.exec(outputAfterError.substring(firstNewLine))
                if (fileMatches) {
                  const line = Number(fileMatches[1]) - 1
                  const decoration = vscode.window.createTextEditorDecorationType({
                    isWholeLine: true,
                    backgroundColor: `rgba(255,0,0, 0.5)`,
                    after: {
                      contentText: ` ${errorMessage.replace(/'/g, '"')}`,
                      color: 'rgba(1, 1, 1, 1.0)'
                    }
                  })
                  lastDecoration = decoration
                  const range = new Range(line, 0, line, 1000)
                  window.activeTextEditor.setDecorations(decoration, [range])
                }
              }
            } else {
              statusBarItem.text = 'Passing'
              statusBarItem.color = 'greenyellow'
            }
          })

          testProcess.on('exit', (code) => {
            outputChannel.append(`Child exited with code ${code}`)
          })
        }, () => {})
      }

      statusBarItem.command = 'spec.showOutputChannel'
      runSpecIfExists(window.activeTextEditor.document.fileName)
      window.onDidChangeActiveTextEditor((editor) => {
        runSpecIfExists(editor.document.fileName)
      })

      workspace.onDidSaveTextDocument((textDocument) => {
        lastDecoration && lastDecoration.dispose()
        // runSpecIfExists(textDocument.fileName)
      })
    }).catch((err) => {
      throw err
    })
}
exports.activate = activate

// this method is called when your extension is deactivated
function deactivate () {
  outputChannel.dispose()
  statusBarItem.dispose()
  lastDecoration && lastDecoration.dispose()
}
exports.deactivate = deactivate
