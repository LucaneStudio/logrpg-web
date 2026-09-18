@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  deploy-android.bat
REM  Build LogRPG (Capacitor/Android), installe et lance l'app
REM  sur le device/emulateur Android connecte via adb.
REM  Lancable depuis n'importe quel dossier (se repositionne seul).
REM ============================================================

cd /d "%~dp0\.."

REM JDK requis : le JDK systeme (souvent 17) est trop ancien pour
REM l'Android Gradle Plugin actuel (exige JDK 21). On utilise le
REM JBR embarque d'Android Studio. Modifie ce chemin si besoin.
if "%JAVA_HOME%"=="" (
  set "JAVA_HOME=C:\Users\merci\AppData\Local\Programs\Android Studio\jbr"
)
if not exist "%JAVA_HOME%\bin\java.exe" (
  echo [ERREUR] JAVA_HOME invalide : "%JAVA_HOME%"
  echo          Le JDK 21 embarque d'Android Studio est requis.
  echo          Modifie JAVA_HOME en tete de ce script si Android Studio est installe ailleurs.
  exit /b 1
)
echo [1/5] JAVA_HOME = %JAVA_HOME%

echo [2/5] Copie des sources web + sync Capacitor...
call npm run android:sync
if errorlevel 1 goto :error

echo [3/5] Build Gradle (assembleDebug)...
pushd android
call .\gradlew.bat assembleDebug
if errorlevel 1 (
  popd
  goto :error
)
popd

set "APK=android\app\build\outputs\apk\debug\app-debug.apk"
if not exist "%APK%" (
  echo [ERREUR] APK introuvable : %APK%
  goto :error
)

echo [4/5] Recherche d'un device/emulateur...
adb start-server >nul 2>&1
set "DEVICE="
for /f "skip=1 tokens=1,2" %%A in ('adb devices') do (
  if "%%B"=="device" set "DEVICE=%%A"
)
if "%DEVICE%"=="" (
  echo [ATTENTION] Aucun device/emulateur detecte par adb.
  echo             APK pret : %APK%
  echo             Branche un telephone avec le debogage USB active, ou lance un emulateur, puis relance ce script.
  exit /b 0
)
echo        Device : %DEVICE%

echo [5/5] Installation + lancement...
adb -s %DEVICE% install -r "%APK%"
if errorlevel 1 goto :error
adb -s %DEVICE% shell am start -n com.lucanestudio.logrpg/.MainActivity

echo.
echo Termine. LogRPG installe et lance sur %DEVICE%.
exit /b 0

:error
echo.
echo [ECHEC] Une etape a echoue, voir le log ci-dessus.
exit /b 1
