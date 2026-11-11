# 10 – Wear OS watch app (Galaxy Watch 4 and newer)

`apps/android/wear` is a small Wear OS app. It has no data of its own: the phone app publishes
today's tasks and the focus timer over the Wear OS Data Layer, and the watch sends taps back.

- Data items (phone → watch): `/karnameh/tasks` (today's tasks: overdue, due or started today,
  finished today; plus today's focus minutes) and `/karnameh/timer`.
- Messages (watch → phone): `/karnameh/done` (task id, toggles done), `/karnameh/timer-start`
  (task id, 25-minute focus), `/karnameh/timer-stop`, `/karnameh/refresh`.
- Phone side: `WearBridge.kt` (publishes after every write and timer change) and
  `WearListenerService.kt` (applies messages, then syncs Drive).
- Both APKs use applicationId `com.karnameh.app` and the shared `ci-debug.keystore`; the Data Layer
  only pairs apps with the same package and signature. Phone app must be 0.9.0 or newer.

## Install on the watch
CI publishes `karnameh-wear.apk` in release `android-latest`. Wear OS has no APK installer, so:
1. Watch: Settings → About watch → Software info → tap *Software version* 5 times (Developer options).
2. Watch: Settings → Developer options → turn on *ADB debugging* and *Wireless debugging*; tap
   *Pair new device* to see the IP, port and pairing code.
3. Phone: install an ADB installer such as *Bugjaeger* (or use `adb` on a computer on the same Wi-Fi),
   pair with the code, then install `karnameh-wear.apk`.
