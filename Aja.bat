@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Roblox-NameBot
py web.py
if errorlevel 1 python web.py
pause
