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
- Stops automatically when all target URLs are found
- Saves results after each find
- Separate state and results files per website

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
    statesDir: './states',  // Directory for state files
    resultsDir: './results' // Directory for result files
});
```

3. Run the crawler:
```bash
npm start
```

## Output

The crawler generates files in two directories:

### States Directory (`./states/`)
- Contains state files for each website (e.g., `https___example_com.json`)
- State files include:
  - Visited URLs
  - Current queue
  - Found results
- Allows resuming interrupted crawls

### Results Directory (`./results/`)
- Contains CSV files for each website (e.g., `https___example_com.csv`)
- CSV files include columns:
  - Target URL: The URL from your input CSV
  - Found On: The page where the link was found

## Configuration Options

- `baseUrl`: The website to crawl (required)
- `maxConcurrent`: Maximum number of concurrent requests (default: 5)
- `maxDepth`: Maximum crawl depth (default: 3)
- `statesDir`: Directory for state files (default: './states')
- `resultsDir`: Directory for result files (default: './results')

## Notes

- The crawler respects robots.txt rules
- It only crawls pages within the same domain
- Random delays (200ms-1s) are added between requests
- The crawler can be stopped and resumed at any time
- URLs are normalized (query parameters and hash fragments are removed)
- Results are saved immediately after finding each target URL
- Crawling stops automatically when all target URLs are found
- Each website gets its own state and results files
- State and results directories are automatically created if they don't exist 