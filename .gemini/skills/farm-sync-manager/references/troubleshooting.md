# Sync Troubleshooting

Common issues and their resolutions.

## 1. Foreign Key Violations
**Symptom**: `push` fails with an error about a missing parent record.
**Fix**: Check `SYNC_ORDER` in `sync.controller.js`. Parents (like `farm_projects`) must be pushed before children (like `expenses`).

## 2. Field Name Mismatch
**Symptom**: Fields are `null` on server or client after sync.
**Fix**: Ensure the field is correctly mapped in `fieldMapping` AND `reverseMapping` (which is generated automatically). Also check the `fromWatermelon` date field list.

## 3. 401 Unauthorized
**Symptom**: Sync fails immediately.
**Fix**: Check if the JWT token is expired. The `api.js` interceptor should handle refreshes, but a hard logout might be needed.

## 4. Conflict Resolution
**Rule**: "Server Delete Wins".
If a record is soft-deleted on the server, subsequent updates from the client are ignored in `push`.
To restore a record, a specific "undelete" action must be implemented outside the standard sync loop.
