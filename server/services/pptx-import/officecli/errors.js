class OfficeCliGatewayError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'OfficeCliGatewayError'
    this.code = code
    this.retryable = Boolean(details.retryable)
    this.safeDetails = details.safeDetails || null
  }
}

function gatewayError(code, message, details) {
  return new OfficeCliGatewayError(code, message, details)
}

module.exports = { OfficeCliGatewayError, gatewayError }
