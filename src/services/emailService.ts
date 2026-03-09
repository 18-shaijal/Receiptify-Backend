import nodemailer from 'nodemailer';
import { CONFIG } from '../config';
import { normalizeKey } from './templateService';
import DocumentSession from '../models/documentModel';

export interface EmailOptions {
    to: string;
    subject: string;
    body: string;
    attachments: { name: string; content: Buffer }[];
}

export interface BulkEmailOptions {
    rows: Record<string, any>[];
    emailColumn: string;
    subjectTemplate: string;
    bodyTemplate: string;
    generatedFiles: { name: string; content: Buffer }[][]; // Array of file arrays per row
    sessionId?: string;
}

export interface EmailResult {
    row: number;
    email: string;
    status: 'sent' | 'failed';
    error?: string;
}

export interface BulkEmailResult {
    totalSent: number;
    totalFailed: number;
    results: EmailResult[];
}

/**
 * Replace {{PLACEHOLDER}} tokens in a string with row data values
 */
const replacePlaceholders = (template: string, data: Record<string, any>): string => {
    let result = template;
    Object.keys(data).forEach(key => {
        const value = data[key] ?? '';

        // Original key regex
        const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regexOriginal = new RegExp(`{{${escapedKey}}}`, 'gi');
        result = result.replace(regexOriginal, String(value));

        // Normalized key regex (e.g. {{STUDENTNAME}})
        const normalizedK = normalizeKey(key);
        const regexNormalized = new RegExp(`{{${normalizedK}}}`, 'gi');
        result = result.replace(regexNormalized, String(value));
    });
    return result;
};

/**
 * Create a Nodemailer transporter for Outlook SMTP
 */
const createTransporter = () => {
    const useOAuth2 = !!CONFIG.EMAIL.CLIENT_ID && !!CONFIG.EMAIL.REFRESH_TOKEN;

    if (useOAuth2) {
        console.log('📧 Using OAuth2 for email sending');
        return nodemailer.createTransport({
            host: CONFIG.EMAIL.SMTP_HOST,
            port: CONFIG.EMAIL.SMTP_PORT,
            secure: false, // STARTTLS
            auth: {
                type: 'OAuth2',
                user: CONFIG.EMAIL.SMTP_USER,
                clientId: CONFIG.EMAIL.CLIENT_ID,
                clientSecret: CONFIG.EMAIL.CLIENT_SECRET,
                refreshToken: CONFIG.EMAIL.REFRESH_TOKEN,
                accessUrl: `https://login.microsoftonline.com/${CONFIG.EMAIL.TENANT_ID || 'common'}/oauth2/v2.0/token`,
                scope: 'https://outlook.office.com/SMTP.Send offline_access'
            } as any,
        });
    }

    console.log('📧 Using Basic Auth (App Password) for email sending');
    return nodemailer.createTransport({
        host: CONFIG.EMAIL.SMTP_HOST,
        port: CONFIG.EMAIL.SMTP_PORT,
        secure: false, // STARTTLS
        auth: {
            user: CONFIG.EMAIL.SMTP_USER,
            pass: CONFIG.EMAIL.SMTP_PASS,
        },
    });
};

/**
 * Send a single email with an attachment
 * Note: For bulk sending, use the shared transporter instead of re-creating it.
 */
export const sendEmailWithAttachment = async (options: EmailOptions, existingTransporter?: nodemailer.Transporter): Promise<any> => {
    const transporter = existingTransporter || createTransporter();

    // Properly format the From address
    const fromAddress = `"Receipt Generator" <${CONFIG.EMAIL.SMTP_USER}>`;

    const info = await transporter.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.body,
        attachments: options.attachments.map(att => ({
            filename: att.name,
            content: att.content,
        })),
    });

    return info;
};

/**
 * Send bulk emails — one per Excel row with the matching generated document attached.
 * Subject and body templates support {{PLACEHOLDER}} syntax.
 */
export const sendBulkEmails = async (options: BulkEmailOptions): Promise<BulkEmailResult> => {
    const { rows, emailColumn, subjectTemplate, bodyTemplate, generatedFiles, sessionId } = options;

    const results: EmailResult[] = [];
    let totalSent = 0;
    let totalFailed = 0;

    console.log(`🚀 Starting bulk email send for ${rows.length} rows using column: ${emailColumn}`);

    // Create transporter once for the entire batch
    const transporter = createTransporter();

    for (let i = 0; i < rows.length; i++) {
        // Check for cancellation if sessionId is provided
        if (sessionId) {
            const session = await DocumentSession.findOne({ sessionId, fileType: 'excel' });
            if (session?.isCancelled) {
                console.log(`🛑 Bulk email send CANCELLED by user at row ${i + 1}`);
                break;
            }
        }

        const row = rows[i];
        const email = row[emailColumn] || row[emailColumn.toUpperCase()] || row[emailColumn.toLowerCase()];

        if (!email || typeof email !== 'string' || !email.includes('@')) {
            console.warn(`⚠️ Row ${i + 1}: Skipping invalid email: ${email}`);
            results.push({
                row: i + 1,
                email: email || '(missing)',
                status: 'failed',
                error: 'Invalid or missing email address',
            });
            totalFailed++;
            continue;
        }

        const recipientEmail = email.trim();

        // Match the generated files for this row (by index)
        const rowFiles = generatedFiles[i];
        if (!rowFiles || rowFiles.length === 0) {
            console.error(`❌ Row ${i + 1}: No generated files found for index ${i}`);
            results.push({
                row: i + 1,
                email: recipientEmail,
                status: 'failed',
                error: 'No generated documents found for this row',
            });
            totalFailed++;
            continue;
        }

        // Replace placeholders in subject and body
        const subject = replacePlaceholders(subjectTemplate, row);
        const body = replacePlaceholders(bodyTemplate, row);

        try {
            console.log(`✉️ [${i + 1}/${rows.length}] Sending to: ${recipientEmail} with ${rowFiles.length} attachments...`);

            const info = await sendEmailWithAttachment({
                to: recipientEmail,
                subject,
                body,
                attachments: rowFiles.map(f => ({ name: f.name, content: f.content })),
            }, transporter);

            console.log(`✅ [${i + 1}/${rows.length}] Sent! MessageID: ${info.messageId}`);
            results.push({ row: i + 1, email: recipientEmail, status: 'sent' });
            totalSent++;
        } catch (error: any) {
            console.error(`❌ [${i + 1}/${rows.length}] Failed for ${recipientEmail}:`, error.message);
            results.push({
                row: i + 1,
                email: recipientEmail,
                status: 'failed',
                error: error.message || 'Unknown error',
            });
            totalFailed++;
        }

        // Delay between emails with early exit for cancellation
        if (i < rows.length - 1) {
            const delay = Math.floor(Math.random() * 5000) + 5000;
            console.log(`⏱️ Waiting ${delay / 1000}s before next email...`);

            // Wait in small chunks to check for cancellation faster
            const startTime = Date.now();
            let cancelledInWait = false;
            while (Date.now() - startTime < delay) {
                await new Promise(resolve => setTimeout(resolve, 500));
                if (sessionId) {
                    const session = await DocumentSession.findOne({ sessionId, fileType: 'excel' });
                    if (session?.isCancelled) {
                        cancelledInWait = true;
                        break;
                    }
                }
            }
            if (cancelledInWait) break;
        }
    }

    console.log(`🏁 Bulk send complete. Sent: ${totalSent}, Failed: ${totalFailed}`);
    return { totalSent, totalFailed, results };
};
