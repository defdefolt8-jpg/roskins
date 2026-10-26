import { documents } from './documents';
import { LEGAL_VERSION, legalReady, legalOperator } from '../../lib/legal-config';
import './legal.css';

export default function LegalPage({ slug }: { slug?: string }) {
  const doc = slug && Object.hasOwn(documents, slug) ? documents[slug as keyof typeof documents] : null;
  return <main className="legal-shell">
    <header className="legal-header"><a className="legal-logo" href="/" aria-label="Roskins — главная">roskins<span>.</span></a><a className="legal-back" href="/">← На трейд-плазу</a></header>
    <div className="legal-heading"><span className="legal-kicker">ПРОЗРАЧНО И ПО ПРАВИЛАМ</span><h1>{doc?.title || 'Документы Roskins'}</h1><p>{doc?.summary || 'Условия площадки, приватность и безопасность обменов — в одном месте.'}</p></div>
    {!legalReady && <aside className="legal-draft" role="note"><b>Проекты документов перед открытием</b><p>Условия обработки данных, полные реквизиты оператора и порядок участия детей ещё уточняются. Эти тексты описывают текущую версию сервиса и требуют завершения до публичного запуска.</p></aside>}
    {slug === 'contacts' && legalOperator.contactEmail && <address className="legal-contact-card"><b>{legalOperator.name}</b><span>{legalOperator.country}</span><a href={`mailto:${legalOperator.contactEmail}`}>{legalOperator.contactEmail}</a></address>}
    <div className="legal-layout"><nav className="legal-nav" aria-label="Юридические документы"><a href="/legal" aria-current={!doc ? 'page' : undefined}>Все документы</a>{Object.entries(documents).map(([key, item]) => <a key={key} href={`/legal/${key}`} aria-current={key === slug ? 'page' : undefined}>{item.title}</a>)}</nav>
    <article className="legal-content">{doc ? <><p className="legal-version">Редакция от 26 октября 2026 · {LEGAL_VERSION}</p>{doc.sections.map(([heading, text]) => <section key={heading}><h2>{heading}</h2><p>{text}</p></section>)}{slug === 'rights' && <p className="legal-sources">Условия правообладателей: <a href="https://www.playadopt.me/legal/terms" target="_blank" rel="noopener noreferrer">Adopt Me</a> · <a href="https://en.help.roblox.com/hc/en-us/articles/115004647846-Roblox-Terms-of-Use" target="_blank" rel="noopener noreferrer">Roblox</a></p>}</> : <div className="legal-cards">{Object.entries(documents).map(([key, item]) => <a className="legal-card" key={key} href={`/legal/${key}`}><span>↗</span><h2>{item.title}</h2><p>{item.summary}</p></a>)}</div>}</article></div>
    <footer className="legal-footer">© {new Date().getFullYear()} Roskins. Независимая площадка. Не связана с Roblox или Uplift Games.</footer>
  </main>;
}
