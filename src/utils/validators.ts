import fs from 'fs';
import path from 'path';

/**
 * Validates file type based on MIME type and extension
 */
export const validateFileType = (
    file: Express.Multer.File,
    allowedMimeTypes: string[],
    allowedExtensions: string[]
): { valid: boolean; error?: string } => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedMimeTypes.includes(file.mimetype)) {
        return {
            valid: false,
            error: `Invalid file type. Allowed types: ${allowedExtensions.join(', ')}`
        };
    }

    if (!allowedExtensions.includes(ext)) {
        return {
            valid: false,
            error: `Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`
        };
    }

    return { valid: true };
};

/**
 * Validates file size
 */
export const validateFileSize = (
    file: Express.Multer.File,
    maxSize: number
): { valid: boolean; error?: string } => {
    if (file.size > maxSize) {
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
        return {
            valid: false,
            error: `File too large. Maximum size: ${maxSizeMB}MB`
        };
    }

    return { valid: true };
};

/**
 * Validates placeholder format ({{PLACEHOLDER}})
 */
export const isValidPlaceholder = (placeholder: string): boolean => {
    const regex = /^{{[A-Z0-9_]+}}$/;
    return regex.test(placeholder);
};

/**
 * Sanitizes filename to prevent directory traversal
 */
export const sanitizeFilename = (filename: string): string => {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
};

/**
 * Ensures directory exists, creates if not
 */
export const ensureDirectoryExists = (dirPath: string): void => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

/**
 * Deletes a file safely
 */
export const deleteFile = (filePath: string): void => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error(`Error deleting file ${filePath}:`, error);
    }
};

/**
 * Validates that required fields are present in request body
 */
export const validateRequiredFields = (
    body: any,
    requiredFields: string[]
): { valid: boolean; error?: string } => {
    const missing = requiredFields.filter(field => !body[field]);

    if (missing.length > 0) {
        return {
            valid: false,
            error: `Missing required fields: ${missing.join(', ')}`
        };
    }

    return { valid: true };
};
