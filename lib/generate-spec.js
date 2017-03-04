const getExportsFromFile = require('get-exports-from-file')
const {getSpecFileName} = require('./filename-utils')
const fs = require('mz/fs')
const path = require('path')
const vscode = require('vscode')
const {
  Position,
  window,
  workspace
} = vscode

module.exports = () => {
  const {fileName} = window.activeTextEditor.document
  window.activeTextEditor.document.save().then(() => {
    const specPath = getSpecFileName(fileName)
    fs.writeFile(specPath, '', 'utf8').then(() => {
      workspace.openTextDocument(specPath).then((document) => {
        window.showTextDocument(document).then((editor) => {
          getExportsFromFile(fileName).then((exports) => {
            const maybeSemi = ''
            const quoteChar = "'"
            const relPath = `./${path.basename(fileName).split('.')[0]}`
            let importStatement = 'import '
            const namedExp = []
            let defaultExp
            exports.forEach((exp) => {
              if (exp.exported === 'default') {
                defaultExp = exp.name
              } else {
                namedExp.push(exp)
              }
            })
            if (defaultExp) {
              if (namedExp.length > 0) {
                importStatement += `${defaultExp}, `
              } else {
                importStatement += defaultExp
              }
            }
            if (namedExp.length > 0) {
              importStatement += `{${namedExp.join(',')}}`
            }
            importStatement += ` from ${quoteChar}${relPath}${quoteChar}${maybeSemi}\n`
            editor.edit(editBuilder => {
              editBuilder.insert(new Position(1, 1), importStatement)
            })
          })
        })
      })
    })
  })
}
