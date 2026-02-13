import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const CONFIG = {
    UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'),
    PORT: process.env.PORT || 5001,
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
    CLEANUP_INTERVAL_HOURS: parseInt(process.env.CLEANUP_INTERVAL_HOURS || '24'),
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/receipt-generator',
    AWS: {
        ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
        SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
        REGION: process.env.AWS_REGION || 'us-east-1',
        S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME || ''
    },
    LIBREOFFICE_PATH: process.env.LIBREOFFICE_PATH || '/Applications/LibreOffice.app/Contents/MacOS/soffice'
};
