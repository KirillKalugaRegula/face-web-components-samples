# Web Components: Enroll & Verify

Web-версия mobile-кейсов Allure `40333`–`40336` с минимальной адаптацией под браузер и Web Components.

## WEB-EV-01. Enroll creates and persists a profile

Параметры:

| identifierType |
| --- |
| externalId |
| personId |

### Предусловия

Установлен и запущен Web sample `react-ts/face-enroll-verify`. Данные sample очищены. Сервис доступен через `/face-api` с профилем `enroll-verify`.

### Шаги

1. Открыть sample и перейти на экран Enroll.
2. Для `identifierType=externalId` задать `externalId for Enroll`; для `identifierType=personId` оставить это поле пустым. Второй идентификатор в Verify не подменять.
3. Запустить и завершить Enroll. Внутри Enroll пройти passive liveness. При `externalId` значение передаётся в `enroll.person.externalId`; `personId` выдаёт сервис после Enroll и не задаётся приложением.

### Ожидаемый результат

Компонент `<face-enroll>` выполняет passive liveness и Enroll. Сервис возвращает `personId`; `externalId` присутствует только если был задан. Оба возвращённых значения отображаются и сохраняются sample. При пустом `externalId` приложение не генерирует его самостоятельно. Сбоев приложения нет.

## WEB-EV-02. Verify uses the persisted profile

Параметры:

| identifierType |
| --- |
| externalId |
| personId |

### Предусловия

Установлен и запущен Web sample `react-ts/face-enroll-verify`. Результат Enroll уже сохранён в sample. Сервис доступен через `/face-api` с профилем `enroll-verify`.

### Шаги

1. Выбрать тип Verify-идентификатора по параметру `identifierType` (`personId` или `externalId`) и открыть Verify.
2. Запустить Verify по сохранённому идентификатору этого типа.
3. Повторить Verify после перезагрузки страницы с тем же параметром.

### Ожидаемый результат

Верификация того же пользователя завершается успешно. Отображаются `verified`, similarity, match result и liveness. Сохранённые идентификаторы доступны после перезагрузки страницы.

## WEB-EV-03. Verify displays negative results and SDK errors

### Предусловия

Установлен и запущен Web sample `react-ts/face-enroll-verify`. Результат Enroll сохранён в sample. Сервис доступен через `/face-api` с профилем `enroll-verify`.

### Шаги

1. Открыть Verify в Web sample.
2. Выполнить Verify с лицом другого пользователя.
3. Повторить с неизвестным идентификатором и с пустыми идентификаторами.
4. Проверить event log, error area и browser Network.

### Ожидаемый результат

Приложение не падает. Отображается отрицательный результат верификации или ошибка SDK с доступными диагностическими полями. Ошибка не остаётся только в browser console.

## WEB-GS-01. GithubSamples: complete Enroll and Verify flow

### Предусловия

Запущен отдельный Web sample Enroll & Verify. Данные sample очищены. Сервис доступен через `/face-api` с профилем `enroll-verify`.

### Шаги

1. Открыть Web sample Enroll & Verify.
2. Заэнроллить пользователя A и выполнить Verify.
3. Заэнроллить пользователя B, повторно открыть sample и снова выполнить Verify.

### Ожидаемый результат

Sample демонстрирует полный поток Enroll → Verify. Новый Enroll заменяет сохранённый профиль в состоянии sample, а Verify использует новый идентификатор.

## Адаптация только для Web

- Компоненты: `<face-enroll>` и `<face-verify>`.
- Passive liveness передаётся через SDK settings как `livenessType = 1`.
- Состояние сохраняется в `localStorage`.
- Запросы выполняет Web Component SDK; React не делает прямые REST-запросы.
- Для локального сервиса используется same-origin `/face-api` через Vite proxy.
- Ошибки дополнительно фиксируются через `face-enroll`/`face-verify` events и event log.
