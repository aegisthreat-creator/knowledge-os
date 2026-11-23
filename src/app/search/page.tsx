import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchPage } from '@/features/search/search-page';
import { PageLoader } from '@/components/ui/spinner';

export const metadata: Metadata = { title: 'Search' };

export default function SearchRoute() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SearchPage />
    </Suspense>
  );
}
