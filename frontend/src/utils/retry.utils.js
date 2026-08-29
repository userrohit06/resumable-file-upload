export const retry = async (
  operation,
  maxRetries = 3,
  baseDelay = 1000,
  onRetry,
) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Intentional cancellation
      // Never retry an aborted request
      if (error.code === "ERR_CANCELED" || error.name === "CanceledError") {
        throw error;
      }

      if (attempt === maxRetries) {
        throw lastError;
      }

      const retryNumber = attempt + 1;
      const delay = baseDelay * Math.pow(2, attempt);

      onRetry?.({
        retryNumber,
        maxRetries,
        delay,
        error,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};
