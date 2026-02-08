import fs from 'fs';
import path from 'path';
import libre from 'libreoffice-convert';
import { promisify } from 'util';

const convertAsync = promisify(libre.convert);

export interface ConversionResult {
    success: boolean;
    outputPath?: string;
    error?: string;
}

/**
 * Converts DOCX file to ODT format
 */
export const convertDocxToOdt = async (
    docxPath: string,
    outputDir: string
): Promise<ConversionResult> => {
    try {
        // Read DOCX file
        const docxBuffer = fs.readFileSync(docxPath);

        // Convert to ODT
        const odtBuffer = await convertAsync(docxBuffer, '.odt', undefined);

        // Generate output path
        const fileName = path.basename(docxPath, '.docx') + '.odt';
        const outputPath = path.join(outputDir, fileName);

        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Write ODT file
        fs.writeFileSync(outputPath, odtBuffer);

        return {
            success: true,
            outputPath
        };
    } catch (error: any) {
        console.error('Error converting DOCX to ODT:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Batch converts multiple DOCX files to ODT
 */
export const batchConvertDocxToOdt = async (
    docxFiles: string[],
    outputDir: string
): Promise<{ successful: string[]; failed: string[] }> => {
    const successful: string[] = [];
    const failed: string[] = [];

    for (const docxPath of docxFiles) {
        const result = await convertDocxToOdt(docxPath, outputDir);

        if (result.success && result.outputPath) {
            successful.push(result.outputPath);
        } else {
            failed.push(docxPath);
        }
    }

    return { successful, failed };
};

/**
 * Checks if LibreOffice is available
 */
export const isLibreOfficeAvailable = async (): Promise<boolean> => {
    try {
        // Try a simple conversion to test if LibreOffice is accessible
        const testBuffer = Buffer.from('test');
        await convertAsync(testBuffer, '.odt', undefined);
        return true;
    } catch (error) {
        console.error('LibreOffice is not available:', error);
        return false;
    }
};
