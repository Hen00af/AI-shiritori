import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.timeout = setTimeout(() => {
      this.remove()
    }, 3000)
  }

  disconnect() {
    clearTimeout(this.timeout)
  }

  remove() {
    this.element.remove()
  }
}