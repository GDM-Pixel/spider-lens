export default {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: [],
  testMatch: ['**/tests/**/*.test.js'],
  // Node 18+ gère les ES modules natifs avec --experimental-vm-modules
  // mais les imports relatifs doivent avoir l'extension .js
}
