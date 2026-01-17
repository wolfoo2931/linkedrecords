import './global.css';
import { RootProvider } from 'fumadocs-ui/provider';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { Banner } from 'fumadocs-ui/components/banner';
import type { ReactNode } from 'react';
import { source } from '@/lib/source';

export const metadata = {
  title: 'LinkedRecords',
  description: 'A documentation site for LinkedRecords - a BaaS for single-page applications',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider theme={{ defaultTheme: 'dark' }}>
          <Banner variant="rainbow" changeLayout>
            <a
              href="https://github.com/wolfoo2931/linkedrecords"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              Help us grow — star us on GitHub
              <img
                src="https://img.shields.io/github/stars/wolfoo2931/linkedrecords?style=social"
                alt="GitHub stars"
                className="h-5"
              />
            </a>
          </Banner>
          <DocsLayout
            tree={source.pageTree}
            nav={{
              title: 'LinkedRecords',
            }}
            sidebar={{ hideSearch: true }}
            githubUrl="https://github.com/wolfoo2931/linkedrecords"
          >
            {children}
          </DocsLayout>
        </RootProvider>
      </body>
    </html>
  );
}
