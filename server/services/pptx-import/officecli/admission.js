const { gatewayError } = require('./errors')

class WeightedAdmissionController {
  constructor({ capacity = 1, maxQueue = 16 } = {}) {
    this.capacity = capacity
    this.maxQueue = maxQueue
    this.used = 0
    this.queue = []
    this.closed = false
  }

  reserve({ weight = 1, signal } = {}) {
    if (!Number.isSafeInteger(weight) || weight < 1 || weight > this.capacity) {
      return Promise.reject(gatewayError('INVALID_WEIGHT', 'Invalid admission weight'))
    }
    if (this.closed) return Promise.reject(gatewayError('ADMISSION_CLOSED', 'Admission is closed'))
    if (signal?.aborted) return Promise.reject(gatewayError('CANCELLED', 'Operation cancelled'))
    if (this.used + weight <= this.capacity && this.queue.length === 0) {
      this.used += weight
      return Promise.resolve(this.releaseHandle(weight))
    }
    if (this.queue.length >= this.maxQueue) {
      return Promise.reject(gatewayError('QUEUE_FULL', 'Host work queue is full', { retryable: true }))
    }
    return new Promise((resolve, reject) => {
      const item = { weight, resolve, reject, signal }
      const abort = () => {
        this.queue = this.queue.filter((queued) => queued !== item)
        reject(gatewayError('CANCELLED', 'Operation cancelled'))
      }
      item.abort = abort
      signal?.addEventListener('abort', abort, { once: true })
      this.queue.push(item)
    })
  }

  releaseHandle(weight) {
    let released = false
    return () => {
      if (released) return
      released = true
      this.used -= weight
      this.drain()
    }
  }

  drain() {
    while (this.queue.length && this.used + this.queue[0].weight <= this.capacity) {
      const item = this.queue.shift()
      item.signal?.removeEventListener('abort', item.abort)
      this.used += item.weight
      item.resolve(this.releaseHandle(item.weight))
    }
  }

  close() {
    this.closed = true
    for (const item of this.queue.splice(0)) {
      item.signal?.removeEventListener('abort', item.abort)
      item.reject(gatewayError('ADMISSION_CLOSED', 'Admission is closed'))
    }
  }
}

const sharedHostAdmission = new WeightedAdmissionController()

module.exports = { WeightedAdmissionController, sharedHostAdmission }
