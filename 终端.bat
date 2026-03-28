@echo off
:: 设置字符集防止中文乱码
chcp 65001 >nul
title WebGIS 无痕启动引擎

:: 如果是隐藏模式，直接跳到后台主逻辑
if "%1"=="hidden" goto :main

color 0B
echo.
echo ╔══════════════════════════════════════════════╗
echo ║                                              ║
echo ║        🚀 WebGIS 隐形启动引擎 (v3.1)         ║
echo ║                                              ║
echo ╚══════════════════════════════════════════════╝
echo.
echo  [模式] Vercel Dev：前端 + /api（物候、天气代理等）
echo  [地址] 约 8 秒后打开 http://localhost:3000
echo  [提示] 若从未用过 Vercel，请先在项目目录执行一次：npx vercel login
echo.
echo  ⚠️ 保护机制：为防止端口占用，服务将在 30 分钟后自动销毁。
echo.

:: 生成临时 VBS 脚本实现完全无黑框后台运行
echo Set objShell = CreateObject("WScript.Shell") > "%temp%\silent_launch.vbs"
echo objShell.Run "cmd /c """"%~f0"" hidden""", 0, False >> "%temp%\silent_launch.vbs"
cscript //nologo "%temp%\silent_launch.vbs"
del "%temp%\silent_launch.vbs"

:: 停留 2 秒让用户看清提示后，自动关闭当前黑窗口
timeout /t 2 >nul
exit /b

:main
:: === 这里是完全隐藏在后台执行的逻辑 ===
cd /d "%~dp0"

:: 1. 启动前结束可能占用的本机 dev（Vite / Vercel 相关 node 进程）
wmic process where "name='node.exe' and (CommandLine like '%%vite%%' or CommandLine like '%%vercel%%')" call terminate >nul 2>&1

:: 2. 后台静默启动：vercel dev（含 api/*.js，与线上一致）
start "" /B npm run dev:stack

:: 3. 等待 dev 就绪后打开浏览器（默认端口 3000，与 dev:stack 一致）
ping -n 9 127.0.0.1 >nul
start "" "http://127.0.0.1:3000/"

:: 4. 开启 30 分钟 (1800 秒) 死亡倒计时
timeout /t 1800 /nobreak >nul

:: 5. 时间到，结束本次启动的 node（Vite / Vercel）
wmic process where "name='node.exe' and (CommandLine like '%%vite%%' or CommandLine like '%%vercel%%')" call terminate >nul 2>&1

exit /b
