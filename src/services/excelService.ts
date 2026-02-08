import ExcelJS from 'exceljs';

export interface ExcelData {
    headers: string[];
    rows: Record<string, any>[];
}

/**
 * Parses Excel file and returns structured data
 */
export const parseExcelFile = async (filePath: string): Promise<ExcelData> => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

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
                    value = value.richText.map((rt: any) => rt.text).join('');
                }
                // Handle formulas - use result
                else if ('result' in value) {
                    value = value.result;
                } else {
                    value = value.toString();
                }
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
 * Formats date to readable string
 */
const formatDate = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

/**
 * Formats number with specified decimal places
 */
export const formatNumber = (num: number, decimals: number = 2): string => {
    return num.toFixed(decimals);
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
