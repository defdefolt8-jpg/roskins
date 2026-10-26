import { notFound } from 'next/navigation';
import LegalPage from '../LegalPage';
import { documents } from '../documents';
export const metadata = { title: 'Правила и документы — Roskins', robots: { index: false, follow: true } };
export default async function Page({ params }: { params: Promise<{ document: string }> }) {
  const { document } = await params;
  if (!Object.hasOwn(documents, document)) notFound();
  return <LegalPage slug={document} />;
}
