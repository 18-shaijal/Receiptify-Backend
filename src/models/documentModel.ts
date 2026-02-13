import mongoose, { Schema, Document } from 'mongoose';

export interface IDocumentSession extends Document {
    sessionId: string;
    originalFileName: string;
    s3Key?: string;
    fileType: 'template' | 'excel';
    status: 'uploaded' | 'processing' | 'processed' | 'failed';
    createdAt: Date;
    rows?: Record<string, any>[]; // Store parsed Excel rows
    headers?: string[]; // Store Excel headers
}

const DocumentSessionSchema: Schema = new Schema({
    sessionId: { type: String, required: true },
    originalFileName: { type: String, required: true },
    s3Key: { type: String }, // Optional now for Excel if we store rows
    fileType: { type: String, enum: ['template', 'excel'], required: true },
    status: { type: String, enum: ['uploaded', 'processing', 'processed', 'failed'], default: 'uploaded' },
    createdAt: { type: Date, default: Date.now, expires: 86400 }, // Auto-delete after 24 hours
    rows: { type: [Schema.Types.Mixed] }, // Store parsed Excel rows
    headers: { type: [String] } // Store Excel headers
});

export default mongoose.model<IDocumentSession>('DocumentSession', DocumentSessionSchema);
