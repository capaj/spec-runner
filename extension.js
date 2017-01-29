const vscode = require('vscode')
const {
  window,
  commands,
  workspace,
  Range
} = vscode
const path = require('path')
const fs = require('mz/fs')
const {spawn} = require('child_process')
const escapeRegExp = require('escape-string-regexp')
const {
  getSpecFileName,
  setSuffix
} = require('./lib/filename-utils')

const generateSpecCommand = require('./lib/generate-spec')
const StatusBar = require('./lib/status-bar')

let outputChannel
let statusBar
const lastDecorations = []
const disposeDecorations = () => {
  lastDecorations.forEach((decoration) => decoration.dispose())
  lastDecorations.length = 0
}
let testProcess

const failToken = 'failed'

function activate (context) {
  if (!workspace.rootPath) {
    return
  }
  statusBar = new StatusBar()

  let lastFile
  let lastSpecFile
  outputChannel = window.createOutputChannel('specrunner')
  fs.readFile(path.join(workspace.rootPath, 'package.json'), 'utf8')
    .then(JSON.parse)
    .then((pckg) => {
      const { jest, ava } = pckg.devDependencies
      if (pckg.specRunner && pckg.specRunner.suffix) {
        setSuffix(pckg.specRunner.suffix)
      }
      let testRunner

      if (pckg.scripts && pckg.scripts.specrun) {
        testRunner = 'npm'
      } else if (ava) {
        testRunner = 'ava'
      } else if (jest) {
        testRunner = 'jest'
      }

      const runSpecIfExists = (file) => {
        const isJSFile = file.endsWith('.js') || file.endsWith('.jsx')
        if (!isJSFile) {
          statusBar.hide()
          return
        }
        statusBar.reset()
        if (lastFile === file) {
          return
        }
        disposeDecorations()
        statusBar.show()
        testProcess && testProcess.kill()
        lastFile = file
        lastSpecFile = getSpecFileName(file)
        let args
        if (testRunner === 'jest') {
          args = [lastSpecFile, '--watch', '--bail', '--json', '--no-colors']
        } else if (testRunner === 'ava') {
          args = [lastSpecFile, '-w', '--verbose', '--fail-fast']
        } else {
          args = ['run', 'specrun', lastSpecFile] // custom tdd script
        }

        return fs.stat(lastSpecFile).then((stats) => {
          testProcess = spawn(testRunner, args, {
            cwd: workspace.rootPath
          })
          statusBar.setRunning()
          const receivedToken = 'Difference:\n'

          const decorateErroredLine = (outputAfterError) => {
            const firstNewLine = outputAfterError.indexOf('\n')
            let errorMessage
            const indexOfDifference = outputAfterError.indexOf(receivedToken)
            if (indexOfDifference !== -1) {
              errorMessage = outputAfterError.substr(indexOfDifference)
              const lines = errorMessage.split('\n').filter((line) => {
                return line.includes(' +  ') || line.includes(' -  ')
              })
              errorMessage = lines.join(' ')
              errorMessage = errorMessage.replace('- ', 'Expected: ')
              errorMessage = errorMessage.replace('+ ', 'Received: ')
            } else {
              errorMessage = outputAfterError.replace(/(?:\r\n|\r|\n)/g, ' ')
            }

            window.visibleTextEditors.forEach((editor) => {
              const setErrorDecorations = (visibleFile) => {
                const fileBasename = escapeRegExp(path.basename(visibleFile))

                const fileRegex = new RegExp(`${fileBasename}:(\\d*):(\\d*)`, 'g')

                let fileMatches = fileRegex.exec(outputAfterError.substring(firstNewLine))
                if (!fileMatches) {
                  fileMatches = fileRegex.exec(outputAfterError)
                }

                if (fileMatches) {
                  const line = Number(fileMatches[1]) - 1
                  const decoration = vscode.window.createTextEditorDecorationType({
                    isWholeLine: true,
                    backgroundColor: `rgba(255,0,0, 0.5)`,
                    after: {
                      contentText: ` ${errorMessage.replace(/'/g, '"')}`, // TODO remove when bug is resolved https://github.com/Microsoft/vscode/issues/19008
                      color: 'rgba(1, 1, 1, 1.0)'
                    }
                  })
                  lastDecorations.push(decoration)
                  const range = new Range(line, 0, line, 1000)
                  editor.setDecorations(decoration, [range])
                }
              }

              const {fileName} = editor.document
              setErrorDecorations(fileName)
            })
          }

          testProcess.stdout.on('data', (data) => {
            const msg = data.toString()
            if (msg.startsWith('{')) {
              const newLineIndex = msg.indexOf('\n')
              let jsonString = msg
              if (newLineIndex !== -1) {
                jsonString = msg.substr(0, newLineIndex)
              }
              const output = JSON.parse(jsonString)
              if (output.numFailedTests === 0 && output.numFailedTestSuites === 0) {
                statusBar.setPassing()
              } else {
                let message = output.testResults[0].message
                statusBar.setFailing(message.substr(0, message.indexOf('\n')))
                message = message.substr(message.indexOf('\n') + 2)
                decorateErroredLine(message)
              }
            } else {
              outputChannel.append(msg)
            }
          })
          testProcess.stderr.on('data', (data) => {
            const msg = data.toString()

            outputChannel.append(msg)
            if (ava) {
              if (msg.includes(failToken) || msg.includes('✖')) {
                disposeDecorations()

                statusBar.setFailing()
                let indexOfErr = msg.lastIndexOf('Error')
                if (indexOfErr !== -1) {
                  const outputAfterError = msg.substring(indexOfErr + 7)
                  decorateErroredLine(outputAfterError)
                }
              } else {
                statusBar.setPassing()
              }
            }
          })

          testProcess.on('exit', (code) => {
            outputChannel.append(`Child exited with code ${code}`)
          })
          testProcess.on('error', (err) => {
            console.error(err)
          })
        }, () => {})
      }

      runSpecIfExists(window.activeTextEditor.document.fileName)
      window.onDidChangeActiveTextEditor((editor) => {
        if (editor.document.languageId !== 'testOutput') {
          runSpecIfExists(editor.document.fileName)
        }
      })

      workspace.onDidSaveTextDocument((textDocument) => {
        disposeDecorations()
        statusBar.setRunning()
        // runSpecIfExists(textDocument.fileName)
      })
    }).catch((err) => {
      throw err
    })

  context.subscriptions.push(
    commands.registerCommand('spec-runner.showOutputChannel', () => {
      outputChannel.show()
      statusBar.show()
    }),
    commands.registerCommand('spec-runner.generateASpec', generateSpecCommand),
    commands.registerCommand('spec-runner.openSpec', () => {
      const {fileName} = window.activeTextEditor.document

      const specPath = getSpecFileName(fileName)
      workspace.openTextDocument(specPath).then((document) => {
        window.showTextDocument(document).then((editor) => {

        })
      })
    })
  )
}
exports.activate = activate

// this method is called when your extension is deactivated
function deactivate () {
  testProcess && testProcess.kill()
  outputChannel.dispose()
  statusBar.dispose()
  lastDecorations && lastDecorations.dispose()
}
exports.deactivate = deactivate
