"use strict";
/**
 * Central PDF Generation Service for Moeb26
 * Handles Chromium browser lifecycle, HTML-to-PDF rendering, and buffer exports.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PDFService = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const templates_1 = require("./templates");
class PDFService {
    static browserInstance = null;
    static isLaunching = false;
    /**
     * Acquire or reuse a Singleton Puppeteer Browser instance to prevent RAM exhaustion
     */
    static async getBrowser() {
        if (this.browserInstance && this.browserInstance.isConnected()) {
            return this.browserInstance;
        }
        if (!this.isLaunching) {
            this.isLaunching = true;
            try {
                this.browserInstance = await puppeteer_1.default.launch({
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--no-first-run',
                        '--no-zygote',
                        '--single-process',
                    ],
                });
            }
            finally {
                this.isLaunching = false;
            }
        }
        else {
            // Wait briefly if browser is currently being launched by another thread
            while (this.isLaunching) {
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
            if (this.browserInstance)
                return this.browserInstance;
        }
        return this.browserInstance;
    }
    /**
     * Graceful cleanup on server shutdown
     */
    static async closeBrowser() {
        if (this.browserInstance) {
            await this.browserInstance.close();
            this.browserInstance = null;
        }
    }
    /**
     * Convert raw HTML string into a PDF Buffer
     */
    static async generateFromHTML(html, options) {
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        try {
            await page.setContent(html, {
                waitUntil: 'networkidle0',
                timeout: 30000,
            });
            const pdfBuffer = await page.pdf({
                format: options?.format || 'A4',
                landscape: options?.orientation === 'landscape',
                printBackground: true,
                margin: {
                    top: options?.margin?.top || '15mm',
                    right: options?.margin?.right || '15mm',
                    bottom: options?.margin?.bottom || '15mm',
                    left: options?.margin?.left || '15mm',
                },
            });
            return Buffer.from(pdfBuffer);
        }
        finally {
            await page.close();
        }
    }
    // ================= DOMAIN GENERATORS =================
    /**
     * Generate Trip Invoice PDF Buffer
     */
    static async generateTripInvoice(data) {
        const html = (0, templates_1.renderTripInvoiceHTML)(data);
        return this.generateFromHTML(html);
    }
    /**
     * Generate Driver Subscription Receipt PDF Buffer
     */
    static async generateSubscriptionReceipt(data) {
        const html = (0, templates_1.renderSubscriptionReceiptHTML)(data);
        return this.generateFromHTML(html);
    }
    /**
     * Generate Driver Earnings Report PDF Buffer
     */
    static async generateEarningsReport(data) {
        const html = (0, templates_1.renderEarningsReportHTML)(data);
        return this.generateFromHTML(html);
    }
}
exports.PDFService = PDFService;
exports.default = PDFService;
//# sourceMappingURL=pdf.service.js.map