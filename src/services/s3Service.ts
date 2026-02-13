import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { PassThrough } from "stream";
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
 * Download a file from S3 as a Buffer
 */
export const downloadAsBuffer = async (key: string): Promise<Buffer> => {
    const command = new GetObjectCommand({
        Bucket: CONFIG.AWS.S3_BUCKET_NAME,
        Key: key,
    });

    const { Body } = await s3Client.send(command);
    if (!Body) throw new Error('Empty body from S3');

    const stream = Body as any;
    const chunks: any[] = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk: any) => chunks.push(chunk));
        stream.on('error', (err: any) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
};

/**
 * Get a PassThrough stream to upload to S3
 */
export const uploadFromStream = (key: string, contentType: string) => {
    const passThrough = new PassThrough();
    const upload = new Upload({
        client: s3Client,
        params: {
            Bucket: CONFIG.AWS.S3_BUCKET_NAME,
            Key: key,
            Body: passThrough,
            ContentType: contentType
        },
    });

    return {
        stream: passThrough,
        promise: upload.done()
    };
};
