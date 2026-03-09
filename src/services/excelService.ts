import ExcelJS from 'exceljs';

export interface ExcelData {
    headers: string[];
    rows: Record<string, any>[];
}

/**
 * Parses Excel file and returns structured data
 */
/**
 * Parses Excel file and returns structured data
 */
export const parseExcelFile = async (input: string | Buffer): Promise<ExcelData> => {
    const workbook = new ExcelJS.Workbook();

    if (Buffer.isBuffer(input)) {
        await workbook.xlsx.load(input as any);
    } else {
        await workbook.xlsx.readFile(input);
    }

    // Get first worksheet
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
        throw new Error('Excel file contains no worksheets');
    }

    const headers: string[] = [];
    const rows: Record<string, any>[] = [];

    // Extract headers from first row
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
        const headerValue = cell.value?.toString().trim() || `Column${colNumber}`;
        headers.push(headerValue);
    });

    if (headers.length === 0) {
        throw new Error('Excel file has no headers');
    }

    // Extract data rows
    worksheet.eachRow((row, rowNumber) => {
        // Skip header row
        if (rowNumber === 1) return;

        const rowData: Record<string, any> = {};
        let hasData = false;

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const header = headers[colNumber - 1];
            if (!header) return;

            let value: any = cell.value;

            // Handle different cell types
            if (value === null || value === undefined) {
                value = '';
            } else if (typeof value === 'object') {
                // Handle dates
                if (value instanceof Date) {
                    value = formatDate(value);
                }
                // Handle rich text
                else if ('richText' in value) {
                    value = (value as any).richText.map((rt: any) => rt.text).join('');
                }
                // Handle formulas - use result
                else if ('result' in value) {
                    value = (value as any).result;
                    if (typeof value === 'number') value = formatExcelNumber(value);
                } else {
                    value = value.toString();
                }
            } else if (typeof value === 'number') {
                value = formatExcelNumber(value);
            }

            rowData[header] = value;
            if (value !== '') hasData = true;
        });

        // Only add rows that have at least one non-empty cell
        if (hasData) {
            rows.push(rowData);
        }
    });

    return { headers, rows };
};

/**
 * Formats date to readable string (DD/MM/YYYY)
 */
const formatDate = (date: Date): string => {
    if (!date || isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

/**
 * Formats a number with commas and consistent decimals
 */
const formatExcelNumber = (value: number): string | number => {
    // If it's a large number or has decimals, we might want to return it as a string 
    // to preserve formatting, but Docxtemplater handles numbers too.
    // However, the user specifically asked for "correct" data like amounts.
    if (value > 999 || !Number.isInteger(value)) {
        return value.toLocaleString('en-US', {
            minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
            maximumFractionDigits: 5 // Allow some precision but keep it clean
        });
    }
    return value;
};

/**
 * Validates Excel data structure
 */
export const validateExcelData = (data: ExcelData): { valid: boolean; error?: string } => {
    if (data.headers.length === 0) {
        return { valid: false, error: 'Excel file has no columns' };
    }

    if (data.rows.length === 0) {
        return { valid: false, error: 'Excel file has no data rows' };
    }

    // Check for duplicate headers
    const uniqueHeaders = new Set(data.headers);
    if (uniqueHeaders.size !== data.headers.length) {
        return { valid: false, error: 'Excel file has duplicate column names' };
    }

    return { valid: true };
};
