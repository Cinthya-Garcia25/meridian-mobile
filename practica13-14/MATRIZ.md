# Matriz de automatización

- **AUT-01 · Unitarias · Aprobado.** Acepta una salida el mismo día y permite omitir el regreso.
- **AUT-02 · Unitarias · Aprobado.** Rechaza destino vacío o en blanco, salida anterior a hoy y regreso anterior a la salida.
- **AUT-03 · Unitarias · Aprobado.** Recupera el identificador tras un error transitorio y propaga la excepción original al agotar los intentos.
- **AUT-04 · Integración · Aprobado.** El componente y el servicio envían los argumentos esperados, reciben HTTP 200 simulado y confirman el identificador.
- **AUT-05 · Integración · Aprobado.** HTTP 401 simulado informa del vencimiento de sesión en un intento. El fallo de red simulado conserva los datos y el UUID para el reenvío.
- **AUT-06 · Persistencia · Aprobado.** Dos llamadas SQL con el mismo UUID devuelven el mismo ID y dejan exactamente una fila con los datos esperados.
- **AUT-07 · CI · Aprobado.** La primera ejecución automática aprobó Angular y PostgreSQL en 34 s. [Ejecución 44205532964](https://github.com/Cinthya-Garcia25/meridian-mobile/actions/runs/44205532964).
- **AUT-08 · CI · Aprobado.** El segundo push volvió a ejecutar y aprobar Angular y PostgreSQL en 41 s. [Ejecución 44205734798](https://github.com/Cinthya-Garcia25/meridian-mobile/actions/runs/44205734798).

[Registro local](ejecucion-local.log) · [Historial de CI](https://github.com/Cinthya-Garcia25/meridian-mobile/actions/workflows/pruebas-moviles.yml?query=branch%3Acodex%2Fpracticas-13-14)
