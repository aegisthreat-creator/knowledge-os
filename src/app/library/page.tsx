import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LibraryPage } from '@/features/library/library-page';
import { PageLoader } from '@/components/ui/spinner';

export const metadata: Metadata = { title: 'Library' };

export default function LibraryRoute() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LibraryPage />
    </Suspense>
  );
}
