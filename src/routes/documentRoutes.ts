import express from 'express';
import {
    validateFiles,
    generatePreview,
    generateDocumentsBulk,
    downloadZip,
    sendEmails
} from '../controllers/documentController';

const router = express.Router();

// Validation and generation routes
router.post('/validate', validateFiles);
router.post('/preview', generatePreview);
router.post('/generate', generateDocumentsBulk);
router.post('/send-emails', sendEmails);

// Download routes
router.get('/download/zip/:sessionId', downloadZip);

export default router;
