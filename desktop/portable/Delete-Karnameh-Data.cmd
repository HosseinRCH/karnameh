@echo off
cd /d "%~dp0"
echo Removing Karnameh data...
if exist "Karnameh-Data" rmdir /s /q "Karnameh-Data"
if exist "%APPDATA%\Karnameh" rmdir /s /q "%APPDATA%\Karnameh"
if exist "%LOCALAPPDATA%\Karnameh" rmdir /s /q "%LOCALAPPDATA%\Karnameh"
for /d %%D in ("%TEMP%\*") do if exist "%%D\Karnameh.exe" rmdir /s /q "%%D"
echo.
echo Done. You can also delete the EXE and this folder.
pause
