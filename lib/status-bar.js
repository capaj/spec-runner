const vscode = require('vscode')
const {
  // StatusBarItem,
  StatusBarAlignment,
  window
} = vscode

module.exports = class StatusBar {
  constructor () {
    this.item = window.createStatusBarItem(StatusBarAlignment.Right, 1000)
  }
  setPassing () {
    this.item.text = '\u2713 Passing'
    this.item.color = 'greenyellow'
    this.item.command = 'spec-runner.showOutputChannel'
  }
  setFailing (failMessage = 'Failing') {
    this.item.text = `\u274C ${failMessage}`
    this.item.color = 'red'
    this.item.command = 'spec-runner.showOutputChannel'
  }
  reset () {
    this.item.text = 'No spec'
    this.item.color = 'white'
    this.item.command = 'spec-runner.generateASpec'
  }
  setRunning () {
    this.item.text = '\u231B Running'
    this.item.color = 'blue'
    this.item.command = 'spec-runner.showOutputChannel'
  }
  hide () {
    this.item.hide()
  }
  show () {
    this.item.show()
  }
}
