import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';

export interface ZipOptions {
    docxFiles: string[];
    odtFiles: string[];
    outputDir: string;
}

export interface ZipResult {
    success: boolean;
    zipPath?: string;
    sessionId?: string;
    error?: string;
}

/**
 * Creates ZIP archive with DOCX and ODT files
 */
export const createZipArchive = async (options: ZipOptions): Promise<ZipResult> => {
    const { docxFiles, odtFiles, outputDir } = options;
    const sessionId = uuidv4();

    try {
        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const zipPath = path.join(outputDir, `documents_${sessionId}.zip`);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });

        return new Promise((resolve, reject) => {
            // Handle stream events
            output.on('close', () => {
                console.log(`ZIP created: ${archive.pointer()} bytes`);
                resolve({
                    success: true,
                    zipPath,
                    sessionId
                });
            });

            archive.on('error', (err) => {
                reject({
                    success: false,
                    error: err.message
                });
            });

            // Pipe archive to output file
            archive.pipe(output);

            // Add DOCX files
            docxFiles.forEach(filePath => {
                if (fs.existsSync(filePath)) {
                    const fileName = path.basename(filePath);
                    archive.file(filePath, { name: `docx/${fileName}` });
                }
            });

            // Add ODT files
            odtFiles.forEach(filePath => {
                if (fs.existsSync(filePath)) {
                    const fileName = path.basename(filePath);
                    archive.file(filePath, { name: `odt/${fileName}` });
                }
            });

            // Finalize archive
            archive.finalize();
        });
    } catch (error: any) {
        console.error('Error creating ZIP archive:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Creates a simple ZIP with just one folder
 */
export const createSimpleZip = async (
    files: string[],
    outputPath: string,
    folderName: string = 'documents'
): Promise<boolean> => {
    try {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        return new Promise((resolve, reject) => {
            output.on('close', () => resolve(true));
            archive.on('error', (err) => reject(err));

            archive.pipe(output);

            files.forEach(filePath => {
                if (fs.existsSync(filePath)) {
                    const fileName = path.basename(filePath);
                    archive.file(filePath, { name: `${folderName}/${fileName}` });
                }
            });

            archive.finalize();
        });
    } catch (error) {
        console.error('Error creating simple ZIP:', error);
        return false;
    }
};
