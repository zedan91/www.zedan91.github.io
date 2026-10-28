# (1414) Safe permanent gallery uploads

Includes the complete drag/drop, ordering and Firestore prize-record workflow.
New gallery saves require uploaded files to reach permanent Cloudinary storage.
If that service rejects a file, the request fails before writing the prize record;
the admin's browser keeps the draft files/order for retry. It no longer publishes
temporary Render upload URLs as though the upload were complete. Legacy clients
retain their existing fallback behavior.

Live upload verification discovered the existing Cloudinary configuration returns
"Unknown API key". The current five-image Philips prize was restored using its
original permanent website URLs and saved to Firestore. Cloudinary account login
is needed to repair its upload settings; no secrets belong in chat or the ZIP.

20 targeted tests pass, including the production route returning 503 without
writing the gallery when permanent storage rejects a file.
