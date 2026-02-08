import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { sanitizeFilename } from '../utils/validators';
import { formatDocxtemplaterError } from './templateService';

export interface GenerationOptions {
    templatePath: string;
    outputDir: string;
    data: Record<string, any>[];
    fileNameTemplate?: string;
}

export interface GenerationResult {
    success: boolean;
    filesGenerated: string[];
    errors: string[];
}

/**
 * Generates documents from template and data
 */
export const generateDocuments = async (
    options: GenerationOptions
): Promise<GenerationResult> => {
    const { templatePath, outputDir, data, fileNameTemplate } = options;
    const filesGenerated: string[] = [];
    const errors: string[] = [];

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Read template once
    const templateContent = fs.readFileSync(templatePath, 'binary');

    // Process each row
    for (let i = 0; i < data.length; i++) {
        try {
            const rowData = data[i];
            const rowNumber = i + 1;

            // Create a new document instance for each row
            const zip = new PizZip(templateContent);
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
            const outputPath = path.join(outputDir, fileName);

            // Write file
            fs.writeFileSync(outputPath, output);
            filesGenerated.push(outputPath);

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
 * Generates a single preview document
 */
export const generatePreviewDocument = async (
    templatePath: string,
    data: Record<string, any>,
    outputPath: string
): Promise<void> => {
    const templateContent = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(templateContent);

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

    const output = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
    });

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, output);
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
        // Replace placeholders in filename template
        let fileName = template;
        Object.keys(data).forEach(key => {
            const value = data[key] || '';
            fileName = fileName.replace(`{${key}}`, sanitizeFilename(String(value)));
        });
        return fileName;
    }

    // Default naming: receipt_<rowNumber>_<NAME>.docx
    const nameField = data.NAME || data.name || data.Name || `row${rowNumber}`;
    const sanitizedName = sanitizeFilename(String(nameField));
    return `receipt_${rowNumber}_${sanitizedName}.docx`;
};
