import ReporterApp from '../reporter/ReporterApp';
import '../reporter/reporter.css';

export default function LivePage() {
  return (
    <div className="reporter-page">
      <ReporterApp />
      <div style={{ color: '#888', fontSize: '13px', marginBottom: '28px' }}>Made with love By <a href="https://notrana.is-a.dev/">Asad</a></div>
    </div>
  );
}
