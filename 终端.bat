@echo off
chcp 65001 >nul
color 0b

echo 🚀 赛博终端 V3.1 - 极简点火程序启动...
echo 🌐 正在为你唤醒浏览器 (http://localhost:3000)...

start "" "http://localhost:3000"

call npm run dev:stack

pause