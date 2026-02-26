import express from 'express';
import { CONFIG } from './config';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = 5001;

const { CLIENT_ID, CLIENT_SECRET } = CONFIG.EMAIL;

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('\n❌ ERROR: Missing EMAIL_CLIENT_ID or EMAIL_CLIENT_SECRET in .env file.');
    process.exit(1);
}

const REDIRECT_URI = `http://localhost:${PORT}/auth/callback`;

// Minimal scopes known to work for Outlook.com personal accounts
const SCOPES = [
    'offline_access',
    'https://outlook.office.com/SMTP.Send'
];

// For personal accounts, 'consumers' or 'common' works best
const TENANT = 'common';

const AUTH_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_mode=query&scope=${encodeURIComponent(SCOPES.join(' '))}&state=12345&prompt=consent`;

app.get('/', (_req, res) => {
    res.send(`
    <div style="font-family: sans-serif; padding: 2rem;">
        <h1>SMTP OAuth2 Setup (Personal Account)</h1>
        <p>This script uses the <b>minimal</b> scopes required for personal Outlook accounts.</p>
        <p>1. Ensure your Azure App Registration supports <b>"Personal Microsoft accounts"</b>.</p>
        <p>2. Click the button below, sign in, and <b>Accept</b> the permission.</p>
        <a href="${AUTH_URL}" style="display: inline-block; padding: 10px 20px; background: #0078d4; color: white; text-decoration: none; border-radius: 4px;">Sign in with Microsoft</a>
    </div>`);
});

app.get('/auth/callback', async (req, res): Promise<any> => {
    const code = req.query.code as string;
    if (!code) return res.send('No authorization code returned');

    try {
        const tokenUrl = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
        const params = new URLSearchParams();
        params.append('client_id', CLIENT_ID);
        params.append('client_secret', CLIENT_SECRET);
        params.append('code', code);
        params.append('redirect_uri', REDIRECT_URI);
        params.append('grant_type', 'authorization_code');
        params.append('scope', SCOPES.join(' '));

        const response = await fetch(tokenUrl, {
            method: 'POST',
            body: params,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const data: any = await response.json();

        if (data.refresh_token) {
            console.log('\n======================================');
            console.log('✅ SUCCESS! Add this to your .env file:');
            console.log('======================================\n');
            console.log(`EMAIL_REFRESH_TOKEN=${data.refresh_token}\n\n`);
            res.send(`<div style="font-family: sans-serif; padding: 2rem; color: #0b7a0b;"><h1>Success! 🎉</h1><p>Check your terminal for the MINIMAL Refresh Token.</p></div>`);
            setTimeout(() => process.exit(0), 1000);
        } else {
            console.error('Error getting token:', data);
            res.send(`<h1>Error</h1><pre>${JSON.stringify(data, null, 2)}</pre>`);
        }
    } catch (error) {
        console.error('Error during token fetch:', error);
        res.send('Internal server error');
    }
});

app.listen(PORT, () => {
    console.log(`\n🚀 Credentials Generator (Minimal) starting...`);
    console.log(`Open http://localhost:${PORT} in your browser`);
});
