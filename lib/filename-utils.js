const path = require('path')
let suffix = 'spec.js'

const getSpecFileName = function (file) {
  if (file.endsWith(suffix)) {
    return file
  }
  const ext = path.extname(file)
  return file.substring(0, file.length - ext.length) + '.' + suffix
}

const getImplementationFileName = function (file) {
  return file.replace(suffix, '.js')
}

module.exports = {
  getSpecFileName,
  getImplementationFileName,
  setSuffix (str) {
    suffix = str
  }
}
