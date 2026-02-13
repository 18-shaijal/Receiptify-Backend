# Receipt Generator API Documentation

Base URL: `http://localhost:5000/api`

## Authentication

No authentication required for the current version.

---

## Upload Endpoints

### Upload Template File

Upload a Word (.docx) or OpenDocument (.odt) template file.

**Endpoint:** `POST /upload/template`

**Content-Type:** `multipart/form-data`

**Request:**
```
Form Data:
- template: File (.docx or .odt, max 10MB)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fileName": "template-1706380000000-123456789.docx",
    "originalName": "receipt_template.docx",
    "path": "/path/to/uploads/template-1706380000000-123456789.docx",
    "size": 15234,
    "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }
}
```

**Error Responses:**
- `400` - No file uploaded, invalid file type, or file too large
- `500` - Server error

---

### Upload Excel File

Upload an Excel (.xlsx) file containing data.

**Endpoint:** `POST /upload/excel`

**Content-Type:** `multipart/form-data`

**Request:**
```
Form Data:
- excel: File (.xlsx, max 10MB)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fileName": "excel-1706380000000-987654321.xlsx",
    "originalName": "customer_data.xlsx",
    "path": "/path/to/uploads/excel-1706380000000-987654321.xlsx",
    "size": 8456,
    "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }
}
```

---

## Document Operations

### Validate Template and Excel

Validate that template placeholders match Excel column headers.

**Endpoint:** `POST /validate`

**Content-Type:** `application/json`

**Request:**
```json
{
  "templatePath": "/path/to/template.docx",
  "excelPath": "/path/to/data.xlsx"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "placeholders": ["NAME", "EMAIL", "AMOUNT", "DATE"],
    "excelHeaders": ["NAME", "EMAIL", "AMOUNT", "DATE", "PHONE"],
    "rowCount": 100,
    "validation": {
      "valid": true,
      "missingInExcel": [],
      "extraInExcel": ["PHONE"],
      "warnings": [
        "Excel contains columns not used in template: PHONE"
      ]
    }
  }
}
```

**Validation Rules:**
- `valid: true` - All placeholders have matching columns
- `valid: false` - Some placeholders missing in Excel
- `missingInExcel` - Placeholders in template but not in Excel
- `extraInExcel` - Columns in Excel not used in template

---

### Generate Preview

Generate a preview document using the first row of Excel data.

**Endpoint:** `POST /preview`

**Content-Type:** `application/json`

**Request:**
```json
{
  "templatePath": "/path/to/template.docx",
  "excelPath": "/path/to/data.xlsx"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "previewPath": "/path/to/generated/session-id/preview.docx",
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "previewData": {
      "NAME": "John Doe",
      "EMAIL": "john@example.com",
      "AMOUNT": "100.00",
      "DATE": "27/01/2024"
    }
  }
}
```

---

### Generate All Documents

Generate documents for all rows in Excel file.

**Endpoint:** `POST /generate`

**Content-Type:** `application/json`

**Request:**
```json
{
  "templatePath": "/path/to/template.docx",
  "excelPath": "/path/to/data.xlsx"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "totalGenerated": 100,
    "docxFiles": [
      "/path/to/session/docx/receipt_1_John_Doe.docx",
      "/path/to/session/docx/receipt_2_Jane_Smith.docx"
    ],
    "odtFiles": [
      "/path/to/session/odt/receipt_1_John_Doe.odt",
      "/path/to/session/odt/receipt_2_Jane_Smith.odt"
    ],
    "zipPath": "/path/to/session/documents_session-id.zip",
    "errors": [],
    "conversionFailures": []
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Some documents failed to generate",
  "errors": [
    "Row 5: Missing required field 'NAME'",
    "Row 12: Invalid template syntax"
  ]
}
```

---

## Download Endpoints

### Download Individual File

Download a specific generated file.

**Endpoint:** `GET /download/:sessionId/:filename`

**Parameters:**
- `sessionId` - UUID from generation response
- `filename` - Name of file to download

**Example:**
```
GET /download/550e8400-e29b-41d4-a716-446655440000/preview.docx
GET /download/550e8400-e29b-41d4-a716-446655440000/receipt_1_John_Doe.docx
```

**Response:** File download (binary)

---

### Download ZIP Archive

Download complete ZIP archive with all generated documents.

**Endpoint:** `GET /download/zip/:sessionId`

**Parameters:**
- `sessionId` - UUID from generation response

**Example:**
```
GET /download/zip/550e8400-e29b-41d4-a716-446655440000
```

**Response:** ZIP file download (binary)

**ZIP Structure:**
```
documents_session-id.zip
├── docx/
│   ├── receipt_1_John_Doe.docx
│   ├── receipt_2_Jane_Smith.docx
│   └── ...
└── odt/
    ├── receipt_1_John_Doe.odt
    ├── receipt_2_Jane_Smith.odt
    └── ...
```

---

## Utility Endpoints

### Health Check

Check if API is running.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "success": true,
  "message": "Receipt Generator API is running",
  "timestamp": "2024-01-27T18:00:00.000Z"
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid input, missing fields, or validation error |
| 404 | Not Found - File or resource not found |
| 500 | Internal Server Error - Server-side processing error |

---

## Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

---

## File Naming Convention

Generated documents follow this pattern:
```
receipt_<rowNumber>_<NAME>.docx
receipt_<rowNumber>_<NAME>.odt
```

Where:
- `rowNumber` - Row index (1-based)
- `NAME` - Value from the NAME field (sanitized)

Example: `receipt_1_John_Doe.docx`

---

## Rate Limits

No rate limits currently enforced.

---

## File Cleanup

Files are automatically deleted after 24 hours. Download your files promptly after generation.

---

## Notes

1. **Session IDs**: Each generation creates a unique session ID. Save this ID to download files later.

2. **File Paths**: The `path` values in upload responses are server-side paths. Use these when calling `/validate`, `/preview`, or `/generate`.

3. **Placeholder Format**: Placeholders must follow `{{PLACEHOLDER_NAME}}` format with uppercase alphanumeric characters and underscores only.

4. **Excel Requirements**: 
   - First row must be headers
   - Headers should match template placeholders (case-insensitive)
   - Only first sheet is processed

5. **LibreOffice Dependency**: ODT conversion requires LibreOffice. If unavailable, ODT files will not be generated but DOCX files will still be created.
