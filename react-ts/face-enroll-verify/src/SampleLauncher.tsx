import "./SampleLauncher.css";

function SampleLauncher() {
  return (
    <main className="sample-launcher">
      <p className="launcher-eyebrow">Regula Web Components · React sample</p>
      <h1>Enroll &amp; Verify</h1>
      <p className="launcher-description">Выберите версию sample для запуска. Обе используют Web Components SDK.</p>
      <div className="sample-options">
        <a className="sample-option" href="/original">
          <span className="sample-tag">ORIGINAL</span>
          <h2>Original sample</h2>
          <p>Базовый сценарий: Enroll, personId и Verify.</p>
          <span className="sample-launch">Запустить оригинальный →</span>
        </a>
        <a className="sample-option enhanced" href="/enhanced">
          <span className="sample-tag">EXTENDED</span>
          <h2>Extended sample</h2>
          <p>Настройки, негативные сценарии, duplicate search, события и результаты.</p>
          <span className="sample-launch">Запустить расширенный →</span>
        </a>
      </div>
      <p className="launcher-footnote">Backend proxy: <code>/face-api</code></p>
    </main>
  );
}

export default SampleLauncher;
