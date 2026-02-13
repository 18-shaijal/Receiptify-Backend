import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { sanitizeFilename } from '../utils/validators';
import { formatDocxtemplaterError } from './templateService';

export interface GenerationOptions {
    templateBuffer: Buffer;
    data: Record<string, any>[];
    fileNameTemplate?: string;
}

export interface GeneratedFile {
    name: string;
    content: Buffer;
}

export interface GenerationResult {
    success: boolean;
    filesGenerated: GeneratedFile[];
    errors: string[];
}

/**
 * Generates documents from template buffer and data
 */
export const generateDocuments = async (
    options: GenerationOptions
): Promise<GenerationResult> => {
    const { templateBuffer, data, fileNameTemplate } = options;
    const filesGenerated: GeneratedFile[] = [];
    const errors: string[] = [];

    // Process each row
    for (let i = 0; i < data.length; i++) {
        try {
            const rowData = data[i];
            const rowNumber = i + 1;

            // Create a new document instance for each row
            const zip = new PizZip(templateBuffer);
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                delimiters: { start: '{{', end: '}}' },
                nullGetter: () => '', // Replace null/undefined with empty string
            });

            // Convert row data keys to uppercase for case-insensitive matching
            const normalizedData: Record<string, any> = {};
            Object.keys(rowData).forEach(key => {
                normalizedData[key.toUpperCase()] = rowData[key];
            });

            // Render document with data
            doc.render(normalizedData);

            // Generate output
            const output = doc.getZip().generate({
                type: 'nodebuffer',
                compression: 'DEFLATE',
            });

            // Generate filename
            const fileName = generateFileName(rowNumber, rowData, fileNameTemplate);

            filesGenerated.push({
                name: fileName,
                content: output
            });

        } catch (error: any) {
            const formattedError = formatDocxtemplaterError(error);
            errors.push(`Row ${i + 1}: ${formattedError.message}`);
            console.error(`Error generating document for row ${i + 1}:`, error);
        }
    }

    return {
        success: errors.length === 0,
        filesGenerated,
        errors
    };
};

/**
 * Generates a single preview document buffer
 */
export const generatePreviewDocument = async (
    templateBuffer: Buffer,
    data: Record<string, any>
): Promise<Buffer> => {
    const zip = new PizZip(templateBuffer);

    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '{{', end: '}}' },
        nullGetter: () => '',
    });

    // Convert data keys to uppercase
    const normalizedData: Record<string, any> = {};
    Object.keys(data).forEach(key => {
        normalizedData[key.toUpperCase()] = data[key];
    });

    try {
        doc.render(normalizedData);
    } catch (error: any) {
        throw formatDocxtemplaterError(error);
    }

    return doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
    });
};

/**
 * Generates filename based on template and data
 */
const generateFileName = (
    rowNumber: number,
    data: Record<string, any>,
    template?: string
): string => {
    if (template) {
        let fileName = template;

        // Normalize data keys to uppercase for matching
        const normalizedData: Record<string, any> = {};
        Object.keys(data).forEach(key => {
            normalizedData[key.toUpperCase()] = data[key];
        });

        // Replace both {{KEY}} and {KEY} formats, globally and case-insensitively
        // We iterate over all keys in data to replace them in the template
        Object.keys(normalizedData).forEach(key => {
            const value = normalizedData[key] || '';
            const sanitizedValue = sanitizeFilename(String(value));

            // Escape key for regex
            const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

            // Replace {{KEY}}
            const regexDouble = new RegExp(`{{${escapedKey}}}`, 'gi');
            fileName = fileName.replace(regexDouble, sanitizedValue);

            // Replace {KEY}
            const regexSingle = new RegExp(`{${escapedKey}}`, 'gi');
            fileName = fileName.replace(regexSingle, sanitizedValue);
        });

        // Ensure we don't have empty filename
        if (!fileName.trim()) {
            fileName = `document_${rowNumber}`;
        }

        // Add default extension if missing (will be handled by caller for specific formats)
        if (!path.extname(fileName)) {
            fileName += '.docx';
        }

        return fileName;
    }

    // Default naming: receipt_<rowNumber>_<NAME>.docx
    const nameField = data.NAME || data.name || data.Name || `row${rowNumber}`;
    const sanitizedName = sanitizeFilename(String(nameField));
    return `receipt_${rowNumber}_${sanitizedName}.docx`;
};
