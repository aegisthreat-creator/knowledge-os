import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DocumentsPage } from '@/features/documents/documents-page';
import { PageLoader } from '@/components/ui/spinner';

export const metadata: Metadata = { title: 'Documents' };

export default function DocumentsRoute() {
  return (
    <Suspense fallback={<PageLoader />}>
      <DocumentsPage />
    </Suspense>
  );
}
