@echo off
if "%1"=="h" goto :start
mshta vbscript:createobject("wscript.shell").run("""%~f0"" h",0)(window.close)&exit
:start
chcp 65001 >nul
start "" "http://localhost:3000"
start /b npm run dev:stack
timeout /t 600 /nobreak >nul
taskkill /F /IM node.exe >nul 2>&1