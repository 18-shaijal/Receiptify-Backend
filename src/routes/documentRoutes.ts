import express from 'express';
import {
    validateFiles,
    generatePreview,
    generateDocumentsBulk,
    downloadZip,
    sendEmails,
    cancelEmails
} from '../controllers/documentController';

const router = express.Router();

// Validation and generation routes
router.post('/validate', validateFiles);
router.post('/preview', generatePreview);
router.post('/generate', generateDocumentsBulk);
router.post('/send-emails', sendEmails);
router.post('/cancel-emails', cancelEmails);

// Download routes
router.get('/download/zip/:sessionId', downloadZip);

export default router;
