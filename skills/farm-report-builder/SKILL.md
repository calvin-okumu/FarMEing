---
name: farm-report-builder
description: Provides specialized patterns and helpers for generating PDF and Excel reports using 'pdfkit' and 'exceljs'. Use when creating new reporting endpoints, adding sections to existing reports, or formatting financial summaries.
---

# Farm Report Builder

This skill streamlines the creation of detailed financial and production reports.

## Workflow

1.  **Data Retrieval**: Use `getProjectData` or similar helpers to fetch scoped data with Prisma.
2.  **Report Initialization**: Set up `PDFDocument` (pdfkit) or `Workbook` (exceljs).
3.  **Section Building**: Add modular sections (Header, Summary, Table, etc.).
4.  **Response Handling**: Set proper `Content-Type` and `Content-Disposition` headers and stream the result.

## Reference Guides

- **PDF Generation**: See [pdf_patterns.md](references/pdf_patterns.md) for pdfkit layout and styling.
- **Excel Generation**: See [excel_patterns.md](references/excel_patterns.md) for exceljs sheet management and column formatting.
- **Data Aggregation**: See [aggregation.md](references/aggregation.md) for common financial and production metrics calculations.

## Standards

- **Units**: Always include units (kg, acres, currency) in reports.
- **Scoping**: Always verify project access before generating reports.
- **Filenames**: Use the pattern `Report_{ProjectName}_{Date}.ext`.
- **Soft Delete**: Ensure only non-deleted records are included in reports.
