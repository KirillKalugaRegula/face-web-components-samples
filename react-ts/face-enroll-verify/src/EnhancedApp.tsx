import * as React from "react";
import {
  ErrorTypes,
  FaceEnrollDetailType,
  FaceEnrollResponseType,
  FaceEnrollWebComponent,
  FaceLivenessDetailType,
  FaceLivenessResponseType,
  FaceLivenessResultStatus,
  FaceLivenessSettings,
  FaceLivenessType,
  FaceLivenessWebComponent,
  FaceVerifyDetailType,
  FaceVerifyResponseType,
  FaceVerifySettings,
  FaceVerifyWebComponent,
  ResponseCode,
} from "@regulaforensics/vp-frontend-face-components";
import "@regulaforensics/vp-frontend-face-components";
import "./App.css";

const faceServiceUrl = "/face-api";
const faceServiceTargetUrl = "http://127.0.0.1:41101";
const storageKey = "face-enroll-verify-sample-v2";

type Operation = "enroll" | "verify" | "liveness" | null;
type GroupMode = "default" | "custom";
type IdentifierMode = "personId" | "empty";
type Preset =
  | "ready"
  | "unknown-group"
  | "unknown-person"
  | "empty-identifiers";

type FormState = {
  groupMode: GroupMode;
  groupId: string;
  name: string;
  enrollExternalId: string;
  personId: string;
  externalId: string;
  identifierMode: IdentifierMode;
  threshold: string;
  duplicateSearchEnabled: boolean;
  duplicateSearchThreshold: string;
  duplicateSearchLimit: string;
  retryCount: string;
  startScreen: boolean;
  finishScreen: boolean;
};

type EventLogEntry = {
  id: number;
  time: string;
  source: string;
  action: string;
  status?: number;
  reason?: string;
  rawMsg?: string;
  transactionId?: string;
  payload: string;
  recovered?: boolean;
};

type RawRequestSnapshot = {
  capturedAt: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
};

type RawRequestRecord = {
  start: RawRequestSnapshot | null;
  process: RawRequestSnapshot | null;
};

type RawRequests = Record<Exclude<Operation, null>, RawRequestRecord>;

type HttpErrorSnapshot = {
  operation: Exclude<Operation, null>;
  capturedAt: string;
  method: string;
  url: string;
  status: number;
  statusText: string;
  body: string;
};

const defaultFormState: FormState = {
  groupMode: "default",
  groupId: "",
  name: "Web sample person",
  enrollExternalId: "",
  personId: "",
  externalId: "",
  identifierMode: "personId",
  threshold: "",
  duplicateSearchEnabled: false,
  duplicateSearchThreshold: "0.8",
  duplicateSearchLimit: "1",
  retryCount: "0",
  startScreen: true,
  finishScreen: true,
};

function loadFormState(): FormState {
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved ? { ...defaultFormState, ...JSON.parse(saved) } : defaultFormState;
  } catch {
    return defaultFormState;
  }
}

function numberOrUndefined(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : undefined;
}

