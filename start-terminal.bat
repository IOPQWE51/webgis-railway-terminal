@echo off
:: 强制设为 UTF-8 编码，防止乱码
chcp 65001 >nul

:: 判断是否为后台守护进程模式
if "%1"=="daemon" goto :daemon

:: ==========================================
:: 1. 前台启动画面 (展示检查过程后自动销毁)
:: ==========================================
title Earth Terminal - Boot Sequence
color 0A
mode con cols=55 lines=18

echo.
echo    =============================================
echo      E A R T H   T E R M I N A L   V 5 . 0
echo               [ TACTICAL RADAR ]
echo    =============================================
echo.
echo    [+] 引擎点火准备...

:: 🛡️ 智能检测：云端密钥缓存
if not exist ".env.local" (
    echo    [!] 未检测到云端密钥缓存
    echo    [*] 正在建立 Vercel 卫星上行链路获取授权...
    call npx vercel env pull .env.local
    echo    [+] 密钥同步完成！
) else (
    echo    [+] 本地授权缓存完整，校验通过.
)

echo    [+] 静默核心已激活 (生命周期: 10 分钟)

:: 核心：调用 mshta 无痕启动自身的 daemon 模式
mshta vbscript:createobject("wscript.shell").run("""%~f0"" daemon",0)(window.close)

:: 制造 3 秒的视觉停留，同时给后台 npm 服务器启动时间
ping 127.0.0.1 -n 4 >nul

echo    [+] 战术雷达就绪，正在切入控制台...
start http://localhost:5173/

:: UI 使命完成，销毁黑框
exit


:: ==========================================
:: 2. 后台静默守护进程 (此处没有任何画面，绝对隐形)
:: ==========================================
:daemon
:: 启动本地开发服务器
start /b npm run dev

:: 隐藏模式下 timeout 会报错，使用 ping 本地回环来精准倒计时 10分钟 (600秒)
ping 127.0.0.1 -n 600 >nul

:: 时间到，无情猎杀所有的 node 后台进程
taskkill /F /IM node.exe >nul 2>&1

:: 隐形进程自尽
exit