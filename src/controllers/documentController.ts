import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { parseExcelFile, validateExcelData } from '../services/excelService';
import { extractPlaceholders, validateTemplate } from '../services/templateService';
import { generateDocuments, generatePreviewDocument } from '../services/documentGenerationService';
import { batchConvertDocxToOdt } from '../services/conversionService';
import { createZipArchive } from '../services/zipService';
import { CONFIG } from '../config';
import { downloadFromS3, uploadToS3, getPresignedDownloadUrl } from '../services/s3Service';
import DocumentSession from '../models/documentModel';

// No local constant needed, use CONFIG.GENERATED_DIR instead

/**
 * Validate template and Excel match
 */
export const validateFiles = async (req: Request, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            res.status(400).json({
                success: false,
                error: 'sessionId is required'
            });
            return;
        }

        // Find session in MongoDB
        const templateSession = await DocumentSession.findOne({ sessionId, fileType: 'template' });
        const excelSession = await DocumentSession.findOne({ sessionId, fileType: 'excel' });

        if (!templateSession || !excelSession) {
            res.status(404).json({
                success: false,
                error: 'Session or files not found'
            });
            return;
        }

        // Download files locally for validation
        const sessionDir = path.join(CONFIG.GENERATED_DIR, sessionId, 'temp');
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

        const templatePath = path.join(sessionDir, templateSession.originalFileName);
        const excelPath = path.join(sessionDir, excelSession.originalFileName);

        await downloadFromS3(templateSession.s3Key!, templatePath);
        await downloadFromS3(excelSession.s3Key!, excelPath);

        // Extract placeholders from template
        const templateInfo = extractPlaceholders(templatePath);

        // Parse Excel file
        const excelData = await parseExcelFile(excelPath);

        // Validate Excel data
        const excelValidation = validateExcelData(excelData);
        if (!excelValidation.valid) {
            res.status(400).json({
                success: false,
                error: excelValidation.error
            });
            return;
        }

        // Validate template against Excel
        const validation = validateTemplate(templateInfo.placeholders, excelData.headers);

        res.json({
            success: true,
            data: {
                placeholders: templateInfo.placeholders,
                excelHeaders: excelData.headers,
                rowCount: excelData.rows.length,
                validation: {
                    valid: validation.valid,
                    missingInExcel: validation.missingInExcel,
                    extraInExcel: validation.extraInExcel,
                    warnings: validation.warnings
                }
            }
        });
    } catch (error: any) {
        console.error('Error validating files:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to validate files'
        });
    }
};

/**
 * Generate preview document (first row only)
 */
export const generatePreview = async (req: Request, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            res.status(400).json({
                success: false,
                error: 'sessionId is required'
            });
            return;
        }

        // Find session in MongoDB
        const templateSession = await DocumentSession.findOne({ sessionId, fileType: 'template' });
        const excelSession = await DocumentSession.findOne({ sessionId, fileType: 'excel' });

        if (!templateSession || !excelSession) {
            res.status(404).json({
                success: false,
                error: 'Session or files not found'
            });
            return;
        }

        // Download files locally for preview generation
        const sessionDir = path.join(CONFIG.GENERATED_DIR, sessionId, 'preview');
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

        const templatePath = path.join(sessionDir, templateSession.originalFileName);
        const excelPath = path.join(sessionDir, excelSession.originalFileName);

        await downloadFromS3(templateSession.s3Key!, templatePath);
        await downloadFromS3(excelSession.s3Key!, excelPath);

        // Parse Excel file
        const excelData = await parseExcelFile(excelPath);

        if (excelData.rows.length === 0) {
            res.status(400).json({
                success: false,
                error: 'Excel file has no data rows'
            });
            return;
        }

        // Use first row for preview
        const previewData = excelData.rows[0];

        // Generate preview document locally
        const previewPath = path.join(sessionDir, 'preview.docx');
        await generatePreviewDocument(templatePath, previewData, previewPath);

        // In-memory preview is handled by the frontend, but we could upload this to S3 too 
        // if we wanted a persistent preview link. For now, we'll keep the existing logic 
        // that likely reads this file or returns the data.
        // Actually, the previous implementation sent the path. 
        // Let's stick to returning data so we can cleanup.

        res.json({
            success: true,
            data: {
                previewPath,
                sessionId,
                previewData
            }
        });

        // Cleanup temp files after some time or immediate if not needed
        // but wait... generatePreviewDocument might be needed by the next step?
        // No, preview is just for visual.
    } catch (error: any) {
        console.error('Error generating preview:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate preview'
        });
    }
};

