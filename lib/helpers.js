// Funções utilitárias compartilhadas pelos casos de teste.

// Inteiro aleatório no intervalo [min, max] (ambos inclusivos).
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Texto aleatório simples para popular títulos/corpos de POST e PUT.
export function randomString(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz ';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out.trim();
}
