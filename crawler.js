import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { parse } from 'csv-parse';
import { createObjectCsvWriter } from 'csv-writer';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';

class WebsiteCrawler {
    constructor(config) {
        this.baseUrl = new URL(config.baseUrl);
        this.targetUrls = new Set();
        this.visitedUrls = new Set();
        this.results = [];
        this.queue = [];
        this.maxConcurrent = config.maxConcurrent ?? 5;
        this.maxDepth = config.maxDepth ?? 3;
        this.statesDir = config.statesDir ?? './states';
        this.resultsDir = config.resultsDir ?? './results';
        this.robots = null;
        this.isCrawling = false;
        this.foundUrls = new Set();
    }

    async initialize() {
        // Create states and results directories if they don't exist
        await fsPromises.mkdir(this.statesDir, { recursive: true });
        await fsPromises.mkdir(this.resultsDir, { recursive: true });

        // Load target URLs from CSV
        await this.loadTargetUrls();
        console.log(`Loaded ${this.targetUrls.size} target URLs to find`);

        // Load robots.txt
        await this.loadRobotsTxt();

        // Load previous state if exists
        await this.loadState();

        // Initialize CSV writer
        const safeUrl = this.baseUrl.toString().replace(/[^a-zA-Z0-9]/g, '_');
        this.outputFile = `${this.resultsDir}/${safeUrl}.csv`;
        this.csvWriter = createObjectCsvWriter({
            path: this.outputFile,
            header: [
                { id: 'targetUrl', title: 'Target URL' },
                { id: 'foundOn', title: 'Found On' }
            ]
        });
    }

    getStateFileName() {
        // Replace all non-alphanumeric characters with underscores
        const safeUrl = this.baseUrl.toString().replace(/[^a-zA-Z0-9]/g, '_');
        return `${this.statesDir}/${safeUrl}.json`;
    }

    async loadTargetUrls() {
        const parser = fs
            .createReadStream('hreflang-errors.csv')
            .pipe(parse({ columns: true, skip_empty_lines: true }));

        for await (const record of parser) {
            if (record['Page URL']) {
                this.targetUrls.add(record['Page URL']);
            }
        }
    }

    async loadRobotsTxt() {
        try {
            const robotsUrl = new URL('/robots.txt', this.baseUrl);
            console.log(`Loading robots.txt from ${robotsUrl.toString()}`);
            const response = await fetch(robotsUrl.toString());
            const robotsText = await response.text();
            this.robots = robotsParser(robotsUrl, robotsText);
            console.log('Successfully loaded robots.txt');
        } catch (error) {
            console.warn('Failed to load robots.txt:', error.message);
            this.robots = null;
        }
    }

    async loadState() {
        try {
            const stateFile = this.getStateFileName();
            console.log(`Loading state from ${stateFile}`);
            const state = JSON.parse(await fsPromises.readFile(stateFile, 'utf8'));
            this.visitedUrls = new Set(state.visitedUrls);
            this.results = state.results;
            this.queue = state.queue;
            console.log(
                `Loaded state: ${this.visitedUrls.size} visited URLs, ${this.queue.length} URLs in queue`
            );
        } catch (error) {
            console.log('No previous state found, starting fresh');
        }
    }

    async saveState() {
        const stateFile = this.getStateFileName();
        const state = {
            visitedUrls: [...this.visitedUrls],
            results: this.results,
            queue: this.queue
        };
        await fsPromises.writeFile(stateFile, JSON.stringify(state, null, 2));
    }

    isAllowedToCrawl(url) {
        if (!this.robots) return true;
        return this.robots.isAllowed(url, 'Crawler');
    }

    normalizeUrl(url) {
        try {
            const normalized = new URL(url, this.baseUrl);
            // Remove query parameters and hash
            normalized.search = '';
            normalized.hash = '';
            return normalized.toString();
        } catch {
            return null;
        }
    }

    isSameDomain(url) {
        try {
            const urlObj = new URL(url, this.baseUrl);
            return urlObj.hostname === this.baseUrl.hostname;
        } catch {
            return false;
        }
    }

    async saveResults() {
        console.log(`Saving results to ${this.outputFile}...`);
        await this.csvWriter.writeRecords(this.results);
        console.log(`Current results: ${this.results.length} matches`);
    }

    allTargetsFound() {
        return this.foundUrls.size === this.targetUrls.size;
    }

