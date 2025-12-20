import DOMPurify from 'dompurify';

/**
 * Sanitiza HTML para prevenir XSS
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

/**
 * Sanitiza texto removendo todo HTML
 */
export function sanitizeText(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] });
}

/**
 * Sanitiza input de usuário (nome, mensagens, etc)
 */
export function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  
  // Remove tags HTML e limita tamanho
  const clean = DOMPurify.sanitize(input.trim(), { ALLOWED_TAGS: [] });
  
  // Remove caracteres de controle
  return clean.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 500);
}

/**
 * Sanitiza ID de sala
 */
export function sanitizeRoomId(roomId: string): string {
  if (!roomId || typeof roomId !== 'string') return '';
  
  // Apenas alfanuméricos, underscore e hífen
  return roomId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
}
