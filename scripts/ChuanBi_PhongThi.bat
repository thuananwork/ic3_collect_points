@echo off
chcp 65001 >nul
title Chuan bi phong thi - IC3 Manager
rem Cach dung: bam dup file nay (hoac: ChuanBi_PhongThi.bat 10.165.246.119 de chon IP thu cong)
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ChuanBi_PhongThi.ps1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ChuanBi_PhongThi.ps1" -Ip %~1
)
echo.
pause
