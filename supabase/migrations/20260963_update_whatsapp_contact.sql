UPDATE store_settings
SET whatsapp = '+213 541 38 30 93'
WHERE whatsapp IS NULL
   OR whatsapp = ''
   OR whatsapp = '050545968';