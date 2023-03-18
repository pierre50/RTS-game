export function throttle(callback, wait, immediate = false) {
  let timeout = null
  let initialCall = true

  return function () {
    const callNow = immediate && initialCall
    const next = () => {
      callback.apply(this, arguments)
      timeout = null
    }

    if (callNow) {
      initialCall = false
      next()
    }

    if (!timeout) {
      timeout = setTimeout(next, wait)
    }
  }
}

export const debounce = (callback, wait) => {
  let timeoutId = null
  return function () {
    window.clearTimeout(timeoutId)
    timeoutId = window.setTimeout(() => {
      callback.apply(this, arguments)
    }, wait)
  }
}
