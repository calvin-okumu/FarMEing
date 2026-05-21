# Excel Generation Patterns (exceljs)

## Initialization

```javascript
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Sheet Name');
```

## Sheet Configuration

### Defining Columns
```javascript
sheet.columns = [
  { header: 'Column A', key: 'a', width: 20 },
  { header: 'Column B', key: 'b', width: 15 },
];
```

### Adding Rows
```javascript
sheet.addRow({ a: 'Value 1', b: 123 });
```

## Response Streaming

```javascript
res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
await workbook.xlsx.write(res);
res.end();
```

## Best Practices
- Use multiple worksheets for complex data (e.g., 'Summary', 'Details', 'Financials').
- Set `workbook.creator` and `workbook.created` metadata.
- Sanitize data (e.g., handle `null` or `undefined` values) before adding rows.
