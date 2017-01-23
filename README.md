# spec-runner
vscode plugin for running single unit specs while editing

## Is this extension for you?
If you do a TDD when developing your JS files and you keep them side by side with the actual implementation, this extension is for you.
By default, it expects a spec file to be named with a suffix `spec.js`. If you use a different suffix like `test.js` or `unit.js` you can put it into your project's package.json like this:

```
"specRunner": {
    "suffix": "test.js"
}
```

also if you have your special way of running unit tests, you can define your own command to be executed in `package.json` scripts:
```
"scripts": {
    "specrun": "node my-special-unicorn-test-script.js"
}
```
The spec file will be appended as argument, so make sure you pass those to the actual test runner.

## supported runners
Since we're parsing the output of each test run, we only support two testing frameworks at the moment. Those being ava and jest.
If you need more, feel free to submit a PR.

## how does it compare to vscode-jest
this runner only runs single files. For full fledged jest runner support, use vscode-jest