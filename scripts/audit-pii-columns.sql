-- Auditoria SOLO LECTURA (MED-3): cuenta filas con PII que NO parece cifrado.
-- Cifrado esperado: 'gcm:ivHex:authTagHex:ciphertextHex' o legacy CBC 'ivHex:cipherHex'.
-- No devuelve valores, solo conteos.
SELECT
  COUNT(*) FILTER (WHERE iban IS NOT NULL) AS iban_total,
  COUNT(*) FILTER (WHERE iban IS NOT NULL AND iban NOT LIKE 'gcm:%' AND iban !~ '^[0-9a-f:]+$') AS iban_posible_plano,
  COUNT(*) FILTER (WHERE "socialSecurityNumber" IS NOT NULL) AS ssn_total,
  COUNT(*) FILTER (WHERE "socialSecurityNumber" IS NOT NULL AND "socialSecurityNumber" NOT LIKE 'gcm:%' AND "socialSecurityNumber" !~ '^[0-9a-f:]+$') AS ssn_posible_plano,
  COUNT(*) FILTER (WHERE dni IS NOT NULL) AS dni_total,
  COUNT(*) FILTER (WHERE "dniEnc" IS NOT NULL) AS dni_enc_poblado
FROM "Employee";
