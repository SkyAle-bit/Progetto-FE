import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // 1. Recupera il token salvato durante il login
  const token = localStorage.getItem('token');

  // 2. Se il token esiste, "clona" la richiesta e aggiunge l'header Authorization
  if (token) {
    const clonedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    // Manda la richiesta modificata al backend
    return next(clonedRequest);
  }

  // 3. Se non c'è il token, fai passare la richiesta normalmente
  return next(req);
};
