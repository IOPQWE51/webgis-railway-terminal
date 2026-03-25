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
echo ║        🚀 WebGIS 隐形启动引擎 (v3.0)         ║
echo ║                                              ║
echo ╚══════════════════════════════════════════════╝
echo.
echo  [状态] 正在为您在后台静默唤醒服务器...
echo  [网络] 浏览器即将自动全屏弹出，请稍候。
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

:: 1. 启动前，先斩杀之前可能遗留的老服务，防止 5173 端口被死锁占用
wmic process where "name='node.exe' and CommandLine like '%%vite%%'" call terminate >nul 2>&1

:: 2. 后台静默启动项目，并自动触发浏览器打开
start "" /B npm run dev -- --open

:: 3. 开启 30 分钟 (1800 秒) 死亡倒计时
timeout /t 1800 /nobreak >nul

:: 4. 时间到，精准斩杀当前的 Vite 服务，释放内存和端口
wmic process where "name='node.exe' and CommandLine like '%%vite%%'" call terminate >nul 2>&1

exit /b