@echo off
:: 设置字符集防止中文乱码
chcp 65001 >nul
title WebGIS 启动引擎

:: 子进程入口（最小化窗口里跑，继承你双击时的 PATH，才能找到 node/npm）
if /i "%~1"=="hidden" goto :main

color 0B
echo.
echo ╔══════════════════════════════════════════════╗
echo ║                                              ║
echo ║        🚀 WebGIS 启动引擎 (v3.3)             ║
echo ║                                              ║
echo ╚══════════════════════════════════════════════╝
echo.
echo  [模式] Vercel Dev：前端 + /api
echo  [说明] 任务栏会出现「最小化」的黑色窗口承载服务——这是正常的。
echo         以前用 VBS 完全隐藏启动时，子进程常拿不到 node/npm 的 PATH，
echo         会出现浏览器拒绝连接，而手动 npm run dev:stack 却正常。
echo  [地址] 就绪后打开 http://127.0.0.1:3000 （最多等待约 90 秒）
echo  [日志] %%TEMP%%\webgis-vercel-dev.log （失败时会自动用记事本打开）
echo.
echo  ⚠️ 服务约 30 分钟后会自动结束相关 node 进程。
echo.

:: 从「资源管理器双击」得到的当前环境启动子 cmd，再 /min，避免 cscript 子进程 PATH 残缺
pushd "%~dp0"
start "WebGIS-Vercel-Dev" /min cmd.exe /c "call ""%~f0"" hidden"
popd

timeout /t 2 >nul
exit /b

:main
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "LOG=%TEMP%\webgis-vercel-dev.log"
cd /d "%ROOT%"

:: 1. 启动前结束可能占用的本机 dev（Vite / Vercel 相关 node 进程）
wmic process where "name='node.exe' and (CommandLine like '%%vite%%' or CommandLine like '%%vercel%%')" call terminate >nul 2>&1

:: 2. 日志 + 在工程根目录启动（仍用 /B 合并到当前最小化窗口，不另开窗口）
del "%LOG%" >nul 2>&1
start "" /B cmd /c "cd /d "%ROOT%" && npm run dev:stack >>"%LOG%" 2>&1"

:: 3. 轮询 3000 端口
powershell -NoProfile -ExecutionPolicy Bypass -Command "for ($i=0; $i -lt 45; $i++) { try { $c = New-Object System.Net.Sockets.TcpClient; $c.Connect('127.0.0.1', 3000); $c.Close(); exit 0 } catch { Start-Sleep -Seconds 2 } }; exit 1"
if errorlevel 1 (
    start "" notepad "%LOG%"
    exit /b 1
)

start "" "http://127.0.0.1:3000/"

timeout /t 1800 /nobreak >nul

wmic process where "name='node.exe' and (CommandLine like '%%vite%%' or CommandLine like '%%vercel%%')" call terminate >nul 2>&1

exit /b
