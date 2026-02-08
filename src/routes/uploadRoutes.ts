import express from 'express';
import multer from 'multer';
import path from 'path';
import { uploadTemplate, uploadExcel } from '../controllers/uploadController';
import { ensureDirectoryExists } from '../utils/validators';
import { CONFIG } from '../config';

const router = express.Router();

// Ensure upload directory exists
ensureDirectoryExists(CONFIG.UPLOAD_DIR);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, CONFIG.UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({ storage });

// Routes
router.post('/template', upload.single('template'), uploadTemplate);
router.post('/excel', upload.single('excel'), uploadExcel);

export default router;
