# Template Guide

This guide explains how to create templates for the Receipt Generator.

## Placeholder Syntax

Placeholders use double curly braces with uppercase names:

```
{{PLACEHOLDER_NAME}}
```

### Rules:
- Must start and end with `{{` and `}}`
- Name must be UPPERCASE
- Can contain letters, numbers, and underscores
- No spaces or special characters

### Valid Examples:
```
{{NAME}}
{{EMAIL}}
{{PHONE_NUMBER}}
{{AMOUNT_USD}}
{{DATE_2024}}
```

### Invalid Examples:
```
{NAME}           ❌ Single braces
{{name}}         ❌ Lowercase
{{Full Name}}    ❌ Spaces
{{AMOUNT-USD}}   ❌ Hyphen
```

## Creating a Template

### Step 1: Create Word Document

1. Open Microsoft Word or LibreOffice Writer
2. Design your document layout
3. Add placeholders where dynamic content should appear

### Step 2: Add Placeholders

Example receipt template:

```
                    RECEIPT
                 Company Name
              123 Business Street
            City, State, ZIP Code

─────────────────────────────────────────

Receipt #: {{RECEIPT_NUMBER}}
Date: {{DATE}}

Bill To:
{{NAME}}
{{EMAIL}}
{{PHONE}}

─────────────────────────────────────────

PAYMENT DETAILS

Amount Paid:        {{AMOUNT}}
Payment Method:     {{PAYMENT_METHOD}}
Transaction ID:     {{TRANSACTION_ID}}

─────────────────────────────────────────

Thank you for your business!

Questions? Contact us at support@company.com
```

### Step 3: Apply Formatting

- Use **bold**, *italic*, colors, etc. - all formatting is preserved
- Add logos, images, tables
- Use headers and footers
- Apply any Word styles

### Step 4: Save Template

- Save as `.docx` (recommended) or `.odt`
- Keep file size under 10MB

## Advanced Features

### Conditional Content

Placeholders are replaced with:
- Actual value if present in Excel
- Empty string if missing

To handle optional fields, write naturally:

```
Phone: {{PHONE}}

// If PHONE is empty, result will be:
Phone:
```

### Number Formatting

Format numbers in Excel, not the template:
- Currency: Format in Excel as "$100.00"
- Dates: Format in Excel as "01/27/2024"
- Percentages: Format in Excel as "15%"

### Multiple Placeholders

Use the same placeholder multiple times:

```
Dear {{NAME}},

Thank you {{NAME}} for your payment...

Best regards,
The {{NAME}} Account Team
```

All instances will be replaced with the same value.

### Tables

You can use placeholders in tables:

```
| Item          | Amount      |
|---------------|-------------|
| {{ITEM_1}}    | {{AMOUNT_1}}|
| {{ITEM_2}}    | {{AMOUNT_2}}|
```

## Best Practices

1. **Be Consistent**: Use same placeholder names across all templates
2. **Test First**: Generate a preview before bulk processing
3. **Keep it Simple**: Avoid overly complex templates
4. **Document Placeholders**: Keep a list of required placeholders
5. **Version Control**: Name templates clearly (receipt_v1.docx)

## Common Use Cases

### Invoice Template
```
INVOICE #{{INVOICE_NUMBER}}

Bill To: {{CUSTOMER_NAME}}
Company: {{COMPANY_NAME}}
Address: {{ADDRESS}}

Items:
{{ITEM_DESCRIPTION}}
Quantity: {{QUANTITY}}
Unit Price: {{UNIT_PRICE}}
Total: {{TOTAL_AMOUNT}}

Due Date: {{DUE_DATE}}
```

### Certificate Template
```
CERTIFICATE OF COMPLETION

This certifies that

{{STUDENT_NAME}}

has successfully completed

{{COURSE_NAME}}

on {{COMPLETION_DATE}}

Grade: {{GRADE}}
Instructor: {{INSTRUCTOR_NAME}}
```

### Letter Template
```
{{DATE}}

Dear {{RECIPIENT_NAME}},

{{LETTER_BODY}}

{{CUSTOM_MESSAGE}}

Sincerely,
{{SENDER_NAME}}
{{SENDER_TITLE}}
```

## Troubleshooting

### Placeholders not replaced
- Check placeholder format (must be `{{NAME}}`)
- Verify column exists in Excel
- Check for extra spaces: `{{ NAME }}` won't work

### Formatting lost
- Use .docx format (better format preservation)
- Avoid complex Word features
- Test with simple formatting first

### Special characters
- Avoid curly braces `{}` in regular text
- To display literal `{{TEXT}}`, don't use placeholders
