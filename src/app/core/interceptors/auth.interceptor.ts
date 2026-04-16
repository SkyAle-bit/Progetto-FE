import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Non aggiungiamo il bearer token alle chiamate di autenticazione pubbliche.
  if (req.url.includes('/api/auth/')) {
    return next(req);
  }

  const token = globalThis.localStorage?.getItem('token');

  if (!token) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authReq);
};

