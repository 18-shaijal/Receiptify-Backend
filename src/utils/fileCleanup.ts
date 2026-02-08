import fs from 'fs';
import path from 'path';

/**
 * Deletes files older than specified hours
 */
export const cleanupOldFiles = (directoryPath: string, maxAgeHours: number): void => {
    if (!fs.existsSync(directoryPath)) {
        return;
    }

    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds

    try {
        const files = fs.readdirSync(directoryPath);

        files.forEach(file => {
            const filePath = path.join(directoryPath, file);
            const stats = fs.statSync(filePath);

            if (stats.isFile()) {
                const fileAge = now - stats.mtimeMs;

                if (fileAge > maxAge) {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted old file: ${filePath}`);
                }
            } else if (stats.isDirectory()) {
                // Recursively clean subdirectories
                cleanupOldFiles(filePath, maxAgeHours);

                // Remove empty directories
                const remainingFiles = fs.readdirSync(filePath);
                if (remainingFiles.length === 0) {
                    fs.rmdirSync(filePath);
                    console.log(`Deleted empty directory: ${filePath}`);
                }
            }
        });
    } catch (error) {
        console.error(`Error cleaning up directory ${directoryPath}:`, error);
    }
};

/**
 * Schedules cleanup job to run at specified interval
 */
export const scheduleCleanup = (
    directories: string[],
    intervalHours: number,
    maxAgeHours: number
): NodeJS.Timeout => {
    const intervalMs = intervalHours * 60 * 60 * 1000;

    return setInterval(() => {
        console.log('Running scheduled file cleanup...');
        directories.forEach(dir => {
            cleanupOldFiles(dir, maxAgeHours);
        });
    }, intervalMs);
};
