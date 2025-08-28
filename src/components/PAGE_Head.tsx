import Head from 'next/head';
import config from '@/config';

/**
 * PAGE_Head Component
 *
 * A comprehensive Next.js Head component that handles all SEO metadata,
 * social media sharing, structured data, and browser configuration.
 * This component provides optimal SEO coverage for search engines and social platforms.
 */
function PAGE_Head() {
  // Extract configuration values for consistent usage throughout the component
  const APP_HREF = config.APP_URL; // Canonical URL of the application
  const APP_TITLE = config.APP_TITLE + ' | ' + config.APP_PARENT; // Full page title with branding
  const APP_DESCRIPTION = config.APP_DESCRIPTION; // Meta description for SEO

  /**
   * Schema.org JSON-LD structured data object
   * Helps search engines understand the content and context of the website
   * Using "SoftwareApplication" type indicates this is a web application
   */
  const schemaData = {
    '@context': 'https://schema.org', // Schema.org vocabulary context
    '@type': 'SoftwareApplication', // Defines this as a software application
    name: config.APP_TITLE, // Application name
    url: APP_HREF, // Application URL
    description: APP_DESCRIPTION, // Application description
  };

  return (
    <Head>
      {/* ========== BASIC HTML DOCUMENT METADATA ========== */}

      {/* Character encoding - UTF-8 for international character support */}
      <meta charSet="utf-8" />

      {/* HTTP Content-Type header equivalent - ensures proper character rendering */}
      <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />

      {/* Viewport configuration for responsive design on mobile devices */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />

      {/* Page title displayed in browser tab and search results */}
      <title>{APP_TITLE}</title>

      {/* Alternate language version link - helps with international SEO */}
      <link rel="alternate" href={APP_HREF} hrefLang="en-us" />

      {/* ========== FAVICON AND APP ICONS ========== */}

      {/* Standard favicon for browser tabs and bookmarks */}
      <link rel="shortcut icon" href="/favicon/favicon.ico" />

      {/* High-resolution icon for Apple devices (iPhone, iPad home screen) */}
      <link
        rel="apple-touch-icon"
        sizes="180x180"
        href="/favicon/apple-touch-icon.png"
      />

      {/* App name when saved to iOS home screen */}
      <meta name="apple-mobile-web-app-title" content={config.APP_PARENT} />

      {/* ========== SEARCH ENGINE OPTIMIZATION ========== */}

      {/* Instructions for search engine crawlers */}
      <meta name="robots" content="follow, index" />
      {/*
       * "follow" - tells crawlers to follow links on this page
       * "index" - allows the page to be indexed in search results
       */}

      {/* Canonical URL - prevents duplicate content issues in SEO */}
      <link rel="canonical" href={APP_HREF} />

      {/* ========== PRIMARY META TAGS FOR SEO ========== */}

      {/* Author information for content attribution */}
      <meta name="author" content={config.APP_AUTHOR} />

      {/* Page title meta tag - used by search engines */}
      <meta name="title" content={APP_TITLE} />

      {/* Meta description - appears in search engine results snippets */}
      <meta name="description" content={APP_DESCRIPTION} />

      {/* ========== OPEN GRAPH PROTOCOL (FACEBOOK) ========== */}
      {/*
       * Open Graph tags control how content appears when shared on Facebook,
       * LinkedIn, and other platforms that support the protocol
       */}

      {/* Title when shared on social media */}
      <meta property="og:title" content={APP_TITLE} />

      {/* Description when shared on social media */}
      <meta property="og:description" content={APP_DESCRIPTION} />

      {/* URL when shared on social media */}
      <meta property="og:url" content={APP_HREF} />

      {/* Content type - "website" is appropriate for most web applications */}
      <meta property="og:type" content="website" />

      {/* Language/locale for internationalization */}
      <meta property="og:locale" content="en_US" />

      {/* Image displayed when shared on social media platforms */}
      <meta property="og:image" content="/quekia_visualizer.png" />

      {/* ========== TWITTER CARD METADATA ========== */}
      {/*
       * Twitter Cards provide rich media experiences when content is shared on Twitter
       * These tags control the appearance of shared links
       */}

      {/* Title for Twitter cards */}
      <meta property="twitter:title" content={APP_TITLE} />

      {/* Description for Twitter cards */}
      <meta property="twitter:description" content={APP_DESCRIPTION} />

      {/* URL for Twitter cards */}
      <meta property="twitter:url" content={APP_HREF} />

      {/* Image for Twitter cards */}
      <meta property="twitter:image" content="/quekia_visualizer.png" />

      {/*
       * Twitter card type - "summary_large_image" displays a large image
       * Alternative options: "summary", "app", "player"
       */}
      <meta property="twitter:card" content="summary_large_image" />

      {/* Twitter handle of the content creator */}
      <meta property="twitter:creator" content={config.APP_AUTHOR} />

      {/* ========== STRUCTURED DATA (JSON-LD) ========== */}
      {/*
       * JSON-LD (JavaScript Object Notation for Linked Data) provides
       * structured data that search engines can understand and use
       * to enhance search results with rich snippets
       */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />
      {/*
       * Using dangerouslySetInnerHTML is necessary here because we need to inject
       * JSON data as a script tag. The JSON.stringify ensures proper escaping.
       */}
    </Head>
  );
}

export default PAGE_Head;
