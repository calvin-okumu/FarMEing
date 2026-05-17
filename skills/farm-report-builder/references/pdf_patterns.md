# PDF Generation Patterns (pdfkit)

## Initialization

```javascript
const doc = new PDFDocument({ margin: 50 });
res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
res.setHeader('Content-type', 'application/pdf');
doc.pipe(res);
```

## Common Layout Elements

### Header
```javascript
doc.fontSize(24).text('Title', { align: 'center' });
doc.moveDown();
doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke(); // Line separator
```

### Sections
```javascript
doc.fontSize(16).text('Section Title', { underline: true });
doc.fontSize(12).text('Regular text');
```

### Conditional Coloring
```javascript
doc.text(`Net Profit: ${val}`, { 
  color: val >= 0 ? 'green' : 'red' 
});
```

## Best Practices
- Use `doc.moveDown()` for vertical spacing.
- Use `doc.page.width` and `doc.page.height` for relative positioning (e.g., footers).
- Always end with `doc.end()`.
