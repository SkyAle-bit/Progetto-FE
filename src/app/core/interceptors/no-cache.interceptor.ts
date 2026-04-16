import { HttpInterceptorFn } from '@angular/common/http';

export const noCacheInterceptor: HttpInterceptorFn = (req, next) => {
  // Gli header anti-cache sono utili soprattutto sulle richieste di lettura.
  if (req.method !== 'GET') {
    return next(req);
  }

  const noCacheReq = req.clone({
    setHeaders: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0'
    }
  });

  return next(noCacheReq);
};

