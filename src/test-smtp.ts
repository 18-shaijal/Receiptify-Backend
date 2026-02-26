import nodemailer from 'nodemailer';
import { CONFIG } from './config';
import dotenv from 'dotenv';
dotenv.config();

async function testSmtp() {
    console.log('Testing SMTP connection with Automatic OAuth2 Refresh...');
    console.log('User:', CONFIG.EMAIL.SMTP_USER);

    // This config matches exactly what we have in src/services/emailService.ts
    const transporter = nodemailer.createTransport({
        host: CONFIG.EMAIL.SMTP_HOST,
        port: Number(CONFIG.EMAIL.SMTP_PORT),
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

    try {
        console.log('\nVerifying connection (Nodemailer will auto-refresh)...');
        const success = await transporter.verify();
        if (success) {
            console.log('✅ SMTP connection successful!');
            console.log('\nSending test email...');

            const info = await transporter.sendMail({
                from: CONFIG.EMAIL.SMTP_USER,
                to: 'shaijalgupta7@gmail.com',
                subject: 'SMTP OAuth2 Final Automated Test',
                text: 'Your SMTP is officially working with automatic token refreshing!',
            });
            console.log('✅ Test email sent successfully!');
            console.log('Message ID:', info.messageId);
        }
    } catch (error: any) {
        console.error('\n❌ SMTP verification failed.');
        console.error('Error details:');
        console.error(error);
    }
}

testSmtp();
