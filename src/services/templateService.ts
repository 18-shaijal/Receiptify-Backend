import fs from 'fs';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

export interface TemplateInfo {
    placeholders: string[];
}

export interface ValidationResult {
    valid: boolean;
    missingInExcel: string[];
    extraInExcel: string[];
    warnings: string[];
    matchedCount: number;
}

/**
 * Normalizes a key for fuzzy matching (removes spaces, underscores, dashes and uppercases)
 */
export const normalizeKey = (key: string): string => {
    return key.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

/**
 * Extracts placeholders from DOCX template
 */
export const extractPlaceholders = (templatePath: string): TemplateInfo => {
    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);

    let doc: Docxtemplater;
    try {
        doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: { start: '{{', end: '}}' },
        });
    } catch (error: any) {
        throw formatDocxtemplaterError(error);
    }

    // Get all tags (placeholders) from the template
    const tags = doc.getFullText().match(/{{([^}]+)}}/g) || [];

    // Extract unique placeholder names
    const placeholders = Array.from(
        new Set(tags.map(tag => tag.replace(/{|}/g, '')))
    );

    return { placeholders };
};

/**
 * Validates template against Excel headers with fuzzy matching
 */
export const validateTemplate = (
    templatePlaceholders: string[],
    excelHeaders: string[]
): ValidationResult => {
    const missingInExcel: string[] = [];
    const extraInExcel: string[] = [];
    const warnings: string[] = [];

    // Create normalized maps for fuzzy matching
    const normalizedExcelHeaders = new Map<string, string>();
    excelHeaders.forEach(header => {
        normalizedExcelHeaders.set(normalizeKey(header), header);
    });

    const normalizedTemplatePlaceholders = new Map<string, string>();
    templatePlaceholders.forEach(placeholder => {
        normalizedTemplatePlaceholders.set(normalizeKey(placeholder), placeholder);
    });

    // Check for placeholders in template not in Excel
    templatePlaceholders.forEach(placeholder => {
        const normalizedP = normalizeKey(placeholder);
        if (!normalizedExcelHeaders.has(normalizedP)) {
            missingInExcel.push(placeholder);
        } else {
            // Check if it's a perfect match or a fuzzy match
            const originalH = normalizedExcelHeaders.get(normalizedP);
            if (originalH !== placeholder) {
                // Fuzzy match found (e.g. "student name" matches "STUDENT_NAME")
                // We don't add a warning here because the generation logic will handle it,
                // but we could if we wanted to be strict.
            }
        }
    });

    // Check for Excel columns not used in template
    excelHeaders.forEach(header => {
        const normalizedH = normalizeKey(header);
        if (!normalizedTemplatePlaceholders.has(normalizedH)) {
            extraInExcel.push(header);
        }
    });

    // Generate warnings
    if (missingInExcel.length > 0) {
        warnings.push(
            `Template contains placeholders not found in Excel: ${missingInExcel.join(', ')}`
        );
    }

    const valid = missingInExcel.length === 0;

    return {
        valid,
        missingInExcel,
        extraInExcel,
        warnings,
        matchedCount: templatePlaceholders.length - missingInExcel.length
    };
};

/**
 * Validates placeholder format (relaxed to allow spaces and symbols common in casual docs)
 */
export const isValidPlaceholderFormat = (placeholder: string): boolean => {
    return /^[\w\s\-\.]+$/i.test(placeholder);
};

/**
 * Formats docxtemplater multi-errors into a readable string
 */
export const formatDocxtemplaterError = (error: any): Error => {
    if (error.properties && error.properties.errors instanceof Array) {
        const errorMessages = error.properties.errors
            .map((err: any) => {
                let msg = err.message;
                if (err.properties && err.properties.explanation) {
                    msg += ` (${err.properties.explanation})`;
                }
                if (err.properties && err.properties.id) {
                    msg = `[${err.properties.id}] ${msg}`;
                }
                return msg;
            })
            .join('\n');
        return new Error(`Template Error:\n${errorMessages}`);
    }
    return error instanceof Error ? error : new Error(String(error));
};
