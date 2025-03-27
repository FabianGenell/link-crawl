# Website Link Crawler

A Node.js script that crawls a target website and checks which pages contain links to a list of URLs.

## Features

- Crawls entire website starting from the homepage
- Extracts and compares links with URLs from a CSV file
- Records results in CSV format
- Respects robots.txt rules
- Implements concurrency control
- Avoids duplicate crawling
- Adds randomized delays between requests
- Resumes from last crawled page
- Queue-based concurrency
- Configurable crawl depth limit
- Link normalization
- Graceful handling of redirects and broken links

## Installation

1. Clone this repository
2. Install dependencies:
```bash
npm install
```

## Usage

1. Create a CSV file named `target-urls.csv` with a column named "Page URL" containing the URLs you want to find:
```csv
Page URL
https://example.com/page1
https://example.com/page2
```

2. Modify the crawler configuration in `crawler.js`:
```javascript
const crawler = new WebsiteCrawler({
    baseUrl: 'https://your-target-website.com',
    maxConcurrent: 5,  // Number of concurrent requests
    maxDepth: 3,       // Maximum crawl depth
    stateFile: 'crawler-state.json',
    outputFile: 'results.csv'
});
```

3. Run the crawler:
```bash
node crawler.js
```

## Output

The crawler generates two files:
- `results.csv`: Contains the found links with columns:
  - Target URL: The URL from your input CSV
  - Found On: The page where the link was found
- `crawler-state.json`: Contains the crawler's state for resuming interrupted crawls

## Configuration Options

- `baseUrl`: The website to crawl (required)
- `maxConcurrent`: Maximum number of concurrent requests (default: 5)
- `maxDepth`: Maximum crawl depth (default: 3)
- `stateFile`: File to save crawler state (default: 'crawler-state.json')
- `outputFile`: File to save results (default: 'results.csv')

## Notes

- The crawler respects robots.txt rules
- It only crawls pages within the same domain
- Random delays (200ms-1s) are added between requests
- The crawler can be stopped and resumed at any time
- URLs are normalized (query parameters and hash fragments are removed) 