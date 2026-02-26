import nodemailer from 'nodemailer';
import { CONFIG } from '../config';

export interface EmailOptions {
    to: string;
    subject: string;
    body: string;
    attachmentName: string;
    attachmentBuffer: Buffer;
}

export interface BulkEmailOptions {
    rows: Record<string, any>[];
    emailColumn: string;
    subjectTemplate: string;
    bodyTemplate: string;
    generatedFiles: { name: string; content: Buffer }[];
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
        const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        // Replace {{KEY}} (case-insensitive)
        const regex = new RegExp(`{{${escapedKey}}}`, 'gi');
        result = result.replace(regex, String(value));
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
        attachments: [
            {
                filename: options.attachmentName,
                content: options.attachmentBuffer,
            },
        ],
    });

    return info;
};

/**
 * Send bulk emails — one per Excel row with the matching generated document attached.
 * Subject and body templates support {{PLACEHOLDER}} syntax.
 */
export const sendBulkEmails = async (options: BulkEmailOptions): Promise<BulkEmailResult> => {
    const { rows, emailColumn, subjectTemplate, bodyTemplate, generatedFiles } = options;

    const results: EmailResult[] = [];
    let totalSent = 0;
    let totalFailed = 0;

    console.log(`🚀 Starting bulk email send for ${rows.length} rows using column: ${emailColumn}`);

    // Create transporter once for the entire batch
    const transporter = createTransporter();

    for (let i = 0; i < rows.length; i++) {
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

        // Match the generated file for this row (by index)
        const file = generatedFiles[i];
        if (!file) {
            console.error(`❌ Row ${i + 1}: No generated file found for index ${i}`);
            results.push({
                row: i + 1,
                email: recipientEmail,
                status: 'failed',
                error: 'No generated document found for this row',
            });
            totalFailed++;
            continue;
        }

        // Replace placeholders in subject and body
        const subject = replacePlaceholders(subjectTemplate, row);
        const body = replacePlaceholders(bodyTemplate, row);

        try {
            console.log(`✉️ [${i + 1}/${rows.length}] Sending to: ${recipientEmail}...`);

            const info = await sendEmailWithAttachment({
                to: recipientEmail,
                subject,
                body,
                attachmentName: file.name,
                attachmentBuffer: file.content,
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

        // Increased delay between emails to avoid Microsoft's OutboundSpamException
        // Using a 5-10 second random delay to appear more "human-like"
        if (i < rows.length - 1) {
            const delay = Math.floor(Math.random() * 5000) + 5000;
            console.log(`⏱️ Waiting ${delay / 1000}s before next email...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    console.log(`🏁 Bulk send complete. Sent: ${totalSent}, Failed: ${totalFailed}`);
    return { totalSent, totalFailed, results };
};
