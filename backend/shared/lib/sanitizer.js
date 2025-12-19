const DOMPurify = require('isomorphic-dompurify');
const validator = require('validator');

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
  ALLOWED_ATTR: ['href', 'title'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  USE_PROFILES: { html: true },
  SANITIZE_DOM: true,
};

function sanitizeContent(content) {
  // Validação de entrada
  if (typeof content !== 'string') {
    throw new Error('Content must be a string');
  }
  
  // Limitar tamanho antes de processar
  const truncated = content.substring(0, 10000);
  
  // Normalizar Unicode para prevenir bypass
  const normalized = truncated.normalize('NFC');
  
  // Sanitização profunda com DOMPurify
  const sanitized = DOMPurify.sanitize(normalized, SANITIZE_CONFIG);
  
  // Escape adicional de caracteres especiais
  return validator.escape(sanitized).substring(0, 5000);
}

function sanitizeUserName(userName) {
  if (typeof userName !== 'string') {
    return 'Anonymous';
  }
  
  // Remover caracteres especiais e limitar tamanho
  return userName
    .replace(/[<>\"'&]/g, '')
    .trim()
    .substring(0, 100) || 'Anonymous';
}

module.exports = {
  sanitizeContent,
  sanitizeUserName
};