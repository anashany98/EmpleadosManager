# SSL Certificate Setup Script (PowerShell)
# Usage: .\setup-ssl.ps1 [-Domain "yourdomain.com"]

param(
    [string]$Domain = "localhost"
)

$SSL_DIR = ".\nginx\ssl"

Write-Host "Setting up SSL certificates for: $Domain" -ForegroundColor Green

# Create SSL directory if it doesn't exist
if (-not (Test-Path $SSL_DIR)) {
    New-Item -ItemType Directory -Path $SSL_DIR -Force | Out-Null
}

# Check if OpenSSL is available
$openssl = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $openssl) {
    Write-Host "OpenSSL not found. Please install OpenSSL or use WSL." -ForegroundColor Red
    Write-Host "Download from: https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor Yellow
    exit 1
}

# Generate self-signed certificate (for development/testing)
Write-Host "Generating self-signed certificate..." -ForegroundColor Yellow

& openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
    -keyout "$SSL_DIR/privkey.pem" `
    -out "$SSL_DIR/fullchain.pem" `
    -subj "/C=ES/ST=Madrid/L=Madrid/O=EmpleadosManager/CN=$Domain" `
    -addext "subjectAltName=DNS:$Domain,DNS:www.$Domain"

Write-Host ""
Write-Host "SSL certificates generated successfully!" -ForegroundColor Green
Write-Host "Certificate: $SSL_DIR/fullchain.pem"
Write-Host "Private Key: $SSL_DIR/privkey.pem"
Write-Host ""
Write-Host "For production, replace with Let's Encrypt certificates:" -ForegroundColor Yellow
Write-Host "  certbot certonly --nginx -d $Domain"
Write-Host ""
Write-Host "Then copy certificates to $SSL_DIR/"
