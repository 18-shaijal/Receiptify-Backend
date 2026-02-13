import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { uploadFromStream } from './s3Service';
import { GeneratedFile } from './documentGenerationService';

export interface ZipOptions {
    filesByFormat: Record<string, string[]>;
    outputDir: string;
}

export interface ZipResult {
    success: boolean;
    zipPath?: string;
    s3Key?: string;
    sessionId?: string;
    error?: string;
}

/**
 * Creates ZIP archive with files organized by format folders
 */
export const createZipArchive = async (options: ZipOptions): Promise<ZipResult> => {
    const { filesByFormat, outputDir } = options;
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

            // Add files for each format
            Object.entries(filesByFormat).forEach(([formatExt, files]) => {
                const folderName = formatExt.replace('.', '');
                files.forEach(filePath => {
                    if (fs.existsSync(filePath)) {
                        const fileName = path.basename(filePath);
                        archive.file(filePath, { name: `${folderName}/${fileName}` });
                    }
                });
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

/**
 * Creates ZIP archive from memory buffers and streams directly to S3
 */
export const streamZipToS3 = async (
    filesByFormat: Record<string, GeneratedFile[]>,
    s3Key: string
): Promise<ZipResult> => {
    try {
        const { stream, promise } = uploadFromStream(s3Key, 'application/zip');
        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        return new Promise((resolve, reject) => {
            stream.on('error', (err) => {
                reject({ success: false, error: err.message });
            });

            archive.on('error', (err) => {
                reject({ success: false, error: err.message });
            });

            archive.pipe(stream);

            // Add buffers for each format
            Object.entries(filesByFormat).forEach(([formatExt, files]) => {
                const folderName = formatExt.replace('.', '');
                files.forEach(file => {
                    archive.append(file.content, { name: `${folderName}/${file.name}` });
                });
            });

            archive.finalize();

            promise.then(() => {
                resolve({
                    success: true,
                    s3Key
                });
            }).catch(err => {
                reject({ success: false, error: err.message });
            });
        });
    } catch (error: any) {
        console.error('Error streaming ZIP to S3:', error);
        return {
            success: false,
            error: error.message
        };
    }
};
