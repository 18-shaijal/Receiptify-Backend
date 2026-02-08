import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { CONFIG } from "../config";
import fs from "fs";

const s3Client = new S3Client({
    region: CONFIG.AWS.REGION,
    credentials: {
        accessKeyId: CONFIG.AWS.ACCESS_KEY_ID,
        secretAccessKey: CONFIG.AWS.SECRET_ACCESS_KEY,
    },
});

/**
 * Upload a file to S3
 */
export const uploadToS3 = async (filePath: string, key: string, contentType: string): Promise<string> => {
    const fileContent = fs.readFileSync(filePath);

    const command = new PutObjectCommand({
        Bucket: CONFIG.AWS.S3_BUCKET_NAME,
        Key: key,
        Body: fileContent,
        ContentType: contentType,
    });

    await s3Client.send(command);
    return key;
};

/**
 * Generate a pre-signed URL for a file in S3
 */
export const getPresignedDownloadUrl = async (key: string, expiresIn: number = 3600): Promise<string> => {
    const command = new GetObjectCommand({
        Bucket: CONFIG.AWS.S3_BUCKET_NAME,
        Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
};

/**
 * Delete a file from S3
 */
export const deleteFromS3 = async (key: string): Promise<void> => {
    const command = new DeleteObjectCommand({
        Bucket: CONFIG.AWS.S3_BUCKET_NAME,
        Key: key,
    });

    await s3Client.send(command);
};

/**
 * Download a file from S3 to a local path
 */
export const downloadFromS3 = async (key: string, localPath: string): Promise<void> => {
    const command = new GetObjectCommand({
        Bucket: CONFIG.AWS.S3_BUCKET_NAME,
        Key: key,
    });

    const { Body } = await s3Client.send(command);

    if (Body) {
        const stream = Body as any;
        const writeStream = fs.createWriteStream(localPath);

        return new Promise((resolve, reject) => {
            stream.pipe(writeStream)
                .on('finish', resolve)
                .on('error', reject);
        });
    }
};