/**
 * Generate all documents
 */
export const generateDocumentsBulk = async (req: Request, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            res.status(400).json({
                success: false,
                error: 'sessionId is required'
            });
            return;
        }

        // Find session in MongoDB
        const templateSession = await DocumentSession.findOne({ sessionId, fileType: 'template' });
        const excelSession = await DocumentSession.findOne({ sessionId, fileType: 'excel' });

        if (!templateSession || !excelSession) {
            res.status(404).json({
                success: false,
                error: 'Session or files not found'
            });
            return;
        }

        // Download files locally for bulk generation
        const sessionDir = path.join(CONFIG.GENERATED_DIR, sessionId);
        const tempDir = path.join(sessionDir, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const templatePath = path.join(tempDir, templateSession.originalFileName);
        const excelPath = path.join(tempDir, excelSession.originalFileName);

        await downloadFromS3(templateSession.s3Key!, templatePath);
        await downloadFromS3(excelSession.s3Key!, excelPath);

        // Parse Excel file
        const excelData = await parseExcelFile(excelPath);

        const docxDir = path.join(sessionDir, 'docx');
        const odtDir = path.join(sessionDir, 'odt');

        // Generate DOCX documents
        const generationResult = await generateDocuments({
            templatePath,
            outputDir: docxDir,
            data: excelData.rows
        });

        if (!generationResult.success) {
            res.status(500).json({
                success: false,
                error: 'Some documents failed to generate',
                errors: generationResult.errors
            });
            return;
        }

        // Convert to ODT
        const conversionResult = await batchConvertDocxToOdt(
            generationResult.filesGenerated,
            odtDir
        );

        // Create ZIP archive
        const zipResult = await createZipArchive({
            docxFiles: generationResult.filesGenerated,
            odtFiles: conversionResult.successful,
            outputDir: sessionDir
        });

        if (!zipResult.success) {
            res.status(500).json({
                success: false,
                error: 'Failed to create ZIP archive'
            });
            return;
        }

        // Upload ZIP to S3
        const zipFileName = `documents_${sessionId}.zip`;
        const zipS3Key = `generated/${sessionId}/${zipFileName}`;
        await uploadToS3(zipResult.zipPath!, zipS3Key, 'application/zip');

        // Generate Pre-signed URL
        const downloadUrl = await getPresignedDownloadUrl(zipS3Key);

        // Immediate cleanup of local generation artifacts
        try {
            if (zipResult.zipPath && fs.existsSync(zipResult.zipPath)) {
                fs.unlinkSync(zipResult.zipPath);
            }
            if (tempDir && fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        } catch (cleanupErr) {
            console.error('Failed to cleanup local generation artifacts:', cleanupErr);
        }

        // Update session in MongoDB
        await DocumentSession.updateMany({ sessionId }, { status: 'processed' });

        res.json({
            success: true,
            data: {
                sessionId,
                totalGenerated: generationResult.filesGenerated.length,
                downloadUrl,
                zipFileName
            }
        });

        // Background Cleanup: Delete local session directory
        fs.rm(sessionDir, { recursive: true, force: true }, (err) => {
            if (err) console.error(`Error cleaning up sessionDir ${sessionId}:`, err);
        });
    } catch (error: any) {
        console.error('Error generating documents:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate documents'
        });
    }
};

/**
 * Download ZIP archive (Returns pre-signed URL)
 */
export const downloadZip = async (req: Request, res: Response): Promise<void> => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            res.status(400).json({
                success: false,
                error: 'Session ID is required'
            });
            return;
        }

        const zipS3Key = `generated/${sessionId}/documents_${sessionId}.zip`;
        const downloadUrl = await getPresignedDownloadUrl(zipS3Key);

        res.json({
            success: true,
            data: {
                downloadUrl
            }
        });
    } catch (error: any) {
        console.error('Error downloading ZIP:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate download link'
        });
    }
};
