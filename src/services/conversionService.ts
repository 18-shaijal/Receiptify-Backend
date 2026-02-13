import fs from 'fs';
import path from 'path';
import libre from 'libreoffice-convert';
import { promisify } from 'util';
import { CONFIG } from '../config';

const convertAsync = promisify(libre.convertWithOptions);

export interface ConversionResult {
    success: boolean;
    outputPath?: string;
    error?: string;
}

/**
 * Converts DOCX file to a target format (PDF, ODT, etc.)
 */
export const convertDocx = async (
    docxPath: string,
    outputDir: string,
    targetExtension: string
): Promise<ConversionResult> => {
    try {
        // Read DOCX file
        const docxBuffer = fs.readFileSync(docxPath);

        // Convert to target format
        const outputBuffer = await convertAsync(docxBuffer, targetExtension.replace('.', ''), undefined, {
            sofficeBinaryPaths: [CONFIG.LIBREOFFICE_PATH]
        });

        // Generate output path
        const fileName = path.basename(docxPath, '.docx') + targetExtension;
        const outputPath = path.join(outputDir, fileName);

        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Write file
        fs.writeFileSync(outputPath, outputBuffer);

        return {
            success: true,
            outputPath
        };
    } catch (error: any) {
        console.error(`Error converting DOCX to ${targetExtension}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Batch converts multiple DOCX files to multiple target formats
 */
export const batchConvertDocx = async (
    docxFiles: string[],
    outputDir: string,
    targetExtensions: string[]
): Promise<Record<string, string[]>> => {
    const results: Record<string, string[]> = {};

    for (const ext of targetExtensions) {
        results[ext] = [];
        const subDir = path.join(outputDir, ext.replace('.', ''));

        for (const docxPath of docxFiles) {
            const result = await convertDocx(docxPath, subDir, ext);
            if (result.success && result.outputPath) {
                results[ext].push(result.outputPath);
            }
        }
    }

    return results;
};

/**
 * Checks if LibreOffice is available
 */
export const isLibreOfficeAvailable = async (): Promise<boolean> => {
    try {
        // Try a simple conversion to test if LibreOffice is accessible
        const testBuffer = Buffer.from('test');
        await convertAsync(testBuffer, 'odt', undefined, {
            sofficeBinaryPaths: [CONFIG.LIBREOFFICE_PATH]
        });
        return true;
    } catch (error) {
        console.error('LibreOffice is not available:', error);
        return false;
    }
};