function retryCountOrUndefined(value: string): number | undefined {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function positiveIntegerOrUndefined(value: string): number | undefined {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function responseJson(value: unknown): string {
  return JSON.stringify(
    value,
    (key, nestedValue) => {
      if (key === "images" && Array.isArray(nestedValue)) {
        return `[${nestedValue.length} image(s) omitted]`;
      }
      return nestedValue;
    },
    2,
  );
}

function formatHttpResponseBody(body: string): string {
  if (!body) return "(empty response body)";
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function requestBodyPreview(body: BodyInit | null | undefined): unknown {
  if (body == null) return null;
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  if (body instanceof Blob) return { kind: "blob", type: body.type, byteLength: body.size };
  if (body instanceof ArrayBuffer) return { kind: "arrayBuffer", byteLength: body.byteLength };
  if (ArrayBuffer.isView(body)) return { kind: "binary", byteLength: body.byteLength };
  return { kind: "opaque" };
}

function requestHeadersPreview(headers: HeadersInit | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (headers) new Headers(headers).forEach((value, key) => { result[key] = value; });
  return result;
}

function livenessLabel(status: number | undefined): string {
  if (status === FaceLivenessResultStatus.CONFIRMED) return "confirmed";
  if (status === FaceLivenessResultStatus.NOT_CONFIRMED) return "not confirmed";
  if (status === FaceLivenessResultStatus.UNKNOWN) return "unknown";
  return "not available";
}

function errorLabel(reason: string | undefined): string {
  if (!reason) return "Unknown component error";
  return reason in ErrorTypes ? reason : `Service/component error: ${reason}`;
}

function App() {
  const [openComponent, setOpenComponent] = React.useState<Operation>(null);
  const [form, setForm] = React.useState<FormState>(loadFormState);
  const [preset, setPreset] = React.useState<Preset>("ready");
  const [enrollResponse, setEnrollResponse] =
    React.useState<FaceEnrollResponseType | null>(null);
  const [verifyResponse, setVerifyResponse] =
    React.useState<FaceVerifyResponseType | null>(null);
  const [livenessResponse, setLivenessResponse] =
    React.useState<FaceLivenessResponseType | null>(null);
  const [lastError, setLastError] = React.useState<string>("");
  const [httpError, setHttpError] = React.useState<HttpErrorSnapshot | null>(null);
  const [eventLog, setEventLog] = React.useState<EventLogEntry[]>([]);
  const [rawRequests, setRawRequests] = React.useState<RawRequests>({
    enroll: { start: null, process: null },
    verify: { start: null, process: null },
    liveness: { start: null, process: null },
  });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const enrollComponentRef = React.useRef<FaceEnrollWebComponent | null>(null);
  const verifyComponentRef = React.useRef<FaceVerifyWebComponent | null>(null);
  const livenessComponentRef = React.useRef<FaceLivenessWebComponent | null>(null);
  const eventCounter = React.useRef(0);
  const requestOperationRef = React.useRef<Exclude<Operation, null> | null>(null);
  const operationSucceededRef = React.useRef(false);
  const pendingErrorRef = React.useRef<string>("");
  const httpErrorRef = React.useRef<string>("");
  const sessionStartEventIdRef = React.useRef(0);

  const updateForm = (patch: Partial<FormState>) => {
    setForm((previous) => ({ ...previous, ...patch }));
  };

  React.useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(form));
  }, [form]);

  React.useEffect(() => {
    const originalFetch = window.fetch;
    const captureRequest = (
      request: RawRequestSnapshot,
      operation: Exclude<Operation, null>,
      phase: "start" | "process",
    ) => {
      setRawRequests((previous) => ({
        ...previous,
        [operation]: { ...previous[operation], [phase]: request },
      }));
    };

    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const isStartRequest = url.includes("/api/v2/liveness/start");
      const isProcessRequest = url.includes("/api/v2/liveness?");
      let operation: Exclude<Operation, null> | null = null;
      if (isStartRequest || isProcessRequest) {
        const body = requestBodyPreview(init?.body);
        operation = isStartRequest
          ? (body && typeof body === "object" && "enroll" in body && body.enroll
            ? "enroll"
            : body && typeof body === "object" && "verify" in body && body.verify
              ? "verify"
              : "liveness")
          : requestOperationRef.current;
        if (operation) {
          requestOperationRef.current = operation;
          captureRequest({
            capturedAt: new Date().toLocaleTimeString(),
            method: init?.method || "GET",
            url,
            headers: requestHeadersPreview(init?.headers),
            body,
          }, operation, isStartRequest ? "start" : "process");
        }
      }
      const response = await originalFetch.call(window, input, init);
      if (operation && !response.ok) {
        const body = await response.clone().text().catch(() => "");
        const trimmedBody = body.length > 4000 ? `${body.slice(0, 4000)}… (truncated)` : body;
        const statusText = response.statusText || "";
        const message = `HTTP ${response.status}${statusText ? ` ${statusText}` : ""}`;
        const requestMethod = init?.method || (input instanceof Request ? input.method : "POST");
        httpErrorRef.current = message;
        pendingErrorRef.current = message;
        setLastError(message);
        setHttpError({
          operation,
          capturedAt: new Date().toLocaleTimeString(),
          method: requestMethod,
          url,
          status: response.status,
          statusText,
          body: trimmedBody,
        });
      }
      return response;
    };

    return () => { window.fetch = originalFetch; };
  }, []);

  const commonSettings = React.useMemo<FaceLivenessSettings>(
    () => ({
      url: faceServiceUrl,
      livenessType: FaceLivenessType.PASSIVE,
      locale: "en",
      startScreen: form.startScreen,
      finishScreen: form.finishScreen,
      retryCount: retryCountOrUndefined(form.retryCount),
      metadata: { sample: "face-enroll-verify-web", preset },
      customization: {
        onboardingScreenStartButtonBackground: "#5b5050",
        retryScreenRetryButtonBackground: "#5b5050",
      },
    }),
    [form.finishScreen, form.retryCount, form.startScreen, preset],
  );

  const enrollPerson = React.useMemo(() => {
    const person: { name?: string; externalId?: string; groups?: string[] } = {};
    const name = form.name.trim();
    const externalId = form.enrollExternalId.trim();
    const groupId = form.groupId.trim();
    if (name) person.name = name;
    if (externalId) person.externalId = externalId;
    if (form.groupMode === "custom" && groupId) person.groups = [groupId];
    return person;
  }, [form.enrollExternalId, form.groupId, form.groupMode, form.name]);

  const enrollSearch = React.useMemo(() => {
    if (!form.duplicateSearchEnabled) return undefined;

    return {
      ...(form.groupMode === "custom" && form.groupId.trim()
        ? { groupIds: [form.groupId.trim()] }
        : {}),
      threshold: numberOrUndefined(form.duplicateSearchThreshold) ?? 0.8,
      limit: positiveIntegerOrUndefined(form.duplicateSearchLimit) ?? 1,
    };
  }, [
    form.duplicateSearchEnabled,
    form.duplicateSearchLimit,
    form.duplicateSearchThreshold,
    form.groupId,
    form.groupMode,
  ]);

  const enrollConfig = React.useMemo(
    () => ({
      person: enrollPerson,
      ...(enrollSearch ? { search: enrollSearch } : {}),
    }),
    [enrollPerson, enrollSearch],
  );

  const verifyConfig = React.useMemo(() => {
    const threshold = numberOrUndefined(form.threshold);
    const suffix = threshold === undefined ? {} : { threshold };
    if (form.identifierMode === "empty") {
      return { ...suffix } as unknown as NonNullable<FaceVerifySettings["verify"]>;
    }
    return { personId: form.personId.trim(), ...suffix };
  }, [form.identifierMode, form.personId, form.threshold]);

  React.useEffect(() => {
    if (openComponent === "enroll" && enrollComponentRef.current) {
      enrollComponentRef.current.settings = { ...commonSettings, enroll: enrollConfig };
    }
    if (openComponent === "verify" && verifyComponentRef.current) {
      verifyComponentRef.current.settings = { ...commonSettings, verify: verifyConfig };
    }
    if (openComponent === "liveness" && livenessComponentRef.current) {
      livenessComponentRef.current.settings = commonSettings;
    }
  }, [commonSettings, enrollConfig, openComponent, verifyConfig]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const appendEvent = (
      source: string,
      detail: {
        action: string;
        data: { status?: number; reason?: string; rawMsg?: string; transactionId?: string } | null;
      },
    ) => {
      const data = detail.data;
      const entry: EventLogEntry = {
        id: eventCounter.current++,
        time: new Date().toLocaleTimeString(),
        source,
        action: detail.action,
        status: data?.status,
        reason: data?.reason,
        rawMsg: data?.rawMsg,
        transactionId: data?.transactionId,
        payload: responseJson(detail),
      };
      setEventLog((previous) => [entry, ...previous].slice(0, 40));
      if (data?.status === ResponseCode.ERROR && (data.reason || data.rawMsg)) {
        if (!httpErrorRef.current) pendingErrorRef.current = data.rawMsg || data.reason || "";
      }
    };

    const finishOperation = () => {
      if (!operationSucceededRef.current) {
        setLastError(httpErrorRef.current || errorLabel(pendingErrorRef.current || "CANCELLED"));
      }
      setOpenComponent(null);
    };

    const markSessionErrorsRecovered = (source: string) => {
      setEventLog((previous) => previous.map((entry) =>
        entry.id >= sessionStartEventIdRef.current &&
        entry.source === source &&
        entry.status === ResponseCode.ERROR
          ? { ...entry, status: undefined, reason: undefined, rawMsg: undefined, recovered: true }
          : entry,
      ));
    };

    const enrollListener = (event: CustomEvent<FaceEnrollDetailType>) => {
      const detail = event.detail;
      appendEvent("face-enroll", detail);
      if (detail.action === "PROCESS_FINISHED" && detail.data?.status === ResponseCode.OK) {
        operationSucceededRef.current = true;
        pendingErrorRef.current = "";
        httpErrorRef.current = "";
        setHttpError(null);
        setLastError("");
        markSessionErrorsRecovered("face-enroll");
        const response = detail.data.response;
        if (response) {
          const enrollResult = response.enrollResult;
          const person = enrollResult?.person ?? enrollResult?.search?.persons?.[0] ?? null;
          setEnrollResponse(response);
          setVerifyResponse(null);
          setForm((previous) => ({
            ...previous,
            personId: person?.id || "",
            externalId: person?.externalId || (enrollResult?.enrolled ? previous.enrollExternalId.trim() : ""),
          }));
        }
      }
      if (detail.action === "CLOSE" || detail.action === "RETRY_COUNTER_EXCEEDED") finishOperation();
    };

    const verifyListener = (event: CustomEvent<FaceVerifyDetailType>) => {
      const detail = event.detail;
      appendEvent("face-verify", detail);
      if (detail.action === "PROCESS_FINISHED" && detail.data?.status === ResponseCode.OK) {
        operationSucceededRef.current = true;
        pendingErrorRef.current = "";
        httpErrorRef.current = "";
        setHttpError(null);
        setLastError("");
        markSessionErrorsRecovered("face-verify");
        if (detail.data.response) {
          setVerifyResponse(detail.data.response);
        }
      }
      if (detail.action === "CLOSE" || detail.action === "RETRY_COUNTER_EXCEEDED") finishOperation();
    };

    const livenessListener = (event: CustomEvent<FaceLivenessDetailType>) => {
      const detail = event.detail;
      appendEvent("face-liveness", detail);
      if (detail.action === "PROCESS_FINISHED" && detail.data?.status === ResponseCode.OK) {
        operationSucceededRef.current = true;
        pendingErrorRef.current = "";
        httpErrorRef.current = "";
        setHttpError(null);
        setLastError("");
        markSessionErrorsRecovered("face-liveness");
        if (detail.data.response) {
          setLivenessResponse(detail.data.response);
        }
      }
      if (detail.action === "CLOSE" || detail.action === "RETRY_COUNTER_EXCEEDED") finishOperation();
    };

    container.addEventListener("face-enroll", enrollListener);
    container.addEventListener("face-verify", verifyListener);
    container.addEventListener("face-liveness", livenessListener);
    return () => {
      container.removeEventListener("face-enroll", enrollListener);
      container.removeEventListener("face-verify", verifyListener);
      container.removeEventListener("face-liveness", livenessListener);
    };
  }, []);

  const applyPreset = (nextPreset: Preset) => {
    setPreset(nextPreset);
    setLastError("");
    if (nextPreset === "ready") {
      updateForm({ groupMode: "default", groupId: "", identifierMode: "personId", personId: "", externalId: "" });
      setVerifyResponse(null);
    } else if (nextPreset === "unknown-group") {
      updateForm({ groupMode: "custom", groupId: "unknown-group-id" });
    } else if (nextPreset === "unknown-person") {
      updateForm({ identifierMode: "personId", personId: "unknown-person-id" });
    } else if (nextPreset === "empty-identifiers") {
      updateForm({ identifierMode: "empty", personId: "", externalId: "" });
    }
  };

  const clearResults = () => {
    setEnrollResponse(null);
    setVerifyResponse(null);
    setLivenessResponse(null);
    setLastError("");
    setHttpError(null);
    httpErrorRef.current = "";
    setEventLog([]);
    setRawRequests({
      enroll: { start: null, process: null },
      verify: { start: null, process: null },
      liveness: { start: null, process: null },
    });
  };

  const clearSavedProfile = () => {
    updateForm({ personId: "", externalId: "" });
    setEnrollResponse(null);
    setVerifyResponse(null);
  };

  const openOperation = (operation: Exclude<Operation, null>) => {
    operationSucceededRef.current = false;
    pendingErrorRef.current = "";
    httpErrorRef.current = "";
    sessionStartEventIdRef.current = eventCounter.current;
    setLastError("");
    setHttpError(null);
    setOpenComponent(operation);
  };

  const returnToSample = () => {
    if (!operationSucceededRef.current) {
      setLastError(httpErrorRef.current || errorLabel(pendingErrorRef.current || "CANCELLED"));
    }
    setOpenComponent(null);
  };

  return (
    <div className="app-shell" ref={containerRef}>
      <header className="app-header">
        <div>
          <p className="eyebrow">Regula Web Components</p>
          <h1>Face Enroll &amp; Verify</h1>
          <p className="muted">Расширенный тестовый sample для сценариев SDK и Face API.</p>
          <a className="sample-chooser-link" href="/">← Sample chooser</a>
        </div>
        <div className="service-chip"><span className="status-dot" /><span>Passive liveness</span><code>{faceServiceUrl} → {faceServiceTargetUrl}</code></div>
      </header>

      {!openComponent && (
        <main className="dashboard">
          <section className="panel settings-panel">
            <div className="panel-title">
              <div><p className="eyebrow">Test configuration</p><h2>Сценарий проверки</h2></div>
              <select aria-label="Test case preset" value={preset} onChange={(event) => applyPreset(event.target.value as Preset)}>
                <option value="ready">Ready: Enroll → Verify</option>
                <option value="unknown-group">Negative: unknown groupId</option>
                <option value="unknown-person">Negative: unknown personId</option>
                <option value="empty-identifiers">Negative: empty identifiers</option>
              </select>
            </div>

            <div className="form-grid">
              <label>Group<select value={form.groupMode} onChange={(event) => updateForm({ groupMode: event.target.value as GroupMode })}><option value="default">Default group / no groups field</option><option value="custom">Custom groupId</option></select></label>
              <label>groupId<input value={form.groupId} disabled={form.groupMode === "default"} placeholder="group-id" onChange={(event) => updateForm({ groupId: event.target.value })} /></label>
              <label>Person name for Enroll<input value={form.name} onChange={(event) => updateForm({ name: event.target.value })} /></label>
              <label>externalId for Enroll<input value={form.enrollExternalId} placeholder="optional Enroll identifier" onChange={(event) => updateForm({ enrollExternalId: event.target.value })} /></label>
            </div>

            <div className="duplicate-search-box">
              <label className="toggle-label"><input type="checkbox" checked={form.duplicateSearchEnabled} onChange={(event) => updateForm({ duplicateSearchEnabled: event.target.checked })} />Duplicate search during Enroll</label>
              <span className="field-hint">Ищет похожие профили до сохранения результата. Custom groupId ограничивает поиск этой группой.</span>
              {form.duplicateSearchEnabled && <div className="form-grid search-grid">
                <label>Search threshold<input type="number" min="0" max="1" step="0.01" value={form.duplicateSearchThreshold} onChange={(event) => updateForm({ duplicateSearchThreshold: event.target.value })} /><span className="field-hint">0–1; default 0.8</span></label>
                <label>Search limit<input type="number" min="1" step="1" value={form.duplicateSearchLimit} onChange={(event) => updateForm({ duplicateSearchLimit: event.target.value })} /><span className="field-hint">Maximum profiles returned</span></label>
              </div>}
            </div>

            <div className="divider" />
            <div className="section-heading"><h3>Verify identifier</h3><span className="hint">Эта версия SDK поддерживает Verify только по personId.</span></div>
            <div className="identifier-grid">
              <label className="radio-card"><input type="radio" checked={form.identifierMode === "personId"} onChange={() => updateForm({ identifierMode: "personId" })} /><span>personId</span><input value={form.personId} placeholder="saved personId" onChange={(event) => updateForm({ personId: event.target.value })} /></label>
              <label className="radio-card compact-radio"><input type="radio" checked={form.identifierMode === "empty"} onChange={() => updateForm({ identifierMode: "empty" })} /><span>Empty</span></label>
            </div>

            <div className="form-grid small-grid">
              <label>Similarity threshold<input type="number" min="0" max="1" step="0.01" value={form.threshold} placeholder="service default" onChange={(event) => updateForm({ threshold: event.target.value })} /></label>
              <label>Liveness retry count<input type="number" min="0" step="1" value={form.retryCount} onChange={(event) => updateForm({ retryCount: event.target.value })} /><span className="field-hint">0 = unlimited</span></label>
              <label className="toggle-label"><input type="checkbox" checked={form.startScreen} onChange={(event) => updateForm({ startScreen: event.target.checked })} />Start screen</label>
              <label className="toggle-label"><input type="checkbox" checked={form.finishScreen} onChange={(event) => updateForm({ finishScreen: event.target.checked })} />Finish screen</label>
            </div>

            <div className="action-row">
              <button className="primary-button" onClick={() => openOperation("enroll")}>Open Enroll</button>
              <button className="primary-button" onClick={() => openOperation("verify")}>Open Verify</button>
              <button className="secondary-button" onClick={() => openOperation("liveness")}>Liveness only</button>
              <button className="text-button" onClick={clearSavedProfile}>Clear saved profile</button>
              <button className="text-button" onClick={clearResults}>Clear results/log</button>
            </div>
          </section>

          <section className="result-grid">
            <ResultCard title="Saved profile" tone={form.personId || form.externalId ? "success" : "neutral"}><dl className="data-list"><dt>personId</dt><dd>{form.personId || "—"}</dd><dt>externalId</dt><dd>{form.externalId || "—"}</dd><dt>Persistence</dt><dd>localStorage</dd></dl><p className="hint">Enroll сохраняет оба идентификатора; текущий SDK выполняет Verify только по personId.</p></ResultCard>
            <ResultCard title="Enroll result" tone={enrollResponse ? "success" : "neutral"}>{enrollResponse ? <><ResultImage images={enrollResponse.images} /><dl className="data-list"><dt>Enrolled</dt><dd>{String(enrollResponse.enrollResult?.enrolled)}</dd><dt>Liveness</dt><dd>{livenessLabel(enrollResponse.status)}</dd><dt>Person</dt><dd>{enrollResponse.enrollResult?.person?.name || enrollResponse.enrollResult?.search?.persons?.[0]?.name || "—"}</dd><dt>Duplicates</dt><dd>{enrollResponse.enrollResult?.search?.persons?.length ?? 0}</dd></dl>{enrollResponse.enrollResult?.search?.persons?.length ? <div className="search-results">{enrollResponse.enrollResult.search.persons.map((person) => <div className="search-result-row" key={person.id}><strong>{person.name || "Unnamed"}</strong><span>{person.externalId || person.id}</span></div>)}</div> : null}</> : <p className="muted">Результат появится после Enroll.</p>}</ResultCard>
            <ResultCard title="Verify result" tone={verifyResponse?.verifyResult?.verified ? "success" : "neutral"}>{verifyResponse ? <dl className="data-list"><dt>Verified</dt><dd>{String(verifyResponse.verifyResult?.verified)}</dd><dt>Match</dt><dd>{String(verifyResponse.verifyResult?.match?.verified ?? false)}</dd><dt>Similarity</dt><dd>{formatSimilarity(verifyResponse.verifyResult?.match?.similarity)}</dd><dt>Liveness</dt><dd>{livenessLabel(verifyResponse.status)}</dd></dl> : <p className="muted">Результат появится после Verify.</p>}</ResultCard>
            <ResultCard title="Liveness result" tone={livenessResponse?.status === FaceLivenessResultStatus.CONFIRMED ? "success" : "neutral"}>{livenessResponse ? <dl className="data-list"><dt>Status</dt><dd>{livenessLabel(livenessResponse.status)}</dd><dt>Type</dt><dd>{livenessResponse.type} / passive = 1</dd><dt>Transaction</dt><dd>{livenessResponse.transactionId || "—"}</dd></dl> : <p className="muted">Можно проверить liveness отдельно.</p>}</ResultCard>
          </section>

          {lastError && <section className="error-banner"><strong>Error</strong><span>{lastError}</span><span className="hint">Событие SDK и тело HTTP-ответа, если SDK получил ответ от сервиса.</span></section>}

          <section className={`lower-grid${httpError ? "" : " single-column"}`}>
            {httpError && <section className="panel http-error-card">
              <div className="http-error-title"><h3>Ответ сервиса</h3><span className="http-status-badge">HTTP {httpError.status} {httpError.statusText}</span></div>
              <div className="http-error-meta"><span className="field-hint">Запрос</span><code>{httpError.method} {httpError.url}</code><span className="field-hint">Получен</span><span>{httpError.capturedAt}</span></div>
              <div><span className="field-hint">Тело HTTP-ответа</span><pre className="json-view">{formatHttpResponseBody(httpError.body)}</pre></div>
              <p className="hint">Это ответ Face API, перехваченный sample. События самой компоненты — в Event log → SDK CustomEvent.detail.</p>
            </section>}
            <ResultCard title={`Event log (${eventLog.length})`}>{eventLog.length ? <div className="event-log">{eventLog.map((event) => <div className="event-row" key={event.id}><span className="event-time">{event.time}</span><strong>{event.source}</strong><span>{event.action}</span>{event.recovered && <span className="recovered-text">RECOVERED</span>}{event.status !== undefined && <span className={event.status === ResponseCode.OK ? "ok-text" : "error-text"}>{event.status === ResponseCode.OK ? "OK" : "ERROR"}</span>}{event.reason && <code>{event.reason}</code>}{event.rawMsg && <code>{event.rawMsg}</code>}<details className="event-payload" open={event.status === ResponseCode.ERROR}><summary>SDK CustomEvent.detail</summary><pre className="json-view">{event.payload}</pre></details></div>)}</div> : <p className="muted">SDK events будут отображены здесь.</p>}</ResultCard>
          </section>

          {(rawRequests.enroll.start || rawRequests.enroll.process || rawRequests.verify.start || rawRequests.verify.process) && <section className="lower-grid raw-results">
            {rawRequests.enroll.start && <ResultCard title="Raw Enroll request"><pre className="json-view">{responseJson(rawRequests.enroll)}</pre></ResultCard>}
            {rawRequests.verify.start && <ResultCard title="Raw Verify request"><pre className="json-view">{responseJson(rawRequests.verify)}</pre></ResultCard>}
          </section>}

          {(enrollResponse || verifyResponse || livenessResponse || httpError) && <section className="lower-grid raw-results">
            {(enrollResponse || httpError?.operation === "enroll") && <ResultCard title="Raw Enroll response">{httpError?.operation === "enroll" ? <><p className="hint">HTTP {httpError.status} {httpError.statusText} · {httpError.method} {httpError.url}</p><pre className="json-view">{httpError.body || "(empty response body)"}</pre></> : <pre className="json-view">{responseJson(enrollResponse)}</pre>}</ResultCard>}
            {(verifyResponse || httpError?.operation === "verify") && <ResultCard title="Raw Verify response">{httpError?.operation === "verify" ? <><p className="hint">HTTP {httpError.status} {httpError.statusText} · {httpError.method} {httpError.url}</p><pre className="json-view">{httpError.body || "(empty response body)"}</pre></> : <pre className="json-view">{responseJson(verifyResponse)}</pre>}</ResultCard>}
            {(livenessResponse || httpError?.operation === "liveness") && <ResultCard title="Raw Liveness response">{httpError?.operation === "liveness" ? <><p className="hint">HTTP {httpError.status} {httpError.statusText} · {httpError.method} {httpError.url}</p><pre className="json-view">{httpError.body || "(empty response body)"}</pre></> : <pre className="json-view">{responseJson(livenessResponse)}</pre>}</ResultCard>}
          </section>}
        </main>
      )}

      {openComponent && <div className="component-stage"><button className="back-button" onClick={returnToSample}>← Back to sample</button>{openComponent === "enroll" && <face-enroll ref={enrollComponentRef} />}{openComponent === "verify" && <face-verify ref={verifyComponentRef} />}{openComponent === "liveness" && <face-liveness ref={livenessComponentRef} />}</div>}
    </div>
  );
}

function ResultCard({ children, title, tone = "neutral" }: { children: React.ReactNode; title: string; tone?: "neutral" | "success" }) {
  return <article className={`panel result-card ${tone}`}><div className="card-title"><h3>{title}</h3>{tone === "success" && <span className="success-mark">✓</span>}</div>{children}</article>;
}

function ResultImage({ images }: { images: string[] }) {
  if (!images[0]) return null;
  return <img className="result-image" src={`data:image/jpeg;base64,${images[0]}`} alt="Captured face" />;
}

function formatSimilarity(similarity: number | undefined): string {
  return similarity === undefined ? "—" : `${(similarity * 100).toFixed(2)}%`;
}

export default App;
