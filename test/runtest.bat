@echo off
cmd /c mocha --ui tdd --reporter spec server.js
cmd /c mocha --ui tdd --reporter spec index.js