    async crawlPage(url, depth = 0) {
        if (depth > this.maxDepth) {
            console.log(`Skipping ${url} - max depth reached`);
            return;
        }

        if (this.allTargetsFound()) {
            console.log('All target URLs have been found! Stopping crawl.');
            return;
        }

        const normalizedUrl = this.normalizeUrl(url);
        if (!normalizedUrl) {
            console.log(`Skipping invalid URL: ${url}`);
            return;
        }
        if (this.visitedUrls.has(normalizedUrl)) {
            console.log(`Skipping already visited URL: ${normalizedUrl}`);
            return;
        }

        console.log(`\nCrawling ${normalizedUrl} (depth: ${depth})`);
        this.visitedUrls.add(normalizedUrl);

        try {
            const response = await fetch(normalizedUrl);
            if (!response.ok) {
                console.log(
                    `Failed to fetch ${normalizedUrl}: ${response.status} ${response.statusText}`
                );
                return;
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            let foundTargets = 0;
            // Check for target URLs
            $('a').each((_, element) => {
                const href = $(element).attr('href');
                if (!href) return;

                const absoluteUrl = this.normalizeUrl(href);
                if (this.targetUrls.has(absoluteUrl) && !this.foundUrls.has(absoluteUrl)) {
                    foundTargets++;
                    this.foundUrls.add(absoluteUrl);
                    this.results.push({
                        targetUrl: absoluteUrl,
                        foundOn: normalizedUrl
                    });
                }
            });

            if (foundTargets > 0) {
                console.log(`Found ${foundTargets} new target URL(s) on ${normalizedUrl}`);
                await this.saveResults();
                await this.saveState();

                if (this.allTargetsFound()) {
                    console.log('All target URLs have been found! Stopping crawl.');
                    return;
                }
            }

            let newUrls = 0;
            // Add new URLs to queue
            if (depth < this.maxDepth && !this.allTargetsFound()) {
                $('a').each((_, element) => {
                    const href = $(element).attr('href');
                    if (!href) return;

                    const absoluteUrl = this.normalizeUrl(href);
                    if (
                        absoluteUrl &&
                        this.isSameDomain(absoluteUrl) &&
                        !this.visitedUrls.has(absoluteUrl) &&
                        this.isAllowedToCrawl(absoluteUrl)
                    ) {
                        newUrls++;
                        this.queue.push({ url: absoluteUrl, depth: depth + 1 });
                    }
                });
            }

            console.log(`Found ${newUrls} new URLs to crawl on ${normalizedUrl}`);

            // Random delay between requests
            const delay = 200 + Math.random() * 800;
            console.log(`Waiting ${Math.round(delay)}ms before next request...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        } catch (error) {
            console.error(`Error crawling ${url}:`, error.message);
        }
    }

    async processQueue() {
        while (this.queue.length > 0 && !this.allTargetsFound()) {
            console.log(`\nQueue status: ${this.queue.length} URLs remaining`);
            const batch = this.queue.splice(0, this.maxConcurrent);
            console.log(`Processing batch of ${batch.length} URLs`);
            await Promise.all(batch.map(({ url, depth }) => this.crawlPage(url, depth)));
            await this.saveState();
        }
    }

    async start() {
        if (this.isCrawling) return;
        this.isCrawling = true;

        try {
            console.log(`Starting crawler for ${this.baseUrl.toString()}`);
            await this.initialize();

            if (this.queue.length === 0) {
                console.log('Starting from homepage');
                this.queue.push({ url: this.baseUrl.toString(), depth: 0 });
            }

            await this.processQueue();

            // Save final results
            console.log('\nSaving final results...');
            await this.saveResults();
            await this.saveState();

            if (this.allTargetsFound()) {
                console.log('Crawling completed successfully - all target URLs found!');
            } else {
                console.log(
                    `Crawling completed. Found ${this.results.length} out of ${this.targetUrls.size} target URLs.`
                );
            }
        } catch (error) {
            console.error('Crawler error:', error);
        } finally {
            this.isCrawling = false;
        }
    }
}

// Example usage
const crawler = new WebsiteCrawler({
    baseUrl: 'https://dailyride.nl', // Replace with your target website
    maxConcurrent: 5,
    maxDepth: 3,
    statesDir: './states',
    resultsDir: './results'
});

crawler.start().catch(console.error);
