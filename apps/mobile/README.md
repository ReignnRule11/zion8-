# Zion8 mobile

Flutter client for the Zion8 church operating system. Architecture:
`docs/architecture/MOBILE.md`.

The Dart tree is the product. Platform folders (`android/`, `ios/`, `web/`)
are generated locally because this repository does not vendor Gradle or Xcode
projects.

## Prerequisites

- Flutter 3.24+ (Dart 3.5+)
- The API running at `http://localhost:4000` (or pass `--dart-define`)

## Generate platform projects

From this directory, once, on a machine with Flutter:

```bash
flutter create . --project-name zion8 --org com.zion8 --platforms=android,ios,web
```

Existing `lib/`, `test/`, and `pubspec.yaml` are kept.

## Configure

```bash
flutter run --dart-define=API_BASE_URL=http://localhost:4000 --dart-define=API_VERSION=1
```

| Define | Default | Purpose |
| --- | --- | --- |
| `API_BASE_URL` | `http://localhost:4000` | NestJS origin, no path |
| `API_VERSION` | `1` | URI version; requests go to `/api/v1` |
| `ENABLE_BIOMETRICS` | `true` | Set `false` in integration tests |

## Test

```bash
flutter test
flutter test integration_test
```

Widget tests override `ZionApi`, `SecureStore`, `CacheStore`, and
`BiometricService`. They never open a plugin channel.

## Layout

```
lib/core/          Cross-cutting: theme, router, network, Hive, sync
lib/features/      One folder per bounded context
test/unit/         Pure Dart
test/widget/       Riverpod + GoRouter screens
integration_test/  Cold start through login
```
