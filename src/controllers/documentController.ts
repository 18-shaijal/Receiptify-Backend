import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { extractPlaceholders, validateTemplate } from '../services/templateService';
import { generateDocuments, generatePreviewDocument, GeneratedFile } from '../services/documentGenerationService';
import { batchConvertDocx } from '../services/conversionService';
import { streamZipToS3 } from '../services/zipService';
import { uploadToS3, getPresignedDownloadUrl, downloadAsBuffer } from '../services/s3Service';
import DocumentSession from '../models/documentModel';

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

        // Validate template against Excel headers stored in DB
        // We don't need to download/parse Excel anymore
        const excelHeaders = excelSession.headers || [];
        const rowCount = excelSession.rows?.length || 0;

        // Download template locally for validation (placeholder extraction still needs file or buffer)
        // We can use buffer to avoid saving to disk
        const templateBuffer = await downloadAsBuffer(templateSession.s3Key!);

        // Extract placeholders from template buffer
        // (Need to update templateService to support buffer or write temp file)
        // For now, let's write temp file for templateService compatibility if it doesn't support buffer yet
        // standard templateService.extractPlaceholders takes a file path.
        const sessionDir = path.join(os.tmpdir(), 'receipt-gen', sessionId, 'temp');
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
        const templatePath = path.join(sessionDir, templateSession.originalFileName);
        fs.writeFileSync(templatePath, templateBuffer);

        const templateInfo = extractPlaceholders(templatePath);

        // Clean up template file
        fs.unlinkSync(templatePath);
        fs.rmdirSync(sessionDir);

        // Validate template against Excel
        const validation = validateTemplate(templateInfo.placeholders, excelHeaders);

        res.json({
            success: true,
            data: {
                placeholders: templateInfo.placeholders,
                excelHeaders: excelHeaders,
                rowCount: rowCount,
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
            error: error.message || 'Failed to validate files',
            details: error.stack
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

        // Download template in-memory
        const templateBuffer = await downloadAsBuffer(templateSession.s3Key!);

        // Get data from DB
        const rows = excelSession.rows || [];

        if (rows.length === 0) {
            res.status(400).json({
                success: false,
                error: 'Excel file has no data rows'
            });
            return;
        }

        // Use first row for preview
        const previewData = rows[0];

        // Generate preview document in-memory
        const previewBuffer = await generatePreviewDocument(templateBuffer, previewData);

        // For preview, we could send the buffer as base64 or upload to a temporary S3 key
        // Let's upload to a temp S3 key so the frontend can download it if needed
        const previewS3Key = `previews/${sessionId}/preview.docx`;
        const tempPath = path.join(os.tmpdir(), `preview_${sessionId}.docx`);
        fs.writeFileSync(tempPath, previewBuffer);
        await uploadToS3(tempPath, previewS3Key, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        fs.unlinkSync(tempPath);

        const downloadUrl = await getPresignedDownloadUrl(previewS3Key);

        res.json({
            success: true,
            data: {
                previewUrl: downloadUrl,
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

        // Download template in-memory
        const templateBuffer = await downloadAsBuffer(templateSession.s3Key!);

        // Get data from DB
        // In a real production scenario with huge data, we would stream this cursor 
        // or use pagination. For now, fetching the array is fine as mongo documents < 16MB.
        const excelRows = excelSession.rows || [];

        const selectedFormats = req.body.formats || ['.docx'];
        const fileNamePattern = req.body.fileNamePattern;

        // Generate documents in-memory
        const generationResult = await generateDocuments({
            templateBuffer,
            data: excelRows,
            fileNameTemplate: fileNamePattern
        });

        if (!generationResult.success) {
            res.status(500).json({
                success: false,
                error: 'Some documents failed to generate',
                errors: generationResult.errors
            });
            return;
        }

        // Prepare files for ZIP
        const filesByFormat: Record<string, GeneratedFile[]> = {};
        filesByFormat['.docx'] = generationResult.filesGenerated;

        // Handle conversion if needed
        const formatsToConvert = selectedFormats.filter((fmt: string) => fmt !== '.docx');
        if (formatsToConvert.length > 0) {
            // For conversion, we still need physical files for LibreOffice (until addresssed)
            // Use OS temp dir
            const conversionDir = path.join(os.tmpdir(), `conversion_${sessionId}`);
            if (!fs.existsSync(conversionDir)) fs.mkdirSync(conversionDir, { recursive: true });

            const docxPaths: string[] = [];
            for (const file of generationResult.filesGenerated) {
                const filePath = path.join(conversionDir, file.name);
                fs.writeFileSync(filePath, file.content);
                docxPaths.push(filePath);
            }

            const conversionResults = await batchConvertDocx(
                docxPaths,
                conversionDir,
                formatsToConvert
            );

            // Read converted files back into buffers
            for (const [ext, paths] of Object.entries(conversionResults)) {
                filesByFormat[ext] = paths.map(p => ({
                    name: path.basename(p),
                    content: fs.readFileSync(p)
                }));
            }

            // Cleanup conversion dir
            fs.rmSync(conversionDir, { recursive: true, force: true });
        }

        // Create ZIP archive and stream directly to S3
        const zipFileName = `documents_${sessionId}.zip`;
        const zipS3Key = `generated/${sessionId}/${zipFileName}`;

        const zipResult = await streamZipToS3(filesByFormat, zipS3Key);

        if (!zipResult.success) {
            res.status(500).json({
                success: false,
                error: 'Failed to create or upload ZIP archive'
            });
            return;
        }

        // Generate Pre-signed URL
        const downloadUrl = await getPresignedDownloadUrl(zipS3Key);

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
