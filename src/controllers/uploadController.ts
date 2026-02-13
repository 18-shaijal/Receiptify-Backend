import { Request, Response } from 'express';
import { validateFileType, validateFileSize } from '../utils/validators';
import { uploadToS3 } from '../services/s3Service';
import { parseExcelFile, validateExcelData } from '../services/excelService';
import DocumentSession from '../models/documentModel';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

interface MulterRequest extends Request {
    file?: Express.Multer.File;
}

const TEMPLATE_MIME_TYPES = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.oasis.opendocument.text' // .odt
];

const TEMPLATE_EXTENSIONS = ['.docx', '.odt'];

const EXCEL_MIME_TYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
];

const EXCEL_EXTENSIONS = ['.xlsx'];

import { CONFIG } from '../config';

/**
 * Upload template file (DOCX or ODT)
 */
export const uploadTemplate = async (req: Request, res: Response): Promise<void> => {
    const multerReq = req as MulterRequest;
    try {
        if (!multerReq.file) {
            res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
            return;
        }

        // Validate file type
        const typeValidation = validateFileType(
            multerReq.file!,
            TEMPLATE_MIME_TYPES,
            TEMPLATE_EXTENSIONS
        );

        if (!typeValidation.valid) {
            res.status(400).json({
                success: false,
                error: typeValidation.error
            });
            return;
        }

        // Validate file size
        const sizeValidation = validateFileSize(multerReq.file, CONFIG.MAX_FILE_SIZE);

        if (!sizeValidation.valid) {
            res.status(400).json({
                success: false,
                error: sizeValidation.error
            });
            return;
        }

        // Generate sessionId and S3 key
        const sessionId = (multerReq.body && multerReq.body.sessionId) || uuidv4();
        const s3Key = `templates/${sessionId}-${multerReq.file.originalname}`;

        // Upload to S3
        await uploadToS3(multerReq.file.path, s3Key, multerReq.file.mimetype);

        // Delete local file immediately after S3 upload
        try {
            fs.unlinkSync(multerReq.file.path);
        } catch (unlinkErr) {
            console.error(`Failed to delete local template file: ${multerReq.file.path}`, unlinkErr);
        }

        // Save to MongoDB
        const session = new DocumentSession({
            sessionId,
            originalFileName: multerReq.file.originalname,
            s3Key,
            fileType: 'template',
            status: 'uploaded'
        });
        await session.save();

        res.json({
            success: true,
            data: {
                sessionId,
                fileName: multerReq.file.originalname,
                originalName: multerReq.file.originalname,
                s3Key,
                size: multerReq.file.size
            }
        });
    } catch (error: any) {
        console.error('Error uploading template:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload template'
        });
    }
};

/**
 * Upload Excel file
 */
export const uploadExcel = async (req: Request, res: Response): Promise<void> => {
    const multerReq = req as MulterRequest;
    try {
        if (!multerReq.file) {
            res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
            return;
        }

        // Validate file type
        const typeValidation = validateFileType(
            multerReq.file,
            EXCEL_MIME_TYPES,
            EXCEL_EXTENSIONS
        );

        if (!typeValidation.valid) {
            res.status(400).json({
                success: false,
                error: typeValidation.error
            });
            return;
        }

        // Validate file size
        const sizeValidation = validateFileSize(multerReq.file, CONFIG.MAX_FILE_SIZE);

        if (!sizeValidation.valid) {
            res.status(400).json({
                success: false,
                error: sizeValidation.error
            });
            return;
        }

        // Use the same sessionId if provided (from template upload) 
        // to link them together, or generate a new one if it's a fresh flow.
        const sessionId = (multerReq.body && multerReq.body.sessionId) || uuidv4();
        // Parse Excel file immediately
        const fileBuffer = fs.readFileSync(multerReq.file.path);
        const excelData = await parseExcelFile(fileBuffer);

        // Validate parsed data
        const dataValidation = validateExcelData(excelData);
        if (!dataValidation.valid) {
            fs.unlinkSync(multerReq.file.path); // Cleanup
            res.status(400).json({
                success: false,
                error: dataValidation.error
            });
            return;
        }

        // Delete local file immediately after parsing
        try {
            fs.unlinkSync(multerReq.file.path);
        } catch (unlinkErr) {
            console.error(`Failed to delete local data file: ${multerReq.file.path}`, unlinkErr);
        }

        // Save to MongoDB with parsed data
        const session = new DocumentSession({
            sessionId,
            originalFileName: multerReq.file.originalname,
            fileType: 'excel',
            status: 'uploaded',
            rows: excelData.rows,
            headers: excelData.headers
        });
        await session.save();

        res.json({
            success: true,
            data: {
                sessionId,
                fileName: multerReq.file.originalname,
                originalName: multerReq.file.originalname,
                size: multerReq.file.size,
                rowCount: excelData.rows.length,
                headers: excelData.headers
            }
        });
    } catch (error: any) {
        console.error('Error uploading Excel:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload Excel file'
        });
    }
};
