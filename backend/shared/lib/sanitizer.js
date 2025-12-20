/**
 * Módulo de Sanitização - SEC-003
 * Previne XSS, SQL Injection e outros ataques de injection
 */

const htmlEntities = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"'`=\/]/g, char => htmlEntities[char]);
}

function stripTags(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

function sanitizeContent(content, options = {}) {
  if (typeof content !== 'string') return '';
  
  const { maxLength = 10000, allowHtml = false, trimWhitespace = true } = options;
  let sanitized = content.substring(0, maxLength);
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  if (!allowHtml) {
    sanitized = stripTags(sanitized);
    sanitized = escapeHtml(sanitized);
  }
  
  if (trimWhitespace) sanitized = sanitized.trim();
  return sanitized;
}

function sanitizeUserName(userName) {
  if (typeof userName !== 'string') return 'Anônimo';
  let sanitized = userName.substring(0, 50);
  sanitized = sanitized.replace(/[<>'"`;(){}[\]\\\/]/g, '');
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  sanitized = sanitized.trim().replace(/\s+/g, ' ');
  return sanitized.length < 1 ? 'Anônimo' : sanitized;
}

function sanitizeId(id) {
  if (typeof id !== 'string') return '';
  return id.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 100);
}

module.exports = { sanitizeContent, sanitizeUserName, sanitizeId, escapeHtml, stripTags };
