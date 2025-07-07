# Security Guidelines for Marketing Agent

## Critical Security Measures Implemented

### 1. Environment Variables

All sensitive configuration values are now managed through environment variables:

- **Backend**: Copy `backend/.env.example` to `backend/.env` and fill in your values
- **Frontend**: Copy `frontend/.env.example` to `frontend/.env.local` and fill in your values

**NEVER commit .env files to version control!**

### 2. Required Security Actions

#### Immediate Actions Required:

1. **Revoke Exposed OpenAI API Key**
   - The OpenAI API key that was previously hardcoded has been exposed
   - Visit https://platform.openai.com/api-keys immediately
   - Revoke the old key and generate a new one
   - Update `backend/.env` with the new key

2. **Generate Secure Secrets**
   ```bash
   # Generate JWT Secret
   openssl rand -hex 32
   
   # Generate NextAuth Secret
   openssl rand -base64 32
   
   # Generate Webhook Secret
   openssl rand -hex 32
   ```

3. **Update Database Credentials**
   - Change the default PostgreSQL password
   - Update `DATABASE_URL` in `backend/.env`

### 3. Environment Variable Validation

- **Backend**: The application will refuse to start if critical environment variables are missing or using default values
- **Frontend**: NextAuth will throw an error if `NEXTAUTH_SECRET` is not set

### 4. Security Best Practices

1. **Never hardcode secrets** in source code
2. **Use strong, random values** for all secrets
3. **Rotate secrets regularly**, especially after any potential exposure
4. **Use different secrets** for different environments (dev, staging, prod)
5. **Limit access** to production secrets to only necessary personnel
6. **Monitor** for exposed secrets using tools like GitHub secret scanning

### 5. Secret Management Recommendations

For production environments, consider using:
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault
- Google Secret Manager

### 6. Gitignore Configuration

The following patterns are configured to prevent accidental commits:
- `**/.env` - All .env files in any directory
- `**/.env.*` - All .env variants except .example files
- `*.key`, `*.pem`, `*.cert` - Private keys and certificates
- `secrets/`, `keys/` - Directories containing secrets

### 7. Monitoring and Alerts

Configure monitoring for:
- Failed authentication attempts
- Unusual API usage patterns
- Exposed secrets in logs
- Webhook validation failures

## Security Checklist for Deployment

- [ ] All .env files created from .env.example templates
- [ ] All secrets are strong, random values (no defaults)
- [ ] OpenAI API key has been rotated
- [ ] Database password has been changed from default
- [ ] NEXTAUTH_SECRET is set and secure
- [ ] JWT_SECRET is set and secure
- [ ] WEBHOOK_SECRET is set and secure
- [ ] .env files are NOT in version control
- [ ] Production uses a proper secret management service
- [ ] SSL/TLS is configured for all endpoints
- [ ] Regular security audits are scheduled

## Reporting Security Issues

If you discover a security vulnerability, please report it to:
- Email: security@yourdomain.com
- Do NOT create public GitHub issues for security vulnerabilities