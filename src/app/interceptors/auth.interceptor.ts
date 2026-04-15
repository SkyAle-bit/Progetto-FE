import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Intercepts HTTP requests to dynamically inject the JWT Authorization token,
 * allowing secure access to protected endpoints without manual token appending.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');

  if (token) {
    const clonedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(clonedRequest);
  }

  return next(req);
};
