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
}

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
 * Validates template against Excel headers
 */
export const validateTemplate = (
    templatePlaceholders: string[],
    excelHeaders: string[]
): ValidationResult => {
    const missingInExcel: string[] = [];
    const extraInExcel: string[] = [];
    const warnings: string[] = [];

    // Convert to uppercase for case-insensitive comparison
    const templateSet = new Set(templatePlaceholders.map(p => p.toUpperCase()));
    const excelSet = new Set(excelHeaders.map(h => h.toUpperCase()));

    // Check for placeholders in template not in Excel
    templateSet.forEach(placeholder => {
        if (!excelSet.has(placeholder)) {
            missingInExcel.push(placeholder);
        }
    });

    // Check for Excel columns not used in template
    excelSet.forEach(header => {
        if (!templateSet.has(header)) {
            extraInExcel.push(header);
        }
    });

    // Generate warnings
    if (missingInExcel.length > 0) {
        warnings.push(
            `Template contains placeholders not found in Excel: ${missingInExcel.join(', ')}`
        );
    }

    if (extraInExcel.length > 0) {
        warnings.push(
            `Excel contains columns not used in template: ${extraInExcel.join(', ')}`
        );
    }

    const valid = missingInExcel.length === 0;

    return {
        valid,
        missingInExcel,
        extraInExcel,
        warnings
    };
};

/**
 * Validates placeholder format
 */
export const isValidPlaceholderFormat = (placeholder: string): boolean => {
    // Should be alphanumeric and underscores only
    return /^[A-Z0-9_]+$/.test(placeholder);
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
