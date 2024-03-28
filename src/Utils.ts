export const Utils = (() => {
  return {
     retryOnError: (f, error, t = 250) => {
      while (true) {
        try {
          return f()
        } catch (err) {
          if (err instanceof error) {
            Utilities.sleep(t)
          }
          throw err
        }
      }
    },
     waitNTimesOnCondition: (n, c, t = 250) => {
      for (let i = 0; i < n; i++) {
        if (c()) {
          return true
        }
        Utilities.sleep(t)
      }
      return false
    }
  }
})()
