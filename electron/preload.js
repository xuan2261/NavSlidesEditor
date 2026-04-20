/**
 * Electron preload script — exposes secure IPC bridge to renderer process.
 * Used for credential management via safeStorage.
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Save a credential securely via OS keychain (Electron safeStorage).
   * @param {string} key   - Credential key (e.g. 'github-token')
   * @param {string} value - Secret value to encrypt
   * @returns {Promise<boolean>} true if saved successfully
   */
  saveCredential: (key, value) => ipcRenderer.invoke('save-credential', key, value),

  /**
   * Retrieve a previously saved credential.
   * @param {string} key - Credential key
   * @returns {Promise<string|null>} Decrypted value or null
   */
  getCredential: (key) => ipcRenderer.invoke('get-credential', key),

  /**
   * Delete a stored credential.
   * @param {string} key - Credential key
   * @returns {Promise<boolean>} true if deleted
   */
  deleteCredential: (key) => ipcRenderer.invoke('delete-credential', key),

  /**
   * Check if secure storage (OS keychain) is available.
   * @returns {Promise<boolean>}
   */
  isSecureStorageAvailable: () => ipcRenderer.invoke('is-secure-storage-available'),
})
