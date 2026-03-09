import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { sanitizeFilename } from '../utils/validators';
import { formatDocxtemplaterError, normalizeKey } from './templateService';

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
 * Formats a value for display (numbers with commas, dates, etc.)
 */
const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '';

    // Handle Numbers (thousand separators, 2 decimal places if needed)
    if (typeof value === 'number') {
        const isInteger = Number.isInteger(value);
        return value.toLocaleString('en-US', {
            minimumFractionDigits: isInteger ? 0 : 2,
            maximumFractionDigits: 2
        });
    }

    return String(value);
};

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

            // Provide data with normalized keys
            const dataToRender: Record<string, any> = {};
            Object.keys(rowData).forEach(key => {
                dataToRender[normalizeKey(key)] = formatValue(rowData[key]);
            });

            const zip = new PizZip(templateBuffer);
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                delimiters: { start: '{{', end: '}}' },
                nullGetter: () => '',
                parser: (tag: string) => {
                    const normalizedTag = normalizeKey(tag);
                    return {
                        get: (scope: any) => {
                            if (tag === '.') return scope;
                            return scope[normalizedTag] ?? scope[tag] ?? '';
                        }
                    };
                }
            });

            console.log(`📝 Row ${rowNumber}: Processing document with matching keys...`);

            // Render document with data
            doc.render(dataToRender);

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

    // Provide data with normalized keys
    const dataToRender: Record<string, any> = {};
    Object.keys(data).forEach(key => {
        dataToRender[normalizeKey(key)] = formatValue(data[key]);
    });

    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '{{', end: '}}' },
        nullGetter: () => '',
        parser: (tag: string) => {
            const normalizedTag = normalizeKey(tag);
            return {
                get: (scope: any) => {
                    if (tag === '.') return scope;
                    return scope[normalizedTag] ?? scope[tag] ?? '';
                }
            };
        }
    });

    try {
        doc.render(dataToRender);
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

        // Replace placeholders using normalized keys for maximum compatibility
        Object.keys(data).forEach(key => {
            const value = data[key] || '';
            const sanitizedValue = sanitizeFilename(String(value));

            // Original key
            const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            fileName = fileName.replace(new RegExp(`{{${escapedKey}}}`, 'gi'), sanitizedValue);
            fileName = fileName.replace(new RegExp(`{${escapedKey}}`, 'gi'), sanitizedValue);

            // Normalized key
            const normalizedK = normalizeKey(key);
            fileName = fileName.replace(new RegExp(`{{${normalizedK}}}`, 'gi'), sanitizedValue);
            fileName = fileName.replace(new RegExp(`{${normalizedK}}`, 'gi'), sanitizedValue);
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
