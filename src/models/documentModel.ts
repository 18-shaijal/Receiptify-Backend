import mongoose, { Schema, Document } from 'mongoose';

export interface IDocumentSession extends Document {
    sessionId: string;
    originalFileName: string;
    s3Key: string;
    fileType: 'template' | 'excel';
    status: 'uploaded' | 'processed' | 'error';
    metadata: {
        rowCount?: number;
        placeholders?: string[];
        error?: string;
    };
    createdAt: Date;
    updatedAt: Date;
}

const DocumentSessionSchema: Schema = new Schema({
    sessionId: { type: String, required: true, index: true },
    originalFileName: { type: String, required: true },
    s3Key: { type: String, required: true },
    fileType: { type: String, enum: ['template', 'excel'], required: true },
    status: { type: String, enum: ['uploaded', 'processed', 'error'], default: 'uploaded' },
    metadata: {
        rowCount: { type: Number },
        placeholders: [{ type: String }],
        error: { type: String }
    }
}, { timestamps: true });

export default mongoose.model<IDocumentSession>('DocumentSession', DocumentSessionSchema);
