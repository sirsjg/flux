/**
 * Global error handlers for development
 * Makes all errors surface immediately with full context
 */

interface ErrorWithStack {
  message?: string;
  stack?: string;
}

function isErrorWithStack(value: unknown): value is ErrorWithStack {
  return typeof value === 'object' && value !== null;
}

if (import.meta.env.DEV) {
  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    const reasonStack = isErrorWithStack(reason) ? reason.stack : undefined;

    console.error('🚨 Unhandled Promise Rejection:', {
      reason,
      promise: event.promise,
      stack: reasonStack,
      timestamp: new Date().toISOString(),
    });

    // Optionally show visual overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #ff0000;
      color: white;
      padding: 20px;
      z-index: 999999;
      font-family: monospace;
      white-space: pre-wrap;
    `;

    const reasonMessage = isErrorWithStack(reason) && typeof reason.message === 'string'
      ? reason.message
      : String(reason);
    const reasonStackStr = isErrorWithStack(reason) && typeof reason.stack === 'string'
      ? reason.stack
      : '';

    overlay.textContent = `🚨 Unhandled Promise Rejection\n${reasonMessage}\n\n${reasonStackStr}`;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'margin-top: 10px; padding: 5px 10px; cursor: pointer;';
    closeBtn.onclick = () => overlay.remove();
    overlay.appendChild(closeBtn);

    document.body.appendChild(overlay);
  });

  // Catch regular errors
  window.addEventListener('error', (event) => {
    const error: unknown = event.error;
    const errorStack = isErrorWithStack(error) ? error.stack : undefined;

    console.error('🚨 Unhandled Error:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error,
      stack: errorStack,
      timestamp: new Date().toISOString(),
    });
  });

  console.log('✅ Dev error handlers installed');
}
